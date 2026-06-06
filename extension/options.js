// Pre-loaded with Clinton's profile + resume so the only required setup is the API key.
const DEFAULT_PROFILE = `Name: Clinton Fernandes
Email: clintonfernandes4u@gmail.com
Phone: +1 801-946-9693
Location: Saint Paul, MN, USA  (State: Minnesota)
LinkedIn: (add your URL)
Current company: Target
Current title: Lead Technical Program Manager
Years of experience: 8
Authorized to work in the US: Yes
Requires visa sponsorship (now and in future): Yes  (seeking H1B sponsorship)
Desired compensation: 175,000-200,000 USD (flexible)
Open to remote: Yes
Gender / Race / Veteran / Disability: Decline to self-identify`;

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
- PM, Visual Data Prep (gig): competitive analysis of Alteryx/Dataiku/Knime.
- Computer Vision & Robotics Lead Engineer (2018–2024): built 3D scanning robotics, mobile AR,
  neural networks for content creation, virtual apparel try-on, mobile 3D capture. 1st place
  Target CodeRED hackathon 2019 & 2022.

## Earlier
nView Medical — CV intern (Intel RealSense + C-arm X-ray fusion). University of Utah — research
(NSF bio-inspired robots), TA (Intro to Robotics). San Jose City College — instructor (cybersec,
Java). TURBOCAM India — 5-axis CNC production engineer.

## Education
M.S. Robotics, University of Utah (2017). B.E. Mechanical Engineering, Goa University (2014).

## Skills
Technical & product program management, MLOps, GenAI, ML recommendation/ranking, enterprise data
modernization, BI & self-service analytics, data governance, operating-model design, executive
governance, GCP/Vertex AI, Looker, Power BI, Python.`;

async function load() {
  const cfg = await chrome.storage.local.get(["apiKey", "model", "resume", "profile"]);
  document.getElementById("apiKey").value = cfg.apiKey || "";
  document.getElementById("model").value = cfg.model || "claude-sonnet-4-6";
  document.getElementById("profile").value = cfg.profile || DEFAULT_PROFILE;
  document.getElementById("resume").value = cfg.resume || DEFAULT_RESUME;
}

document.getElementById("save").onclick = async () => {
  await chrome.storage.local.set({
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value,
    profile: document.getElementById("profile").value,
    resume: document.getElementById("resume").value,
  });
  const s = document.getElementById("status");
  s.textContent = "Saved ✓";
  setTimeout(() => (s.textContent = ""), 2000);
};

load();
