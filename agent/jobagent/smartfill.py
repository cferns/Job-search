"""Vision-assisted form filling (set-of-mark).

CSS-selector rules miss custom radio "cards" and oddly-built questions. This instead:
1. tags every visible, empty form control and overlays a numbered badge on it,
2. screenshots the rendered form and sends it to Claude with the candidate's profile,
3. gets back one action per field (type / select / click an option),
4. actuates each by its tag id.

It only touches currently-empty fields, so it complements the fast selector path rather
than fighting it. Everything is best-effort and wrapped so it can never crash a run.
"""
from __future__ import annotations

import base64
import json

import anthropic

from .models import FillReport, JobPosting

# Tags visible, empty controls; assigns data-ja ids; groups radios/checkboxes by name;
# overlays numbered badges; returns the field metadata as JSON.
_TAG_JS = r"""
() => {
  const isVis = el => {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const labelFor = el => {
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    const lid = el.getAttribute('aria-labelledby');
    if (lid) { const t = document.getElementById(lid.split(' ')[0]); if (t && t.innerText) return t.innerText.trim(); }
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l && l.innerText) return l.innerText.trim(); }
    let n = el;
    for (let i = 0; i < 6 && n; i++) {
      n = n.parentElement; if (!n) break;
      const l = n.querySelector('label,.application-label,legend,[class*="label"],[class*="question"]');
      if (l && l.innerText && l.innerText.trim().length > 2) return l.innerText.trim().split('\n')[0].slice(0, 160);
    }
    return el.getAttribute('placeholder') || el.getAttribute('name') || '';
  };
  const empty = el => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'radio' || type === 'checkbox') return true;        // group emptiness handled below
    if (tag === 'select') return el.selectedIndex <= 0 || !el.value;
    return !(el.value && el.value.trim());
  };
  const badge = (el, idx) => {
    const r = el.getBoundingClientRect();
    const b = document.createElement('div'); b.className = 'ja-badge'; b.textContent = idx;
    b.style.cssText = 'position:absolute;z-index:2147483647;background:#e11;color:#fff;'
      + 'font:bold 11px sans-serif;padding:0 4px;border-radius:3px;pointer-events:none;'
      + 'left:' + (r.left + scrollX) + 'px;top:' + (r.top + scrollY - 2) + 'px;';
    document.body.appendChild(b);
  };
  let idx = 0; const out = []; const groups = {};
  document.querySelectorAll('input,textarea,select').forEach(el => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'file', 'image', 'reset'].includes(type)) return;
    if (!isVis(el)) return;
    if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
      const name = el.getAttribute('name') || ('grp' + idx);
      el.setAttribute('data-ja', idx); badge(el, idx);
      const opt = { label: labelFor(el) || el.value || ('opt' + idx), ja: idx };
      if (groups[name] === undefined) {
        groups[name] = out.length;
        out.push({ kind: type, label: '', options: [opt], _first: idx });
      } else { out[groups[name]].options.push(opt); }
      idx++; return;
    }
    if (!empty(el)) return;
    el.setAttribute('data-ja', idx); badge(el, idx);
    const f = { ja: idx, kind: tag === 'select' ? 'select' : (tag === 'textarea' ? 'textarea' : 'text'), label: labelFor(el) };
    if (tag === 'select') f.options = [...el.options].map(o => o.textContent.trim()).filter(Boolean);
    out.push(f); idx++;
  });
  // group question label = label of the container holding the first option
  out.forEach(f => {
    if (f.kind === 'radio' || f.kind === 'checkbox') {
      const first = document.querySelector('[data-ja="' + f._first + '"]');
      if (first) f.label = labelFor(first);
      delete f._first;
    }
  });
  return JSON.stringify(out);
}
"""

_REMOVE_BADGES_JS = "() => { document.querySelectorAll('.ja-badge').forEach(b => b.remove()); }"

SYSTEM = """You fill a job-application form for a candidate. You are shown a screenshot of the \
form with a red numbered badge on each empty field, plus a JSON list of those fields (each has \
a numeric id `ja`, a `kind`, its `label`/question, and `options` for selects/radios).

Return ONLY a JSON object: {"actions": [ ... ]}. Each action is one of:
- {"ja": N, "action": "type", "value": "..."}            for text/textarea/email/select-by-text
- {"ja": N, "action": "select", "value": "exact option"} for a <select> (use an option's text)
- {"ja": N, "action": "click"}                            to choose a radio/checkbox OPTION (use the option's ja)

Rules:
- Use ONLY facts from the candidate profile/resume. Never invent. If you don't know and the
  field is optional, omit it.
- For radio/checkbox groups, emit a single "click" action on the ja of the correct OPTION.
- For essay/free-text questions, write a concise, truthful, tailored answer as a "type" value.
- Match the candidate's real situation (work authorization, sponsorship, location, etc.)."""


def _decide(model: str, fields: list, screenshot_png: bytes | None,
            resume: str, profile: dict, posting: JobPosting) -> list:
    client = anthropic.Anthropic()
    text = (
        f"# Candidate profile\n{json.dumps(profile, indent=2)}\n\n"
        f"# Master resume\n{resume}\n\n"
        f"# Job\n{posting.role} at {posting.company}\n"
        f"JD (partial): {(posting.description or '')[:2500]}\n\n"
        f"# Form fields (the badges on the screenshot match these `ja` ids)\n{json.dumps(fields)[:12000]}\n\n"
        f"Return the JSON actions now."
    )
    content: list = [{"type": "text", "text": text}]
    if screenshot_png:
        try:
            b64 = base64.standard_b64encode(screenshot_png).decode()
            content.insert(0, {"type": "image", "source": {
                "type": "base64", "media_type": "image/png", "data": b64}})
        except Exception:
            pass
    resp = client.messages.create(
        model=model, max_tokens=4000, system=SYSTEM,
        messages=[{"role": "user", "content": content}],
    )
    raw = "".join(b.text for b in resp.content if b.type == "text").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1].lstrip("json").strip() if "```" in raw else raw
    try:
        return json.loads(raw).get("actions", [])
    except Exception:
        return []


def fill(page, model: str, resume: str, profile: dict, posting: JobPosting,
         report: FillReport) -> None:
    """Vision-fill the remaining empty fields (radios/selects/essays included)."""
    try:
        fields = json.loads(page.evaluate(_TAG_JS))
    except Exception as e:
        report.notes.append(f"vision: could not tag fields ({e})")
        return
    if not fields:
        return
    shot = None
    try:
        shot = page.screenshot(full_page=True)
    except Exception:
        pass
    actions = _decide(model, fields, shot, resume, profile, posting)
    try:
        page.evaluate(_REMOVE_BADGES_JS)
    except Exception:
        pass

    for a in actions:
        try:
            ja = a.get("ja")
            act = a.get("action")
            loc = page.locator(f'[data-ja="{ja}"]').first
            if not loc.count():
                continue
            label = next((f.get("label", "") for f in fields
                          if f.get("ja") == ja or any(o.get("ja") == ja
                          for o in f.get("options", []))), "")
            if act == "click":
                loc.scroll_into_view_if_needed(timeout=2000)
                loc.check(timeout=3000) if (loc.get_attribute("type") in ("radio", "checkbox")) else loc.click(timeout=3000)
                report.filled.append(f"[vision] {label[:40].strip()}")
            elif act == "select":
                loc.select_option(label=a.get("value", ""), timeout=2500)
                report.filled.append(f"[vision] {label[:40].strip()}")
            elif act == "type" and a.get("value"):
                loc.fill(a["value"], timeout=3000)
                report.filled.append(f"[vision] {label[:40].strip()}")
        except Exception:
            continue
