/* ====/* =======================================================================
   main.js
   Orchestrates:
   - Wizard navigation (steps 1..6)
   - Shared state (wizard, current session, saved history)
   - Review summary + Save to localStorage
   - History page + chart + edit/delete
   Works with:
     - exercises.js (defines window.EXERCISES)
     - filters.js (builds categories, equipment, exercises + insights + movement)
     - sets.js     (renders per-set reps/weight grids + prev markers)
======================================================================= */

/* ------------------------- Shared State ------------------------- */
window.userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
window.currentWorkoutExercises = []; // exercises added in the current session

// Wizard scratchpad (current page selections)
window.wizard = {
  location: "",          // gym | home
  timing: "now",         // now | past
  datetime: "",          // ISO minute string
  category: "",          // e.g., "push"
  muscle: "",            // only when category is "specific muscle"
  equipment: "",         // e.g., "barbell"
  exercise: "",          // selected exercise name

  movementType: "bilateral", // "bilateral" | "unilateral"

  sets: 3,

  // Bilateral arrays
  setReps: [],
  setWeights: [],

  // Unilateral arrays
  setRepsL: [],
  setWeightsL: [],
  setRepsR: [],
  setWeightsR: [],

  // Max info for review/trend
  maxWeight: 0,
  maxWeightSetCount: 0
};

let currentStep = 1;
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

let myChart = null;

/* ------------------------- Utilities ------------------------- */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const nowIsoMinute = () => new Date().toISOString().slice(0, 16);
const toInt = (v, f = 0) => Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : f;
const toFloat = (v, f = 0) => Number.isFinite(parseFloat(v)) ? parseFloat(v) : f;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const fmtDelta = (d) => {
  if (d == null) return "—";
  const dd = Number(d.toFixed(2));
  if (dd > 0) return `▲ +${dd}kg`;
  if (dd < 0) return `▼ ${Math.abs(dd)}kg`;
  return `= 0kg`;
};
function uniq(a){ return [...new Set(a)]; }
function qs(sel){ return document.querySelector(sel); }

/* ------------------------- History helpers (exposed for sets.js) ------------------------- */
function getExerciseRecordsDesc(exName) {
  const recs = (window.userWorkoutData[exName]?.records || []).slice();
  recs.sort((a, b) => new Date(b.date) - new Date(a.date));
  return recs;
}
function extractWeightsAndReps(record) {
  if (record?.setWeightsL && record?.setWeightsR) {
    const wAll = [...(record.setWeightsL||[]), ...(record.setWeightsR||[])];
    const rAll = [
      ...(record.setRepsL || Array(record.setWeightsL?.length || 0).fill(null)),
      ...(record.setRepsR || Array(record.setWeightsR?.length || 0).fill(null))
    ];
    return { weights: wAll, reps: rAll };
  }
  return {
    weights: Array.isArray(record?.setWeights) ? record.setWeights : [],
    reps: Array.isArray(record?.setReps) ? record.setReps : []
  };
}
function getLastHeaviestWithReps(exName) {
  const recs = getExerciseRecordsDesc(exName);
  if (recs.length === 0) return null;
  const r = recs[0];
  const { weights, reps } = extractWeightsAndReps(r);
  if (weights.length === 0) return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };
  const maxW = Math.max(...weights);
  const idx = weights.findIndex((w) => w === maxW);
  const repsAtMax = idx >= 0 ? (reps[idx] ?? null) : null;
  return { maxWeight: maxW, reps: repsAtMax, date: r.date };
}
function getBestHeaviestWithReps(exName) {
  const bestW = window.userWorkoutData[exName]?.bestWeight ?? null;
  if (bestW == null) return null;
  const recs = getExerciseRecordsDesc(exName).slice().reverse(); // oldest -> newest
  for (const r of recs) {
    const { weights, reps } = extractWeightsAndReps(r);
    const i = weights.findIndex((w) => w === bestW);
    if (i >= 0) return { maxWeight: bestW, reps: reps[i] ?? null, date: r.date };
  }
  return { maxWeight: bestW, reps: null, date: null };
}
function getTrendAgainstLast(exName, currentMax) {
  const last = getLastHeaviestWithReps(exName);
  if (!last || last.maxWeight == null) return { dir: "na", delta: null };
  const delta = Number((currentMax - last.maxWeight).toFixed(2));
  if (delta > 0) return { dir: "up", delta };
  if (delta < 0) return { dir: "down", delta };
  return { dir: "same", delta: 0 };
}

/* Expose helpers in case sets.js needs them */
window.__historyHelpers = {
  getExerciseRecordsDesc,
  extractWeightsAndReps,
  getLastHeaviestWithReps,
  getBestHeaviestWithReps
};

/* ------------------------- Init ------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Wire page switches
  qs("#to-history")?.addEventListener("click", showHistoryView);
  qs("#to-logger")?.addEventListener("click", showLoggerView);

  // Wizard nav
  qs("#next-btn")?.addEventListener("click", nextStep);
  qs("#prev-btn")?.addEventListener("click", prevStep);

  // Add/edit/save
  qs("#add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);
  qs("#edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  qs("#save-session-btn")?.addEventListener("click", saveSession);

  // History change
  qs("#history-select")?.addEventListener("change", displayExerciseHistory);

  // Timing change (Step 2)
  document.querySelectorAll('input[name="timing"]').forEach(r => {
    r.addEventListener("change", onTimingChange);
  });

  // Exercise search (Step 5)
  const search = qs("#exercise-search");
  if (search) {
    search.addEventListener("input", () => {
      if (typeof window.filterExercisesBySearch === "function") {
        window.filterExercisesBySearch(search.value || "");
      }
    });
  }

  // Initial datetime for "now"
  const dt = qs("#workout-datetime");
  if (dt) dt.value = nowIsoMinute();

  // Let filters.js populate the category/muscle selects
  if (typeof window.populateWorkOnDropdown === "function") {
    window.populateWorkOnDropdown();
  }

  // Start wizard
  goToStep(1);
  updateReviewButtonState();
});

/* ------------------------- Step Navigation ------------------------- */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });

  // Previous disabled on step 1
  const prev = qs("#prev-btn");
  if (prev) prev.disabled = (step === 1);

  // Populate step-specific content
  if (step === 4 && typeof window.populateEquipment === "function") {
    window.populateEquipment();
  } else if (step === 5 && typeof window.populateExercises === "function") {
    window.populateExercises();
  } else if (step === 6) {
    buildSessionSummary();
  }

  updateReviewButtonState();
}
function prevStep() {
  if (currentStep > 1) goToStep(currentStep - 1);
}
function nextStep() {
  if (currentStep < 5) {
    if (!validateAndStore(currentStep)) return;
    goToStep(currentStep + 1);
    return;
  }
  if (currentStep === 5) {
    if (window.currentWorkoutExercises.length === 0) {
      const hint = qs("#s5-hint");
      if (hint) hint.textContent = "Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6);
    return;
  }
  saveSession();
}
function updateReviewButtonState() {
  const next = qs("#next-btn");
  if (!next) return;
  if (currentStep === 5) {
    next.textContent = "Review";
    const disabled = window.currentWorkoutExercises.length === 0;
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

/* ------------------------- Step validations ------------------------- */
function validateAndStore(step) {
  switch (step) {
    case 1: {
      const val = qs("#workout-type-select")?.value || "";
      if (!val) { (qs("#s1-hint")||{}).textContent = "Please select where you are training."; return false; }
      (qs("#s1-hint")||{}).textContent = "";
      window.wizard.location = val;
      return true;
    }
    case 2: {
      const timing = document.querySelector('input[name="timing"]:checked');
      if (!timing) { (qs("#s2-hint")||{}).textContent = "Select session timing."; return false; }
      window.wizard.timing = timing.value;
      if (timing.value === "past") {
        const dt = qs("#workout-datetime")?.value || "";
        if (!dt) { (qs("#s2-hint")||{}).textContent = "Choose a date/time for your past session."; return false; }
        window.wizard.datetime = dt;
      } else {
        window.wizard.datetime = nowIsoMinute();
      }
      (qs("#s2-hint")||{}).textContent = "";
      return true;
    }
    case 3: {
      const raw = qs("#work-on-select")?.value || "";
      if (!raw) { (qs("#s3-hint")||{}).textContent = "Please select what you're training."; return false; }
      window.wizard.category = raw.toLowerCase();

      if (window.wizard.category === "specific muscle") {
        const mus = qs("#muscle-select")?.value || "";
        if (!mus) { (qs("#s3-hint")||{}).textContent = "Please choose a specific muscle."; return false; }
        window.wizard.muscle = mus;
      } else {
        window.wizard.muscle = "";
      }
      (qs("#s3-hint")||{}).textContent = "";
      return true;
    }
    case 4: {
      const eq = qs("#equipment-select")?.value || "";
      if (!eq) { (qs("#s4-hint")||{}).textContent = "Please select the machine/equipment."; return false; }
      (qs("#s4-hint")||{}).textContent = "";
      window.wizard.equipment = eq;
      return true;
    }
    case 5:
      // set collection happens in addExerciseToWorkout() already
      return true;
    default:
      return true;
  }
}

/* ------------------------- Timing change handler ------------------------- */
function onTimingChange(e) {
  window.wizard.timing = e.target.value;
  const dt = qs("#workout-datetime");
  const hint = qs("#date-hint");
  if (!dt) return;
  if (window.wizard.timing === "now") {
    dt.value = nowIsoMinute();
    dt.setAttribute("disabled", "disabled");
    if (hint) hint.textContent = "Date/time is locked to now.";
  } else {
    dt.removeAttribute("disabled");
    if (hint) hint.textContent = "Pick the date/time for your past session.";
  }
}

/* ------------------------- Add/remove exercises (Step 5) ------------------------- */
function addExerciseToWorkout() {
  // Validate Step 5 inputs (sets.js already drew inputs & ensures movement type)
  const hint = qs("#s5-hint");
  const exercise = qs("#exercise-select")?.value || "";
  if (!exercise) { if (hint) hint.textContent = "Choose an exercise."; return; }

  const n = Math.max(1, toInt(qs("#sets-input")?.value, 1));
  window.wizard.sets = n;

  // read movement type (injected select by filters.js)
  const mtSel = document.getElementById("movement-type-select");
  window.wizard.movementType = mtSel ? mtSel.value : "bilateral";

  if (window.wizard.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
        repsL.some(v => v <= 0) || wtsL.some(v => v < 0) || repsR.some(v => v <= 0) || wtsR.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right sides.";
      return;
    }

    window.wizard.setRepsL = repsL; window.wizard.setWeightsL = wtsL;
    window.wizard.setRepsR = repsR; window.wizard.setWeightsR = wtsR;

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    const overallMax = Math.max(maxL, maxR);
    const countOverall = [...wtsL, ...wtsR].filter(w => w === overallMax).length;

    window.wizard.maxWeight = overallMax;
    window.wizard.maxWeightSetCount = countOverall;

    window.wizard.setReps = []; window.wizard.setWeights = [];

  } else {
    const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i => toInt(i.value));
    const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i => toFloat(i.value));
    if (reps.length !== n || wts.length !== n || reps.some(v => v <= 0) || wts.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return;
    }
    window.wizard.setReps = reps; window.wizard.setWeights = wts;
    const maxW = Math.max(...wts);
    const maxCount = wts.filter(w => w === maxW).length;
    window.wizard.maxWeight = maxW; window.wizard.maxWeightSetCount = maxCount;

    window.wizard.setRepsL = []; window.wizard.setWeightsL = [];
    window.wizard.setRepsR = []; window.wizard.setWeightsR = [];
  }

  window.wizard.exercise = exercise;

  const ex = {
    id: Date.now().toString(),
    date: window.wizard.datetime,
    name: window.wizard.exercise,
    category: window.wizard.category,
    equipment: window.wizard.equipment,
    muscle: window.wizard.category === "specific muscle" ? window.wizard.muscle : null,
    movementType: window.wizard.movementType,
    sets: window.wizard.sets,
    setReps: window.wizard.setReps.slice(),
    setWeights: window.wizard.setWeights.slice(),
    setRepsL: window.wizard.setRepsL.slice(),
    setWeightsL: window.wizard.setWeightsL.slice(),
    setRepsR: window.wizard.setRepsR.slice(),
    setWeightsR: window.wizard.setWeightsR.slice(),
    maxWeight: window.wizard.maxWeight,
    maxWeightSetCount: window.wizard.maxWeightSetCount
  };

  window.currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();

  // Reset inline inputs for next add
  const exSel = qs("#exercise-select"); if (exSel) exSel.value = "";
  const setsInput = qs("#sets-input"); if (setsInput) setsInput.value = "3";

  window.wizard.exercise = ""; window.wizard.sets = 3;
  window.wizard.movementType = "bilateral";
  window.wizard.setReps = []; window.wizard.setWeights = [];
  window.wizard.setRepsL = []; window.wizard.setWeightsL = [];
  window.wizard.setRepsR = []; window.wizard.setWeightsR = [];
  window.wizard.maxWeight = 0; window.wizard.maxWeightSetCount = 0;

  if (typeof window.renderSetRows === "function") {
    window.renderSetRows(); // re-render empty grids
  }
  const insights = qs("#exercise-insights");
  if (insights) insights.textContent = "";

  updateReviewButtonState();
}
function renderCurrentWorkoutList() {
  const wrap = qs("#current-workout-list-container");
  const list = qs("#current-workout-list");
  if (!wrap || !list) return;

  list.innerHTML = "";
  if (window.currentWorkoutExercises.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";

  window.currentWorkoutExercises.forEach((ex, idx) => {
    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r, i) => `${r}x${ex.setWeightsL[i]}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r, i) => `${r}x${ex.setWeightsR[i]}kg`).join(", ");
      const maxL = Math.max(...ex.setWeightsL);
      const maxR = Math.max(...ex.setWeightsR);
      const cL = ex.setWeightsL.filter(w => w === maxL).length;
      const cR = ex.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${maxL}kg for ${cL} set(s) • Heaviest Right: ${maxR}kg for ${cR} set(s)</div>
      `;
    } else {
      const pairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
      details = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${ex.maxWeight}kg for ${ex.maxWeightSetCount} set(s)</div>
      `;
    }
    const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;

    const item = document.createElement("div");
    item.className = "workout-item";
    item.innerHTML = `
      <strong>${ex.name}</strong> <small>(${meta})</small><br>
      ${details}
      <button style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;" onclick="removeExerciseFromWorkout(${idx})">Remove</button>
    `;
    list.appendChild(item);
  });
}
function removeExerciseFromWorkout(index) {
  window.currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

/* ------------------------- Review (Step 6) ------------------------- */
function buildSessionSummary() {
  const meta = qs("#summary-meta");
  const exWrap = qs("#summary-exercises");
  const totals = qs("#summary-totals");

  if (meta) {
    meta.innerHTML = `
      <div class="summary-row"><strong>Location</strong><span>${title(window.wizard.location)}</span></div>
      <div class="summary-row"><strong>When</strong><span>${window.wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
      <div class="summary-row"><strong>Date & Time</strong><span>${new Date(window.wizard.datetime).toLocaleString()}</span></div>
    `;
  }

  if (exWrap) exWrap.innerHTML = "";

  (window.currentWorkoutExercises || []).forEach(ex => {
    const trend = getTrendAgainstLast(ex.name, ex.maxWeight);
    let badge = "";
    if (trend.dir === "up")   badge = ` <span style="color:#4caf50;">▲ +${Math.abs(trend.delta)}kg</span>`;
    if (trend.dir === "down") badge = ` <span style="color:#ff5252;">▼ ${Math.abs(trend.delta)}kg</span>`;
    if (trend.dir === "same") badge = ` <span style="color:#ffb300;">= 0kg</span>`;
    if (trend.dir === "na")   badge = ` <span style="color:#9aa0a6;">— no history</span>`;

    const last = getLastHeaviestWithReps(ex.name);
    const best = getBestHeaviestWithReps(ex.name);
    const lastDelta = last ? ex.maxWeight - last.maxWeight : null;
    const bestDelta = best ? ex.maxWeight - best.maxWeight : null;

    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r, i) => `${r}x${ex.setWeightsL[i]}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r, i) => `${r}x${ex.setWeightsR[i]}kg`).join(", ");
      const maxL = Math.max(...ex.setWeightsL);
      const maxR = Math.max(...ex.setWeightsR);
      const cL = ex.setWeightsL.filter(w => w === maxL).length;
      const cR = ex.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: <strong>${maxL}kg</strong> (${cL} set${cL!==1?"s":""}) • Heaviest Right: <strong>${maxR}kg</strong> (${cR} set${cR!==1?"s":""})</div>
        <div>Overall Heaviest this session: <strong>${ex.maxWeight}kg</strong>${badge}</div>
        <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
        <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
      `;
    } else {
      const pairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
      details = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest this session: <strong>${ex.maxWeight}kg</strong>${badge}</div>
        <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
        <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
      `;
    }

    const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
    const card = document.createElement("div");
    card.className = "summary-exercise";
    card.innerHTML = `
      <strong>${ex.name}</strong> <small>(${metaLine})</small><br>
      ${details}
    `;
    if (exWrap) exWrap.appendChild(card);
  });

  let totalVolume = 0, totalSets = 0;
  window.currentWorkoutExercises.forEach(ex => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets * 2;
      ex.setRepsL.forEach((r, i) => totalVolume += r * ex.setWeightsL[i]);
      ex.setRepsR.forEach((r, i) => totalVolume += r * ex.setWeightsR[i]);
    } else {
      totalSets += ex.sets;
      ex.setReps.forEach((r, i) => totalVolume += r * ex.setWeights[i]);
    }
  });

  if (totals) {
    totals.innerHTML = `
      <div><strong>Total Exercises:</strong> ${window.currentWorkoutExercises.length}</div>
      <div><strong>Total Sets:</strong> ${totalSets}</div>
      <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
    `;
  }
}

/* ------------------------- Save session ------------------------- */
function saveSession() {
  const dt = window.wizard.datetime;
  if (!dt) { alert("Missing session date/time — go back to Step 2."); return; }
  if (window.currentWorkoutExercises.length === 0) { alert("Add at least one exercise before saving."); return; }

  window.currentWorkoutExercises.forEach((ex) => {
    if (!window.userWorkoutData[ex.name]) window.userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    window.userWorkoutData[ex.name].records.push({
      id: ex.id, date: dt,
      category: ex.category, equipment: ex.equipment, muscle: ex.muscle,
      movementType: ex.movementType,
      setReps: ex.setReps, setWeights: ex.setWeights,
      setRepsL: ex.setRepsL, setWeightsL: ex.setWeightsL,
      setRepsR: ex.setRepsR, setWeightsR: ex.setWeightsR,
      sets: ex.sets,
      maxWeight: ex.maxWeight, maxWeightSetCount: ex.maxWeightSetCount
    });
    if (ex.maxWeight > window.userWorkoutData[ex.name].bestWeight) {
      window.userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(window.userWorkoutData));
  alert("Workout session saved successfully!");

  window.currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  Object.assign(window.wizard, {
    location: "", timing: "now", datetime: nowIsoMinute(),
    category: "", muscle: "", equipment: "", exercise: "",
    movementType: "bilateral",
    sets: 3,
    setReps: [], setWeights: [],
    setRepsL: [], setWeightsL: [],
    setRepsR: [], setWeightsR: [],
    maxWeight: 0, maxWeightSetCount: 0
  });

  const typeSel = qs("#workout-type-select"); if (typeSel) typeSel.value = "";
  const nowRadio = document.querySelector('input[name="timing"][value="now"]'); if (nowRadio) nowRadio.checked = true;
  const dtInput = qs("#workout-datetime"); if (dtInput) { dtInput.setAttribute("disabled", "disabled"); dtInput.value = window.wizard.datetime; }
  const workOn = qs("#work-on-select"); if (workOn) workOn.value = "";
  const musSel = qs("#muscle-select"); if (musSel) musSel.value = "";
  const musGrp = qs("#muscle-select-group"); if (musGrp) musGrp.style.display = "none";
  const eqSel = qs("#equipment-select"); if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
  const exSel = qs("#exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  const setsInput = qs("#sets-input"); if (setsInput) setsInput.value = "3";
  if (typeof window.renderSetRows === "function") window.renderSetRows();

  goToStep(1);
}

/* ------------------------- History page ------------------------- */
function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  qs("#workout-history")?.classList.add("active");

  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}
function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  qs("#workout-logger")?.classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
}
function populateHistoryDropdown() {
  const sel = qs("#history-select");
  if (!sel) return;

  const keys = Object.keys(window.userWorkoutData).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = `<option value="">--Select an Exercise--</option>` +
    keys.map(k => `<option value="${k}">${k}</option>`).join("");

  const details = qs("#history-details");
  if (details) details.style.display = "none";
}
function displayExerciseHistory() {
  const exName = qs("#history-select")?.value || "";
  const details = qs("#history-details");
  const bestTitle = qs("#best-weight-title");
  const log = qs("#history-log");

  if (!exName || !window.userWorkoutData[exName]?.records?.length) {
    if (details) details.style.display = "none";
    return;
  }

  const hist = window.userWorkoutData[exName];
  if (details) details.style.display = "block";
  if (bestTitle) bestTitle.textContent = `Best Weight: ${hist.bestWeight}kg`;

  const sorted = hist.records.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const dates = sorted.map(r => new Date(r.date).toLocaleDateString());
  const maxWeights = sorted.map(r => r.maxWeight);

  if (myChart) myChart.destroy();
  const ctx = document.getElementById("history-chart")?.getContext("2d");
  if (ctx) {
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Heaviest Lift (kg)',
          data: maxWeights,
          borderColor: 'orange',
          backgroundColor: 'rgba(255,165,0,0.2)',
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Date', color: 'white' }, ticks: { color: 'white' } },
          y: { title: { display: true, text: 'Weight (kg)', color: 'white' }, ticks: { color: 'white' } }
        },
        plugins: { legend: { labels: { color: 'white' } } }
      }
    });
  }

  if (log) {
    log.innerHTML = "";
    sorted.forEach(rec => {
      const dateString = new Date(rec.date).toLocaleString();

      let detailsHtml = "";
      if (rec.movementType === "unilateral" && (rec.setWeightsL || rec.setWeightsR)) {
        const pairsL = (rec.setRepsL||[]).map((r, i) => `${r}x${(rec.setWeightsL||[])[i]}kg`).join(", ");
        const pairsR = (rec.setRepsR||[]).map((r, i) => `${r}x${(rec.setWeightsR||[])[i]}kg`).join(", ");
        const maxL = (rec.setWeightsL||[]).length ? Math.max(...rec.setWeightsL) : 0;
        const maxR = (rec.setWeightsR||[]).length ? Math.max(...rec.setWeightsR) : 0;
        const cL = (rec.setWeightsL||[]).filter(w => w === maxL).length;
        const cR = (rec.setWeightsR||[]).filter(w => w === maxR).length;
        detailsHtml = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${maxL}kg for ${cL} set(s) • Heaviest Right: ${maxR}kg for ${cR} set(s)</div>
        `;
      } else {
        const pairs = (rec.setReps||[]).map((r, i) => `${r}x${(rec.setWeights||[])[i]}kg`).join(", ");
        detailsHtml = `
          <div>Sets: ${rec.sets} → ${pairs || "—"}</div>
          <div>Heaviest: ${rec.maxWeight}kg${rec.maxWeightSetCount ? ` for ${rec.maxWeightSetCount} set(s)` : ""}</div>
        `;
      }

      const meta = `${title(rec.category || "n/a")} • ${title(rec.equipment || "n/a")}${rec.muscle ? ` • ${rec.muscle}` : ""} • ${title(rec.movementType || "bilateral")}`;

      const li = document.createElement("li");
      li.innerHTML = `
        <span>
          <strong>${exName}</strong> <small>(${meta})</small><br>
          Date: ${dateString}<br>
          ${detailsHtml}
        </span>
        <div class="history-actions">
          <button class="edit-btn" onclick="editRecord('${exName}','${rec.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteRecord('${exName}','${rec.id}')">Delete</button>
        </div>
      `;
      log.appendChild(li);
    });
  }
}
function deleteRecord(exName, recordId) {
  if (!confirm("Delete this record?")) return;
  const hist = window.userWorkoutData[exName];
  if (!hist) return;

  hist.records = hist.records.filter(r => r.id !== recordId);

  if (hist.records.length === 0) {
    delete window.userWorkoutData[exName];
  } else {
    const newMax = Math.max(...hist.records.map(r => r.maxWeight));
    hist.bestWeight = Number.isFinite(newMax) ? newMax : 0;
  }

  localStorage.setItem("userWorkoutData", JSON.stringify(window.userWorkoutData));
  populateHistoryDropdown();

  const sel = qs("#history-select");
  if (window.userWorkoutData[exName]) {
    sel.value = exName;
    displayExerciseHistory();
  } else {
    const details = qs("#history-details");
    if (details) details.style.display = "none";
  }
}
function editRecord(exName, recordId) {
  const hist = window.userWorkoutData[exName];
  const rec = hist?.records.find(r => r.id === recordId);
  if (!rec) return;

  // fill wizard from record
  window.wizard.location = HOME_EQUIPMENT.includes(rec.equipment) ? "home" : "gym";
  window.wizard.timing = "past";
  window.wizard.datetime = rec.date;
  window.wizard.category = rec.category || "";
  window.wizard.muscle = rec.muscle || "";
  window.wizard.equipment = rec.equipment || "";
  window.wizard.exercise = exName;
  window.wizard.movementType = rec.movementType || "bilateral";
  window.wizard.sets = rec.sets || 3;

  if (window.wizard.movementType === "unilateral" && rec.setWeightsL && rec.setWeightsR) {
    window.wizard.setRepsL = (rec.setRepsL || []).slice();
    window.wizard.setWeightsL = (rec.setWeightsL || []).slice();
    window.wizard.setRepsR = (rec.setRepsR || []).slice();
    window.wizard.setWeightsR = (rec.setWeightsR || []).slice();
    window.wizard.setReps = []; window.wizard.setWeights = [];
  } else {
    window.wizard.setReps = (rec.setReps || []).slice();
    window.wizard.setWeights = (rec.setWeights || []).slice();
    window.wizard.setRepsL = []; window.wizard.setWeightsL = [];
    window.wizard.setRepsR = []; window.wizard.setWeightsR = [];
  }

  const { weights } = extractWeightsAndReps(rec);
  const maxW = weights.length ? Math.max(...weights) : (rec.maxWeight || 0);
  window.wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
  window.wizard.maxWeightSetCount = weights.filter(w => w === window.wizard.maxWeight).length || (rec.maxWeightSetCount || 0);

  showLoggerView();

  // Reflect in UI
  const typeSel = qs("#workout-type-select"); if (typeSel) typeSel.value = window.wizard.location;
  const pastRadio = document.querySelector('input[name="timing"][value="past"]'); if (pastRadio) pastRadio.checked = true;
  const dt = qs("#workout-datetime"); if (dt) { dt.removeAttribute("disabled"); dt.value = window.wizard.datetime; }
  const catSel = qs("#work-on-select"); if (catSel) catSel.value = window.wizard.category;

  const muscleGroup = qs("#muscle-select-group");
  const muscleSel = qs("#muscle-select");
  if (window.wizard.category === "specific muscle") { if (muscleGroup) muscleGroup.style.display = "block"; if (muscleSel) muscleSel.value = window.wizard.muscle; }
  else { if (muscleGroup) muscleGroup.style.display = "none"; }

  if (typeof window.populateEquipment === "function") window.populateEquipment();
  const eqSel = qs("#equipment-select"); if (eqSel) eqSel.value = window.wizard.equipment;
  if (typeof window.populateExercises === "function") window.populateExercises();
  const exSel = qs("#exercise-select"); if (exSel) exSel.value = window.wizard.exercise;

  if (typeof window.renderSetRows === "function") window.renderSetRows();

  // Pre-fill set values after rows render
  if (window.wizard.movementType === "unilateral") {
    const gridL = document.getElementById("sets-grid-left");
    const gridR = document.getElementById("sets-grid-right");
    if (gridL && gridR) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = window.wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = window.wizard.setWeightsL[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = window.wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = window.wizard.setWeightsR[i] ?? "");
    }
  } else {
    const grid = document.getElementById("sets-grid");
    if (grid) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = window.wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = window.wizard.setWeights[i] ?? "");
    }
  }

  window.currentWorkoutExercises = [{
    id: rec.id, date: window.wizard.datetime, name: window.wizard.exercise, category: window.wizard.category,
    equipment: window.wizard.equipment, muscle: window.wizard.muscle || null, movementType: window.wizard.movementType,
    sets: window.wizard.sets,
    setReps: window.wizard.setReps.slice(), setWeights: window.wizard.setWeights.slice(),
    setRepsL: window.wizard.setRepsL.slice(), setWeightsL: window.wizard.setWeightsL.slice(),
    setRepsR: window.wizard.setRepsR.slice(), setWeightsR: window.wizard.setWeightsR.slice(),
    maxWeight: window.wizard.maxWeight, maxWeightSetCount: window.wizard.maxWeightSetCount
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();

  goToStep(5);
  const editMsg = qs("#edit-mode-message"); if (editMsg) editMsg.style.display = "block";
}

/* ------------------------- Expose some functions globally ------------------------- */
window.showHistoryView = showHistoryView;
window.showLoggerView = showLoggerView;
window.addExerciseToWorkout = addExerciseToWorkout;
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;

/* ------------------------- Crash log helper ------------------------- */
window.addEventListener("error", (e) => console.error("[JS Error]", e.error || e.message));
