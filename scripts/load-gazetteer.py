#!/usr/bin/env python3
"""Upsert Natural Earth GeoJSON into places. Maps types to city/region/country."""
import argparse, json, math, os, subprocess, sys
from pathlib import Path
from shutil import which
from urllib.request import Request, urlopen

KIND_COUNTRY = "country"
KIND_REGION = "region"
KIND_CITY = "city"


def esc(v):
    if v is None:
        return "NULL"
    return "\047" + str(v).replace("\047", "\047\047") + "\047"


def esc_text_array(items):
    seen = set()
    out = []
    for item in items:
        s = " ".join(str(item).split()).strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    if not out:
        return "'{}'::text[]"
    return "ARRAY[" + ", ".join(esc(x) for x in out) + "]::text[]"


def prop(props, *keys):
    for k in keys:
        if k in props and props[k] not in (None, ""):
            return props[k]
        lk = k.lower()
        for pk, pv in props.items():
            if str(pk).lower() == lk and pv not in (None, ""):
                return pv
    return None


def split_alt(raw):
    if raw is None:
        return []
    parts = []
    for chunk in str(raw).replace(";", "|").split("|"):
        bit = chunk.strip()
        if bit:
            parts.append(bit)
    return parts


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


def city_radius_m(props):
    pop = prop(props, "POP_MAX", "pop_max", "POP_MIN", "pop_min")
    try:
        pop_n = int(float(pop)) if pop is not None else 0
    except (TypeError, ValueError):
        pop_n = 0
    rank = prop(props, "SCALERANK", "scalerank")
    try:
        rank_n = int(float(rank)) if rank is not None else 6
    except (TypeError, ValueError):
        rank_n = 6
    if pop_n >= 5_000_000 or rank_n <= 1:
        return 40000
    if pop_n >= 1_000_000 or rank_n <= 3:
        return 25000
    if pop_n >= 100_000 or rank_n <= 6:
        return 18000
    return 12000


def feature_name_aliases(props):
    primary = prop(props, "NAME_EN", "name_en", "NAME", "name", "ADMIN", "admin", "NAMEASCII", "nameascii")
    if not primary:
        return None, []
    primary = str(primary).strip()
    if not primary:
        return None, []
    aliases = []
    for extra in (
        prop(props, "NAME", "name"),
        prop(props, "NAME_LONG", "name_long"),
        prop(props, "ADMIN", "admin"),
        prop(props, "NAMEASCII", "nameascii"),
        prop(props, "ABBREV", "abbrev"),
        prop(props, "POSTAL", "postal"),
        prop(props, "ISO_A2", "iso_a2"),
        prop(props, "ISO_A3", "iso_a3"),
        prop(props, "ADM0_A3", "adm0_a3"),
        prop(props, "iso_3166_2", "ISO_3166_2"),
    ):
        if extra:
            aliases.append(str(extra))
    aliases.extend(split_alt(prop(props, "NAME_ALT", "name_alt", "NAMEALT", "namealt")))
    cleaned = []
    seen = {primary.lower()}
    for a in aliases:
        s = " ".join(a.split()).strip()
        if not s or s.lower() in seen:
            continue
        if s in ("-99", "-1", "N/A", "NA"):
            continue
        seen.add(s.lower())
        cleaned.append(s)
    return primary, cleaned


def load_features(path):
    with open(path) as f:
        data = json.load(f)
    if data.get("type") == "FeatureCollection":
        return data.get("features") or []
    if data.get("type") == "Feature":
        return [data]
    return []


def rows_from(path, kind):
    rows = []
    for f in load_features(path):
        geom = f.get("geometry") or {}
        geom_type = geom.get("type")
        if geom_type not in {
            "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon",
        }:
            continue
        if not coords_ok(geom.get("coordinates")):
            continue
        props = f.get("properties") or {}
        name, aliases = feature_name_aliases(props)
        if not name:
            continue
        gjson = json.dumps(
            {"type": geom_type, "coordinates": geom.get("coordinates")},
            separators=(",", ":"),
        )
        radius = city_radius_m(props) if kind == KIND_CITY else 0
        rows.append((name, aliases, kind, gjson, radius))
    return rows


def sql_upsert(rows, overwrite):
    conflict = (
        "ON CONFLICT ((lower(name)), kind) DO UPDATE SET "
        "aliases = EXCLUDED.aliases, kind = EXCLUDED.kind, geom = EXCLUDED.geom, bbox = EXCLUDED.bbox"
        if overwrite
        else (
            "ON CONFLICT ((lower(name)), kind) DO UPDATE SET "
            "aliases = EXCLUDED.aliases, geom = EXCLUDED.geom, bbox = EXCLUDED.bbox "
            "WHERE ST_Area(EXCLUDED.bbox::geography) > ST_Area(places.bbox::geography)"
        )
    )
    parts = []
    for name, aliases, kind, gjson, radius in rows:
        radius_sql = str(int(radius)) if radius else "NULL"
        parts.append(
            "INSERT INTO places (name, aliases, kind, geom, bbox) "
            "SELECT "
            + esc(name) + ", " + esc_text_array(aliases) + ", " + esc(kind) + ", "
            + "ST_SetSRID(ST_PointOnSurface(g), 4326)::geography, "
            + "CASE "
            + "WHEN ST_GeometryType(g) IN ('ST_Point', 'ST_MultiPoint') THEN "
            + "ST_Envelope(ST_Buffer(ST_SetSRID(ST_Centroid(g), 4326)::geography, COALESCE("
            + radius_sql + ", 25000))::geometry) "
            + "ELSE g "
            + "END "
            + "FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(" + esc(gjson) + "), 4326) AS g) s "
            + conflict + ";"
        )
    return parts


def run_sql(statements):
    url = os.environ.get("DATABASE_URL", "postgres://overwatch:overwatch@127.0.0.1:5432/overwatch")
    sql = "BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;\n"
    if which("psql"):
        proc = subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1"], input=sql, text=True)
        return proc.returncode
    proc = subprocess.run(
        ["docker", "exec", "-i", "overwatch-postgres", "psql", "-U", "overwatch", "-d", "overwatch", "-v", "ON_ERROR_STOP=1"],
        input=sql,
        text=True,
    )
    return proc.returncode


def default_cache():
    root = Path(__file__).resolve().parent.parent
    return Path(os.environ.get("OVERWATCH_NE_CACHE", root / ".cache" / "naturalearth"))


def download_file(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print("using cached", dest.name)
        return
    print("downloading", dest.name)
    req = Request(url, headers={"User-Agent": "overwatch-gazetteer/1"})
    tmp = dest.with_name(dest.name + ".part")
    try:
        with urlopen(req, timeout=120) as resp, open(tmp, "wb") as out:
            out.write(resp.read())
        tmp.replace(dest)
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise


def ensure_ne_files(countries, admin1, places):
    cache = default_cache()
    host = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
    mapping = [
        (countries, cache / "ne_50m_admin_0_countries.geojson", host + "ne_50m_admin_0_countries.geojson", None),
        (admin1, cache / "ne_50m_admin_1_states_provinces.geojson", host + "ne_50m_admin_1_states_provinces.geojson", host + "ne_50m_admin_1_states_provinces_lakes.geojson"),
        (places, cache / "ne_50m_populated_places.geojson", host + "ne_50m_populated_places.geojson", None),
    ]
    out = []
    for given, dest, url, fallback in mapping:
        if given:
            out.append(given)
            continue
        try:
            download_file(url, dest)
        except Exception:
            if not fallback:
                raise
            download_file(fallback, dest)
        out.append(str(dest))
    return out


def main():
    ap = argparse.ArgumentParser(description="Load Natural Earth gazetteer into places")
    ap.add_argument("--countries")
    ap.add_argument("--admin1")
    ap.add_argument("--places")
    args = ap.parse_args()
    countries_path, admin1_path, places_path = ensure_ne_files(args.countries, args.admin1, args.places)
    countries = rows_from(countries_path, KIND_COUNTRY)
    admin1 = rows_from(admin1_path, KIND_REGION)
    cities = rows_from(places_path, KIND_CITY)
    statements = []
    statements.extend(sql_upsert(countries, overwrite=True))
    statements.extend(sql_upsert(admin1, overwrite=False))
    statements.extend(sql_upsert(cities, overwrite=False))
    code = run_sql(statements)
    print("gazetteer upserted countries=%d admin1=%d cities=%d" % (len(countries), len(admin1), len(cities)))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
