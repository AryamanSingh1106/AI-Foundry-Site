"""POST /api/join - receives the Join form (name, phone, email, resume file)."""
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from ..config import get_settings
from ..db import get_db
from ..ratelimit import limiter
from ..validation import MAX_RESUME_BYTES, validate_application, validate_resume

router = APIRouter()

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.post("/join")
@limiter.limit("5/hour")  # max 5 applications per IP per hour
async def join(
    request: Request,                 # slowapi needs this argument
    name: str = Form(...),
    phone: str = Form(...),
    email: str = Form(...),
    resume: UploadFile = File(...),
    website: str = Form(""),          # honeypot: hidden field, real users leave it empty
):
    # Bots love filling every field. Pretend success, store nothing.
    if website:
        return {"ok": True}

    values, errors = validate_application(name, phone, email)

    # Read at most limit+1 bytes so a huge upload can't eat our memory.
    data = await resume.read(MAX_RESUME_BYTES + 1)
    ext, resume_error = validate_resume(data)
    if resume_error:
        errors.append(resume_error)

    if errors:
        raise HTTPException(status_code=422, detail=errors)

    # Random filename: never trust the one the user sent.
    path = f"{uuid.uuid4()}.{ext}"
    db = get_db()
    db.storage.from_(get_settings().resume_bucket).upload(
        path, data, {"content-type": CONTENT_TYPES[ext]}
    )
    db.table("applications").insert({**values, "resume_path": path}).execute()
    return {"ok": True}
