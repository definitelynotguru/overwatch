#!/usr/bin/env python3
"""Fixture tests for scripts/load-geojson.py classify().

Run: python3 tests/classify_test.py
Maps only to existing catalog canonical ids (see src/domain/catalog.ts).
"""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "classify" / "edge-tags.geojson"

# Canonical ids that exist in src/domain/catalog.ts (subset we assert against)
CATALOG_IDS = {
    "airport",
    "bridge",
    "broadcast_tower",
    "data_center",
    "helipad",
    "industrial",
    "pipeline",
    "port",
    "power_line",
    "power_plant",
    "refinery",
    "substation",
    "telecom",
    "telephone_exchange",
}


def load_module():
    path = ROOT / "scripts" / "load-geojson.py"
    spec = importlib.util.spec_from_file_location("load_geojson", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class ClassifyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_power_line_variants(self):
        c = self.mod.classify
        self.assertEqual(c({"power": "line"}), "power_line")
        self.assertEqual(c({"power": "cable"}), "power_line")
        self.assertEqual(c({"power": "minor_line"}), "power_line")
        # more specific power types must win
        self.assertEqual(c({"power": "plant"}), "power_plant")
        self.assertEqual(c({"power": "substation"}), "substation")
        self.assertIsNone(c({"power": "pole"}))

    def test_bridge_variants(self):
        c = self.mod.classify
        self.assertEqual(c({"man_made": "bridge"}), "bridge")
        self.assertEqual(c({"bridge": "yes", "highway": "primary"}), "bridge")
        self.assertEqual(c({"bridge": "viaduct", "railway": "rail"}), "bridge")
        self.assertEqual(c({"bridge": "aqueduct"}), "bridge")
        self.assertIsNone(c({"bridge": "no", "highway": "primary"}))

    def test_pipeline_variants(self):
        c = self.mod.classify
        self.assertEqual(c({"man_made": "pipeline"}), "pipeline")
        self.assertEqual(c({"route": "pipeline"}), "pipeline")

    def test_telecom_variants(self):
        c = self.mod.classify
        self.assertEqual(
            c({"man_made": "tower", "tower:type": "communication"}), "telecom"
        )
        self.assertEqual(c({"man_made": "tower", "tower:type": "cellular"}), "telecom")
        self.assertEqual(c({"man_made": "mast", "tower:type": "communication"}), "telecom")
        self.assertEqual(c({"man_made": "mast", "tower:type": "microwave"}), "telecom")
        self.assertEqual(c({"man_made": "communications_tower"}), "telecom")
        self.assertEqual(c({"communication:mobile_phone": "yes"}), "telecom")
        self.assertEqual(c({"communication:radio": "yes"}), "telecom")
        self.assertEqual(
            c({"man_made": "tower", "tower:type": "broadcast"}), "broadcast_tower"
        )
        self.assertEqual(c({"telecom": "exchange"}), "telephone_exchange")

    def test_fixture_geojson(self):
        data = json.loads(FIXTURE.read_text())
        self.assertEqual(data["type"], "FeatureCollection")
        self.assertGreater(len(data["features"]), 10)
        for feat in data["features"]:
            props = {k: str(v) for k, v in (feat.get("properties") or {}).items() if v is not None}
            expected_raw = props.pop("expected", "")
            expected = expected_raw if expected_raw else None
            got = self.mod.classify(props)
            self.assertEqual(
                got,
                expected,
                msg=f"id={feat.get('id')} tags={props} expected={expected!r} got={got!r}",
            )
            if got is not None:
                self.assertIn(got, CATALOG_IDS)

    def test_load_features_classifies_fixture(self):
        """End-to-end: load_features + classify (no DB)."""
        features = self.mod.load_features(str(FIXTURE))
        classified = []
        for f in features:
            props = {k: str(v) for k, v in (f.get("properties") or {}).items() if v is not None}
            expected_raw = props.pop("expected", "")
            expected = expected_raw if expected_raw else None
            cid = self.mod.classify(props)
            if expected:
                self.assertEqual(cid, expected)
                classified.append(cid)
            else:
                self.assertIsNone(cid)
        self.assertIn("power_line", classified)
        self.assertIn("bridge", classified)
        self.assertIn("pipeline", classified)
        self.assertIn("telecom", classified)
        self.assertIn("telephone_exchange", classified)
        self.assertIn("broadcast_tower", classified)


if __name__ == "__main__":
    # Keep cwd-independent
    sys.path.insert(0, str(ROOT))
    unittest.main()
