#!/usr/bin/env python3
"""Upsert OSM GeoJSON into assets. Keeps Point / LineString / Polygon as-is."""
import json, math, os, subprocess, sys

# Canonical ids must exist in src/domain/catalog.ts. RULES cover exact
# tag equality; edge variants (power cables, bridge=*, telecom masts, …)
# are handled below so densify no longer drops tags osmium already pulls.
RULES = [
    ("airport", {"aeroway": "aerodrome"}),
    ("helipad", {"aeroway": "helipad"}),
    ("bridge", {"man_made": "bridge"}),
    ("data_center", {"building": "data_centre"}),
    ("power_plant", {"power": "plant"}),
    ("substation", {"power": "substation"}),
    ("refinery", {"industrial": "refinery"}),
    ("pipeline", {"man_made": "pipeline"}),
    ("pipeline", {"route": "pipeline"}),
    ("power_line", {"power": "line"}),
    ("power_line", {"power": "cable"}),
    ("power_line", {"power": "minor_line"}),
    ("industrial", {"landuse": "industrial"}),
    ("port", {"landuse": "port"}),
]

OSM_TYPES = {"node", "way", "relation"}

# tower:type values that densify sees on man_made=tower/mast but used to drop
TELECOM_TOWER_TYPES = {
    "communication",
    "telecommunications",
    "cellular",
    "cell",
    "gsm",
    "umts",
    "lte",
    "mobile",
    "microwave",
    "radio",
}

BRIDGE_NO = {"no", "none", "0", "false"}


def classify(tags):
    for cid, need in RULES:
        if all(tags.get(k) == v for k, v in need.items()):
            return cid
    # Highway/railway bridges: bridge=yes|viaduct|… (osmium nwr/bridge)
    bv = tags.get("bridge")
    if bv and bv.lower() not in BRIDGE_NO:
        return "bridge"
    tt = tags.get("tower:type")
    mm = tags.get("man_made")
    if mm == "tower" and tt == "broadcast":
        return "broadcast_tower"
    if mm in {"tower", "mast"} and tt in TELECOM_TOWER_TYPES:
        return "telecom"
    if mm == "communications_tower":
        return "telecom"
    if tags.get("communication:mobile_phone") == "yes":
        return "telecom"
    if tags.get("communication:radio") == "yes":
        return "telecom"
    if tags.get("telecom") == "exchange":
        return "telephone_exchange"
    if mm == "works" and tags.get("product") == "petroleum":
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


BATCH = 500


def row_sql(osm_type, osm_id, name, cid, operator, gjson, tags):
    return (
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


def run_psql(sql):
    """Run SQL via psql. Prefer PG* env so passwords stay off argv (Neon-safe)."""
    from shutil import which

    # Managed PostGIS (Neon) needs SSL. Only default require for remote paths
    # (full PGHOST/PGUSER/PGDATABASE triple or DATABASE_URL) — not bare PGHOST
    # and not the local Docker/default URL fallback.
    env = os.environ.copy()
    has_pg_triple = bool(env.get("PGHOST") and env.get("PGUSER") and env.get("PGDATABASE"))
    if not env.get("PGSSLMODE") and (has_pg_triple or env.get("DATABASE_URL")):
        os.environ["PGSSLMODE"] = "require"
        env["PGSSLMODE"] = "require"

    if which("psql"):
        # Quiet: remote densify was drowning in "INSERT 0 1" lines (~1/row RTT).
        args = ["psql", "-q", "-v", "ON_ERROR_STOP=1"]
        if has_pg_triple:
            # libpq picks up PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGSSLMODE
            pass
        else:
            url = env.get("DATABASE_URL", "postgres://overwatch:overwatch@127.0.0.1:5432/overwatch")
            args.append(url)
        return subprocess.run(args, input=sql, text=True, env=env)
    return subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "overwatch-postgres",
            "psql",
            "-U",
            "overwatch",
            "-d",
            "overwatch",
            "-v",
            "ON_ERROR_STOP=1",
        ],
        input=sql,
        text=True,
    )


def main():
    path = sys.argv[1]
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

    # Batched commits: one giant BEGIN/COMMIT over Neon was ~50 min for ~15k
    # upserts and held a single long transaction. Smaller batches commit
    # progress and cut peak memory for the SQL string.
    total = len(rows)
    done = 0
    for i in range(0, total, BATCH):
        chunk = rows[i : i + BATCH]
        parts = ["BEGIN;"]
        for row in chunk:
            parts.append(row_sql(*row))
        parts.append("COMMIT;")
        proc = run_psql("\n".join(parts))
        if proc.returncode != 0:
            print("upsert failed after", done, "of", total, file=sys.stderr)
            raise SystemExit(proc.returncode)
        done += len(chunk)
        print("upserted", done, "/", total)

    if total == 0:
        print("upserted 0")
    raise SystemExit(0)


if __name__ == "__main__":
    main()
