"""Load profile + settings YAML and resolve repo-relative paths."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

# Repo root is two levels up from this file: <repo>/agent/jobagent/config.py
REPO_ROOT = Path(__file__).resolve().parents[2]
AGENT_DIR = REPO_ROOT / "agent"
DATA_DIR = AGENT_DIR / "data"


def store_path() -> Path:
    """Path to the learning store (gitignored — holds your answers)."""
    return DATA_DIR / "learnings.json"


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing config file: {path}\n"
            f"Copy the matching *.example.yaml and fill it in."
        )
    with path.open() as f:
        return yaml.safe_load(f) or {}


def resolve(path_str: str) -> Path:
    """Resolve a path from settings/profile relative to the repo root."""
    p = Path(path_str)
    return p if p.is_absolute() else (REPO_ROOT / p)


@dataclass
class Settings:
    submit_mode: str = "review"
    model: str = "claude-opus-4-8"
    output_dir: str = "resume/tailored"
    tracker_csv: str = "applications.csv"
    browser_profile_dir: str = "agent/.browser-profile"
    headless: bool = False
    collect_feedback: bool = True
    auto_answer_questions: bool = True
    vision: bool = True
    raw: dict[str, Any] = field(default_factory=dict)


def load_settings() -> Settings:
    data = _load_yaml(AGENT_DIR / "config" / "settings.yaml")
    return Settings(
        submit_mode=data.get("submit_mode", "review"),
        model=data.get("model", "claude-opus-4-8"),
        output_dir=data.get("output_dir", "resume/tailored"),
        tracker_csv=data.get("tracker_csv", "applications.csv"),
        browser_profile_dir=data.get("browser_profile_dir", "agent/.browser-profile"),
        headless=bool(data.get("headless", False)),
        collect_feedback=bool(data.get("collect_feedback", True)),
        auto_answer_questions=bool(data.get("auto_answer_questions", True)),
        vision=bool(data.get("vision", True)),
        raw=data,
    )


def load_profile() -> dict[str, Any]:
    return _load_yaml(AGENT_DIR / "config" / "profile.yaml")


def read_master_resume(profile: dict[str, Any]) -> str:
    path = resolve(profile.get("master_resume", "resume/master-resume.md"))
    if not path.exists():
        raise FileNotFoundError(f"Master resume not found: {path}")
    return path.read_text()


def _load_dotenv() -> None:
    """Load agent/.env (KEY=VALUE per line) so the API key persists without re-exporting."""
    p = AGENT_DIR / ".env"
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def check_api_key() -> None:
    _load_dotenv()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit(
            "ANTHROPIC_API_KEY is not set. Either:\n"
            "  echo 'ANTHROPIC_API_KEY=sk-ant-...' > agent/.env   (recommended; gitignored)\n"
            "  or: export ANTHROPIC_API_KEY=sk-ant-..."
        )
