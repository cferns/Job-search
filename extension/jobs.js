// Job Search session dashboard. SEARCHES, isJobUrl, getCfg, runFillOnTab come from core.js.
function esc(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fitCell(j) {
  if (j.confidence === undefined || j.confidence === null || j.confidence === "") return "<td>—</td>";
  const c = Number(j.confidence);
  const col = c >= 70 ? "#2a8a4a" : (c >= 45 ? "#c98a00" : "#c33");
  return `<td title="${esc(j.fit_reason || "")}"><b style="color:${col}">${c}%</b></td>`;
}
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
  jobs.slice().reverse().forEach((j) => {
    const tr = document.createElement("tr");
    const company = j.company || (j.title || "").split(/ [-|@] | at /)[1] || "";
    tr.innerHTML =
      `<td>${esc(company)}</td>` +
      `<td><a href="${esc(j.url)}" target="_blank">${esc(j.title || j.url)}</a><div style="color:#aaa;font-size:11px">${esc(j.date || "")}</div></td>` +
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
  btn.disabled = true;
  try {
    msg.textContent = "opening…";
    const tab = await chrome.tabs.create({ url: job.url, active: true });
    await waitTabComplete(tab.id); await sleep(2500);
    const res = await runFillOnTab(tab.id, cfg, (s) => { msg.textContent = s; });
    msg.textContent = res.error ? "no form found — open & fill manually" : ("filled " + res.filled + " — review & submit");
  } catch (e) {
    msg.textContent = "error: " + (e.message || e);
  } finally {
    btn.disabled = false;
  }
}

async function findJobs() {
  const setS = (m) => { document.getElementById("stats").textContent = m; };
  const cfg = await getCfg();
  if (!cfg.apiKey) { setS("Set your Anthropic API key in Settings first."); return; }
  const btn = document.getElementById("findJobs"); btn.disabled = true; const orig = btn.textContent; btn.textContent = "Searching…";
  try {
    const { jobQuery } = await chrome.storage.local.get("jobQuery");
    const q = jobQuery || "Technical Program Manager OR Product Manager, data/AI/ML platforms, remote, H1B sponsorship";
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
    btn.disabled = false; btn.textContent = orig;
  }
}

async function init() {
  const { jobQuery } = await chrome.storage.local.get("jobQuery");
  const q = ((jobQuery || "Technical Program Manager OR Product Manager data AI ML platform").split("\n")[0]).slice(0, 140);
  const sdiv = document.getElementById("searches");
  SEARCHES.forEach(([label, fn]) => {
    const b = document.createElement("button"); b.textContent = label; b.onclick = () => chrome.tabs.create({ url: fn(q) }); sdiv.appendChild(b);
  });
  document.getElementById("findJobs").onclick = findJobs;
  render();
  chrome.storage.onChanged.addListener((ch) => { if (ch.jobs) render(); });
}

init();
