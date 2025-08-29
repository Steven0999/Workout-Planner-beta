/* =======================================================================
   main.js
   App bootstrap + step navigation glue.
   Ensures we do NOT reset Step 5 after adding an exercise.
   Depends on: filters.js, sets.js, history/review modules you already have.
======================================================================= */

window.wizard = window.wizard || {
  location: "", timing: "now", datetime: new Date().toISOString().slice(0,16),
  category: "", muscle: "", equipment: "", exercise: "",
  movementType: "bilateral",
  sets: 3,
  setReps: [], setWeights: [],
  setRepsL: [], setWeightsL: [],
  setRepsR: [], setWeightsR: [],
  maxWeight: 0, maxWeightSetCount: 0
};

window.userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData") || "{}");
window.currentWorkoutExercises = window.currentWorkoutExercises || [];
window.myChart = null;

let currentStep = 1;
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

/* ---------- small utils used across modules ---------- */
window.toInt = (v, f=0) => Number.isFinite(parseInt(v,10)) ? parseInt(v,10) : f;
window.toFloat = (v, f=0) => Number.isFinite(parseFloat(v)) ? parseFloat(v) : f;
window.isFiniteNum = (x) => typeof x === "number" && Number.isFinite(x);
window.title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
window.normalizeCategory = (c0) => {
  const c = String(c0 || "").toLowerCase().trim();
  if (c === "upper") return "upper body";
  if (c === "lower" || c === "legs") return "lower body";
  return c;
};
window.byLocation = (items, loc) => {
  const HOME = new Set(["body weight", "resistance bands", "kettlebell"]);
  if (loc === "home") return items.filter(e => e.equipment.some(eq => HOME.has(eq)));
  return items;
};
window.uniq = (a) => [...new Set(a)];
window.trimZeros = (n) => {
  if (!isFiniteNum(n)) return n;
  const s = String(n);
  return s.includes(".") ? s.replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1") : s;
};

/* ---------- History helpers used by sets.js (Prev markers) ---------- */
window.getExerciseRecordsDesc = function getExerciseRecordsDesc(exName) {
  const recs = (userWorkoutData[exName]?.records || []).slice();
  recs.sort((a,b) => new Date(b.date) - new Date(a.date));
  return recs;
};

/* ---------- DOM Ready ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Step buttons
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);

  // In-step actions
  document.getElementById("add-exercise-btn")?.addEventListener("click", () => {
    // handled in sets.js -> window.addExerciseToWorkout
    window.addExerciseToWorkout();
  });

  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);

  // Step 1 — Location
  const typeSel = document.getElementById("workout-type-select");
  if (typeSel) {
    typeSel.value = wizard.location || "";
    typeSel.addEventListener("change", () => wizard.location = typeSel.value);
  }

  // Step 2 — Timing
  document.querySelectorAll('input[name="timing"]').forEach(r => {
    r.addEventListener("change", (e) => {
      wizard.timing = e.target.value;
      const dt = document.getElementById("workout-datetime");
      if (wizard.timing === "now") {
        dt.value = new Date().toISOString().slice(0,16);
        dt.setAttribute("disabled", "disabled");
      } else {
        dt.removeAttribute("disabled");
      }
    });
  });
  const dt = document.getElementById("workout-datetime");
  if (wizard.timing === "now") { dt.value = new Date().toISOString().slice(0,16); dt.setAttribute("disabled","disabled"); }
  else { dt.removeAttribute("disabled"); dt.value = wizard.datetime || new Date().toISOString().slice(0,16); }
  dt.addEventListener("change", () => wizard.datetime = dt.value);

  // Step 3 — Category + muscle (filters.js)
  populateWorkOnDropdown();

  // Step 5 — Sets count change drives re-render
  const setsInput = document.getElementById("sets-input");
  if (setsInput) {
    setsInput.value = wizard.sets;
    setsInput.addEventListener("change", () => {
      wizard.sets = Math.max(1, toInt(setsInput.value, 1));
      renderSetRows();
    });
  }

  goToStep(1);
  updateReviewButtonState();
});

/* ---------- Navigation ---------- */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });

  // On entering steps, populate
  if (step === 4) populateEquipment();
  if (step === 5) populateExercises();
  if (step === 6 && typeof buildSessionSummary === "function") buildSessionSummary();

  updateReviewButtonState();

  const prev = document.getElementById("prev-btn");
  if (prev) prev.disabled = (step === 1);
}
function prevStep(){ if (currentStep > 1) goToStep(currentStep - 1); }
function nextStep(){
  if (currentStep < 5) {
    if (!validateAndStore(currentStep)) return;
    goToStep(currentStep + 1);
    return;
  }
  if (currentStep === 5) {
    if (currentWorkoutExercises.length === 0) {
      const hint = document.getElementById("s5-hint");
      if (hint) hint.textContent = "Please add at least one exercise before reviewing.";
      return;
    }
    goToStep(6);
    return;
  }
  if (typeof saveSession === "function") saveSession();
}
function updateReviewButtonState() {
  const next = document.getElementById("next-btn");
  if (!next) return;
  if (currentStep === 5) {
    next.textContent = "Review";
    const disabled = currentWorkoutExercises.length === 0;
    next.disabled = disabled;
    next.classList.toggle("is-disabled", disabled);
  } else if (currentStep === 6) {
    next.textContent = "Save";
    next.disabled = false;
    next.classList.remove("is-disabled");
  } else {
    next.textContent = "Next";
    next.disabled = false;
    next.classList.remove("is-disabled");
  }
}

/* ---------- Minimal validation dispatcher ---------- */
function validateAndStore(step) {
  if (step === 1) {
    if (!wizard.location) { alert("Please select where you are training."); return false; }
    return true;
  }
  if (step === 2) {
    if (!wizard.timing) { alert("Please choose timing (now / past)."); return false; }
    if (wizard.timing === "past" && !wizard.datetime) { alert("Pick a date/time for the past session."); return false; }
    return true;
  }
  if (step === 3) {
    if (!wizard.category) { alert("Please select what you're training."); return false; }
    if (wizard.category === "specific muscle" && !wizard.muscle) { alert("Please choose a specific muscle."); return false; }
    return true;
  }
  if (step === 4) {
    if (!wizard.equipment) { alert("Please select equipment."); return false; }
    return true;
  }
  return true;
}

/* ---------- Page switch (history/logger) ---------- */
window.showHistoryView = function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");

  if (typeof populateHistoryDropdown === "function") populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
};
window.showLoggerView = function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
};

/* ---------- Expose to other modules if needed ---------- */
window.goToStep = goToStep;
