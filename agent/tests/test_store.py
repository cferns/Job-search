"""Tests for the learning store (no Playwright/Anthropic needed)."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jobagent.store import (  # noqa: E402
    Store, keywords, match_answer, normalize, seed_answers,
)


def test_normalize_keywords():
    assert normalize("How many YEARS of experience?!") == "how many years of experience"
    assert keywords("Years of experience") == {"years", "experience"}


def test_match_answer_subset_rule():
    answers = {
        "authorized to work": "Yes",
        "require sponsorship": "Yes",
        "years experience": "8",
        "salary": "180000",
    }
    # stored keywords fully contained in the label -> match
    assert match_answer(answers, "Are you legally authorized to work in the US?") == "Yes"
    assert match_answer(answers, "Will you now or in the future require sponsorship?") == "Yes"
    assert match_answer(answers, "Years of experience") == "8"
    assert match_answer(answers, "Salary expectation") == "180000"
    # no spurious match when keywords don't all appear
    assert match_answer(answers, "What is your favorite color?") is None
    assert match_answer({}, "anything") is None


def test_match_prefers_most_specific():
    answers = {"salary": "100", "salary expectation range": "200"}
    assert match_answer(answers, "Salary expectation range (USD)") == "200"


def test_seed_answers_from_profile():
    s = seed_answers({
        "work_authorized": True, "needs_sponsorship": True,
        "years_experience": "8", "linkedin": "https://lnkd/x",
    })
    assert match_answer(s, "Are you authorized to work?") == "Yes"
    assert match_answer(s, "Do you require visa sponsorship?") == "Yes"
    assert match_answer(s, "LinkedIn profile URL") == "https://lnkd/x"


def test_store_roundtrip_and_summary():
    d = Path(tempfile.mkdtemp())
    path = d / "learnings.json"
    store = Store.load(path)
    store.learn_answer("Work authorization", "Yes")
    store.record_field("greenhouse", "Work authorization", False)
    store.record_field("greenhouse", "Email", True)
    store.record_run({"url": "u1", "ats": "greenhouse", "status": "Applied",
                      "missing_keywords": ["kubernetes", "kubernetes"],
                      "feedback": {"rating": 4}})
    store.record_run({"url": "u2", "ats": "greenhouse", "status": "Applied",
                      "missing_keywords": ["kubernetes"], "feedback": {"rating": 5}})
    store.save()

    reloaded = Store.load(path)
    assert reloaded.data["answers"]["work authorization"] == "Yes"
    assert reloaded.known_gaps("greenhouse") == ["Work authorization"]
    summ = reloaded.summary()
    assert summ["runs"] == 2 and summ["applied"] == 2
    assert summ["avg_rating"] == 4.5
    assert summ["per_ats"]["greenhouse"]["fill_rate"] == 50  # 1 filled / 1 skipped
    # "kubernetes" appears in >=2 runs -> surfaces as a recurring gap
    assert "kubernetes" in reloaded.learnings_context()


def test_strategy_bandit():
    d = Path(tempfile.mkdtemp())
    store = Store.load(d / "s.json")
    opts = ["impact-first", "mission-fit", "problem-solver"]
    # cold start explores each unused option in order
    assert store.pick_strategy(opts) == "impact-first"
    store.record_strategy("impact-first", 3)
    assert store.pick_strategy(opts) == "mission-fit"
    store.record_strategy("mission-fit", 5)
    assert store.pick_strategy(opts) == "problem-solver"
    store.record_strategy("problem-solver", 2)
    # all used -> exploit the highest average rating
    assert store.pick_strategy(opts) == "mission-fit"
    assert store.strategy_avg("mission-fit") == 5.0
    # record without a rating still counts a use
    store.record_strategy("problem-solver")
    assert store.data["strategies"]["problem-solver"]["uses"] == 2


def _run_all() -> int:
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn(); print(f"PASS {fn.__name__}")
        except AssertionError as e:
            failed += 1; print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_run_all())
