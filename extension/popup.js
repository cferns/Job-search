// Orchestrates: scrape the form on the active tab -> ask Claude for answers -> fill them.
const statusEl = document.getElementById("status");
const fillBtn = document.getElementById("fill");
document.getElementById("opts").onclick = () => chrome.runtime.openOptionsPage();

function setStatus(msg) { statusEl.textContent = msg; }

// ---- injected into the page: tag every visible empty field, return its metadata ----
function scrapeFields() {
  const isVis = (el) => {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none";
  };
  const labelFor = (el) => {
    const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim();
    const lid = el.getAttribute("aria-labelledby");
    if (lid) { const t = document.getElementById(lid.split(" ")[0]); if (t && t.innerText) return t.innerText.trim(); }
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l && l.innerText) return l.innerText.trim(); }
    let n = el;
    for (let i = 0; i < 6 && n; i++) {
      n = n.parentElement; if (!n) break;
      const l = n.querySelector('label,.application-label,legend,[class*="label"],[class*="question"]');
      if (l && l.innerText && l.innerText.trim().length > 2) return l.innerText.trim().split("\n")[0].slice(0, 160);
    }
    return el.getAttribute("placeholder") || el.getAttribute("name") || "";
  };
  let idx = 0; const out = []; const groups = {};
  document.querySelectorAll("input,textarea,select").forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "image", "reset"].includes(type)) return;
    if (!isVis(el)) return;
    if (tag === "input" && (type === "radio" || type === "checkbox")) {
      const name = el.getAttribute("name") || "grp" + idx;
      el.setAttribute("data-ja", idx);
      const opt = { label: labelFor(el) || el.value || "opt" + idx, ja: idx };
      if (groups[name] === undefined) { groups[name] = out.length; out.push({ kind: type, label: "", options: [opt], _first: idx }); }
      else out[groups[name]].options.push(opt);
      idx++; return;
    }
    // skip already-filled text/select
    if (tag === "select") { if (el.selectedIndex > 0 && el.value) return; }
    else if (el.value && el.value.trim()) return;
    el.setAttribute("data-ja", idx);
    const f = { ja: idx, kind: tag === "select" ? "select" : (tag === "textarea" ? "textarea" : "text"), label: labelFor(el) };
    if (tag === "select") f.options = [...el.options].map((o) => o.textContent.trim()).filter(Boolean);
    out.push(f); idx++;
  });
  out.forEach((f) => {
    if (f.kind === "radio" || f.kind === "checkbox") {
      const first = document.querySelector('[data-ja="' + f._first + '"]'); if (first) f.label = labelFor(first); delete f._first;
    }
  });
  return { fields: out, jd: (document.body.innerText || "").slice(0, 6000), url: location.href };
}

// ---- injected into the page: apply Claude's actions (React-safe) ----
function applyActions(actions) {
  const setNativeValue = (el, value) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  let n = 0;
  for (const a of actions || []) {
    try {
      const el = document.querySelector('[data-ja="' + a.ja + '"]'); if (!el) continue;
      if (a.action === "click") { el.click(); n++; }
      else if (a.action === "select") {
        const opt = [...el.options].find((o) => o.textContent.trim().toLowerCase() === String(a.value).trim().toLowerCase())
          || [...el.options].find((o) => o.textContent.trim().toLowerCase().includes(String(a.value).trim().toLowerCase()));
        if (opt) { el.value = opt.value; el.dispatchEvent(new Event("change", { bubbles: true })); n++; }
      } else if (a.action === "type" && a.value) { setNativeValue(el, a.value); n++; }
    } catch (e) { /* skip */ }
  }
  return n;
}

const SYSTEM = `You fill a job-application form for a candidate. You get a JSON list of empty fields \
(each: numeric id "ja", "kind", its "label"/question, and "options" for selects/radios). \
Return ONLY JSON: {"actions":[...]}. Each action: \
{"ja":N,"action":"type","value":"..."} for text/textarea; \
{"ja":N,"action":"select","value":"exact option text"} for a <select>; \
{"ja":N,"action":"click"} where ja is the OPTION's id, to pick a radio/checkbox. \
Use ONLY facts from the candidate profile/resume — never invent. Omit optional fields you can't \
answer. For radio groups emit one click on the correct option's ja. For essays, write a concise, \
truthful, tailored answer. Match the candidate's real work-authorization, sponsorship, and location.`;

async function callClaude(cfg, data) {
  const user =
    "# Candidate profile\n" + cfg.profile + "\n\n# Master resume\n" + cfg.resume +
    "\n\n# Page URL\n" + data.url + "\n\n# Page text (for context)\n" + data.jd +
    "\n\n# Empty form fields\n" + JSON.stringify(data.fields).slice(0, 14000) +
    "\n\nReturn the JSON actions now.";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: 4000, system: SYSTEM,
      messages: [{ role: "user", content: user }] }),
  });
  if (!resp.ok) throw new Error("API " + resp.status + ": " + (await resp.text()).slice(0, 200));
  const j = await resp.json();
  let txt = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (txt.startsWith("```")) txt = txt.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  return JSON.parse(txt).actions || [];
}

fillBtn.onclick = async () => {
  fillBtn.disabled = true;
  try {
    const cfg = await chrome.storage.local.get(["apiKey", "model", "resume", "profile"]);
    if (!cfg.apiKey) { setStatus("Set your Anthropic API key in Settings first."); return; }
    cfg.model = cfg.model || "claude-sonnet-4-6";
    cfg.resume = cfg.resume || ""; cfg.profile = cfg.profile || "";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    setStatus("Reading the form…");
    const r1 = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeFields });
    const data = r1[0].result;
    if (!data.fields.length) { setStatus("No empty fields found on this page. Are you on the application form (not the job description)?"); return; }

    setStatus("Asking Claude to answer " + data.fields.length + " fields… (~10–30s)");
    const actions = await callClaude(cfg, data);

    setStatus("Filling…");
    const r2 = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: applyActions, args: [actions] });
    setStatus("Filled " + (r2[0].result || 0) + " fields. Review everything, then submit yourself.\n(Some custom widgets/CAPTCHAs may still need you.)");
  } catch (e) {
    setStatus("Error: " + (e.message || e));
  } finally {
    fillBtn.disabled = false;
  }
};
