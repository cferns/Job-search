// Job Search session dashboard. SEARCHES, isJobUrl, getCfg, runFillOnTab come from core.js.
function esc(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fitCell(j) {
  if (j.confidence === undefined || j.confidence === null || j.confidence === "") return "<td>—</td>";
  const c = Number(j.confidence);
  const col = c >= 70 ? "#2a8a4a" : (c >= 45 ? "#c98a00" : "#c33");
  return `<td title="${esc(j.fit_reason || "")}"><b style="color:${col}">${c}%</b></td>`;
}
function dspin(on) { const s = document.getElementById("dspin"); if (s) s.style.display = on ? "inline-block" : "none"; }
async function getJobs() { return (await chrome.storage.local.get("jobs")).jobs || []; }
async function setJobs(jobs) { await chrome.storage.local.set({ jobs }); }

async function render() {
  const jobs = await getJobs();
  const tb = document.getElementById("rows");
  document.getElementById("empty").style.display = jobs.length ? "none" : "block";
  const counts = jobs.reduce((m, j) => ((m[j.status] = (m[j.status] || 0) + 1), m), {});
  document.getElementById("stats").textContent = jobs.length
    ? `${jobs.length} jobs · ${counts.Applied || 0} applied · ${counts.Pending || 0} pending · ${counts.Skipped || 0} skipped`
    : "";
  tb.innerHTML = "";
  const ft = (document.getElementById("filterText")?.value || "").toLowerCase();
  const fs = document.getElementById("filterStatus")?.value || "All";
  const sb = document.getElementById("sortBy")?.value || "fit";
  let sorted = jobs.filter((j) =>
    (fs === "All" || j.status === fs) &&
    (!ft || ((j.company || "") + " " + (j.title || "") + " " + (j.desc || "")).toLowerCase().includes(ft)));
  sorted.sort((a, b) => {
    if (sb === "company") return (a.company || a.title || "").localeCompare(b.company || b.title || "");
    if (sb === "date") return (b.date || "").localeCompare(a.date || "");
    return Number(b.confidence ?? -1) - Number(a.confidence ?? -1);
  });
  sorted.forEach((j) => {
    const tr = document.createElement("tr");
    const company = j.company || (j.title || "").split(/ [-|@] | at /)[1] || "";
    tr.innerHTML =
      `<td>${esc(company)}</td>` +
      `<td><a href="${esc(j.url)}" target="_blank">${esc(j.title || j.url)}</a></td>` +
      `<td style="white-space:nowrap;color:#666;">${esc(j.date || "")}</td>` +
      `<td class="desc">${esc(j.desc || "")}</td>` +
      fitCell(j) +
      `<td><select data-id="${j.id}" class="st">` + ["Pending", "Applied", "Skipped"].map((s) => `<option ${j.status === s ? "selected" : ""}>${s}</option>`).join("") + `</select></td>` +
      `<td><button class="apply" data-id="${j.id}" style="background:#4f8cff;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-weight:600;">Auto-apply ▶</button> <span class="msg" data-msg="${j.id}" style="font-size:11px;color:#666;"></span></td>` +
      `<td><button class="del" data-id="${j.id}" title="Remove">✕</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll("select.st").forEach((s) => { s.onchange = async () => {
    const jobs2 = await getJobs(); const j = jobs2.find((x) => x.id === s.dataset.id); if (j) { j.status = s.value; await setJobs(jobs2); render(); } }; });
  tb.querySelectorAll(".del").forEach((b) => { b.onclick = async () => {
    await setJobs((await getJobs()).filter((x) => x.id !== b.dataset.id)); render(); }; });
  tb.querySelectorAll(".apply").forEach((b) => { b.onclick = () => autoApply(b.dataset.id, b); });
}

async function autoApply(id, btn) {
  const cfg = await getCfg();
  const msg = document.querySelector('[data-msg="' + id + '"]');
  if (!cfg.apiKey) { msg.textContent = "Set API key in Settings"; return; }
  const job = (await getJobs()).find((x) => x.id === id);
  if (!job) return;
  await ensureAccess();
  btn.disabled = true; dspin(true);
  try {
    msg.textContent = "opening…";
    const tab = await chrome.tabs.create({ url: job.url, active: true });
    await waitTabComplete(tab.id); await sleep(2500);
    const res = await runFillOnTab(tab.id, cfg, (s) => { msg.textContent = s; }, { title: job.title, company: job.company });
    msg.textContent = res.error ? "no form found — open & fill manually" : ("filled " + res.filled + " — review & submit");
  } catch (e) {
    msg.textContent = "error: " + (e.message || e);
  } finally {
    btn.disabled = false; dspin(false);
  }
}

async function runSearch(q, btn) {
  const setS = (m) => { document.getElementById("stats").textContent = m; };
  const cfg = await getCfg();
  if (!cfg.apiKey) { setS("Set your Anthropic API key in Settings first."); return; }
  btn.disabled = true; const orig = btn.textContent; btn.textContent = "Searching…"; dspin(true);
  try {
    setS("Searching the web for jobs… (~20–40s)");
    const found = await searchJobs(cfg, q);
    const jobs = await getJobs(); const have = new Set(jobs.map((j) => j.url));
    let added = 0;
    for (const f of found) {
      if (f && f.url && !have.has(f.url)) {
        jobs.push({ id: Date.now().toString(36) + added, url: f.url, title: f.title || f.url, company: f.company || "", desc: f.description || "", confidence: f.confidence, fit_reason: f.fit_reason || "", status: "Pending", date: new Date().toISOString().slice(0, 10) });
        have.add(f.url); added++;
      }
    }
    await setJobs(jobs); render();
    setS("Found " + found.length + " · added " + added + " new job(s).");
  } catch (e) {
    setS("Search error: " + (e.message || e));
  } finally {
    btn.disabled = false; btn.textContent = orig; dspin(false);
  }
}

async function findJobs() {
  const { jobQuery } = await chrome.storage.local.get("jobQuery");
  const q = jobQuery || "Technical Program Manager OR Product Manager, data/AI/ML platforms, remote, H1B sponsorship";
  runSearch(q, document.getElementById("findJobs"));
}

async function findByCompanies() {
  const c = document.getElementById("companies").value.trim();
  if (!c) { document.getElementById("stats").textContent = "Enter company names (comma separated)."; return; }
  const { jobQuery } = await chrome.storage.local.get("jobQuery");
  const role = (jobQuery || "Technical Program Manager OR Product Manager, data/AI/ML").split("\n")[0];
  const q = role + "\nONLY at these companies — check each company's careers page / Greenhouse-Lever-Ashby board: " + c;
  runSearch(q, document.getElementById("searchCompanies"));
}

async function refreshList() {
  const setS = (m) => { document.getElementById("stats").textContent = m; };
  const btn = document.getElementById("refresh"); btn.disabled = true; const orig = btn.textContent; dspin(true);
  try {
    const jobs = await getJobs();
    const missing = jobs.filter((j) => j.confidence === undefined || j.confidence === null || j.confidence === "");
    if (missing.length) {
      const cfg = await getCfg();
      if (!cfg.apiKey) { setS("Set your API key in Settings to score Fit."); }
      else {
        btn.textContent = "Scoring…"; setS("Scoring " + missing.length + " job(s) for Fit…");
        const scored = await scoreJobs(cfg, missing.map((j) => ({ title: j.title, company: j.company, desc: j.desc })));
        scored.forEach((s) => { const j = missing[s.i]; if (j) { j.confidence = s.confidence; j.fit_reason = s.fit_reason || ""; } });
        await setJobs(jobs);
      }
    }
    render();
    setS("Sorted by Fit." + (missing.length ? " Scored " + missing.length + " new." : ""));
  } catch (e) {
    setS("Refresh error: " + (e.message || e));
  } finally {
    btn.disabled = false; btn.textContent = orig; dspin(false);
  }
}

async function renderArchive() {
  const arch = (await chrome.storage.local.get("tailoredArchive")).tailoredArchive || [];
  const div = document.getElementById("archive");
  if (!arch.length) { div.innerHTML = '<div style="color:#888">None yet — “Tailor &amp; Fill” saves each tailored resume + cover letter here.</div>'; return; }
  div.innerHTML = arch.slice().reverse().map((a) => {
    const when = (() => { try { return new Date(a.ts).toLocaleString(); } catch (e) { return a.ts || ""; } })();
    const label = esc((a.company ? a.company + " · " : "") + (a.title || a.url));
    let links = `<a href="${a.resumeDataUrl}" download="resume.pdf">⬇ Resume</a>`;
    if (a.coverDataUrl) links += ` · <a href="${a.coverDataUrl}" download="cover-letter.pdf">⬇ Cover letter</a>`;
    return `<div style="padding:7px 0;border-bottom:1px solid #eee;font-size:13px;"><b>${label}</b> <span style="color:#aaa">${esc(when)}</span><br>${links} · <a href="#" class="arcdel" data-id="${a.id}" style="color:#c33">✕ remove</a></div>`;
  }).join("");
  div.querySelectorAll(".arcdel").forEach((b) => { b.onclick = async (e) => {
    e.preventDefault();
    const arch2 = ((await chrome.storage.local.get("tailoredArchive")).tailoredArchive || []).filter((x) => x.id !== b.dataset.id);
    await chrome.storage.local.set({ tailoredArchive: arch2 }); renderArchive();
  }; });
}

async function init() {
  document.getElementById("findJobs").onclick = findJobs;
  document.getElementById("refresh").onclick = refreshList;
  document.getElementById("searchCompanies").onclick = findByCompanies;
  document.getElementById("filterText").oninput = render;
  document.getElementById("filterStatus").onchange = render;
  document.getElementById("sortBy").onchange = render;
  render();
  renderArchive();
  chrome.storage.onChanged.addListener((ch) => { if (ch.jobs) render(); if (ch.tailoredArchive) renderArchive(); });
}

init();
