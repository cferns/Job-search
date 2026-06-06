// Structured profile — a separate field for every common job-application question,
// including full per-role Experience and Education entries (Workday-style sections).
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
const EMP = ["Full-time", "Contract", "Part-time", "Internship", "Open to discuss"];
const TRAVEL = ["Open to discuss", "Yes, up to 25%", "Yes, up to 50%", "Yes", "No"];
const DECLINE3 = ["Decline to self-identify", "Yes", "No"];

const BASE_FIELDS = [
  ["Contact", "firstName", "First name", "Clinton"],
  ["Contact", "middleName", "Middle name", ""],
  ["Contact", "lastName", "Last name", "Fernandes"],
  ["Contact", "preferredName", "Preferred name", "Clinton"],
  ["Contact", "email", "Email", "clintonfernandes4u@gmail.com"],
  ["Contact", "phone", "Phone", "+1 801-946-9693"],
  ["Contact", "addressLine", "Street address", ""],
  ["Contact", "addressLine2", "Address line 2", ""],
  ["Contact", "city", "City", "Saint Paul"],
  ["Contact", "state", "State / Province", "Minnesota"],
  ["Contact", "zip", "ZIP / Postal code", ""],
  ["Contact", "country", "Country", "United States"],

  ["Links", "linkedin", "LinkedIn URL", ""],
  ["Links", "github", "GitHub URL", ""],
  ["Links", "portfolio", "Portfolio / Website", ""],
  ["Links", "twitter", "Twitter / X URL", ""],

  ["Professional summary", "currentCompany", "Current company", "Target"],
  ["Professional summary", "currentTitle", "Current title", "Lead Technical Program Manager"],
  ["Professional summary", "yearsExperience", "Years of experience", "8"],
  ["Professional summary", "employmentType", "Desired employment type", "Full-time", "select", EMP],
  ["Professional summary", "desiredSalary", "Desired compensation", "175,000-200,000 USD (flexible)"],
  ["Professional summary", "currentSalary", "Current compensation (optional)", ""],
  ["Professional summary", "earliestStart", "Earliest start / notice period", "Two weeks' notice"],
  ["Professional summary", "willingToTravel", "Willing to travel?", "Open to discuss", "select", TRAVEL],
  ["Professional summary", "skills", "Key skills", "Technical & Product Program Management, MLOps, GenAI, ML recommendation/ranking, enterprise data modernization, BI & self-service analytics, data governance, GCP/Vertex AI, Looker, Power BI, Python, stakeholder alignment, roadmapping, executive governance", "area"],
  ["Professional summary", "certifications", "Certifications / licenses", "", "area"],

  ["Work authorization", "workAuthorized", "Authorized to work in the US?", "Yes", "select", YN],
  ["Work authorization", "needsSponsorship", "Require visa sponsorship (now or future)?", "Yes", "select", YN],
  ["Work authorization", "visaStatus", "Visa status / notes", "Seeking H1B sponsorship"],
  ["Work authorization", "over18", "Are you 18 or older?", "Yes", "select", YN],
  ["Work authorization", "willingToRelocate", "Willing to relocate?", "Open to discuss", "select", ["Open to discuss", "Yes", "No"]],
  ["Work authorization", "remotePreference", "Remote / onsite preference", "Remote"],
  ["Work authorization", "workLocationState", "State you'll work from", "Minnesota"],
  ["Work authorization", "citizenship", "Citizenship / country (optional)", ""],
  ["Work authorization", "securityClearance", "Security clearance", "None"],
  ["Work authorization", "previouslyApplied", "Previously applied to this company?", "No", "select", YN],
  ["Work authorization", "relatedToEmployee", "Related to a current employee?", "No", "select", YN],
  ["Work authorization", "driversLicense", "Valid driver's license?", "Yes", "select", YN],
  ["Work authorization", "felony", "Convicted of a felony? (sensitive — answer yourself)", ""],
];

// Full work history (each becomes its own "Experience N" section of fields).
const EXPERIENCE = [
  { company: "Target", title: "Lead Technical Program Manager — Data Modernization", location: "Minneapolis, MN (Remote)", start: "09/2025", end: "Present",
    desc: "Lead enterprise data consumption & analytics modernization across Target. Built an intake-to-delivery playbook; driving BI/self-service adoption; decommissioning 4+ legacy tools and migrating 615 directors (40+ Data Science directors) onto modern data/visualization platforms." },
  { company: "Target", title: "Lead Technical Program Manager — MLOps", location: "Minneapolis, MN", start: "04/2024", end: "08/2025",
    desc: "Led the enterprise MLOps program; cut model time-to-production from 6+ months to under 1 month; onboarded 40+ product teams; ran governance aligning 400+ stakeholders; defined the MLOps maturity model." },
  { company: "Target", title: "Product Manager — AI/ML (Recommendations & GenAI)", location: "Minneapolis, MN", start: "12/2022", end: "04/2024",
    desc: "Owned the roadmap for an ML recommendation engine (with 8+ scientists/engineers) that drove $25M+ in attributable demand; launched GenAI MVPs for text/image/metadata generation (~$1M+ projected impact)." },
  { company: "Target", title: "Computer Vision & Robotics Lead Engineer", location: "Minneapolis, MN", start: "05/2018", end: "04/2024",
    desc: "Built 3D scanning robotics, mobile AR apps, neural networks for content creation, a virtual apparel try-on, and a mobile 3D capture pipeline. 1st place, Target CodeRED hackathon (2019 & 2022)." },
  { company: "nView Medical", title: "Software Engineer Intern — Computer Vision", location: "Salt Lake City, UT", start: "10/2017", end: "12/2017",
    desc: "Integrated an Intel RealSense stereo camera with a medical imaging system; improved 3D reconstruction via X-ray/camera fusion and tracked surgical instruments in the C-arm reference frame." },
  { company: "University of Utah", title: "Research Assistant — Bio-Inspired Robots", location: "Salt Lake City, UT", start: "09/2015", end: "12/2017",
    desc: "NSF-funded quadruped robot research; designed, fabricated, and tested a hybrid leg that improved stability across terrains." },
  { company: "TURBOCAM India Pvt. Ltd.", title: "Junior Production Engineer", location: "Goa, India", start: "01/2015", end: "07/2015",
    desc: "Operated and managed 5-axis CNC milling machines producing aerospace and turbomachinery components (blades, impellers)." },
];

const EDUCATION = [
  { school: "University of Utah", degree: "M.S.", field: "Robotics", start: "2015", end: "2017", gpa: "" },
  { school: "Goa University", degree: "B.E.", field: "Mechanical Engineering", start: "2010", end: "2014", gpa: "" },
];

// Professional references (blank — fill with people who agreed to be a reference).
const REFERENCES = [
  { name: "", relationship: "", company: "", email: "", phone: "" },
  { name: "", relationship: "", company: "", email: "", phone: "" },
];

const EEO_FIELDS = [
  ["Demographics (EEO — optional)", "gender", "Gender", "Decline to self-identify", "select", GENDER],
  ["Demographics (EEO — optional)", "race", "Race / Ethnicity", "Decline to self-identify", "select", RACE],
  ["Demographics (EEO — optional)", "hispanicLatino", "Hispanic / Latino?", "Decline to self-identify", "select", DECLINE3],
  ["Demographics (EEO — optional)", "veteranStatus", "Veteran status", "I am not a protected veteran", "select", VET],
  ["Demographics (EEO — optional)", "disability", "Disability status", "Decline to self-identify", "select", DIS],
  ["Demographics (EEO — optional)", "sexualOrientation", "Sexual orientation (optional DEI)", "Decline to self-identify"],
  ["Demographics (EEO — optional)", "transgender", "Transgender? (optional DEI)", "Decline to self-identify", "select", DECLINE3],
  ["Demographics (EEO — optional)", "pronouns", "Pronouns", ""],

  ["Other common questions", "howHeard", "How did you hear about us?", "LinkedIn"],
  ["Other common questions", "employedHereBefore", "Previously employed at this company?", "No", "select", YN],
  ["Other common questions", "currentlyEmployedHere", "Currently employed at this company?", "No", "select", YN],
  ["Other common questions", "nonCompete", "Subject to a non-compete / prior-employer agreement?", "No", "select", YN],
  ["Other common questions", "referralName", "Referral name (if any)", ""],
  ["Other common questions", "languages", "Languages", "English"],
  ["Other common questions", "requireAccommodation", "Require accommodation for the process?", "No", "select", YN],
];

// Assemble FIELDS: base + experience entries + education entries + EEO/other.
const FIELDS = [...BASE_FIELDS];
EXPERIENCE.forEach((e, i) => {
  const s = `Experience ${i + 1}`;
  FIELDS.push([s, `exp${i + 1}_company`, "Company", e.company]);
  FIELDS.push([s, `exp${i + 1}_title`, "Title", e.title]);
  FIELDS.push([s, `exp${i + 1}_location`, "Location", e.location]);
  FIELDS.push([s, `exp${i + 1}_start`, "Start (MM/YYYY)", e.start]);
  FIELDS.push([s, `exp${i + 1}_end`, "End (MM/YYYY or Present)", e.end]);
  FIELDS.push([s, `exp${i + 1}_desc`, "Description", e.desc, "area"]);
});
EDUCATION.forEach((e, i) => {
  const s = `Education ${i + 1}`;
  FIELDS.push([s, `edu${i + 1}_school`, "School / University", e.school]);
  FIELDS.push([s, `edu${i + 1}_degree`, "Degree", e.degree]);
  FIELDS.push([s, `edu${i + 1}_field`, "Field of study", e.field]);
  FIELDS.push([s, `edu${i + 1}_start`, "Start year", e.start]);
  FIELDS.push([s, `edu${i + 1}_end`, "End year", e.end]);
  FIELDS.push([s, `edu${i + 1}_gpa`, "GPA (optional)", e.gpa]);
});
REFERENCES.forEach((r, i) => {
  const s = `Reference ${i + 1}`;
  FIELDS.push([s, `ref${i + 1}_name`, "Name", r.name]);
  FIELDS.push([s, `ref${i + 1}_relationship`, "Relationship", r.relationship]);
  FIELDS.push([s, `ref${i + 1}_company`, "Company", r.company]);
  FIELDS.push([s, `ref${i + 1}_email`, "Email", r.email]);
  FIELDS.push([s, `ref${i + 1}_phone`, "Phone", r.phone]);
});
FIELDS.push(...EEO_FIELDS);

const DEFAULT_RESUME = `# Clinton Fernandes — Lead Technical Program Manager (Data, AI & ML Platforms)
clintonfernandes4u@gmail.com

## Summary
Drives enterprise AI/Data transformation — connects platforms, governance, and people to
measurable outcomes. Fluent across MLOps, GenAI, GCP/Vertex AI, Power BI, Looker, and
operating-model design / executive governance.

## Target (May 2018 – Present)
- Lead TPM, Data Modernization (Sep 2025–present): leading enterprise data consumption/analytics
  modernization; built an intake-to-delivery playbook; decommissioning 4+ legacy tools and
  migrating 615 directors onto modern data/visualization platforms.
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
  let html = ""; let section = "";
  for (const [sec, key, label, def, type, opts] of FIELDS) {
    if (sec !== section) { html += `</div><h2>${sec}</h2><div class="grid">`; section = sec; }
    const val = (saved && saved[key] !== undefined) ? saved[key] : def;
    if (type === "select") {
      const o = opts.map((x) => `<option ${x === val ? "selected" : ""}>${x}</option>`).join("");
      html += `<div class="f"><label>${label}</label><select data-k="${key}">${o}</select></div>`;
    } else if (type === "area") {
      html += `<div class="f wide"><label>${label}</label><textarea class="small" data-k="${key}">${(val || "").replace(/</g, "&lt;")}</textarea></div>`;
    } else {
      html += `<div class="f"><label>${label}</label><input data-k="${key}" value="${(val || "").replace(/"/g, "&quot;")}" /></div>`;
    }
  }
  document.getElementById("fields").innerHTML = html.replace(/^<\/div>/, "") + "</div>";
}

async function load() {
  const cfg = await chrome.storage.local.get(["apiKey", "model", "resume", "profileData", "resumeFile"]);
  document.getElementById("apiKey").value = cfg.apiKey || "";
  document.getElementById("model").value = cfg.model || "claude-sonnet-4-6";
  document.getElementById("resume").value = cfg.resume || DEFAULT_RESUME;
  document.getElementById("resumeFileName").textContent =
    cfg.resumeFile && cfg.resumeFile.name ? "Stored: " + cfg.resumeFile.name : "No file stored yet.";
  render(cfg.profileData || {});
}

// Store the picked resume file as a data URL so it can be re-attached on any form.
document.getElementById("resumeFile").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    await chrome.storage.local.set({ resumeFile: { name: file.name, type: file.type, dataUrl: reader.result } });
    document.getElementById("resumeFileName").textContent = "Stored: " + file.name + " ✓";
  };
  reader.readAsDataURL(file);
};

document.getElementById("save").onclick = async () => {
  const data = {};
  document.querySelectorAll("[data-k]").forEach((el) => { data[el.dataset.k] = el.value.trim(); });
  // human-readable, section-grouped block for the model prompt
  let profile = ""; let sec = "";
  for (const [section, key, label] of FIELDS) {
    const v = data[key];
    if (!v || /\(add your URL\)/i.test(v)) continue;
    if (section !== sec) { profile += `\n[${section}]\n`; sec = section; }
    profile += `${label}: ${v}\n`;
  }
  await chrome.storage.local.set({
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value,
    resume: document.getElementById("resume").value,
    profileData: data,
    profile: profile.trim(),
  });
  const s = document.getElementById("status");
  s.textContent = "Saved ✓";
  setTimeout(() => (s.textContent = ""), 2000);
};

document.getElementById("clearLearned").onclick = async () => {
  await chrome.storage.local.set({ learned: {} });
  const s = document.getElementById("status");
  s.textContent = "Saved answers cleared ✓";
  setTimeout(() => (s.textContent = ""), 2000);
};

load();
