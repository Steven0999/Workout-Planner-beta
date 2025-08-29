// js/wizard.js
// Central step navigator + validation + wiring to other modules (filters, sets, session, history)

/* global functions expected (provided by other files):
   - populateEquipment()            // filters.js
   - populateExercises()            // sets.js
   - renderSetRows()                // sets.js
   - initSetsStep()                 // sets.js
   - buildSessionSummary()          // session.js (or wherever you put it)
   - updateReviewButtonState()      // main.js (or session UI)
   - saveSession()                  // session.js
   - populateHistoryDropdown()      // history.js
   - displayExerciseHistory()       // history.js
*/

(function () {
  // ========= Global wizard state used across modules =========
  // (If you already define window.wizard elsewhere, this keeps/extends it.)
  window.wizard = Object.assign({
    location: "",            // "gym" | "home"
    timing: "now",           // "now" | "past"
    datetime: new Date().toISOString().slice(0, 16),
    category: "",            // e.g., "push", "pull", "upper body", "specific muscle"
    muscle: "",              // only when category === "specific muscle"
    equipment: "",           // e.g., "barbell", "dumbbell"
    exercise: "",            // picked exercise name
    movementType: "bilateral", // "bilateral" | "unilateral"
    sets: 3
  }, window.wizard || {});

  // ========= Local navigation state =========
  window.currentStep = window.currentStep || 1;
  let lastLoggerStep = 1;
  const pageScroll = { logger: 0, history: 0 };

  // ========= DOM helpers =========
  const $ = (sel) => document.querySelector(sel);
  const setVisibleStep = (step) => {
    document.querySelectorAll(".wizard-step").forEach((el, idx) => {
      el.style.display = (idx === step - 1) ? "block" : "none";
    });
    document.querySelectorAll(".step-badge").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.step) === step);
    });
    const prevBtn = $("#prev-btn");
    if (prevBtn) prevBtn.disabled = (step === 1);
  };

  // ========= Step transitions =========
  function goToStep(step) {
    window.currentStep = step;
    setVisibleStep(step);

    // Enter-step hooks
    if (step === 4 && typeof window.populateEquipment === "function") {
      window.populateEquipment();
    }
    if (step === 5) {
      if (typeof window.initSetsStep === "function") window.initSetsStep();
      if (typeof window.populateExercises === "function") window.populateExercises();
      if (typeof window.renderSetRows === "function") window.renderSetRows();
    }
    if (step === 6 && typeof window.buildSessionSummary === "function") {
      window.buildSessionSummary();
    }

    if (typeof window.updateReviewButtonState === "function") {
      window.updateReviewButtonState();
    }
  }

  function prevStep() {
    if (window.currentStep > 1) goToStep(window.currentStep - 1);
  }

  function nextStep() {
    // Steps 1–4 require validation before advancing
    if (window.currentStep < 5) {
      if (!validateAndStore(window.currentStep)) return;
      goToStep(window.currentStep + 1);
      return;
    }

    // Step 5: require at least one exercise added before Review
    if (window.currentStep === 5) {
      const hasItems = Array.isArray(window.currentWorkoutExercises) && window.currentWorkoutExercises.length > 0;
      if (!hasItems) {
        const hint = $("#s5-hint");
        if (hint) hint.textContent = "Please add at least one exercise before reviewing your session.";
        return;
      }
      goToStep(6);
      return;
    }

    // Step 6: Save
    if (typeof window.saveSession === "function") {
      window.saveSession();
    }
  }

  // ========= Validation =========
  function validateAndStore(step) {
    switch (step) {
      case 1: return validateStep1();
      case 2: return validateStep2();
      case 3: return validateStep3();
      case 4: return validateStep4();
      case 5: return validateStep5();
      default: return true;
    }
  }

  function validateStep1() {
    const val = $("#workout-type-select")?.value || "";
    const hint = $("#s1-hint");
    if (!val) {
      if (hint) hint.textContent = "Please select where you are training.";
      return false;
    }
    if (hint) hint.textContent = "";
    window.wizard.location = val;
    return true;
  }

  function validateStep2() {
    const hint = $("#s2-hint");
    const checked = document.querySelector('input[name="timing"]:checked');
    if (!checked) {
      if (hint) hint.textContent = "Please select session timing.";
      return false;
    }

    window.wizard.timing = checked.value; // "now" | "past"
    if (window.wizard.timing === "now") {
      // lock datetime to now and disable input
      window.wizard.datetime = new Date().toISOString().slice(0, 16);
      const dt = $("#workout-datetime");
      if (dt) {
        dt.value = window.wizard.datetime;
        dt.setAttribute("disabled", "disabled");
      }
      if (hint) hint.textContent = "";
      return true;
    }

    // Past: must have a date/time
    const dtVal = $("#workout-datetime")?.value || "";
    if (!dtVal) {
      if (hint) hint.textContent = "Pick the date/time for your past session.";
      return false;
    }
    window.wizard.datetime = dtVal;
    const dt = $("#workout-datetime");
    if (dt) dt.removeAttribute("disabled");
    if (hint) hint.textContent = "";
    return true;
  }

  function validateStep3() {
    const hint = $("#s3-hint");
    const categoryRaw = $("#work-on-select")?.value || "";
    if (!categoryRaw) {
      if (hint) hint.textContent = "Please select what you are training.";
      return false;
    }
    window.wizard.category = normalizeCategory(categoryRaw);

    if (window.wizard.category === "specific muscle") {
      const mus = $("#muscle-select")?.value || "";
      if (!mus) {
        if (hint) hint.textContent = "Please choose a specific muscle.";
        return false;
      }
      window.wizard.muscle = mus;
    } else {
      window.wizard.muscle = "";
    }

    if (hint) hint.textContent = "";
    return true;
  }

  function validateStep4() {
    const hint = $("#s4-hint");
    const eq = $("#equipment-select")?.value || "";
    if (!eq) {
      if (hint) hint.textContent = "Please select the machine/equipment.";
      return false;
    }
    window.wizard.equipment = eq;
    if (hint) hint.textContent = "";
    return true;
  }

  // Step 5’s detailed field validation is handled inside sets.js when adding an exercise,
  // but we still allow Next → Review only when session has items (enforced in nextStep()).
  function validateStep5() { return true; }

  // ========= Normalizers / helpers =========
  function normalizeCategory(c0) {
    const c = String(c0 || "").toLowerCase().trim();
    if (c === "upper") return "upper body";
    if (c === "lower" || c === "legs") return "lower body";
    return c;
  }

  // ========= Public navigation between Logger ↔ History (optional, if you use header buttons) =========
  function showHistoryView() {
    lastLoggerStep = window.currentStep || lastLoggerStep;
    pageScroll.logger = document.scrollingElement.scrollTop;

    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    $("#workout-history")?.classList.add("active");

    if (typeof window.populateHistoryDropdown === "function") {
      window.populateHistoryDropdown();
    }

    requestAnimationFrame(() => {
      document.scrollingElement.scrollTop = pageScroll.history || 0;
    });
  }

  function showLoggerView() {
    pageScroll.history = document.scrollingElement.scrollTop;

    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    $("#workout-logger")?.classList.add("active");

    goToStep(lastLoggerStep);

    requestAnimationFrame(() => {
      document.scrollingElement.scrollTop = pageScroll.logger || 0;
    });

    if (typeof window.updateReviewButtonState === "function") {
      window.updateReviewButtonState();
    }
  }

  // ========= Wire up buttons on DOM ready =========
  document.addEventListener("DOMContentLoaded", () => {
    // Next / Prev
    $("#next-btn")?.addEventListener("click", nextStep);
    $("#prev-btn")?.addEventListener("click", prevStep);

    // Header navigation (if present)
    $("#to-history")?.addEventListener("click", showHistoryView);
    $("#to-logger")?.addEventListener("click", showLoggerView);

    // Timing radios init
    document.querySelectorAll('input[name="timing"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        const v = e.target.value;
        const dateInput = /** @type {HTMLInputElement} */ ($("#workout-datetime"));
        if (!dateInput) return;
        if (v === "now") {
          window.wizard.timing = "now";
          window.wizard.datetime = new Date().toISOString().slice(0, 16);
          dateInput.value = window.wizard.datetime;
          dateInput.setAttribute("disabled", "disabled");
        } else {
          window.wizard.timing = "past";
          dateInput.removeAttribute("disabled");
        }
      });
    });

    // Category change → show/hide muscle group
    $("#work-on-select")?.addEventListener("change", () => {
      const cat = normalizeCategory($("#work-on-select").value);
      const group = $("#muscle-select-group");
      if (group) group.style.display = (cat === "specific muscle") ? "block" : "none";
      // reset down-stream when category changes
      const eqSel = $("#equipment-select");
      const exSel = $("#exercise-select");
      if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
      if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
      window.wizard.category = cat;
      window.wizard.muscle = "";
    });

    // Muscle change → clear downstream
    $("#muscle-select")?.addEventListener("change", () => {
      const eqSel = $("#equipment-select");
      const exSel = $("#exercise-select");
      if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
      if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
      window.wizard.muscle = $("#muscle-select").value || "";
    });

    // Default timing to "now"
    const nowRadio = document.querySelector('input[name="timing"][value="now"]');
    if (nowRadio) nowRadio.checked = true;
    const dt = $("#workout-datetime");
    if (dt) {
      dt.value = window.wizard.datetime;
      dt.setAttribute("disabled", "disabled");
    }

    // Start at step 1
    goToStep(window.currentStep || 1);
  });

  // ========= Expose to global (if needed elsewhere) =========
  window.goToStep = goToStep;
  window.prevStep = prevStep;
  window.nextStep = nextStep;
  window.showHistoryView = showHistoryView;
  window.showLoggerView = showLoggerView;
  window.validateAndStore = validateAndStore;
})();
