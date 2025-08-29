/* ==========================================================
   MAIN: page switches + Next/Previous + step validation
   ========================================================== */

(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  let steps = [];
  let currentStep = 1;

  // Page switching (Logger / History)
  function showPage(id) {
    $$(".page").forEach(p => p.classList.remove("active"));
    $(id)?.classList.add("active");
  }

  function showStep(n) {
    currentStep = n;
    $$(".wizard-step").forEach(el => {
      const step = Number(el.getAttribute("data-step"));
      el.classList.toggle("active", step === n);
    });
    $$(".step-badge").forEach(b => {
      const s = Number(b.dataset.step);
      b.classList.toggle("active", s === n);
    });
    const nextBtn = $("#next-btn");
    if (nextBtn) nextBtn.textContent = (steps.indexOf(n) === steps.length - 1) ? "Save" : "Next";
    $("#prev-btn")?.toggleAttribute("disabled", steps.indexOf(n) === 0);
  }

  function validateStep(n) {
    // Delegate into wizard state so we don’t duplicate logic
    if (typeof window._wizard_validateStep === "function") return window._wizard_validateStep(n);
    return true;
  }

  function onNext(e) {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    // If last step, save
    if (steps.indexOf(currentStep) === steps.length - 1) {
      if (typeof window._wizard_saveSession === "function") window._wizard_saveSession();
      return;
    }

    const next = steps[steps.indexOf(currentStep) + 1];
    showStep(next);

    // Entering dynamic steps? Let wizard render as needed
    if (typeof window._wizard_onEnterStep === "function") window._wizard_onEnterStep(next);
  }

  function onPrev(e) {
    e.preventDefault();
    const idx = steps.indexOf(currentStep);
    if (idx <= 0) return;
    const prev = steps[idx - 1];
    showStep(prev);
    if (typeof window._wizard_onEnterStep === "function") window._wizard_onEnterStep(prev);
  }

  // History / Logger toggle
  function toHistory() {
    showPage("#workout-history");
    if (typeof window._wizard_populateHistory === "function") window._wizard_populateHistory();
  }
  function toLogger() {
    showPage("#workout-logger");
    showStep(currentStep); // keep place
  }

  document.addEventListener("DOMContentLoaded", () => {
    steps = $$(".wizard-step")
      .map(el => Number(el.getAttribute("data-step")))
      .filter(n => Number.isFinite(n))
      .sort((a,b) => a - b);

    // Wire buttons (Step 5)
    $("#prev-btn")?.addEventListener("click", onPrev);
    $("#next-btn")?.addEventListener("click", onNext);
    // Step 6 prev
    $("#prev-btn-6")?.addEventListener("click", (e) => {
      e.preventDefault();
      const idx = steps.indexOf(currentStep);
      const prev = steps[Math.max(0, idx - 1)];
      showStep(prev);
      if (typeof window._wizard_onEnterStep === "function") window._wizard_onEnterStep(prev);
    });

    $("#save-session-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof window._wizard_saveSession === "function") window._wizard_saveSession();
    });

    $("#to-history")?.addEventListener("click", toHistory);
    $("#to-logger")?.addEventListener("click", toLogger);

    showPage("#workout-logger");
    showStep(1);

    // Bootstrap wizard internals
    if (typeof window._wizard_init === "function") window._wizard_init();
  });

})();
