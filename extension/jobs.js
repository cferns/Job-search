// Job Search session dashboard: launch searches + track jobs (link, company, status).
const SEARCHES = [
  ["LinkedIn (remote)", (q) => "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(q) + "&f_WT=2"],
  ["Indeed (remote)", (q) => "https://www.indeed.com/jobs?q=" + encodeURIComponent(q) + "&l=Remote"],
  ["Greenhouse/Lever/Ashby", (q) => "https://www.google.com/search?q=" + encodeURIComponent(q + " (site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com)")],
  ["Remote + H1B", (q) => "https://www.google.com/search?q=" + encodeURIComponent(q + " remote H1B visa sponsorship jobs")],
];

function esc(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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
      `<td><select data-id="${j.id}" class="st s-${esc(j.status)}">` +
        ["Pending", "Applied", "Skipped"].map((s) => `<option ${j.status === s ? "selected" : ""}>${s}</option>`).join("") +
      `</select></td>` +
      `<td><button class="del" data-id="${j.id}" title="Remove">✕</button></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll("select.st").forEach((s) => {
    s.onchange = async () => {
      const jobs2 = await getJobs();
      const j = jobs2.find((x) => x.id === s.dataset.id);
      if (j) { j.status = s.value; await setJobs(jobs2); render(); }
    };
  });
  tb.querySelectorAll(".del").forEach((b) => {
    b.onclick = async () => {
      const jobs2 = (await getJobs()).filter((x) => x.id !== b.dataset.id);
      await setJobs(jobs2); render();
    };
  });
}

async function init() {
  const { jobQuery } = await chrome.storage.local.get("jobQuery");
  const q = ((jobQuery || "Technical Program Manager OR Product Manager data AI ML platform").split("\n")[0]).slice(0, 140);
  const sdiv = document.getElementById("searches");
  SEARCHES.forEach(([label, fn]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => chrome.tabs.create({ url: fn(q) });
    sdiv.appendChild(b);
  });
  render();
  // live-update if a job is added while this page is open
  chrome.storage.onChanged.addListener((ch) => { if (ch.jobs) render(); });
}

init();
