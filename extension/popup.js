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
  const txt = (el) => (el && el.innerText ? el.innerText.trim() : "");
  // The QUESTION for a radio/checkbox group: the shared label/legend above the options.
  const groupQuestion = (el) => {
    let n = el;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement; if (!n) break;
      if (n.matches('fieldset,[role="radiogroup"],[role="group"],.application-question,li,[class*="question"],[class*="field"]')) {
        const lab = n.querySelector(".application-label, legend, label, h2, h3, h4");
        const t = txt(lab) || txt(n).split("\n")[0];
        if (t && t.length > 3) return t.slice(0, 180);
      }
    }
    return "";
  };
  // The label of a single option (Yes / No / a choice).
  const optionLabel = (el) => {
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (txt(l)) return txt(l); }
    const wrap = el.closest("label"); if (txt(wrap)) return txt(wrap);
    const sib = el.nextElementSibling; if (txt(sib)) return txt(sib);
    return el.value || "option";
  };
  // Generic label for text/select fields.
  const labelFor = (el) => {
    const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim();
    const lid = el.getAttribute("aria-labelledby");
    if (lid) { const t = document.getElementById(lid.split(" ")[0]); if (txt(t)) return txt(t); }
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (txt(l)) return txt(l); }
    let n = el;
    for (let i = 0; i < 6 && n; i++) {
      n = n.parentElement; if (!n) break;
      const l = n.querySelector('label,.application-label,legend,[class*="label"],[class*="question"]');
      if (txt(l) && txt(l).length > 2) return txt(l).split("\n")[0].slice(0, 160);
    }
    return el.getAttribute("placeholder") || el.getAttribute("name") || "";
  };
  let idx = 0; const out = []; const groups = {};
  // Native inputs + common ARIA custom widgets.
  document.querySelectorAll('input,textarea,select,[role="radio"],[role="checkbox"]').forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase();
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "image", "reset"].includes(type)) return;
    if (!isVis(el)) return;
    const isChoice = (tag === "input" && (type === "radio" || type === "checkbox")) || role === "radio" || role === "checkbox";
    if (isChoice) {
      const name = el.getAttribute("name") || ("grp_" + (groupQuestion(el) || idx));
      el.setAttribute("data-ja", idx);
      const opt = { label: optionLabel(el) || "opt" + idx, ja: idx };
      if (groups[name] === undefined) { groups[name] = out.length; out.push({ kind: "radio", label: groupQuestion(el), options: [opt] }); }
      else out[groups[name]].options.push(opt);
      idx++; return;
    }
    if (tag === "select") { if (el.selectedIndex > 0 && el.value) return; }
    else if (el.value && el.value.trim()) return;
    el.setAttribute("data-ja", idx);
    const f = { ja: idx, kind: tag === "select" ? "select" : (tag === "textarea" ? "textarea" : "text"), label: labelFor(el) };
    if (tag === "select") f.options = [...el.options].map((o) => o.textContent.trim()).filter(Boolean);
    out.push(f); idx++;
  });
  return { fields: out, jd: (document.body.innerText || "").slice(0, 6000), url: location.href };
}

// ---- injected into the page: apply Claude's actions (React-safe; handles typeaheads) ----
async function applyActions(actions) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setNativeValue = (el, value) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  // Autocomplete/typeahead (location, school, etc.): set text, let suggestions load, click the match.
  const isCombo = (el) =>
    el.getAttribute("role") === "combobox" ||
    el.getAttribute("aria-autocomplete") ||
    el.getAttribute("aria-controls") ||
    el.getAttribute("aria-expanded") !== null ||
    /select|combobox|typeahead|autocomplete|location/i.test((el.className || "") + (el.id || "") + (el.name || ""));
  const fillCombo = async (el, value) => {
    el.focus();
    setNativeValue(el, value);
    const k = value.slice(-1);
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: k }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: k }));
    for (let wait = 0; wait < 4; wait++) {
      await sleep(500);
      const want = value.toLowerCase().split(",")[0].trim();
      let opts = [...document.querySelectorAll(
        '[role="option"],ul[role="listbox"] li,.select__option,[class*="option"],[class*="suggestion"],[class*="menu"] li')]
        .filter((o) => o.offsetParent !== null && o.innerText && o.innerText.trim());
      let pick = opts.find((o) => o.innerText.toLowerCase().includes(want)) || opts[0];
      if (pick) { pick.click(); return true; }
    }
    // fallback: keyboard arrow-down + enter
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    return false;
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
      } else if (a.action === "type" && a.value) {
        if (isCombo(el)) { await fillCombo(el, a.value); n++; }
        else { setNativeValue(el, a.value); n++; }
      }
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
  const learnedTxt = cfg.learned && Object.keys(cfg.learned).length
    ? "\n\n# Saved answers (reuse when a field's question matches — but the Candidate profile above WINS on any conflict)\n" +
      Object.entries(cfg.learned).map(([q, a]) => "Q: " + q + "\nA: " + a).join("\n")
    : "";
  const user =
    "# Candidate profile\n" + cfg.profile + "\n\n# Master resume\n" + cfg.resume +
    learnedTxt +
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
    const cfg = await chrome.storage.local.get(["apiKey", "model", "resume", "profile", "learned", "resumeFile"]);
    if (!cfg.apiKey) { setStatus("Set your Anthropic API key in Settings first."); return; }
    cfg.model = cfg.model || "claude-sonnet-4-6";
    cfg.resume = cfg.resume || ""; cfg.profile = cfg.profile || "";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    setStatus("Reading the form (incl. embedded frames)…");
    // Run in EVERY frame — application forms are often inside an iframe (e.g. Greenhouse).
    const all = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: scrapeFields });
    const candidates = all.filter((r) => r.result && r.result.fields && r.result.fields.length)
      .sort((a, b) => b.result.fields.length - a.result.fields.length);
    if (!candidates.length) { setStatus("No empty fields found in any frame. Are you on the application form (not the job description)? If it's an embedded form, click into it first."); return; }
    const best = candidates[0];
    const data = best.result;
    const frameTarget = { tabId: tab.id, frameIds: [best.frameId] };

    setStatus("Asking Claude to answer " + data.fields.length + " fields… (~10–30s)");
    const actions = await callClaude(cfg, data);

    setStatus("Filling…");
    const r2 = await chrome.scripting.executeScript({ target: frameTarget, func: applyActions, args: [actions] });

    let resumeMsg = "";
    if (cfg.resumeFile && cfg.resumeFile.dataUrl) {
      setStatus("Attaching resume…");
      const r3 = await chrome.scripting.executeScript({ target: frameTarget, func: applyResume, args: [cfg.resumeFile] });
      resumeMsg = (r3[0].result ? "\nResume attached." : "\n(No file-upload field found — some sites use Attach/Dropbox buttons that need a manual click.)");
    } else {
      resumeMsg = "\n(Pick a resume PDF in Settings to auto-attach it.)";
    }
    await recordJob(tab, data.jd);
    setStatus("Filled " + (r2[0].result || 0) + " fields." + resumeMsg +
      "\nReview everything, then submit yourself. Saved to your Job Search session.");
  } catch (e) {
    setStatus("Error: " + (e.message || e));
  } finally {
    fillBtn.disabled = false;
  }
};

// ---- injected: attach the stored resume to the best-matching file input ----
async function applyResume(file) {
  try {
    const all = [...document.querySelectorAll('input[type="file"]')];
    if (!all.length || !file || !file.dataUrl) return 0;
    let target = all.find((i) => /resume|cv/i.test(
      (i.name || "") + (i.id || "") + (i.getAttribute("aria-label") || "") +
      (i.closest("label") ? i.closest("label").innerText : "")));
    if (!target) target = all[0];
    const res = await fetch(file.dataUrl);
    const blob = await res.blob();
    const f = new File([blob], file.name || "resume.pdf", { type: file.type || "application/pdf" });
    const dt = new DataTransfer(); dt.items.add(f);
    target.files = dt.files;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return 1;
  } catch (e) { return 0; }
}

// ---- injected: read what's currently filled, return [{question, answer}] ----
function scrapeAnswers() {
  const txt = (el) => (el && el.innerText ? el.innerText.trim() : "");
  const labelUp = (el) => {
    const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim();
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (txt(l)) return txt(l); }
    let n = el;
    for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (!n) break;
      const l = n.querySelector('label,.application-label,legend,[class*="label"],[class*="question"]');
      if (txt(l) && txt(l).length > 2) return txt(l).split("\n")[0].slice(0, 180); }
    return el.getAttribute("placeholder") || el.getAttribute("name") || "";
  };
  const groupQ = (el) => {
    let n = el;
    for (let i = 0; i < 8 && n; i++) { n = n.parentElement; if (!n) break;
      if (n.matches('fieldset,[role="radiogroup"],.application-question,li,[class*="question"]')) {
        const lab = n.querySelector(".application-label, legend, label");
        const t = txt(lab) || txt(n).split("\n")[0];
        if (t && t.length > 3) return t.slice(0, 180); } }
    return "";
  };
  const out = [];
  document.querySelectorAll("input,textarea,select").forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "image", "reset", "password"].includes(type)) return;
    if (tag === "input" && (type === "radio" || type === "checkbox")) {
      if (el.checked) { const q = groupQ(el); const wrap = el.closest("label"); const a = txt(wrap) || el.value;
        if (q && a) out.push({ question: q, answer: a }); }
    } else {
      const v = tag === "select" ? (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value) : el.value;
      if (v && v.trim()) out.push({ question: labelUp(el), answer: v.trim() });
    }
  });
  return out;
}

// ---- Job searches: open the in-extension session dashboard ----
document.getElementById("search").onclick = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("jobs.html") });
};

async function recordJob(tab, desc) {
  try {
    const { jobs = [] } = await chrome.storage.local.get("jobs");
    if (jobs.some((j) => j.url === tab.url)) return;
    jobs.push({
      id: Date.now().toString(36), url: tab.url, title: tab.title || tab.url,
      desc: (desc || "").slice(0, 220), status: "Pending",
      date: new Date().toISOString().slice(0, 10),
    });
    await chrome.storage.local.set({ jobs });
  } catch (e) { /* ignore */ }
}

const saveBtn = document.getElementById("saveAns");
saveBtn.onclick = async () => {
  saveBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const r = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: scrapeAnswers });
    const pairs = r.flatMap((x) => x.result || []);
    const cur = (await chrome.storage.local.get("learned")).learned || {};
    let n = 0;
    for (const p of pairs) {
      const key = (p.question || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (key && p.answer) { cur[key] = p.answer; n++; }
    }
    await chrome.storage.local.set({ learned: cur });
    setStatus("Saved " + n + " answers. They'll be reused on future forms when the question matches.");
  } catch (e) {
    setStatus("Error saving: " + (e.message || e));
  } finally {
    saveBtn.disabled = false;
  }
};
