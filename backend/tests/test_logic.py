"""Run with:  python -m unittest discover tests   (no extra packages needed)"""
import json
import unittest
from pathlib import Path

from app.mapping import build_site_payload, event_out, project_out
from app.validation import validate_application, validate_resume


class ValidationTests(unittest.TestCase):
    def test_good_application(self):
        v, errs = validate_application("  Aryaman  Singh ", "+91 98765-43210", "A@B.com")
        self.assertEqual(errs, [])
        self.assertEqual(v["name"], "Aryaman Singh")
        self.assertEqual(v["email"], "a@b.com")

    def test_bad_application(self):
        _, errs = validate_application("A", "123", "nope")
        self.assertEqual(len(errs), 3)

    def test_resume_types(self):
        self.assertEqual(validate_resume(b"%PDF-1.7 ...")[0], "pdf")
        self.assertEqual(validate_resume(b"PK\x03\x04 ...")[0], "docx")
        self.assertEqual(validate_resume(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1..")[0], "doc")

    def test_resume_rejects_fake_and_big_and_empty(self):
        self.assertIsNotNone(validate_resume(b"MZ\x90\x00 fake exe renamed .pdf")[1])
        self.assertIsNotNone(validate_resume(b"%PDF-" + b"0" * (5 * 1024 * 1024))[1])
        self.assertIsNotNone(validate_resume(b"")[1])


class MappingTests(unittest.TestCase):
    def test_event_keys_match_frontend(self):
        e = event_out({"id": "1", "kind": "up", "title": "T", "highlights": None})
        for key in ["k", "d", "tm", "v", "t", "x", "l", "hl", "r", "img", "gallery"]:
            self.assertIn(key, e)
        self.assertEqual(e["hl"], [])

    def test_project_stage_only_when_ongoing(self):
        on = project_out({"id": "1", "kind": "on", "type": "Project", "title": "T", "stage": 1, "progress": 62})
        done = project_out({"id": "2", "kind": "done", "type": "Project", "title": "T"})
        self.assertEqual((on["st"], on["p"]), (1, 62))
        self.assertNotIn("st", done)

    def test_empty_tables_fall_back_to_datajs(self):
        self.assertEqual(build_site_payload([], [], [], [], [], {}), {})

    def test_roundtrip_with_real_seed_data(self):
        """Seed JSON -> pretend DB rows -> API output must carry the same visible text."""
        seed = json.loads(Path("seed_data.json").read_text(encoding="utf-8"))
        rows = [
            {"id": str(i), "kind": e["k"], "date_label": e["d"], "time_label": e["tm"], "venue": e["v"],
             "title": e["t"], "short": e["x"], "long": e["l"], "highlights": e["hl"]}
            for i, e in enumerate(seed["EVENTS"])
        ]
        out = build_site_payload(rows, [], [], [], [], {})["EVENTS"]
        for original, got in zip(seed["EVENTS"], out):
            for key in ["k", "d", "tm", "v", "t", "x", "l", "hl"]:
                self.assertEqual(original[key], got[key])


if __name__ == "__main__":
    unittest.main()
