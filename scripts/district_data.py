"""Offline NYC CSCL / building conversion. The runtime never requests the source service."""
import math

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
