"""
AI Foundry API.  Run locally with:   uvicorn app.main:app --reload
Then open http://127.0.0.1:8000/docs  for an interactive page to try every endpoint.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import get_settings
from .ratelimit import limiter
from .routes import join, site

app = FastAPI(title="AI Foundry API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: tells browsers which websites may call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(site.router, prefix="/api")
app.include_router(join.router, prefix="/api")


# GET and HEAD: uptime monitors (e.g. UptimeRobot) often use HEAD requests.
@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"ok": True}
