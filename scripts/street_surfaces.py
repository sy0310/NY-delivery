"""Bake shared street polygons and disjoint pavement meshes with Shapely 2.1.2."""
import json
from pathlib import Path
from shapely import constrained_delaunay_triangles, make_valid, unary_union
from shapely.geometry import LineString, Polygon, box

# Authored clearance adjustments in metres, limited to the delivery turns below.
WIDENING = {
    'flushing': {'nyc-84124': 1.4, 'nyc-84125': 1.4},
    'chinatown': {'nyc-1782': 1.4, 'nyc-140948': 1.4, 'nyc-99642': 1.2},
}


def polygon_parts(geometry):
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [part for item in getattr(geometry, 'geoms', []) for part in polygon_parts(item)]


def surface_record(kind, geometry):
    polygons, triangles = [], []
    for polygon in polygon_parts(geometry):
        if polygon.area < .001:
            continue
        def ring(coordinates):
            return [{'x': round(x, 4), 'z': round(z, 4)} for x, z in list(coordinates)[:-1]]
        polygons.append({'outer': ring(polygon.exterior.coords),
                         'holes': [ring(hole.coords) for hole in polygon.interiors]})
        for triangle in constrained_delaunay_triangles(polygon).geoms:
            a, b, c = list(triangle.exterior.coords)[:3]
            # X/Z winding must give an upward Y normal in the engine.
            if (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]) > 0:
                b, c = c, b
            triangles.extend(round(value, 4) for point in (a, b, c) for value in point)
    return {'kind': kind, 'polygons': polygons, 'triangles': triangles}


def attach_road_surfaces(district):
    for road in district['roads']:
        extra = WIDENING.get(district['id'], {}).get(road['id'])
        if extra:
            road.setdefault('sourceWidth', road['width'])
            road['width'] = round(road['sourceWidth'] + extra, 3)
    bounds = district['bounds']
    extent = box(bounds['minX'], bounds['minZ'], bounds['maxX'], bounds['maxZ'])
    buildings = unary_union([make_valid(Polygon([(p['x'], p['z']) for p in building['footprint']]))
                            for building in district['buildings']])
    lanes = {'car': [], 'bus': [], 'walk': []}
    pavement = []
    for road in district['roads']:
        line = LineString([(p['x'], p['z']) for p in road['points']])
        kind = 'car' if road['car'] else 'walk' if road['direction'] == 'NV' else 'bus'
        lanes[kind].append(line.buffer(road['width']/2, quad_segs=4))
        pavement.append(line.buffer(road['width']/2+3, quad_segs=4))
    occupied = Polygon()
    surfaces = []
    for kind in ('car', 'bus', 'walk'):
        area = unary_union(lanes[kind]).intersection(extent).difference(buildings).difference(occupied)
        surfaces.append(surface_record(kind, area))
        occupied = occupied.union(area)
    sidewalk = unary_union(pavement).intersection(extent).difference(buildings).difference(occupied)
    surfaces.append(surface_record('sidewalk', sidewalk))
    district['surfaces'] = surfaces
    return district


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    for name in ('Flushing', 'Chinatown'):
        path = root / 'game/assets/scripts' / (name + 'District.ts')
        source = path.read_text()
        prefix, serialized = source.split(' = ', 1)
        district = attach_road_surfaces(json.loads(serialized.rstrip(';\n')))
        path.write_text(prefix + ' = ' + json.dumps(district, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print(district['id'], [(surface['kind'], len(surface['triangles'])//6) for surface in district['surfaces']])
