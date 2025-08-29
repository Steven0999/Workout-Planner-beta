/* ==========================================================
   MAIN NAV: Next / Previous for the multi-step wizard
   - Requires each step container to have:  .wizard-step[data-step="N"]
   - Requires buttons: #next-btn, #prev-btn
   - Works alongside your existing wizard.js (no changes needed)
   ========================================================== */

(function () {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Which steps exist? (reads from DOM)
  let steps = [];
  let currentStep = 1;

  document.addEventListener("DOMContentLoaded", () => {
    steps = $$(".wizard-step")
      .map(el => Number(el.getAttribute("data-step")))
      .filter(n => Number.isFinite(n))
      .sort((a,b) => a - b);

    // Default to the first declared step
    currentStep = steps.length ? steps[0] : 1;

    // Wire buttons
    $("#next-btn")?.addEventListener("click", onNext);
    $("#prev-btn")?.addEventListener("click", onPrev);

    // First paint
    showStep(currentStep);
    updateNavState();
  });

  function onNext(e) {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    const idx = steps.indexOf(currentStep);
    if (idx < steps.length - 1) {
      currentStep = steps[idx + 1];
      showStep(currentStep);
      updateNavState();
      // Entering Exercise/Sets step? Ask wizard.js to (re)render inputs
      if (typeof window._wizard_refreshSets === "function") {
        window._wizard_refreshSets();
      }
    } else {
      // Last step — you may choose to trigger save here if desired.
      // If your save is elsewhere, leave this as-is.
      // Example:
      // if (typeof window.saveSession === "function") window.saveSession();
    }
  }

  function onPrev(e) {
    e.preventDefault();
    const idx = steps.indexOf(currentStep);
    if (idx > 0) {
      currentStep = steps[idx - 1];
      showStep(currentStep);
      updateNavState();
    }
  }

  function showStep(stepNumber) {
    $$(".wizard-step").forEach(el => {
      el.style.display = (Number(el.getAttribute("data-step")) === stepNumber) ? "block" : "none";
    });

    // Optional: tweak Next button text on the final step
    const nextBtn = $("#next-btn");
    if (nextBtn) {
      const isLast = steps.indexOf(stepNumber) === steps.length - 1;
      nextBtn.textContent = isLast ? "Save" : "Next";
    }
  }

  function updateNavState() {
    const prevBtn = $("#prev-btn");
    if (prevBtn) {
      prevBtn.disabled = (steps.indexOf(currentStep) <= 0);
    }
  }

  // Minimal, friendly validation tied to visible step
  function validateStep(stepNumber) {
    // Read ids that wizard.js already uses
    const categorySel  = $("#work-on-select");
    const muscleGroup  = $("#muscle-select-group");
    const muscleSel    = $("#muscle-select");
    const equipSel     = $("#equipment-select");
    const exSel        = $("#exercise-select");
    const setsArea     = $("#sets-area");

    // You can adapt which numeric step corresponds to which UI.
    // This is generic and checks what's on screen:
    const stepEl = $(`.wizard-step[data-step="${stepNumber}"]`);
    if (!stepEl) return true; // nothing to validate

    // If this step has the category select, ensure a choice
    if (stepEl.contains(categorySel)) {
      const cat = categorySel.value;
      if (!cat) { alert("Please select what you are training."); return false; }
      if (cat === "specific muscle" && muscleGroup && stepEl.contains(muscleGroup)) {
        const mus = muscleSel?.value || "";
        if (!mus) { alert("Please choose a specific muscle."); return false; }
      }
    }

    // If this step has the equipment select, ensure a choice
    if (stepEl.contains(equipSel)) {
      const eq = equipSel.value;
      if (!eq) { alert("Please select the machine/equipment."); return false; }
    }

    // If this step has the exercise select (and sets area), ensure valid
    if (stepEl.contains(exSel)) {
      const ex = exSel.value;
      if (!ex) { alert("Please choose an exercise."); return false; }

      // Require at least one row of reps/weights to exist
      if (stepEl.contains(setsArea)) {
        const repsInputs   = $$('#sets-area .rep-input');
        const weightInputs = $$('#sets-area .weight-input');
        if (repsInputs.length === 0 || weightInputs.length === 0) {
          alert("Please enter reps & weight for the sets.");
          // Give wizard.js a chance to render now if it hasn’t yet
          if (typeof window._wizard_refreshSets === "function") window._wizard_refreshSets();
          return false;
        }
      }
    }

    return true;
  }

})();
