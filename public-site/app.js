const ALLOWED_EVENTS = new Set([
  "public_page_viewed",
  "devbot_evaluation_started",
  "devbot_execution_model_reviewed",
  "devbot_evaluation_brief_prepared",
  "devbot_evaluation_handoff",
]);

function emit(event, metadata = {}) {
  if (!ALLOWED_EVENTS.has(event)) return;
  const detail = {
    event,
    entityId: "tolani.devbot",
    surface: "public_evaluation",
    path: window.location.pathname,
    ...metadata,
  };
  window.dispatchEvent(new CustomEvent("devbot:conversion", { detail }));
  if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
}

emit("public_page_viewed", { state: "public_surface_viewed" });

document.querySelectorAll("[data-event]").forEach((element) => {
  element.addEventListener("click", () => {
    emit(element.dataset.event, { state: element.dataset.state || null });
  });
});

const form = document.querySelector("[data-evaluation-form]");
const output = document.querySelector("[data-evaluation-output]");
const copyButton = document.querySelector("[data-copy-brief]");

if (form && output) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const controls = data.getAll("controls");
    const brief = {
      schemaVersion: "1.0.0",
      type: "devbot.public_evaluation_brief",
      teamContext: data.get("teamContext"),
      requestClass: data.get("requestClass"),
      repositoryAccess: data.get("repositoryAccess"),
      riskLevel: data.get("riskLevel"),
      requiredControls: controls,
      authority: {
        productionWriteGranted: false,
        autonomousApprovalGranted: false,
        humanQualificationRequired: true,
      },
    };

    output.textContent = JSON.stringify(brief, null, 2);
    output.hidden = false;
    if (copyButton) copyButton.hidden = false;
    emit("devbot_evaluation_brief_prepared", {
      state: "evaluation_brief_prepared",
      requestClass: String(data.get("requestClass") || "unknown"),
      riskLevel: String(data.get("riskLevel") || "unknown"),
    });
  });
}

if (copyButton && output) {
  copyButton.addEventListener("click", async () => {
    if (!output.textContent) return;
    try {
      await navigator.clipboard.writeText(output.textContent);
      copyButton.textContent = "Brief copied";
    } catch {
      copyButton.textContent = "Copy unavailable";
    }
  });
}
