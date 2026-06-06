// Structured profile — a separate field for every common job-application question.
const YN = ["Yes", "No"];
const GENDER = ["Decline to self-identify", "Male", "Female", "Non-binary"];
const RACE = ["Decline to self-identify", "Asian", "Black or African American",
  "Hispanic or Latino", "White", "Native American or Alaska Native",
  "Native Hawaiian or Pacific Islander", "Two or more races"];
const VET = ["I am not a protected veteran",
  "I identify as one or more of the classifications of a protected veteran",
  "Decline to self-identify"];
const DIS = ["Decline to self-identify", "No, I do not have a disability",
  "Yes, I have a disability or have had one in the past"];

// section, key, label, default, type(text|select), options
const FIELDS = [
  ["Contact", "firstName", "First name", "Clinton"],
  ["Contact", "lastName", "Last name", "Fernandes"],
  ["Contact", "preferredName", "Preferred name", "Clinton"],
  ["Contact", "email", "Email", "clintonfernandes4u@gmail.com"],
  ["Contact", "phone", "Phone", "+1 801-946-9693"],
  ["Contact", "addressLine", "Street address", ""],
  ["Contact", "city", "City", "Saint Paul"],
  ["Contact", "state", "State / Province", "Minnesota"],
  ["Contact", "zip", "ZIP / Postal code", ""],
  ["Contact", "country", "Country", "United States"],

  ["Links", "linkedin", "LinkedIn URL", ""],
  ["Links", "github", "GitHub URL", ""],
  ["Links", "portfolio", "Portfolio / Website", ""],
  ["Links", "twitter", "Twitter / X URL", ""],

  ["Professional", "currentCompany", "Current company", "Target"],
  ["Professional", "currentTitle", "Current title", "Lead Technical Program Manager"],
  ["Professional", "yearsExperience", "Years of experience", "8"],
  ["Professional", "desiredSalary", "Desired compensation", "175,000-200,000 USD (flexible)"],
  ["Professional", "earliestStart", "Earliest start / notice period", "Two weeks' notice"],
  ["Professional", "highestEducation", "Highest education", "M.S. in Robotics"],
  ["Professional", "school", "School / University", "University of Utah"],
  ["Professional", "gradYear", "Graduation year", "2017"],

  ["Work authorization", "workAuthorized", "Authorized to work in the US?", "Yes", "select", YN],
  ["Work authorization", "needsSponsorship", "Require visa sponsorship (now or future)?", "Yes", "select", YN],
  ["Work authorization", "visaStatus", "Visa status / notes", "Seeking H1B sponsorship"],
  ["Work authorization", "over18", "Are you 18 or older?", "Yes", "select", YN],
  ["Work authorization", "willingToRelocate", "Willing to relocate?", "Open to discuss", "select", ["Open to discuss", "Yes", "No"]],
  ["Work authorization", "remotePreference", "Remote / onsite preference", "Remote"],
  ["Work authorization", "workLocationState", "State you'll work from", "Minnesota"],
  ["Work authorization", "citizenship", "Citizenship / country (optional)", ""],

  ["Demographics (EEO — optional)", "gender", "Gender", "Decline to self-identify", "select", GENDER],
  ["Demographics (EEO — optional)", "race", "Race / Ethnicity", "Decline to self-identify", "select", RACE],
  ["Demographics (EEO — optional)", "hispanicLatino", "Hispanic / Latino?", "Decline to self-identify", "select", ["Decline to self-identify", "Yes", "No"]],
  ["Demographics (EEO — optional)", "veteranStatus", "Veteran status", "I am not a protected veteran", "select", VET],
  ["Demographics (EEO — optional)", "disability", "Disability status", "Decline to self-identify", "select", DIS],
  ["Demographics (EEO — optional)", "pronouns", "Pronouns", ""],

  ["Other common questions", "howHeard", "How did you hear about us?", "LinkedIn"],
  ["Other common questions", "employedHereBefore", "Previously employed at this company?", "No", "select", YN],
  ["Other common questions", "currentlyEmployedHere", "Currently employed at this company?", "No", "select", YN],
  ["Other common questions", "nonCompete", "Subject to a non-compete / prior-employer agreement?", "No", "select", YN],
  ["Other common questions", "referralName", "Referral name (if any)", ""],
  ["Other common questions", "languages", "Languages", "English"],
  ["Other common questions", "requireAccommodation", "Require accommodation for the process?", "No", "select", YN],
];

const DEFAULT_RESUME = `# Clinton Fernandes — Lead Technical Program Manager (Data, AI & ML Platforms)
clintonfernandes4u@gmail.com

## Summary
Drives enterprise AI/Data transformation — connects platforms, governance, and people to
measurable outcomes. Fluent across MLOps, GenAI, GCP/Vertex AI, Power BI, Looker, and
operating-model design / executive governance.

## Target (May 2018 – Present)
- Lead TPM, Data Modernization (Sep 2025–present): leading enterprise data consumption/analytics
  modernization; built an intake-to-delivery playbook; decommissioning 4+ legacy tools and
  migrating 615 directors (40+ Data Science directors) onto modern data/visualization platforms.
- Lead TPM, MLOps (Apr 2024–Aug 2025): led the enterprise MLOps program; cut model
  time-to-production from 6+ months to under 1 month; onboarded 40+ product teams; ran
  governance aligning 400+ stakeholders; defined the MLOps maturity model.
- PM, Advanced ML Recommendation (gig): owned roadmap; with 8+ scientists/engineers improved
  ranking models; drove $25M+ in attributable demand.
- PM, AI for Marketing & Digital (gig): launched GenAI MVPs for text/image/metadata generation;
  ~$1M+ projected impact.
- Computer Vision & Robotics Lead Engineer (2018–2024): built 3D scanning robotics, mobile AR,
  neural networks for content creation, virtual apparel try-on, mobile 3D capture. 1st place
  Target CodeRED hackathon 2019 & 2022.

## Education
M.S. Robotics, University of Utah (2017). B.E. Mechanical Engineering, Goa University (2014).

## Skills
Technical & product program management, MLOps, GenAI, ML recommendation/ranking, enterprise data
modernization, BI & self-service analytics, data governance, operating-model design, executive
governance, GCP/Vertex AI, Looker, Power BI, Python.`;

function render(saved) {
  const root = document.getElementById("fields");
  let html = ""; let section = "";
  for (const [sec, key, label, def, type, opts] of FIELDS) {
    if (sec !== section) { html += `</div><h2>${sec}</h2><div class="grid">`; section = sec; }
    const val = (saved && saved[key] !== undefined) ? saved[key] : def;
    if (type === "select") {
      const o = opts.map((x) => `<option ${x === val ? "selected" : ""}>${x}</option>`).join("");
      html += `<div class="f"><label>${label}</label><select data-k="${key}">${o}</select></div>`;
    } else {
      html += `<div class="f"><label>${label}</label><input data-k="${key}" value="${(val || "").replace(/"/g, "&quot;")}" /></div>`;
    }
  }
  root.innerHTML = html.replace(/^<\/div>/, "") + "</div>";
}

async function load() {
  const cfg = await chrome.storage.local.get(["apiKey", "model", "resume", "profileData"]);
  document.getElementById("apiKey").value = cfg.apiKey || "";
  document.getElementById("model").value = cfg.model || "claude-sonnet-4-6";
  document.getElementById("resume").value = cfg.resume || DEFAULT_RESUME;
  render(cfg.profileData || {});
}

document.getElementById("save").onclick = async () => {
  const data = {};
  document.querySelectorAll("[data-k]").forEach((el) => { data[el.dataset.k] = el.value.trim(); });
  // human-readable block for the model prompt
  const labelByKey = Object.fromEntries(FIELDS.map((f) => [f[1], f[2]]));
  const profile = Object.entries(data)
    .filter(([, v]) => v && !/\(add your URL\)/i.test(v))
    .map(([k, v]) => `${labelByKey[k]}: ${v}`).join("\n");
  await chrome.storage.local.set({
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value,
    resume: document.getElementById("resume").value,
    profileData: data,
    profile,
  });
  const s = document.getElementById("status");
  s.textContent = "Saved ✓";
  setTimeout(() => (s.textContent = ""), 2000);
};

load();
