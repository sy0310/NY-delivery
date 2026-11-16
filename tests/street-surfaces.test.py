"""Run with .local/road-tools/bin/python tests/street-surfaces.test.py."""
import json
from pathlib import Path
import unittest
from shapely import unary_union
from shapely.geometry import Polygon


class StreetSurfaces(unittest.TestCase):
    def test_partition_clearance_and_upward_triangles(self):
        root = Path(__file__).resolve().parents[1]
        for name in ('Flushing', 'Chinatown'):
            source = (root / 'game/assets/scripts' / (name + 'District.ts')).read_text()
            district = json.loads(source.split(' = ', 1)[1].rstrip(';\n'))
            buildings = unary_union([Polygon([(p['x'], p['z']) for p in item['footprint']])
                                     for item in district['buildings']])
            areas = []
            for surface in district['surfaces']:
                polygons = [Polygon([(p['x'], p['z']) for p in item['outer']],
                                    [[(p['x'], p['z']) for p in ring] for ring in item['holes']])
                            for item in surface['polygons']]
                geometry = unary_union(polygons)
                triangle_area = 0
                values = surface['triangles']
                for index in range(0, len(values), 6):
                    ax, az, bx, bz, cx, cz = values[index:index + 6]
                    winding = (bx-ax)*(cz-az)-(bz-az)*(cx-ax)
                    self.assertLessEqual(winding, .00001)
                    triangle_area += abs(winding)/2
                self.assertAlmostEqual(triangle_area, geometry.area, delta=.05)
                self.assertLess(geometry.intersection(buildings).area, .05)
                for previous in areas:
                    self.assertLess(geometry.intersection(previous).area, .05)
                areas.append(geometry)


if __name__ == '__main__':
    unittest.main()
