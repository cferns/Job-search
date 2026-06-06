// Popup UI — uses the shared engine in core.js.
const fillBtn = document.getElementById("fill");
function setStatus(msg) { document.getElementById("statusText").textContent = msg; }
function spin(on) { document.getElementById("spin").style.display = on ? "inline-block" : "none"; }

document.getElementById("opts").onclick = () => chrome.runtime.openOptionsPage();
document.getElementById("search").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("jobs.html") });

// Show download links for the most recently generated tailored resume + cover letter.
async function renderDownloads() {
  const { lastTailored } = await chrome.storage.local.get("lastTailored");
  const div = document.getElementById("downloads");
  if (!lastTailored || !lastTailored.resumeDataUrl) { div.innerHTML = ""; return; }
  let html = "Last tailored (" + (lastTailored.date || "") + "): ";
  html += `<a href="${lastTailored.resumeDataUrl}" download="Tailored-Resume.pdf">⬇ Resume</a>`;
  if (lastTailored.coverDataUrl) html += ` · <a href="${lastTailored.coverDataUrl}" download="Tailored-Cover-Letter.pdf">⬇ Cover letter</a>`;
  div.innerHTML = html;
}
renderDownloads();

async function recordJob(tab, desc) {
  try {
    const { jobs = [] } = await chrome.storage.local.get("jobs");
    if (jobs.some((j) => j.url === tab.url)) return;
    jobs.push({ id: Date.now().toString(36), url: tab.url, title: tab.title || tab.url,
      desc: (desc || "").slice(0, 220), status: "Pending", date: new Date().toISOString().slice(0, 10) });
    await chrome.storage.local.set({ jobs });
  } catch (e) { /* ignore */ }
}

fillBtn.onclick = async () => {
  fillBtn.disabled = true; spin(true);
  try {
    const cfg = await getCfg();
    if (!cfg.apiKey) { setStatus("Set your Anthropic API key in Settings first."); return; }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const title = tab.title || "";
    const company = title.split(/\s[-|–—]\s| at /)[0].trim();  // best-effort
    const res = await runFillOnTab(tab.id, cfg, setStatus, { title, company });
    if (res.error) {
      setStatus("No fillable form found (scanned " + (res.frames || 0) + " frames, " + (res.totalInputs || 0) + " inputs).\n"
        + (res.frames <= 1
          ? "Only the top page was readable — the form is in a blocked cross-origin frame. Fix: chrome://extensions → this extension → Details → Site access → 'On all sites', then retry."
          : "Inputs exist but weren't fillable here — the form may be in a closed shadow DOM or needs the Apply panel opened. Click into the form and retry."));
      return;
    }
    await recordJob(tab, res.jd);
    const rmsg = res.resume
      ? ("\nTailored resume" + (res.cover ? " + cover letter" : "") + " uploaded." + (res.savedFolder ? " Saved to your folder." : ""))
      : "\n(No resume upload field found — an Attach/Dropbox button may need a manual click.)";
    setStatus("Filled " + res.filled + " fields." + rmsg + "\nReview & submit yourself. Saved to your Job Search session.");
    renderDownloads();
  } catch (e) {
    setStatus("Error: " + (e.message || e));
  } finally {
    fillBtn.disabled = false; spin(false);
  }
};

const saveBtn = document.getElementById("saveAns");
saveBtn.onclick = async () => {
  saveBtn.disabled = true; spin(true);
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
    saveBtn.disabled = false; spin(false);
  }
};
