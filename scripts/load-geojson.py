#!/usr/bin/env python3
"""Upsert OSM GeoJSON into assets. Keeps Point / LineString / Polygon as-is."""
import json, math, os, subprocess, sys

RULES = [
    ("airport", {"aeroway": "aerodrome"}),
    ("helipad", {"aeroway": "helipad"}),
    ("bridge", {"man_made": "bridge"}),
    ("data_center", {"building": "data_centre"}),
    ("power_plant", {"power": "plant"}),
    ("substation", {"power": "substation"}),
    ("refinery", {"industrial": "refinery"}),
    ("pipeline", {"man_made": "pipeline"}),
    ("industrial", {"landuse": "industrial"}),
    ("port", {"landuse": "port"}),
]

OSM_TYPES = {"node", "way", "relation"}


def classify(tags):
    for cid, need in RULES:
        if all(tags.get(k) == v for k, v in need.items()):
            return cid
    tt = tags.get("tower:type")
    if tags.get("man_made") == "tower" and tt in {"communication", "telecommunications"}:
        return "telecom"
    if tags.get("man_made") == "communications_tower":
        return "telecom"
    if tags.get("communication:mobile_phone") == "yes":
        return "telecom"
    if tags.get("man_made") == "works" and tags.get("product") == "petroleum":
        return "refinery"
    return None


def esc(v):
    if v is None:
        return "NULL"
    return "\047" + str(v).replace("\047", "\047\047") + "\047"


def coords_ok(coords):
    if coords is None:
        return False
    if isinstance(coords, (int, float)):
        return False
    if len(coords) == 0:
        return False
    if isinstance(coords[0], (int, float)):
        if len(coords) < 2:
            return False
        try:
            lon = float(coords[0])
            lat = float(coords[1])
        except (TypeError, ValueError):
            return False
        if not math.isfinite(lon) or not math.isfinite(lat):
            return False
        if lon < -180 or lon > 180 or lat < -90 or lat > 90:
            return False
        return True
    return all(coords_ok(c) for c in coords)


def infer_osm_type(geom_type):
    if geom_type in ("Point", "MultiPoint"):
        return "node"
    if geom_type in ("LineString", "MultiLineString", "Polygon"):
        return "way"
    return "relation"


def parse_osm_ref(props, feature, geom_type):
    fid = feature.get("id")
    if fid is None:
        fid = props.get("@id") or props.get("osm_id") or props.get("id")
    otype = props.get("@type") or props.get("osm_type")
    if otype not in OSM_TYPES:
        otype = None
    if isinstance(fid, str) and "/" in fid:
        left, right = fid.split("/", 1)
        if left in OSM_TYPES:
            try:
                return left, int(float(right))
            except (TypeError, ValueError):
                pass
    if otype and fid is not None:
        try:
            return otype, int(float(str(fid)))
        except (TypeError, ValueError):
            pass
    if fid is not None and otype is None:
        try:
            return infer_osm_type(geom_type), int(float(str(fid)))
        except (TypeError, ValueError):
            pass
    return None


def load_features(path):
    with open(path) as f:
        raw = f.read().strip()
    if not raw:
        return []
    if raw[0] == "{":
        data = json.loads(raw)
        if data.get("type") == "FeatureCollection":
            return data.get("features") or []
        if data.get("type") == "Feature":
            return [data]
        return []
    features = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        if obj.get("type") == "Feature":
            features.append(obj)
        elif obj.get("type") == "FeatureCollection":
            features.extend(obj.get("features") or [])
    return features


def main():
    path = sys.argv[1]
    url = os.environ.get("DATABASE_URL", "postgres://overwatch:overwatch@127.0.0.1:5432/overwatch")
    rows = []
    for f in load_features(path):
        geom = f.get("geometry") or {}
        geom_type = geom.get("type")
        if geom_type not in {
            "Point",
            "MultiPoint",
            "LineString",
            "MultiLineString",
            "Polygon",
            "MultiPolygon",
        }:
            continue
        if not coords_ok(geom.get("coordinates")):
            continue
        props = {k: str(v) for k, v in (f.get("properties") or {}).items() if v is not None}
        cid = classify(props)
        if not cid:
            continue
        ref = parse_osm_ref(props, f, geom_type)
        if not ref:
            continue
        osm_type, osm_id = ref
        name = props.get("name")
        operator = props.get("operator") or props.get("owner")
        tags = json.dumps(props, separators=(",", ":"))
        gjson = json.dumps(
            {"type": geom_type, "coordinates": geom.get("coordinates")},
            separators=(",", ":"),
        )
        rows.append((osm_type, osm_id, name, cid, operator, gjson, tags))
    parts = ["BEGIN;"]
    for osm_type, osm_id, name, cid, operator, gjson, tags in rows:
        parts.append(
            "INSERT INTO assets (osm_type, osm_id, name, canonical_type, operator, geom, tags) VALUES ("
            + esc(osm_type)
            + ", "
            + str(osm_id)
            + ", "
            + esc(name)
            + ", "
            + esc(cid)
            + ", "
            + esc(operator)
            + ", ST_SetSRID(ST_GeomFromGeoJSON("
            + esc(gjson)
            + "), 4326), "
            + esc(tags)
            + "::jsonb) ON CONFLICT (osm_type, osm_id) DO UPDATE SET "
            + "name=EXCLUDED.name, canonical_type=EXCLUDED.canonical_type, operator=EXCLUDED.operator, geom=EXCLUDED.geom, tags=EXCLUDED.tags;"
        )
    parts.append("COMMIT;")
    sql = "\n".join(parts)
    from shutil import which
    if which("psql"):
        proc = subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1"], input=sql, text=True)
    else:
        proc = subprocess.run(
            ["docker", "exec", "-i", "overwatch-postgres", "psql", "-U", "overwatch", "-d", "overwatch", "-v", "ON_ERROR_STOP=1"],
            input=sql,
            text=True,
        )
    print("upserted", len(rows))
    raise SystemExit(proc.returncode)


if __name__ == "__main__":
    main()
