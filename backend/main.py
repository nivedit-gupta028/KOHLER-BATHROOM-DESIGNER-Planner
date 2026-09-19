"""FastAPI entry point for the KOHLER AI Bathroom Designer."""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .optimizer import build_layout

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

app = FastAPI(
    title="KOHLER AI Bathroom Designer API",
    version="1.0.0",
    description="PuLP-powered bathroom fixture optimization with 3D placements.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


class OptimizeRequest(BaseModel):
    length_ft: float = Field(default=10.0, ge=4.0, le=40.0)
    width_ft: float = Field(default=8.0, ge=4.0, le=40.0)
    budget: float = Field(default=15000.0, ge=0.0, le=1_000_000.0)
    theme: str = Field(default="Minimalist Modern", min_length=1, max_length=64)
    layout_style: str = Field(default="Zoned Wet/Dry", min_length=1, max_length=64)
    must_have_products: list[str] = Field(default_factory=list)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "kohler-ai-designer"}

@app.get("/api/catalog")
def catalog() -> list[dict]:
    from .optimizer import load_catalog
    return load_catalog().to_dict(orient="records")

@app.post("/api/optimize")
def optimize(payload: OptimizeRequest) -> dict:
    try:
        return build_layout(payload.model_dump())
    except Exception as exc:  # Keep API errors explicit and actionable.
        raise HTTPException(status_code=500, detail=f"Layout optimization failed: {exc}") from exc


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")


@app.get("/app.js", include_in_schema=False)
def app_script() -> FileResponse:
    return FileResponse(FRONTEND / "app.js", media_type="application/javascript")


@app.get("/styles.css", include_in_schema=False)
def styles() -> FileResponse:
    return FileResponse(FRONTEND / "styles.css", media_type="text/css")
