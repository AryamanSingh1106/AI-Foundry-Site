"""Run with:  python -m unittest discover tests   (no extra packages needed)"""
import json
import unittest
from pathlib import Path

from types import SimpleNamespace

from app.clientip import client_ip
from app.mapping import build_site_payload, event_out, project_out
from app.storage import SaveFailed, save_application
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


def _req(headers=None, host="10.0.0.1"):
    return SimpleNamespace(headers={k.lower(): v for k, v in (headers or {}).items()},
                           client=SimpleNamespace(host=host) if host else None)


class ClientIpTests(unittest.TestCase):
    def test_uses_cloudflare_header_behind_proxy(self):
        self.assertEqual(client_ip(_req({"CF-Connecting-IP": "203.0.113.7"})), "203.0.113.7")

    def test_ignores_spoofable_x_forwarded_for(self):
        r = _req({"X-Forwarded-For": "1.2.3.4, 10.0.0.9"}, host="10.0.0.1")
        self.assertEqual(client_ip(r), "10.0.0.1")

    def test_falls_back_to_socket_address_locally(self):
        self.assertEqual(client_ip(_req()), "10.0.0.1")
        self.assertEqual(client_ip(_req(host=None)), "unknown")


class _FakeBucket:
    def __init__(self, store, fail_upload=False):
        self.store, self.fail_upload = store, fail_upload

    def upload(self, path, data, opts):
        if self.fail_upload:
            raise RuntimeError("storage down")
        self.store.add(path)

    def remove(self, paths):
        for p in paths:
            self.store.discard(p)


class _FakeDb:
    def __init__(self, fail_insert=False, fail_upload=False):
        self.files, self.rows = set(), []
        self.fail_insert, self.fail_upload = fail_insert, fail_upload
        self.storage = SimpleNamespace(from_=lambda b: _FakeBucket(self.files, self.fail_upload))

    def table(self, name):
        db = self
        class T:
            def insert(self, row):
                class Q:
                    def execute(_):
                        if db.fail_insert:
                            raise RuntimeError("db down")
                        db.rows.append(row)
                return Q()
        return T()


class SaveApplicationTests(unittest.TestCase):
    def test_success_stores_file_and_row(self):
        db = _FakeDb()
        save_application(db, "resumes", "a.pdf", b"x", "application/pdf", {"name": "A"})
        self.assertEqual(db.files, {"a.pdf"})
        self.assertEqual(db.rows, [{"name": "A", "resume_path": "a.pdf"}])

    def test_failed_insert_removes_uploaded_file(self):
        db = _FakeDb(fail_insert=True)
        with self.assertRaises(SaveFailed):
            save_application(db, "resumes", "a.pdf", b"x", "application/pdf", {"name": "A"})
        self.assertEqual(db.files, set())
        self.assertEqual(db.rows, [])

    def test_failed_upload_saves_nothing(self):
        db = _FakeDb(fail_upload=True)
        with self.assertRaises(SaveFailed):
            save_application(db, "resumes", "a.pdf", b"x", "application/pdf", {"name": "A"})
        self.assertEqual(db.rows, [])
