#!/usr/bin/env python3
import json, os, subprocess, sys

RULES = [
    ("airport", {"aeroway": "aerodrome"}),
    ("helipad", {"aeroway": "helipad"}),
    ("bridge", {"man_made": "bridge"}),
    ("data_center", {"building": "data_centre"}),
    ("power_plant", {"power": "plant"}),
    ("substation", {"power": "substation"}),
    ("refinery", {"industrial": "refinery"}),
]

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

def main():
    path = sys.argv[1]
    data = json.load(open(path))
    url = os.environ.get("DATABASE_URL", "postgres://overwatch:overwatch@127.0.0.1:5432/overwatch")
    rows = []
    for f in data.get("features", []):
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = coords[0], coords[1]
        props = {k: str(v) for k, v in (f.get("properties") or {}).items() if v is not None}
        cid = classify(props)
        if not cid:
            continue
        osm_id = props.get("id") or props.get("osm_id")
        if not osm_id:
            continue
        osm_type = props.get("type") or props.get("osm_type") or "node"
        name = props.get("name")
        operator = props.get("operator") or props.get("owner")
        tags = json.dumps(props, separators=(",", ":"))
        rows.append((osm_type, int(float(osm_id)), name, cid, operator, lon, lat, tags))
    parts = ["BEGIN;"]
    for osm_type, osm_id, name, cid, operator, lon, lat, tags in rows:
        parts.append(
            "INSERT INTO assets (osm_type, osm_id, name, canonical_type, operator, geom, tags) VALUES ("
            + esc(osm_type) + ", " + str(osm_id) + ", " + esc(name) + ", " + esc(cid) + ", "
            + esc(operator) + ", ST_SetSRID(ST_MakePoint(" + str(lon) + ", " + str(lat)
            + "), 4326)::geography, " + esc(tags) + "::jsonb) ON CONFLICT (osm_type, osm_id) DO UPDATE SET "
            + "name=EXCLUDED.name, canonical_type=EXCLUDED.canonical_type, operator=EXCLUDED.operator, geom=EXCLUDED.geom, tags=EXCLUDED.tags;"
        )
    parts.append("COMMIT;")
    proc = subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1"], input="\n".join(parts), text=True)
    print("upserted", len(rows))
    raise SystemExit(proc.returncode)

if __name__ == "__main__":
    main()
