"""Offline NYC CSCL / building conversion. The runtime never requests the source service."""
import math
import base64
import json
import struct
from pathlib import Path

SURVEY_FOOT = 1200 / 3937


def local_point(point, origin, wkid):
    if wkid not in (2263, 102718):
        raise ValueError('Expected NAD83 New York Long Island US survey feet, EPSG:2263')
    return {'x': (point[0] - origin[0]) * SURVEY_FOOT,
            'z': -(point[1] - origin[1]) * SURVEY_FOOT}


def roof_height(value):
    missing = value is None or not math.isfinite(float(value)) or float(value) <= 0
    source = None if missing else float(value) * .3048
    return {'height': 12 if missing else round(min(96, max(4.5, source)), 3),
            'fallback': missing, 'sourceHeight': source}


def access_flags(attributes, district):
    if attributes.get('STATUS') != '2' or attributes.get('FROM_LEVEL_CODE') != 13 or attributes.get('TO_LEVEL_CODE') != 13:
        return None
    if str(attributes.get('FCC')) in ('1', '2', '8', '9'):
        return None
    direction = attributes.get('TRAFDIR')
    if direction not in ('FT', 'TF', 'TW', 'NV'):
        return None
    name = attributes.get('FULL_STREET_NAME', '')
    car = direction != 'NV' and attributes.get('ACCESSIBLE') not in ('2', '3', '4')
    foot = attributes.get('NONPED') not in ('V', 'D')
    restriction = ''
    if district == 'flushing' and name in ('MAIN ST', 'KISSENA BLVD'):
        car = False
        restriction = 'Main Street busway, 06:00-19:00. Prototype cars use adjacent streets.'
    if name in ('DOYERS ST', 'LIPPMANN PLZ'):
        car = False
        restriction = 'Pedestrian plaza'
    return {'car': car, 'foot': foot, 'direction': direction, 'restriction': restriction}


def distance(a, b):
    return math.hypot(a['x'] - b['x'], a['z'] - b['z'])


def project(point, a, b):
    dx, dz = b['x'] - a['x'], b['z'] - a['z']
    fraction = max(0, min(1, ((point['x'] - a['x']) * dx + (point['z'] - a['z']) * dz) / (dx * dx + dz * dz or 1)))
    result = {'x': a['x'] + dx * fraction, 'z': a['z'] + dz * fraction}
    return result, fraction, distance(point, result)


def inside(point, polygon):
    result = False
    for index, a in enumerate(polygon):
        b = polygon[index - 1]
        if (a['z'] > point['z']) != (b['z'] > point['z']) and point['x'] < (b['x'] - a['x']) * (point['z'] - a['z']) / (b['z'] - a['z']) + a['x']:
            result = not result
    return result


def transform(origin, yaw, x, z):
    angle = math.radians(yaw)
    return {'x': origin['x'] + x * math.cos(angle) + z * math.sin(angle),
            'z': origin['z'] - x * math.sin(angle) + z * math.cos(angle)}


def polygon_area(points):
    return sum(p['x'] * points[(i + 1) % len(points)]['z'] - points[(i + 1) % len(points)]['x'] * p['z'] for i, p in enumerate(points)) / 2


def clean_ring(points):
    clean = []
    for point in points:
        if not clean or distance(clean[-1], point) > .03:
            clean.append(point)
    if distance(clean[0], clean[-1]) < .03:
        clean.pop()
    changed = True
    while changed and len(clean) > 3:
        changed = False
        for index, b in enumerate(clean):
            a, c = clean[index - 1], clean[(index + 1) % len(clean)]
            if project(b, a, c)[2] < .015:
                clean.pop(index)
                changed = True
                break
    return clean


def polygon_distance(first,second):
    if any(inside(point,second) for point in first) or any(inside(point,first) for point in second):
        return 0
    return min(project(point,a,ring[(index+1)%len(ring)])[2]
               for points,ring in [(first,second),(second,first)]
               for point in points for index,a in enumerate(ring))


def roof_triangles(points):
    indices = list(range(len(points)))
    if polygon_area(points) < 0:
        indices.reverse()
    triangles = []
    def cross(a, b, c):
        return (b['x'] - a['x']) * (c['z'] - a['z']) - (b['z'] - a['z']) * (c['x'] - a['x'])
    while len(indices) > 3:
        for index, middle in enumerate(indices):
            left, right = indices[index - 1], indices[(index + 1) % len(indices)]
            a, b, c = points[left], points[middle], points[right]
            if cross(a, b, c) <= .000001:
                continue
            contained = any(cross(a, b, points[other]) >= -.000001 and cross(b, c, points[other]) >= -.000001 and cross(c, a, points[other]) >= -.000001
                            for other in indices if other not in (left, middle, right))
            if contained:
                continue
            triangles.extend([left, right, middle])  # Upward normal in X/Y/Z.
            indices.pop(index)
            break
        else:
            raise ValueError('Cannot triangulate an invalid footprint')
    triangles.extend([indices[0], indices[2], indices[1]])
    return triangles


def write_building_gltf(path, buildings, places, name, sample_id=None):
    groups = [{'positions': [], 'normals': [], 'uvs': [], 'indices': []} for _ in range(4)]
    def wall(a, b, bottom, height, material, outward):
        group = groups[material]
        dx, dz = b['x'] - a['x'], b['z'] - a['z']
        length = math.hypot(dx, dz)
        if length < .001 or height <= bottom:
            return
        first = len(group['positions']) // 3
        normal = [dz / length * outward, 0, -dx / length * outward]
        for p, y, u in [(a, bottom, 0), (a, height, 0), (b, bottom, length / 4.8), (b, height, length / 4.8)]:
            group['positions'].extend([p['x'], y, p['z']])
            group['normals'].extend(normal)
            group['uvs'].extend([u, y / 6.4])
        order = [0, 1, 2, 1, 3, 2] if outward > 0 else [0, 2, 1, 1, 2, 3]
        group['indices'].extend(first + index for index in order)
    for building in buildings:
        polygon = building['footprint']
        outward = 1 if polygon_area(polygon) > 0 else -1
        entrances = [place for place in places if place['buildingId'] == building['id']]
        for index, a in enumerate(polygon):
            b = polygon[(index + 1) % len(polygon)]
            entrance = next((place for place in entrances if place['frontageEdge'] == index), None)
            if entrance:
                length = distance(a, b)
                _, middle, _ = project(entrance['entry'], a, b)
                opening = entrance.get('width', 1.6)
                low, high = middle - opening / length / 2, middle + opening / length / 2
                left = {'x': a['x'] + (b['x'] - a['x']) * low, 'z': a['z'] + (b['z'] - a['z']) * low}
                right = {'x': a['x'] + (b['x'] - a['x']) * high, 'z': a['z'] + (b['z'] - a['z']) * high}
                wall(a, left, 0, building['height'], building['style'], outward)
                wall(left, right, 3.15 if 'counter' in entrance else 2.7, building['height'], building['style'], outward)
                wall(right, b, 0, building['height'], building['style'], outward)
            else:
                wall(a, b, 0, building['height'], building['style'], outward)
        roof = groups[3]
        first = len(roof['positions']) // 3
        for point in polygon:
            roof['positions'].extend([point['x'], building['height'], point['z']])
            roof['normals'].extend([0, 1, 0])
            roof['uvs'].extend([point['x'] / 8, point['z'] / 8])
        roof['indices'].extend(first + index for index in roof_triangles(polygon))
    binary = bytearray()
    views, accessors, primitives = [], [], []
    def accessor(values, size, component_type, code, target, limits=False):
        while len(binary) % 4:
            binary.append(0)
        start = len(binary)
        binary.extend(struct.pack('<' + code * len(values), *values))
        views.append({'buffer': 0, 'byteOffset': start, 'byteLength': len(binary) - start, 'target': target})
        info = {'bufferView': len(views) - 1, 'componentType': component_type,
                'count': len(values) // size, 'type': {1: 'SCALAR', 2: 'VEC2', 3: 'VEC3'}[size]}
        if limits:
            info['min'] = [min(values[index::size]) for index in range(size)]
            info['max'] = [max(values[index::size]) for index in range(size)]
        accessors.append(info)
        return len(accessors) - 1
    for material, group in enumerate(groups):
        if not group['positions']:
            continue
        attributes = {'POSITION': accessor(group['positions'], 3, 5126, 'f', 34962, True),
                      'NORMAL': accessor(group['normals'], 3, 5126, 'f', 34962),
                      'TEXCOORD_0': accessor(group['uvs'], 2, 5126, 'f', 34962)}
        wide = max(group['indices']) > 65535
        indices = accessor(group['indices'], 1, 5125 if wide else 5123, 'I' if wide else 'H', 34963)
        primitives.append({'attributes': attributes, 'indices': indices, 'material': material})
    model = {'asset': {'version': '2.0', 'generator': 'NY-delivery offline NYC footprint converter'},
             'scene': 0, 'scenes': [{'name': name, 'nodes': [0]}], 'nodes': [{'name': name, 'mesh': 0}],
             'meshes': [{'name': name, 'primitives': primitives}], 'bufferViews': views, 'accessors': accessors,
             'buffers': [{'byteLength': len(binary), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(binary).decode()}],
             'materials': [{'name': 'NYC wall ' + str(index) if index < 3 else 'NYC roof',
                            'pbrMetallicRoughness': {'baseColorFactor': color + [1], 'roughnessFactor': .9, 'metallicFactor': 0}}
                           for index, color in enumerate([[.57, .44, .35], [.63, .61, .52], [.42, .31, .27], [.26, .30, .30]])],
             'extras': {'units': 'metres', 'buildingId': sample_id, 'source': 'NYC OTI Building Footprints'}}
    Path(path).write_text(json.dumps(model, separators=(',', ':')))
