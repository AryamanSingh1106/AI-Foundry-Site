"""
Server-side checks for the Join form.

NEVER trust the browser's checks - anyone can skip the website and send
requests straight to the API. So we re-check everything here.
"""
import re

MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB, same limit as the frontend

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
PHONE_RE = re.compile(r"^\+?[\d\s-]{10,16}$")

# The first bytes of a real file reveal its true type ("magic bytes").
# This catches someone renaming virus.exe to resume.pdf.
PDF_MAGIC = b"%PDF-"
DOCX_MAGIC = b"PK\x03\x04"                      # .docx is a zip file
DOC_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # old .doc format


def clean_text(value: str) -> str:
    """Trim and collapse whitespace; strip control characters."""
    value = re.sub(r"[\x00-\x1f\x7f]", " ", value or "")
    return re.sub(r"\s+", " ", value).strip()


def validate_application(name: str, phone: str, email: str) -> tuple[dict, list[str]]:
    """Returns (cleaned_values, list_of_error_messages)."""
    name, phone, email = clean_text(name), clean_text(phone), clean_text(email)
    errors = []
    if len(name) < 2 or len(name) > 100:
        errors.append("Please enter your full name")
    if not PHONE_RE.match(phone) or len(re.sub(r"\D", "", phone)) < 10:
        errors.append("Enter a valid phone number")
    if len(email) > 254 or not EMAIL_RE.match(email):
        errors.append("Enter a valid email address")
    return {"name": name, "phone": phone, "email": email.lower()}, errors


def detect_resume_type(data: bytes) -> str | None:
    """Look at the file's first bytes. Returns 'pdf' / 'docx' / 'doc' or None."""
    if data.startswith(PDF_MAGIC):
        return "pdf"
    if data.startswith(DOCX_MAGIC):
        return "docx"
    if data.startswith(DOC_MAGIC):
        return "doc"
    return None


def validate_resume(data: bytes) -> tuple[str | None, str | None]:
    """Returns (file_extension, error_message). One of them is always None."""
    if not data:
        return None, "Please attach your resume"
    if len(data) > MAX_RESUME_BYTES:
        return None, "File must be under 5 MB"
    kind = detect_resume_type(data)
    if kind is None:
        return None, "Please upload a PDF or Word file"
    return kind, None
