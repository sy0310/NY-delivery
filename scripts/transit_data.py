"""MTA point snapshots and official ArcGIS coordinate projection, run only offline at development time."""
import hashlib
import json
from datetime import datetime, timezone
import urllib.parse
import urllib.request
from district_data import local_point, inside, project

PROJECT = 'https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer/project'
REGIONS = {'flushing': [-73.8344,40.7572,-73.8258,40.762], 'chinatown': [-73.9996,40.7129,-73.9895,40.718]}


def fetch_transit(raw):
    for region,bounds in REGIONS.items():
        records=[]
        for kind,code,lat,lon in [('subway','i9wp-a4ja','entrance_latitude','entrance_longitude'),('bus','2ucp-7wg5','latitude','longitude')]:
            where=("in_effect = 'true' AND " if kind=='bus' else '')+f'{lat} between {bounds[1]} and {bounds[3]} AND {lon} between {bounds[0]} and {bounds[2]}'
            url='https://data.ny.gov/resource/'+code+'.json?'+urllib.parse.urlencode({'$where':where,'$limit':5000})
            content=urllib.request.urlopen(url,timeout=60).read();rows=json.loads(content)
            if not isinstance(rows,list) or len(rows)>=5000:raise ValueError('Truncated transit source')
            (raw/f'{region}-{kind}.json').write_bytes(content);(raw/f'{region}-{kind}-url.txt').write_text(url)
            seen=set()
            for row in rows:
                key=(row[lat],row[lon])
                if key in seen:continue
                seen.add(key)
                if kind=='subway' and row.get('entrance_type')!='Stair':continue
                records.append({'id':kind+'-'+str(len(records)),'name':('SUBWAY '+row.get('daytime_routes','')+' · ' if kind=='subway' else 'BUS · ')+row['stop_name'],
                                'kind':kind,'coordinate':[float(row[lon]),float(row[lat])]})
        geometry={'geometryType':'esriGeometryMultipoint','geometries':[{'points':[record['coordinate']for record in records]}]}
        url=PROJECT+'?'+urllib.parse.urlencode({'f':'json','inSR':4326,'outSR':2263,'geometries':json.dumps(geometry,separators=(',',':'))})
        result=json.load(urllib.request.urlopen(url,timeout=60))
        if 'error' in result:raise ValueError(result['error'])
        for record,point in zip(records,result['geometries'][0]['points']):record['projected']=point
        (raw/f'{region}-transit-projected.json').write_text(json.dumps(records))
        (raw/f'{region}-transit-projection-url.txt').write_text(url)
        (raw/f'{region}-transit-retrieved.txt').write_text(datetime.now(timezone.utc).isoformat())


def add_transit(raw,district):
    region=district['id'];records=json.loads((raw/f'{region}-transit-projected.json').read_text())
    chosen=[]
    for record in records:
        point=local_point(record['projected'],district['origin']['coordinates'],2263)
        if not inside(point,district['boundary']):continue
        road,segment=min(((road,(a,b))for road in district['roads']for a,b in zip(road['points'],road['points'][1:])),
                         key=lambda item:project(point,*item[1])[2])
        if project(point,*segment)[2]>road['width']/2+8:continue
        chosen.append({**record,'position':{k:round(v,3)for k,v in point.items()},'yaw':0})
    for kind,limit in [('subway',4),('bus',4)]:
        points=sorted([record for record in chosen if record['kind']==kind],key=lambda record:record['position']['x']**2+record['position']['z']**2)[:limit]
        district['landmarks'].extend({k:record[k]for k in ['id','name','kind','position','yaw']}for record in points)
    for kind in ['subway','bus','transit-projected']:
        path=raw/f'{region}-{kind}.json'
        url=(raw/f'{region}-{kind}-url.txt').read_text()if kind!='transit-projected'else(raw/f'{region}-transit-projection-url.txt').read_text()
        district['sources'].append({'url':url,'retrieved':(raw/f'{region}-transit-retrieved.txt').read_text().strip(),
                                   'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                                   'license':'MTA via New York State Open Data, provider terms and dataset date retained; ArcGIS projection for coordinates.'})
