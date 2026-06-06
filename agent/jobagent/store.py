"""Learning store: an answer bank, per-ATS field stats, and a run journal.

This is the agent's memory. It's deterministic (no model training) — it remembers the
answers you give to custom application questions, which fields each ATS commonly needs,
and feedback per run, then reuses all of that to fill more next time and to sharpen
tailoring. Stored as one JSON file (gitignored — it holds your answers).
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

_EMPTY: dict[str, Any] = {"answers": {}, "field_stats": {}, "runs": []}

_STOP = {
    "the", "a", "an", "do", "you", "your", "please", "of", "to", "for", "is", "are",
    "will", "i", "we", "this", "in", "on", "what", "how", "many", "have", "with", "or",
    "and", "at", "us", "not", "now", "future", "any", "would", "be", "able", "currently",
    "legally", "United", "states", "country", "if", "applicable", "select", "enter",
}


def normalize(text: str) -> str:
    text = re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower())
    return re.sub(r"\s+", " ", text).strip()


def keywords(text: str) -> set[str]:
    return {w for w in normalize(text).split() if w not in _STOP and len(w) > 2}


def match_answer(answers: dict[str, str], label: str) -> str | None:
    """Find the stored answer whose question best matches a form-field label.

    Rule: exact normalized match first; otherwise the stored question whose keyword set
    is fully contained in the label's keywords, preferring the most specific (most
    keywords). This is precise — it won't fire on a loose single-word overlap.
    """
    if not answers or not label:
        return None
    n = normalize(label)
    if n in answers:
        return answers[n]
    lk = keywords(label)
    if not lk:
        return None
    best, best_len = None, 0
    for q, a in answers.items():
        qk = keywords(q)
        if qk and qk <= lk and len(qk) > best_len:
            best, best_len = a, len(qk)
    return best


def seed_answers(profile: dict[str, Any]) -> dict[str, str]:
    """Build an initial answer bank from the profile so custom questions fill from run 1."""
    def yn(v: Any) -> str:
        return "Yes" if v else "No"

    raw: dict[str, str] = {}
    if profile.get("work_authorized") is not None:
        raw["authorized to work"] = yn(profile["work_authorized"])
        raw["work authorization"] = yn(profile["work_authorized"])
    if profile.get("needs_sponsorship") is not None:
        raw["require sponsorship"] = yn(profile["needs_sponsorship"])
        raw["visa sponsorship"] = yn(profile["needs_sponsorship"])
        raw["sponsorship"] = yn(profile["needs_sponsorship"])
    if profile.get("years_experience"):
        raw["years experience"] = str(profile["years_experience"])
    if profile.get("desired_salary"):
        raw["salary"] = str(profile["desired_salary"])
        raw["salary expectation"] = str(profile["desired_salary"])
        raw["expected compensation"] = str(profile["desired_salary"])
    if profile.get("current_company"):
        raw["current company"] = profile["current_company"]
        raw["current employer"] = profile["current_company"]
    if profile.get("linkedin"):
        raw["linkedin"] = profile["linkedin"]
        raw["linkedin profile"] = profile["linkedin"]
    if profile.get("github"):
        raw["github"] = profile["github"]
    if profile.get("portfolio"):
        raw["website"] = profile["portfolio"]
        raw["portfolio"] = profile["portfolio"]
    for k in ("gender", "race", "veteran_status", "disability", "pronouns"):
        if profile.get(k):
            raw[k.replace("_", " ")] = profile[k]
    if profile.get("location"):
        raw["location"] = profile["location"]
    return {normalize(k): v for k, v in raw.items() if v}


class Store:
    def __init__(self, path: Path, data: dict[str, Any]):
        self.path = path
        self.data = data

    @classmethod
    def load(cls, path: Path) -> "Store":
        data = json.loads(json.dumps(_EMPTY))
        if path.exists():
            try:
                loaded = json.loads(path.read_text())
                if isinstance(loaded, dict):
                    for k in _EMPTY:
                        data[k] = loaded.get(k, data[k])
            except Exception:
                pass
        return cls(path, data)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2, sort_keys=True))

    # --- answer bank ---
    def learn_answer(self, question: str, answer: str) -> None:
        q, a = normalize(question), (answer or "").strip()
        if q and a:
            self.data["answers"][q] = a

    def merged_answers(self, seed: dict[str, str]) -> dict[str, str]:
        """Seed (from profile) overlaid by learned answers (user corrections win)."""
        return {**seed, **self.data["answers"]}

    # --- per-ATS field stats ---
    def record_field(self, ats: str, label: str, filled: bool) -> None:
        st = self.data["field_stats"].setdefault(ats, {})
        cell = st.setdefault(label, {"filled": 0, "skipped": 0})
        cell["filled" if filled else "skipped"] += 1

    def known_gaps(self, ats: str, n: int = 5) -> list[str]:
        st = self.data["field_stats"].get(ats, {})
        ranked = sorted(st.items(), key=lambda kv: kv[1].get("skipped", 0), reverse=True)
        return [k for k, v in ranked if v.get("skipped", 0) > 0][:n]

    # --- run journal ---
    def record_run(self, record: dict[str, Any]) -> None:
        record.setdefault("date", date.today().isoformat())
        self.data["runs"].append(record)

    def learnings_context(self, n: int = 6) -> str:
        """Recurring JD keywords past resumes under-covered — fed back into tailoring."""
        c: Counter[str] = Counter()
        for r in self.data["runs"]:
            for kw in r.get("missing_keywords", []) or []:
                c[kw.strip()] += 1
        common = [kw for kw, cnt in c.most_common(n) if cnt >= 2]
        if not common:
            return ""
        return ("Across recent postings, these JD themes were often under-evidenced in the "
                "resume — surface genuinely relevant experience for them if it exists (never "
                "fabricate): " + ", ".join(common) + ".")

    def summary(self) -> dict[str, Any]:
        runs = self.data["runs"]
        ratings = [r["feedback"]["rating"] for r in runs
                   if isinstance(r.get("feedback"), dict) and r["feedback"].get("rating")]
        per_ats: dict[str, dict[str, int]] = {}
        for ats, fields in self.data["field_stats"].items():
            f = sum(v.get("filled", 0) for v in fields.values())
            s = sum(v.get("skipped", 0) for v in fields.values())
            per_ats[ats] = {"filled": f, "skipped": s,
                            "fill_rate": round(100 * f / (f + s)) if (f + s) else 0}
        return {
            "runs": len(runs),
            "applied": sum(1 for r in runs if r.get("status") == "Applied"),
            "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
            "learned_answers": len(self.data["answers"]),
            "per_ats": per_ats,
        }
