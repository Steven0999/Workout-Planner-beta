/* ======================================
   wizard.js — step flow, dropdowns, insights, populate lists
====================================== */
window.goToStep = function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = idx === step - 1 ? "block" : "none";
  });
  document.querySelectorAll(".step-badge").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });
  const prev = document.getElementById("prev-btn");
  if (prev) prev.disabled = step === 1;

  if (step === 4) populateEquipment();
  else if (step === 5) populateExercises();
  else if (step === 6) buildSessionSummary();

  updateReviewButtonState();
};

window.prevStep = function prevStep() { if (currentStep > 1) goToStep(currentStep - 1); };
window.nextStep = function nextStep() {
  if (currentStep < 5) {
    if (!validateAndStore(currentStep)) return;
    goToStep(currentStep + 1);
    return;
  }
  if (currentStep === 5) {
    if (currentWorkoutExercises.length === 0) {
      const s5Hint = document.getElementById("s5-hint");
      if (s5Hint) s5Hint.textContent = "Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6);
    return;
  }
  saveSession();
};

window.updateReviewButtonState = function updateReviewButtonState() {
  const next = document.getElementById("next-btn");
  if (!next) return;
  if (currentStep === 5) {
    next.textContent = "Review";
    const noItems = currentWorkoutExercises.length === 0;
    next.disabled = noItems;
    next.classList.toggle("is-disabled", noItems);
  } else if (currentStep === 6) {
    next.textContent = "Save";
    next.disabled = false;
    next.classList.remove("is-disabled");
  } else {
    next.textContent = "Next";
    next.disabled = false;
    next.classList.remove("is-disabled");
  }
};

/* Step 1 */
window.initStep1 = function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (sel) sel.value = wizard.location || "";
};
window.validateAndStoreStep1 = function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  const val = document.getElementById("workout-type-select").value;
  if (!val) { if (hint) hint.textContent = "Please select where you are training."; return false; }
  if (hint) hint.textContent = "";
  wizard.location = val; return true;
};

/* Step 2 */
window.initStep2 = function initStep2() {
  document.querySelectorAll('input[name="timing"]').forEach((r) => r.addEventListener("change", onTimingChange));
  if (!wizard.timing) {
    const nowRadio = document.querySelector('input[name="timing"][value="now"]');
    if (nowRadio) nowRadio.checked = true;
    wizard.timing = "now"; setDateToNow(true);
  } else {
    const chosen = document.querySelector(`input[name="timing"][value="${wizard.timing}"]`);
    if (chosen) chosen.checked = true;
    if (wizard.timing === "now") setDateToNow(true);
  }
};
function onTimingChange(e) {
  wizard.timing = e.target.value;
  if (wizard.timing === "now") setDateToNow(true);
  else {
    const dt = document.getElementById("workout-datetime");
    dt.removeAttribute("disabled");
    const hint = document.getElementById("date-hint");
    if (hint) hint.textContent = "Pick the date/time for your past session.";
  }
}
function setDateToNow(write) {
  const dt = document.getElementById("workout-datetime");
  const now = nowIsoMinute(); if (write) dt.value = now;
  dt.setAttribute("disabled", "disabled");
  const hint = document.getElementById("date-hint"); if (hint) hint.textContent = "Date/time is locked to now.";
}
window.validateAndStoreStep2 = function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  const dt = document.getElementById("workout-datetime").value;
  if (!wizard.timing) { if (hint) hint.textContent = "Select session timing."; return false; }
  if (wizard.timing === "past" && !dt) { if (hint) hint.textContent = "Choose a date/time for your past session."; return false; }
  wizard.datetime = wizard.timing === "now" ? nowIsoMinute() : dt;
  if (hint) hint.textContent = ""; return true;
};

/* Step 3 */
window.initStep3 = function initStep3() {
  const workOn = document.getElementById("work-on-select");
  const cats = allCategories();
  workOn.innerHTML = `<option value="">--Select--</option>` + cats.map((c) => `<option value="${c}">${title(c)}</option>`).join('');
  workOn.value = wizard.category || "";

  const musclesSel = document.getElementById("muscle-select");
  const muscles = allMuscles();
  musclesSel.innerHTML = `<option value="">--Select--</option>` + muscles.map((m) => `<option value="${m}">${m}</option>`).join('');
  musclesSel.value = wizard.muscle || "";

  workOn.addEventListener("change", () => {
    const cat = normalizeCategory(workOn.value);
    wizard.category = cat; wizard.equipment = ""; wizard.exercise = "";
    const group = document.getElementById("muscle-select-group");
    if (cat === "specific muscle") { group.style.display = "block"; }
    else { group.style.display = "none"; wizard.muscle = ""; musclesSel.value = ""; }
  });
  musclesSel.addEventListener("change", () => wizard.muscle = musclesSel.value);
};
window.validateAndStoreStep3 = function validateAndStoreStep3() {
  const hint = document.getElementById("s3-hint");
  const raw = document.getElementById("work-on-select").value;
  if (!raw) { if (hint) hint.textContent = "Please select what you're training."; return false; }
  const cat = normalizeCategory(raw); wizard.category = cat;
  if (cat === "specific muscle") {
    const mus = document.getElementById("muscle-select").value;
    if (!mus) { if (hint) hint.textContent = "Please choose a specific muscle."; return false; }
    wizard.muscle = mus;
  }
  if (hint) hint.textContent = ""; return true;
};

/* Step 4 */
window.initStep4 = function initStep4() {};
window.populateEquipment = function populateEquipment() {
  const sel = document.getElementById("equipment-select");
  sel.innerHTML = `<option value="">--Select--</option>`;
  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);
  const equipments = uniq(filtered.flatMap((e) => e.equipment)).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML += equipments.map((eq) => `<option value="${eq}">${title(eq)}</option>`).join("");
  if (equipments.includes(wizard.equipment)) sel.value = wizard.equipment;
  sel.onchange = () => { wizard.equipment = sel.value; populateExercises(); };
};
window.validateAndStoreStep4 = function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  const val = document.getElementById("equipment-select").value;
  if (!val) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  wizard.equipment = val; if (hint) hint.textContent = ""; return true;
};

/* Step 5 — insights & movement type */
function ensureInsightsNode() {
  let node = document.getElementById("exercise-insights");
  if (!node) {
    const grp = document.getElementById("exercise-select").closest(".form-group") || document.getElementById("exercise-select").parentElement;
    node = document.createElement("div");
    node.id = "exercise-insights";
    node.className = "hint";
    node.style.marginTop = "8px";
    grp.parentElement.insertBefore(node, grp.nextSibling);
  }
  return node;
}
window.ensureMovementTypeControl = function ensureMovementTypeControl() {
  let wrap = document.getElementById("movement-type-wrap");
  const insights = ensureInsightsNode();
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "movement-type-wrap";
    wrap.className = "form-group";
    wrap.innerHTML = `
      <label>Movement Type</label>
      <select id="movement-type-select">
        <option value="bilateral">Bilateral</option>
        <option value="unilateral">Unilateral</option>
      </select>
    `;
    insights.parentElement.insertBefore(wrap, insights.nextSibling);

    const typeSel = wrap.querySelector("#movement-type-select");
    typeSel.addEventListener("change", () => {
      wizard.movementType = typeSel.value;
      renderSetRows();
    });
  }
  wrap.querySelector("#movement-type-select").value = wizard.movementType || "bilateral";
  return wrap;
};
window.showExerciseInsights = function showExerciseInsights(name) {
  const box = ensureInsightsNode();
  if (!name) { box.textContent = ""; return; }
  const last = getLastHeaviestWithReps(name);
  const best = getBestHeaviestWithReps(name);
  const parts = [];
  if (last) parts.push(`Last: <strong>${last.maxWeight ?? 0} kg</strong>${last.reps != null ? ` × <strong>${last.reps} reps</strong>` : ""} (${fmtDate(last.date)})`);
  else parts.push(`Last: <em>no history</em>`);
  if (best) parts.push(`Heaviest: <strong>${best.maxWeight ?? 0} kg</strong>${best.reps != null ? ` × <strong>${best.reps} reps</strong>` : ""}${best.date ? ` (${fmtDate(best.date)})` : ""}`);
  else parts.push(`Heaviest: <em>no history</em>`);
  box.innerHTML = parts.join(" &nbsp;•&nbsp; ");
};

window.initStep5 = function initStep5() {
  const setsInput = document.getElementById("sets-input");
  setsInput.value = wizard.sets;
  setsInput.addEventListener("change", () => {
    wizard.sets = Math.max(1, toInt(setsInput.value, 1));
    renderSetRows();
  });
  renderSetRows();
};

window.populateExercises = function populateExercises() {
  const select = document.getElementById("exercise-select");
  if (!select) return;

  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter((e) => wizard.equipment ? e.equipment.includes(wizard.equipment) : true);

  const names = uniq(filtered.map((e) => e.name)).sort((a,b)=>a.localeCompare(b));
  window._exerciseBaseNames = names;

  ensureExerciseSearchControl();
  renderExerciseOptions(select, names, window.exerciseSearchTerm);

  showExerciseInsights(select.value || null);
  ensureMovementTypeControl();

  select.onchange = () => {
    wizard.exercise = select.value;
    showExerciseInsights(wizard.exercise);
    ensureMovementTypeControl();
    renderSetRows();
  };

  renderSetRows();
};

/* Validation dispatcher */
window.validateAndStore = function validateAndStore(step) {
  if (step === 1) return validateAndStoreStep1();
  if (step === 2) return validateAndStoreStep2();
  if (step === 3) return validateAndStoreStep3();
  if (step === 4) return validateAndStoreStep4();
  if (step === 5) return validateAndStoreStep5();
  return true;
};
