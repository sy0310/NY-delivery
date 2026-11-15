#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reproducible offline extraction from cropped NYC ArcGIS snapshots in .local/map-source."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import urllib.parse
import urllib.request
from transit_data import fetch_transit, add_transit
from district_data import access_flags, clean_ring, distance, inside, local_point, polygon_area, polygon_distance, project, roof_height, transform, write_building_gltf

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / '.local/map-source'
FOOTPRINTS = 'https://services6.arcgis.com/yG5s3afENB5iO9fj/arcgis/rest/services/BUILDING_view/FeatureServer/0'
STREETS = 'https://services6.arcgis.com/yG5s3afENB5iO9fj/arcgis/rest/services/Centerline_view/FeatureServer/0'
FLUSHING_FACES = [
    [84125, 5122, -91833, -83899],
    [91833, 5121, -9328, -83900],
    [9328, 5120, -100107, -83901],
    [84124, 102464, -91832, -5122],
    [91832, 91831, 91830, 16802, -9330, -9329, -5121],
]

CHINATOWN_FACES = [[1782, 79920, -1839, -204036, -1836, 140948], [-1782, -140864, -140946, -182263, -182381, 182376, 79921], [1836, -173243, -197225, -140868, 140863, 1837], [-1837, 140864, -140948], [-1840, -79920, -79921, -99642, 16665], [16666, 99642, -182376, -166808], [16708, -69123, -140866, 140870, 140869], [-69124, 101099, 140866], [-4258, -91633, 69123, 16707], [-101099, -140885, 140946, -140863, 140865], [140885, -182384, -207604, -182380, 182381, 182263]]


def fetch_snapshot(district, bounds):
    RAW.mkdir(parents=True, exist_ok=True)
    for kind, service, fields in [
        ('streets', STREETS, 'OBJECTID,PHYSICALID,FULL_STREET_NAME,TRAFDIR,STREETWIDTH,STATUS,ACCESSIBLE,NONPED,FCC,RW_TYPE,FROM_LEVEL_CODE,TO_LEVEL_CODE,SEGMENT_TYPE,SEGMENT_TYPE_VALUE'),
        ('buildings', FOOTPRINTS, 'OBJECTID,BIN,HEIGHT_ROOF,FEATURE_CODE'),
    ]:
        query = {'f': 'json', 'geometryType': 'esriGeometryEnvelope', 'geometry': ','.join(map(str, bounds)),
                 'inSR': '4326', 'outSR': '2263', 'spatialRel': 'esriSpatialRelIntersects', 'where': '1=1',
                 'outFields': fields, 'returnGeometry': 'true', 'resultRecordCount': 2000}
        url = service + '/query?' + urllib.parse.urlencode(query)
        data = json.load(urllib.request.urlopen(url))
        if 'error' in data or data.get('exceededTransferLimit'):
            raise ValueError('Source error or truncated response. Paginate before converting.')
        (RAW / f'{district}-{kind}.json').write_text(json.dumps(data))
        (RAW / f'{district}-{kind}-url.txt').write_text(url)
    (RAW / f'{district}-retrieved.txt').write_text(datetime.now(timezone.utc).isoformat())


def rounded(point):
    return {axis: round(point[axis], 3) for axis in ('x', 'z')}


def chain(roads, signed_ids):
    points = []
    for identity in signed_ids:
        part = roads[abs(identity)]['points']
        if identity < 0:
            part = list(reversed(part))
        if points and distance(points[-1], part[0]) > .02:
            raise ValueError(f'Disconnected outline at {identity}')
        points.extend(part if not points else part[1:])
    return clean_ring(points)


def hull(points):
    coordinates=sorted(set((point['x'],point['z']) for point in points))
    def cross(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    chains=[]
    for ordered in (coordinates,list(reversed(coordinates))):
        chain=[]
        for point in ordered:
            while len(chain)>1 and cross(chain[-2],chain[-1],point)<=0: chain.pop()
            chain.append(point)
        chains.extend(chain[:-1])
    return [{'x':x,'z':z} for x,z in chains]


def boundary_for(roads, faces):
    counts = Counter(abs(identity) for face in faces for identity in face)
    remaining = [roads[identity]['points'] for identity, count in counts.items() if count == 1]
    points = list(remaining.pop(0))
    while remaining:
        for index, part in enumerate(remaining):
            if distance(points[-1], part[0]) < .02:
                points.extend(part[1:])
                remaining.pop(index)
                break
            if distance(points[-1], part[-1]) < .02:
                points.extend(list(reversed(part))[1:])
                remaining.pop(index)
                break
        else:
            raise ValueError('Unclosed playable boundary')
    return clean_ring(points)


def point_on_road(road, fraction):
    lengths = [distance(a, b) for a, b in zip(road['points'], road['points'][1:])]
    travel = sum(lengths) * fraction
    for index, length in enumerate(lengths):
        if travel <= length or index == len(lengths) - 1:
            a, b = road['points'][index:index + 2]
            t = travel / length
            return {'x': a['x'] + (b['x'] - a['x']) * t, 'z': a['z'] + (b['z'] - a['z']) * t}, a, b
        travel -= length
    raise ValueError('Empty road')


def place_on_frontage(buildings, road, fraction, side, identity, name, used, shop=False, lobby=False, shop_width=6.8):
    desired, road_a, road_b = point_on_road(road, fraction)
    dx, dz = road_b['x'] - road_a['x'], road_b['z'] - road_a['z']
    length = math.hypot(dx, dz)
    right = (-dz / length, dx / length)
    width, depth = (shop_width, 7) if shop else (3.2, 3) if lobby else (1.8, 0)
    candidates = []
    for building in buildings:
        if building['id'] in used or building['block'].startswith('context'):
            continue
        ring = building['footprint']
        for index, a in enumerate(ring):
            b = ring[(index + 1) % len(ring)]
            edge_length = distance(a, b)
            if edge_length < width + .4:
                continue
            alignment = abs(((b['x'] - a['x']) * dx + (b['z'] - a['z']) * dz) / (edge_length * length))
            if alignment < .8:
                continue
            _, progress, _ = project(desired, a, b)
            margin = (width / 2 + .1) / edge_length
            progress = max(margin, min(1 - margin, progress))
            entry = {'x': a['x'] + (b['x'] - a['x']) * progress, 'z': a['z'] + (b['z'] - a['z']) * progress}
            centre, road_fraction, distance_to_road = project(entry, road_a, road_b)
            offset = (entry['x'] - centre['x']) * right[0] + (entry['z'] - centre['z']) * right[1]
            if offset * side < 0 or distance_to_road > road['width'] / 2 + 14 or not .08 < road_fraction < .92:
                continue
            yaw = math.degrees(math.atan2(-(b['z'] - a['z']), b['x'] - a['x']))
            if not inside(transform(entry, yaw, 0, .4), ring):
                yaw += 180
            if depth and not all(inside(transform(entry, yaw, x, z), ring)
                                 for x in (-width / 2 + .15, width / 2 - .15) for z in (.3, depth - .2)):
                continue
            if inside(transform(entry,yaw,0,-.5),ring):
                continue
            steps=max(1,math.ceil(distance(centre,entry)/.4))
            corridor=[{'x':centre['x']+(entry['x']-centre['x'])*step/steps,
                       'z':centre['z']+(entry['z']-centre['z'])*step/steps} for step in range(steps+1)]
            if any(inside(point,other['footprint']) or min(project(point,a,other['footprint'][(j+1)%len(other['footprint'])])[2] for j,a in enumerate(other['footprint']))<.38
                   for other in buildings if other is not building for point in corridor):
                continue
            candidates.append((distance(desired, centre) + abs(distance_to_road - road['width'] / 2) * 2,
                               building, index, entry, centre, yaw))
    if not candidates:
        raise ValueError('No valid frontage for ' + identity)
    _, building, edge, entry, centre, yaw = sorted(candidates, key=lambda candidate: (candidate[0], candidate[1]['id']))[0]
    used.add(building['id'])
    result = {'id': identity, 'name': name, 'entry': rounded(entry), 'yaw': round(yaw, 4),
              'buildingId': building['id'], 'frontageEdge': edge, '_centre': centre, '_road': road['id']}
    if shop:
        result.update({'width': width, 'depth': depth, 'counter': rounded(transform(entry, yaw, 0, 4.6)),
                       'queue': rounded(transform(entry, yaw, -1.9, 3.3))})
    else:
        result.update({'target': rounded(transform(entry, yaw, 0, 1.2 if lobby else -1)),
                       'kind': 'lobby' if lobby else 'residence'})
        if lobby:
            result.update({'width': width, 'depth': depth})
    result['walkway'] = [rounded(centre), rounded(entry), result.get('counter', result.get('target'))]
    return result


def parking_for(place, road, fraction=None):
    if fraction is None:
        centre, _, _ = min((project(place['entry'], a, b) for a, b in zip(road['points'], road['points'][1:])), key=lambda item: item[2])
        _, a, b = point_on_road(road, .5)
    else:
        centre, a, b = point_on_road(road, fraction)
    dx, dz = b['x'] - a['x'], b['z'] - a['z']
    length = math.hypot(dx, dz)
    normal = (-dz / length, dx / length)
    sign = 1 if (place['entry']['x'] - centre['x']) * normal[0] + (place['entry']['z'] - centre['z']) * normal[1] >= 0 else -1
    offset = max(0, road['width'] / 2 - 1.7)
    place['parking'] = rounded({'x': centre['x'] + normal[0] * sign * offset, 'z': centre['z'] + normal[1] * sign * offset})
    half_width = road['width'] / 2 - .6
    return [rounded({'x': centre['x'] + dx / length * along + normal[0] * across,
                     'z': centre['z'] + dz / length * along + normal[1] * across})
            for along, across in [(-12, -half_width), (12, -half_width), (12, half_width), (-12, half_width)]]


def convert_region(region, face_ids, origin_id, prefix):
    streets = json.loads((RAW / f'{region}-streets.json').read_text())
    footprints = json.loads((RAW / f'{region}-buildings.json').read_text())
    source = {feature['attributes']['PHYSICALID']: feature for feature in streets['features']}
    origin = source[origin_id]['geometry']['paths'][0][0]
    selected = {abs(identity) for face in face_ids for identity in face} | ({101370} if region=='flushing' else set())
    roads = {}
    for identity in sorted(selected):
        feature = source[identity]
        attributes = feature['attributes']
        access = access_flags(attributes, region)
        if access is None:
            raise ValueError('Selected road is no longer an at-grade, constructed segment')
        path = []
        for part in feature['geometry']['paths']:
            if path and math.hypot(path[-1][0]-part[0][0],path[-1][1]-part[0][1]) > .05:
                raise ValueError('Disconnected multipart road needs source review')
            path.extend(part if not path else part[1:])
        points = [rounded(local_point(point, origin, streets['spatialReference']['latestWkid'])) for point in path]
        key = lambda point: f"{point['x']:.3f},{point['z']:.3f},13"
        roads[identity] = {'id': 'nyc-' + str(identity), 'name': attributes['FULL_STREET_NAME'],
                           'from': key(points[0]), 'to': key(points[-1]), 'points': points,
                           'width': round((attributes['STREETWIDTH'] or 30) * .3048, 3),
                           'levelFrom': 13, 'levelTo': 13, **access}
    faces = [chain(roads, face) for face in face_ids]
    boundary = boundary_for(roads, face_ids) if region=='flushing' else hull([point for face in faces for point in face])
    buildings = []
    for feature in footprints['features']:
        attributes = feature['attributes']
        if attributes['FEATURE_CODE'] != 2100:
            continue
        rings = [clean_ring([local_point(point, origin, footprints['spatialReference']['latestWkid']) for point in ring]) for ring in feature['geometry']['rings']]
        ring = max(rings, key=lambda points: abs(polygon_area(points)))
        if len(ring) < 3 or abs(polygon_area(ring)) < 8:
            continue
        centre = {'x': sum(point['x'] for point in ring) / len(ring), 'z': sum(point['z'] for point in ring) / len(ring)}
        block = next((prefix + str(index + 1) for index, face in enumerate(faces) if inside(centre, face)), None)
        if block is None and region=='chinatown' and inside(centre,boundary):
            block='C-infill'
        if block is None:
            nearest = polygon_distance(ring,boundary)
            if nearest > 45:
                continue
            block = 'context-' + str(math.floor(centre['x'] / 128)) + '-' + str(math.floor(centre['z'] / 128))
        buildings.append({'id': 'bin-' + str(attributes['BIN']), 'footprint': [rounded(point) for point in ring],
                          'block': block, 'style': attributes['BIN'] % 3, **roof_height(attributes['HEIGHT_ROOF'])})
    buildings.sort(key=lambda building: building['id'])
    used = set()
    if region == 'flushing':
        noodles = place_on_frontage(buildings, roads[83900], .45, -1, 'willow-noodles', 'Willow Noodle House', used, shop=True)
        noodles.update({'chineseName': '槐香面馆', 'menu': '1 × Hand-pulled noodles · 1 × Ginger tea'})
        dumplings = place_on_frontage(buildings, roads[5121], .52, -1, 'lantern-dumplings', 'Lantern Dumplings', used, shop=True)
        dumplings.update({'chineseName': '灯笼饺子', 'menu': '1 × Dumplings · 1 × Sesame noodles'})
        deliveries = [place_on_frontage(buildings, roads[84125], .72, 1, '38-avenue-residence', '38th Avenue residence', used),
                      place_on_frontage(buildings, roads[16802], .57, 1, 'union-lobby', 'Union Street lobby', used, lobby=True),
                      place_on_frontage(buildings, roads[91831], .63, 1, '39-avenue-door', '39th Avenue entrance', used)]
        places = [noodles, dumplings] + deliveries
        areas = [parking_for(noodles, roads[83900]), parking_for(dumplings, roads[91833], .82)]
        areas.extend([parking_for(deliveries[0], roads[84125]), parking_for(deliveries[1], roads[16802]), parking_for(deliveries[2], roads[91831])])
    else:
        noodles = place_on_frontage(buildings, roads[140864], .58, -1, 'pearl-noodles', 'Pearl Alley Noodles', used, shop=True, shop_width=4.6)
        noodles.update({'chineseName': '珍巷面馆', 'menu': '1 × Wonton noodles · 1 × Oolong tea'})
        dumplings = place_on_frontage(buildings, roads[79920], .5, -1, 'mott-dumplings', 'Mott Steam Kitchen', used, shop=True)
        dumplings.update({'chineseName': '莫街蒸馆', 'menu': '1 × Steam buns · 1 × Scallion noodles'})
        deliveries = [place_on_frontage(buildings, roads[69123], .55, 1, 'east-broadway-door', 'East Broadway entrance', used),
                      place_on_frontage(buildings, roads[4258], .68, -1, 'henry-lobby', 'Henry Street lobby', used, lobby=True),
                      place_on_frontage(buildings, roads[16665], .5, 1, 'mulberry-residence', 'Mulberry residence', used)]
        places = [noodles, dumplings] + deliveries
        areas = [parking_for(noodles, roads[140948], .45),parking_for(dumplings, roads[79920])]
        areas.extend([parking_for(deliveries[0], roads[69123]),parking_for(deliveries[1], roads[4258]),parking_for(deliveries[2], roads[16665])])
    for place in places:
        place.pop('_centre')
        place.pop('_road')
    spawn, a, b = point_on_road(roads[16802] if region=='flushing' else roads[69123], .18 if region=='flushing' else .8)
    yaw = math.degrees(math.atan2(-(b['x'] - a['x']), -(b['z'] - a['z'])))
    xs, zs = [point['x'] for point in boundary], [point['z'] for point in boundary]
    sources = []
    retrieved_file = RAW / f'{region}-retrieved.txt'
    if not retrieved_file.exists():
        retrieved_file.write_text(datetime.fromtimestamp((RAW / f'{region}-streets.json').stat().st_mtime, timezone.utc).isoformat())
    for kind in ('streets', 'buildings'):
        raw_file = RAW / f'{region}-{kind}.json'
        sources.append({'url': (RAW / f'{region}-{kind}-url.txt').read_text(), 'retrieved': retrieved_file.read_text().strip(),
                        'sha256': hashlib.sha256(raw_file.read_bytes()).hexdigest(),
                        'license': 'NYC Open Data terms, source/version/modifications retained'})
    district = {'id': region, 'name': '法拉盛 · Flushing' if region=='flushing' else '唐人街 · Chinatown', 'borough': 'Queens' if region=='flushing' else 'Manhattan', 'orderPrefix': 'FL' if region=='flushing' else 'CT', 'units': 'm',
                'origin': {'crs': 'EPSG:2263', 'coordinates': origin}, 'boundary': boundary,
                'bounds': {'minX': min(xs) - 35, 'maxX': max(xs) + 35, 'minZ': min(zs) - 35, 'maxZ': max(zs) + 35},
                'roads': list(roads.values()), 'buildings': buildings, 'restaurants': [noodles, dumplings], 'deliveries': deliveries,
                'parkingAreas': areas, 'spawn': {**rounded(spawn), 'yaw': yaw}, 'landmarks': [], 'sources': sources, 'blocks': []}
    return district


def export(district, class_name):
    add_transit(RAW,district)
    output = ROOT / 'game/assets/resources/districts' / district['id']
    output.mkdir(parents=True, exist_ok=True)
    places = district['restaurants'] + district['deliveries']
    sample = next(building for building in district['buildings'] if not building['block'].startswith('context') and building['id'] not in {place['buildingId'] for place in places})
    groups = {'sample-building': [sample]}
    for building in district['buildings']:
        if building is not sample:
            groups.setdefault(building['block'], []).append(building)
    for identity, buildings in sorted(groups.items()):
        write_building_gltf(output / (identity + '.gltf'), buildings, places, identity, sample['id'] if identity == 'sample-building' else None)
        points = [point for building in buildings for point in building['footprint']]
        bounds = {'minX': min(point['x'] for point in points), 'maxX': max(point['x'] for point in points),
                  'minZ': min(point['z'] for point in points), 'maxZ': max(point['z'] for point in points)}
        district['blocks'].append({'id': identity, 'kind': 'sample' if identity == 'sample-building' else 'context' if identity.startswith('context') else 'street-block',
                                   'asset': 'districts/' + district['id'] + '/' + identity, 'bounds': bounds,
                                   'buildings': [building['id'] for building in buildings]})
    serialized = json.dumps(district, ensure_ascii=False, separators=(',', ':'))
    (ROOT / 'game/assets/scripts' / (class_name + '.ts')).write_text("import type { DistrictDefinition } from './DistrictDefinition';\n\n// Generated by scripts/convert-districts.py from the recorded NYC snapshot.\nexport const " + district['id'].upper() + '_DISTRICT: DistrictDefinition = ' + serialized + ';\n')
    manifest = {'district': district['id'], 'origin': district['origin'], 'sources': district['sources'], 'streetBlocks': sum(block['kind']=='street-block' for block in district['blocks']),
                'roads': len(district['roads']), 'buildings': len(district['buildings']),
                'fallbackHeights': sum(building['fallback'] for building in district['buildings']),
                'heightSimplifications': sum(building['sourceHeight'] is not None and abs(building['sourceHeight'] - building['height']) > .01 for building in district['buildings']),
                'modifications': ['Local EPSG:2263 US survey feet to metres, north is negative Z.', 'Only curated constructed at-grade source segments. Original endpoints and direction retained.',
                                  'Main/Lippmann (Flushing) and Doyers (Chinatown) remain foot-only, crossing side streets retained.',
                                  'Curated complete source street faces plus 45m background footprint context. Chinatown ends at Market Street to keep the slice compact.', 'Largest exterior footprint ring, courtyard holes omitted, ground flattened.',
                                  'Roof heights are feet above ground, missing height falls back to 12m, visible shell range 4.5–96m.', 'Restaurant brands, interiors and temporary curb parking are authored game locations.']}
    maps = ROOT / 'docs/maps'
    maps.mkdir(parents=True, exist_ok=True)
    (maps / (district['id'] + '-source.json')).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'district': district['id'], 'roads': len(district['roads']), 'buildings': len(district['buildings']), 'assets': len(district['blocks']),
                      'restaurants': [(place['id'], place['buildingId'], place['entry'], place['parking']) for place in district['restaurants']]}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true')
    arguments = parser.parse_args()
    if arguments.fetch:
        fetch_snapshot('flushing', [-73.8344, 40.7572, -73.8258, 40.7620])
    if arguments.fetch:
        fetch_snapshot('chinatown', [-73.9996,40.7129,-73.9895,40.7180])
        fetch_transit(RAW)
    export(convert_region('flushing', FLUSHING_FACES, 9329, 'F'), 'FlushingDistrict')
    export(convert_region('chinatown', CHINATOWN_FACES, 1782, 'C'), 'ChinatownDistrict')
