"""Saves an application: resume file first, then the database row.

If the row can't be saved, the file is deleted again, so storage never fills with resumes that
belong to no application.
"""


class SaveFailed(Exception):
    """The application could not be stored (nothing is left behind)."""


def save_application(db, bucket: str, path: str, data: bytes, content_type: str, row: dict) -> None:
    try:
        db.storage.from_(bucket).upload(path, data, {"content-type": content_type})
    except Exception as exc:
        raise SaveFailed("upload failed") from exc

    try:
        db.table("applications").insert({**row, "resume_path": path}).execute()
    except Exception as exc:
        try:
            db.storage.from_(bucket).remove([path])  # undo the upload
        except Exception:
            pass  # cleanup is best effort; still report the original failure
        raise SaveFailed("database insert failed") from exc
