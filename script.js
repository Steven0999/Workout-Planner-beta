/* =======================================================================
   Workout Session Logger — script.js (FULL)
   Requires:
     - Chart.js
     - exercises.js (defines window.EXERCISES)
   Features:
     - Wizard: Location → Timing → Category(+muscle) → Equipment → Exercise & Sets → Review
     - Fixed categories list (push, pull, upper body, etc.)
     - Equipment dropdown from filtered library (barbell, dumbbell, machine, cable machine, etc.)
     - Reps & Weight inputs with per-set "Prev" markers
     - Unilateral mode: left & right set grids
     - Insights: show last and best (with reps & dates)
     - Review page: deltas vs last & best, totals, session list
     - Save to localStorage; history view with Chart.js; edit/delete
     - Preserve step & scroll switching Logger ↔ History
   ======================================================================= */

/* ---------------- Crash guard (shows error text in #fatal if present) ---------------- */
window.addEventListener("error", (e) => {
  console.error("[JS Error]", e.error || e.message);
  const el = document.getElementById("fatal");
  if (el) el.textContent = "Error: " + (e.error?.message || e.message);
});

/* ---------------- Utilities ---------------- */
const HOME_EQUIPMENT = new Set(["body weight", "resistance bands", "kettlebell"]);

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function title(s) { return capitalize(String(s || "")); }
function toInt(v, f = 0) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : f; }
function toFloat(v, f = 0) { const n = parseFloat(v); return Number.isFinite(n) ? n : f; }
function nowIsoMinute() { return new Date().toISOString().slice(0, 16); }
function isoToLocalString(iso) { try { return new Date(iso).toLocaleString(); } catch { return iso || ""; } }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString() : "—"; }
function stripZeros(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return n;
  const s = n.toString();
  return s.includes(".") ? s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1") : s;
}
function uniq(arr) { return [...new Set(arr)]; }
function setOptions(selectSel, arr, mapFn) {
  const el = document.querySelector(selectSel);
  if (!el) return;
  const html = (arr || []).map(v => {
    const mapped = mapFn ? mapFn(v) : { value: v, text: v };
    return `<option value="${String(mapped.value)}">${String(mapped.text)}</option>`;
  }).join("");
  el.innerHTML = html;
}

/* ---------------- Normalize exercises from exercises.js ---------------- */
const RAW_EXERCISES = Array.isArray(window.EXERCISES) ? window.EXERCISES
                     : Array.isArray(window.exercisesData) ? window.exercisesData
                     : [];

const EXERCISES_NORM = RAW_EXERCISES.map(e => ({
  name: e?.name || "Unknown",
  // sections/categories (lowercase)
  sections: Array.isArray(e?.sections) ? e.sections.map(s => String(s).toLowerCase().trim())
         : Array.isArray(e?.categories) ? e.categories.map(s => String(s).toLowerCase().trim())
         : (e?.category ? [String(e.category).toLowerCase().trim()] : []),
  // equipment (lowercase)
  equipment: Array.isArray(e?.equipment) ? e.equipment.map(s => String(s).toLowerCase().trim())
           : (typeof e?.equipment === "string" ? [String(e.equipment).toLowerCase().trim()] : []),
  // muscles (as written)
  muscles: Array.isArray(e?.muscles) ? e.muscles.map(m => String(m).trim())
        : (e?.muscle ? [String(e.muscle).trim()] : [])
}));

/* ---------------- Fixed categories for "What are you working on?" ---------------- */
const FIXED_CATEGORIES = [
  "upper body",
  "lower body",
  "push",
  "pull",
  "full body",
  "hinge",
  "squat",
  "core",
  "specific muscle"
];
function normalizeCategory(c0) {
  const c = String(c0 || "").toLowerCase().trim();
  if (c === "upper") return "upper body";
  if (c === "lower" || c === "legs") return "lower body";
  return c;
}

/* ---------------- Filters ---------------- */
function byLocation(items, loc) {
  if (loc === "home") {
    return items.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.has(eq)));
  }
  return items;
}
function byCategoryAndMuscle(items, category, muscle) {
  const cat = normalizeCategory(category);
  if (!cat) return [];
  if (cat === "specific muscle") {
    if (!muscle) return [];
    return items.filter(e => e.sections.includes("specific muscle") && e.muscles.includes(muscle));
  }
  return items.filter(e => e.sections.includes(cat));
}

/* ---------------- App State ---------------- */
let currentStep = 1;
let lastLoggerStep = 1;
let myChart = null;

let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

const pageScroll = { logger: 0, history: 0 };

const wizard = {
  location: "",
  timing: "now",        // "now" | "past"
  datetime: nowIsoMinute(),

  category: "",
  muscle: "",
  equipment: "",
  exercise: "",

  movementType: "bilateral", // "bilateral" | "unilateral"
  sets: 3,

  // Bilateral
  setReps: [],
  setWeights: [],

  // Unilateral
  setRepsL: [],
  setWeightsL: [],
  setRepsR: [],
  setWeightsR: [],

  maxWeight: 0,
  maxWeightSetCount: 0
};

/* ---------------- History helpers (last/best & per-set prev) ---------------- */
function getExerciseRecordsDesc(exName) {
  const recs = (userWorkoutData[exName]?.records || []).slice();
  recs.sort((a, b) => new Date(b.date) - new Date(a.date));
  return recs;
}
function extractWeightsAndReps(record) {
  if (record.setWeightsL && record.setWeightsR) {
    const weights = [...(record.setWeightsL || []), ...(record.setWeightsR || [])];
    const reps = [
      ...(record.setRepsL || Array(record.setWeightsL?.length || 0).fill(null)),
      ...(record.setRepsR || Array(record.setWeightsR?.length || 0).fill(null))
    ];
    return { weights, reps };
  }
  return {
    weights: Array.isArray(record.setWeights) ? record.setWeights : [],
    reps: Array.isArray(record.setReps) ? record.setReps : []
  };
}
function getLastHeaviestWithReps(exName) {
  const recs = getExerciseRecordsDesc(exName);
  if (recs.length === 0) return null;
  const r = recs[0];
  const { weights, reps } = extractWeightsAndReps(r);
  if (!weights.length) return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };
  const maxW = Math.max(...weights);
  const idx = weights.findIndex(w => w === maxW);
  return { maxWeight: maxW, reps: idx >= 0 ? (reps[idx] ?? null) : null, date: r.date };
}
function getBestHeaviestWithReps(exName) {
  const bestW = userWorkoutData[exName]?.bestWeight;
  if (bestW == null) return null;
  const recs = getExerciseRecordsDesc(exName).slice().reverse(); // oldest → newest
  for (const r of recs) {
    const { weights, reps } = extractWeightsAndReps(r);
    const idx = weights.findIndex(w => w === bestW);
    if (idx >= 0) return { maxWeight: bestW, reps: reps[idx] ?? null, date: r.date };
  }
  return { maxWeight: bestW, reps: null, date: null };
}
function computePrevPerSet(exName, movementType, setsCount) {
  const blank = Array(setsCount).fill("");
  if (!exName) return movementType === "unilateral" ? { prevL: blank.slice(), prevR: blank.slice() } : { prev: blank.slice() };
  const last = getExerciseRecordsDesc(exName)[0];
  if (!last) return movementType === "unilateral" ? { prevL: blank.slice(), prevR: blank.slice() } : { prev: blank.slice() };

  if (movementType === "unilateral") {
    let prevL = blank.slice(), prevR = blank.slice();
    if (Array.isArray(last.setWeightsL) && Array.isArray(last.setWeightsR)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeightsL.length) prevL[i] = last.setWeightsL[i];
        if (i < last.setWeightsR.length) prevR[i] = last.setWeightsR[i];
      }
    } else if (Array.isArray(last.setWeights)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeights.length) prevL[i] = prevR[i] = last.setWeights[i];
      }
    } else if (typeof last.maxWeight === "number") {
      prevL = Array(setsCount).fill(last.maxWeight);
      prevR = Array(setsCount).fill(last.maxWeight);
    }
    return { prevL, prevR };
  }

  // bilateral
  let prev = blank.slice();
  if (Array.isArray(last.setWeights)) {
    for (let i = 0; i < setsCount; i++) if (i < last.setWeights.length) prev[i] = last.setWeights[i];
  } else if (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)) {
    for (let i = 0; i < setsCount; i++) {
      const l = Array.isArray(last.setWeightsL) && i < last.setWeightsL.length ? last.setWeightsL[i] : null;
      const r = Array.isArray(last.setWeightsR) && i < last.setWeightsR.length ? last.setWeightsR[i] : null;
      if (l != null && r != null) prev[i] = Math.max(l, r);
      else if (l != null) prev[i] = l;
      else if (r != null) prev[i] = r;
    }
  } else if (typeof last.maxWeight === "number") {
    prev = Array(setsCount).fill(last.maxWeight);
  }
  return { prev };
}

/* ---------------- DOM Ready ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Nav buttons
  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);
  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);
  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);

  // Step initializers
  initStep1();
  initStep2();
  initStep3();
  initStep4();
  initStep5();

  // Go to first step
  goToStep(1);
  updateReviewButtonState();
});

/* ---------------- Step navigation ---------------- */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });

  const prev = document.getElementById("prev-btn");
  if (prev) prev.disabled = step === 1;

  if (step === 4) populateEquipment();
  else if (step === 5) populateExercises();
  else if (step === 6) buildSessionSummary();

  updateReviewButtonState();
}
function prevStep() { if (currentStep > 1) goToStep(currentStep - 1); }
function nextStep() {
  if (currentStep < 5) {
    if (!validateAndStore(currentStep)) return;
    goToStep(currentStep + 1);
    return;
  }
  if (currentStep === 5) {
    if (currentWorkoutExercises.length === 0) {
      const hint = document.getElementById("s5-hint");
      if (hint) hint.textContent = "Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6);
    return;
  }
  // step 6
  saveSession();
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

/* ---------------- Step 1 — Location ---------------- */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (!sel) return;
  setOptions("#workout-type-select", ["", "gym", "home"], v => {
    if (v === "") return { value: "", text: "--Select Location--" };
    return { value: v, text: capitalize(v) };
  });
  sel.value = wizard.location || "";
}
function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  const val = document.getElementById("workout-type-select")?.value || "";
  if (!val) { if (hint) hint.textContent = "Please select where you are training."; return false; }
  if (hint) hint.textContent = "";
  wizard.location = val;
  return true;
}

/* ---------------- Step 2 — Timing + Date ---------------- */
function initStep2() {
  document.querySelectorAll('input[name="timing"]').forEach(r => {
    r.addEventListener("change", onTimingChange);
  });

  const dt = document.getElementById("workout-datetime");
  if (!wizard.timing) wizard.timing = "now";
  if (wizard.timing === "now") {
    if (dt) { dt.value = nowIsoMinute(); dt.setAttribute("disabled", "disabled"); }
    const hint = document.getElementById("date-hint");
    if (hint) hint.textContent = "Date/time is locked to now.";
  } else {
    if (dt) { dt.removeAttribute("disabled"); dt.value = wizard.datetime || ""; }
  }
}
function onTimingChange(e) {
  wizard.timing = e.target.value;
  const dt = document.getElementById("workout-datetime");
  const hint = document.getElementById("date-hint");
  if (wizard.timing === "now") {
    if (dt) { dt.value = nowIsoMinute(); dt.setAttribute("disabled", "disabled"); }
    if (hint) hint.textContent = "Date/time is locked to now.";
  } else {
    if (dt) { dt.removeAttribute("disabled"); }
    if (hint) hint.textContent = "Pick the date/time for your past session.";
  }
}
function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  const dt = document.getElementById("workout-datetime")?.value || "";
  if (!wizard.timing) { if (hint) hint.textContent = "Select session timing."; return false; }
  if (wizard.timing === "past" && !dt) { if (hint) hint.textContent = "Choose a date/time for your past session."; return false; }
  wizard.datetime = wizard.timing === "now" ? nowIsoMinute() : dt;
  if (hint) hint.textContent = "";
  return true;
}

/* ---------------- Step 3 — Category (+ specific muscle) ---------------- */
function initStep3() {
  const workOn = document.getElementById("work-on-select");
  const musclesSel = document.getElementById("muscle-select");
  const muscleGroup = document.getElementById("muscle-select-group");
  if (!workOn || !musclesSel || !muscleGroup) return;

  // Fixed program categories
  workOn.innerHTML = `<option value="">--Select--</option>` +
    FIXED_CATEGORIES.map(c => `<option value="${c}">${capitalize(c)}</option>`).join("");

  // Muscles (from data)
  const muscles = uniq(EXERCISES_NORM.flatMap(e => e.muscles)).sort((a, b) => a.localeCompare(b));
  musclesSel.innerHTML = `<option value="">--Select--</option>` +
    muscles.map(m => `<option value="${m}">${m}</option>`).join("");

  // Restore state
  if (wizard.category) workOn.value = wizard.category;
  if (wizard.muscle) musclesSel.value = wizard.muscle;
  muscleGroup.style.display = (wizard.category === "specific muscle") ? "block" : "none";

  workOn.onchange = () => {
    const cat = normalizeCategory(workOn.value);
    wizard.category = cat;
    wizard.equipment = "";
    wizard.exercise = "";
    muscleGroup.style.display = (cat === "specific muscle") ? "block" : "none";
    if (cat !== "specific muscle") { wizard.muscle = ""; musclesSel.value = ""; }
    setOptions("#equipment-select", ["--Select--"]);
    setOptions("#exercise-select", ["--Select--"]);
  };
  musclesSel.onchange = () => {
    wizard.muscle = musclesSel.value;
    setOptions("#equipment-select", ["--Select--"]);
    setOptions("#exercise-select", ["--Select--"]);
  };
}
function validateAndStoreStep3() {
  const hint = document.getElementById("s3-hint");
  const raw = document.getElementById("work-on-select")?.value || "";
  if (!raw) { if (hint) hint.textContent = "Please select what you're training."; return false; }
  const cat = normalizeCategory(raw);
  wizard.category = cat;
  if (cat === "specific muscle") {
    const mus = document.getElementById("muscle-select")?.value || "";
    if (!mus) { if (hint) hint.textContent = "Please choose a specific muscle."; return false; }
    wizard.muscle = mus;
  }
  if (hint) hint.textContent = "";
  return true;
}

/* ---------------- Step 4 — Equipment ---------------- */
function initStep4() { /* populated when entering step 4 */ }
function populateEquipment() {
  const sel = document.getElementById("equipment-select");
  const hint = document.getElementById("s4-hint");
  if (!sel) return;

  sel.innerHTML = `<option value="">--Select--</option>`;
  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);

  const eqs = uniq(filtered.flatMap(e => e.equipment)).sort((a, b) => a.localeCompare(b));
  sel.innerHTML += eqs.map(eq => `<option value="${eq}">${title(eq)}</option>`).join("");

  if (wizard.equipment && eqs.includes(wizard.equipment)) sel.value = wizard.equipment;

  sel.onchange = () => {
    wizard.equipment = sel.value;
    if (hint) hint.textContent = "";
    // Clear exercise list as equipment changed
    setOptions("#exercise-select", ["--Select--"]);
  };
}
function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  const val = document.getElementById("equipment-select")?.value || "";
  if (!val) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  wizard.equipment = val;
  if (hint) hint.textContent = "";
  return true;
}

/* ---------------- Step 5 — Exercise & Sets ---------------- */
function initStep5() {
  const setsInput = document.getElementById("sets-input");
  if (setsInput) {
    setsInput.value = wizard.sets;
    setsInput.addEventListener("change", () => {
      wizard.sets = Math.max(1, toInt(setsInput.value, 1));
      renderSetRows();
    });
  }
}
function populateExercises() {
  const select = document.getElementById("exercise-select");
  if (!select) return;

  // Base pool by location → then by category(+muscle) → by equipment
  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter(e => wizard.equipment ? e.equipment.includes(wizard.equipment) : true);

  const names = uniq(filtered.map(e => e.name)).sort((a, b) => a.localeCompare(b));

  select.innerHTML = `<option value="">--Select--</option>` +
    names.map(n => `<option value="${n}">${n}</option>`).join("");

  if (wizard.exercise && names.includes(wizard.exercise)) select.value = wizard.exercise;

  ensureMovementTypeControl();
  showExerciseInsights(select.value || "");

  select.onchange = () => {
    wizard.exercise = select.value;
    showExerciseInsights(wizard.exercise);
    renderSetRows();
  };

  renderSetRows();
}
function ensureMovementTypeControl() {
  if (document.getElementById("movement-type-wrap")) {
    const s = document.getElementById("movement-type-select");
    if (s) s.value = wizard.movementType || "bilateral";
    return;
  }
  const host = document.getElementById("exercise-select-group") || document.getElementById("exercise-select")?.parentElement;
  if (!host) return;
  const wrap = document.createElement("div");
  wrap.id = "movement-type-wrap";
  wrap.className = "form-group";
  wrap.innerHTML = `
    <label>Movement Type</label>
    <select id="movement-type-select">
      <option value="bilateral">Bilateral</option>
      <option value="unilateral">Unilateral</option>
    </select>
  `;
  host.insertAdjacentElement("afterend", wrap);
  const sel = document.getElementById("movement-type-select");
  sel.value = wizard.movementType || "bilateral";
  sel.addEventListener("change", () => {
    wizard.movementType = sel.value;
    renderSetRows();
  });
}
function ensureInsightsNode() {
  let node = document.getElementById("exercise-insights");
  if (!node) {
    const host = document.getElementById("exercise-select-group") || document.getElementById("exercise-select")?.parentElement;
    if (!host) return null;
    node = document.createElement("div");
    node.id = "exercise-insights";
    node.className = "hint";
    node.style.marginTop = "8px";
    host.insertAdjacentElement("afterend", node);
  }
  return node;
}
function showExerciseInsights(name) {
  const box = ensureInsightsNode();
  if (!box) return;
  if (!name) { box.textContent = ""; return; }
  const last = getLastHeaviestWithReps(name);
  const best = getBestHeaviestWithReps(name);
  const parts = [];
  if (last) parts.push(`Last: <strong>${stripZeros(last.maxWeight)} kg</strong>${last.reps != null ? ` × <strong>${stripZeros(last.reps)} reps</strong>` : ""} (${fmtDate(last.date)})`);
  else parts.push(`Last: <em>no history</em>`);
  if (best) parts.push(`Heaviest: <strong>${stripZeros(best.maxWeight)} kg</strong>${best.reps != null ? ` × <strong>${stripZeros(best.reps)} reps</strong>` : ""}${best.date ? ` (${fmtDate(best.date)})` : ""}`);
  else parts.push(`Heaviest: <em>no history</em>`);
  box.innerHTML = parts.join(" &nbsp;•&nbsp; ");
}
function renderSetRows() {
  const container = document.getElementById("exercise-inputs");
  if (!container) return;

  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value, 1));
  const exName = wizard.exercise || "";
  const isUni = (wizard.movementType === "unilateral");

  container.innerHTML = "";

  const prev = computePrevPerSet(exName, isUni ? "unilateral" : "bilateral", n);

  if (!isUni) {
    const block = document.createElement("div");
    block.className = "form-group";
    block.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    container.appendChild(block);

    const grid = block.querySelector("#sets-grid");
    for (let i = 1; i <= n; i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prev && prev.prev[i - 1] !== "" && prev.prev[i - 1] != null) ? prev.prev[i - 1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : stripZeros(prevVal) + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i - 1}">
      `;
      grid.appendChild(row);
    }

    // Prefill if we have buffered values
    if (wizard.setReps.length === n && wizard.setWeights.length === n) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");
    }

  } else {
    // Left
    const left = document.createElement("div");
    left.className = "form-group";
    left.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(left);
    const gridL = left.querySelector("#sets-grid-left");
    for (let i = 1; i <= n; i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const prevValL = (prev.prevL && prev.prevL[i - 1] !== "" && prev.prevL[i - 1] != null) ? prev.prevL[i - 1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Left Set ${i}: Reps" data-side="L" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevValL === "" ? "—" : stripZeros(prevValL) + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Left Set ${i}: Weight (kg)" data-side="L" data-kind="weight" data-idx="${i - 1}">
      `;
      gridL.appendChild(row);
    }
    if (wizard.setRepsL.length === n && wizard.setWeightsL.length === n) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsL[i] ?? "");
    }

    // Right
    const right = document.createElement("div");
    right.className = "form-group";
    right.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    container.appendChild(right);
    const gridR = right.querySelector("#sets-grid-right");
    for (let i = 1; i <= n; i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const prevValR = (prev.prevR && prev.prevR[i - 1] !== "" && prev.prevR[i - 1] != null) ? prev.prevR[i - 1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Right Set ${i}: Reps" data-side="R" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevValR === "" ? "—" : stripZeros(prevValR) + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Right Set ${i}: Weight (kg)" data-side="R" data-kind="weight" data-idx="${i - 1}">
      `;
      gridR.appendChild(row);
    }
    if (wizard.setRepsR.length === n && wizard.setWeightsR.length === n) {
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsR[i] ?? "");
    }
  }
}
function validateAndStoreStep5() {
  const hint = document.getElementById("s5-hint");
  const exercise = document.getElementById("exercise-select")?.value || "";
  if (!exercise) { if (hint) hint.textContent = "Choose an exercise."; return false; }
  wizard.exercise = exercise;

  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value, 1));
  wizard.sets = n;

  if (wizard.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#exercise-inputs [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#exercise-inputs [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#exercise-inputs [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#exercise-inputs [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
        repsL.some(v => v <= 0) || wtsL.some(v => v < 0) || repsR.some(v => v <= 0) || wtsR.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right sides.";
      return false;
    }

    wizard.setRepsL = repsL; wizard.setWeightsL = wtsL;
    wizard.setRepsR = repsR; wizard.setWeightsR = wtsR;

    const maxL = Math.max(...wtsL); const maxR = Math.max(...wtsR);
    const overallMax = Math.max(maxL, maxR);
    const countOverall = [...wtsL, ...wtsR].filter(w => w === overallMax).length;

    wizard.maxWeight = overallMax;
    wizard.maxWeightSetCount = countOverall;

    wizard.setReps = []; wizard.setWeights = [];

  } else {
    const reps = [...document.querySelectorAll('#exercise-inputs [data-kind="reps"]')].map(i => toInt(i.value));
    const wts  = [...document.querySelectorAll('#exercise-inputs [data-kind="weight"]')].map(i => toFloat(i.value));

    if (reps.length !== n || wts.length !== n || reps.some(v => v <= 0) || wts.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return false;
    }

    wizard.setReps = reps; wizard.setWeights = wts;
    const maxW = Math.max(...wts);
    const maxCount = wts.filter(w => w === maxW).length;
    wizard.maxWeight = maxW; wizard.maxWeightSetCount = maxCount;

    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  if (hint) hint.textContent = "";
  return true;
}
function addExerciseToWorkout() {
  if (!validateAndStoreStep5()) return;

  const ex = {
    id: Date.now().toString(),
    date: wizard.datetime,
    name: wizard.exercise,
    category: wizard.category,
    equipment: wizard.equipment,
    muscle: wizard.category === "specific muscle" ? wizard.muscle : null,
    movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(),
    setWeights: wizard.setWeights.slice(),
    setRepsL: wizard.setRepsL.slice(),
    setWeightsL: wizard.setWeightsL.slice(),
    setRepsR: wizard.setRepsR.slice(),
    setWeightsR: wizard.setWeightsR.slice(),
    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount
  };
  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();

  // reset inline for next add
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  wizard.exercise = ""; wizard.sets = 3; wizard.movementType = "bilateral";
  wizard.setReps = []; wizard.setWeights = [];
  wizard.setRepsL = []; wizard.setWeightsL = [];
  wizard.setRepsR = []; wizard.setWeightsR = [];
  wizard.maxWeight = 0; wizard.maxWeightSetCount = 0;
  renderSetRows();
  const ins = document.getElementById("exercise-insights"); if (ins) ins.textContent = "";

  updateReviewButtonState();
}
function renderCurrentWorkoutList() {
  const wrap = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  if (!wrap || !list) return;

  list.innerHTML = "";
  if (currentWorkoutExercises.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";

  currentWorkoutExercises.forEach((ex, idx) => {
    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsL[i])}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsR[i])}kg`).join(", ");
      const maxL = ex.setWeightsL.length ? Math.max(...ex.setWeightsL) : 0;
      const maxR = ex.setWeightsR.length ? Math.max(...ex.setWeightsR) : 0;
      const cL = ex.setWeightsL.filter(w => w === maxL).length;
      const cR = ex.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)}</div>
      `;
    } else {
      const pairs = ex.setReps.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeights[i])}kg`).join(", ");
      details = `
        <div>${stripZeros(ex.sets)} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${stripZeros(ex.maxWeight)}kg × ${stripZeros(ex.maxWeightSetCount)} set(s)</div>
      `;
    }
    const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
    const div = document.createElement("div");
    div.className = "workout-item";
    div.innerHTML = `
      <strong>${ex.name}</strong> <small>(${meta})</small><br>
      ${details}
      <button onclick="removeExerciseFromWorkout(${idx})" style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;">Remove</button>
    `;
    list.appendChild(div);
  });
}
function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

/* ---------------- Step 6 — Review & Save ---------------- */
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  if (meta) meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${title(wizard.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocalString(wizard.datetime)}</span></div>
  `;

  if (exWrap) exWrap.innerHTML = "";

  (currentWorkoutExercises || []).forEach(ex => {
    // Trend badge vs last
    const last = getLastHeaviestWithReps(ex.name);
    const best = getBestHeaviestWithReps(ex.name);
    const lastDelta = last ? +(ex.maxWeight - last.maxWeight).toFixed(2) : null;
    let badge = `<span style="color:#9aa0a6;">— no history</span>`;
    if (lastDelta != null) {
      if (lastDelta > 0) badge = ` <span style="color:#4caf50;">▲ +${stripZeros(lastDelta)}kg</span>`;
      else if (lastDelta < 0) badge = ` <span style="color:#ff5252;">▼ ${stripZeros(Math.abs(lastDelta))}kg</span>`;
      else badge = ` <span style="color:#ffb300;">= 0kg</span>`;
    }

    const bestDelta = best ? +(ex.maxWeight - best.maxWeight).toFixed(2) : null;
    const lastLine = `vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${lastDelta == null ? "—" : (lastDelta > 0 ? `▲ +${stripZeros(lastDelta)}kg` : lastDelta < 0 ? `▼ ${stripZeros(Math.abs(lastDelta))}kg` : "= 0kg")}</strong>`;
    const bestLine = `vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${bestDelta == null ? "—" : (bestDelta > 0 ? `▲ +${stripZeros(bestDelta)}kg` : bestDelta < 0 ? `▼ ${stripZeros(Math.abs(bestDelta))}kg` : "= 0kg")}</strong>`;

    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsL[i])}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsR[i])}kg`).join(", ");
      const maxL = ex.setWeightsL.length ? Math.max(...ex.setWeightsL) : 0;
      const maxR = ex.setWeightsR.length ? Math.max(...ex.setWeightsR) : 0;
      const cL = ex.setWeightsL.filter(w => w === maxL).length;
      const cR = ex.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Overall heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong>${badge}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)}</div>
        <div>${lastLine}</div>
        <div>${bestLine}</div>
      `;
    } else {
      const pairs = ex.setReps.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeights[i])}kg`).join(", ");
      details = `
        <div>${stripZeros(ex.sets)} sets → ${pairs || "—"}</div>
        <div>Heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong>${badge}</div>
        <div>${lastLine}</div>
        <div>${bestLine}</div>
      `;
    }

    const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
    const card = document.createElement("div");
    card.className = "summary-exercise";
    card.innerHTML = `<strong>${ex.name}</strong> <small>(${metaLine})</small><br>${details}`;
    if (exWrap) exWrap.appendChild(card);
  });

  // Totals
  let totalVolume = 0, totalSets = 0;
  currentWorkoutExercises.forEach(ex => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets * 2;
      ex.setRepsL.forEach((r, i) => totalVolume += r * (ex.setWeightsL[i] || 0));
      ex.setRepsR.forEach((r, i) => totalVolume += r * (ex.setWeightsR[i] || 0));
    } else {
      totalSets += ex.sets;
      ex.setReps.forEach((r, i) => totalVolume += r * (ex.setWeights[i] || 0));
    }
  });
  if (totals) {
    totals.innerHTML = `
      <div><strong>Total Exercises:</strong> ${currentWorkoutExercises.length}</div>
      <div><strong>Total Sets:</strong> ${totalSets}</div>
      <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
    `;
  }
}
function saveSession() {
  const dt = wizard.datetime;
  if (!dt) { alert("Missing session date/time — go back to Step 2."); return; }
  if (currentWorkoutExercises.length === 0) { alert("Add at least one exercise before saving."); return; }

  currentWorkoutExercises.forEach(ex => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id,
      date: dt,
      category: ex.category,
      equipment: ex.equipment,
      muscle: ex.muscle,
      movementType: ex.movementType,
      sets: ex.sets,
      setReps: ex.setReps,
      setWeights: ex.setWeights,
      setRepsL: ex.setRepsL,
      setWeightsL: ex.setWeightsL,
      setRepsR: ex.setRepsR,
      setWeightsR: ex.setWeightsR,
      maxWeight: ex.maxWeight,
      maxWeightSetCount: ex.maxWeightSetCount
    });
    if (ex.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved!");

  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  // Reset wizard minimal
  wizard.exercise = "";
  wizard.sets = 3;
  wizard.movementType = "bilateral";
  wizard.setReps = wizard.setWeights = [];
  wizard.setRepsL = wizard.setWeightsL = [];
  wizard.setRepsR = wizard.setWeightsR = [];
  wizard.maxWeight = wizard.maxWeightSetCount = 0;

  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.value = "";
  const setsInput = document.getElementById("sets-input"); if (setsInput) setsInput.value = "3";
  renderSetRows();

  goToStep(1);
  updateReviewButtonState();
}

/* ---------------- History view (Chart.js) ---------------- */
function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history")?.classList.add("active");

  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}
function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger")?.classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
}
function populateHistoryDropdown() {
  const sel = document.getElementById("history-select");
  if (!sel) return;
  const keys = Object.keys(userWorkoutData).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">--Select an Exercise--</option>` + keys.map(k => `<option value="${k}">${k}</option>`).join("");
  const details = document.getElementById("history-details");
  if (details) details.style.display = "none";
  sel.onchange = displayExerciseHistory;
}
function displayExerciseHistory() {
  const exName = document.getElementById("history-select")?.value || "";
  const details = document.getElementById("history-details");
  const bestTitle = document.getElementById("best-weight-title");
  const log = document.getElementById("history-log");

  if (!exName || !userWorkoutData[exName]?.records?.length) {
    if (details) details.style.display = "none";
    return;
  }
  if (details) details.style.display = "block";

  const hist = userWorkoutData[exName];
  if (bestTitle) bestTitle.textContent = `Best Weight: ${stripZeros(hist.bestWeight)}kg`;

  const sorted = hist.records.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const dates = sorted.map(r => new Date(r.date).toLocaleDateString());
  const maxWeights = sorted.map(r => r.maxWeight);

  if (myChart) myChart.destroy();
  const ctx = document.getElementById("history-chart")?.getContext("2d");
  if (ctx) {
    myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [{
          label: "Heaviest Lift (kg)",
          data: maxWeights,
          borderColor: "orange",
          backgroundColor: "rgba(255,165,0,0.2)",
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "Date", color: "white" }, ticks: { color: "white" } },
          y: { title: { display: true, text: "Weight (kg)", color: "white" }, ticks: { color: "white" } }
        },
        plugins: { legend: { labels: { color: "white" } } }
      }
    });
  }

  if (log) {
    log.innerHTML = "";
    sorted.forEach(rec => {
      let detailsHtml = "";
      if (rec.movementType === "unilateral" && (rec.setWeightsL || rec.setWeightsR)) {
        const pairsL = (rec.setRepsL || []).map((r, i) => `${stripZeros(r)}x${stripZeros(rec.setWeightsL?.[i])}kg`).join(", ");
        const pairsR = (rec.setRepsR || []).map((r, i) => `${stripZeros(r)}x${stripZeros(rec.setWeightsR?.[i])}kg`).join(", ");
        const maxL = rec.setWeightsL?.length ? Math.max(...rec.setWeightsL) : 0;
        const maxR = rec.setWeightsR?.length ? Math.max(...rec.setWeightsR) : 0;
        const cL = (rec.setWeightsL || []).filter(w => w === maxL).length;
        const cR = (rec.setWeightsR || []).filter(w => w === maxR).length;
        detailsHtml = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)}</div>
        `;
      } else {
        const pairs = (rec.setReps || []).map((r, i) => `${stripZeros(r)}x${stripZeros(rec.setWeights?.[i])}kg`).join(", ");
        detailsHtml = `
          <div>Sets: ${stripZeros(rec.sets)} → ${pairs || "—"}</div>
          <div>Heaviest: ${stripZeros(rec.maxWeight)}kg${rec.maxWeightSetCount ? ` × ${stripZeros(rec.maxWeightSetCount)} set(s)` : ""}</div>
        `;
      }

      const meta = `${title(rec.category || "n/a")} • ${title(rec.equipment || "n/a")}${rec.muscle ? ` • ${rec.muscle}` : ""} • ${title(rec.movementType || "bilateral")}`;

      const li = document.createElement("li");
      li.innerHTML = `
        <span>
          <strong>${exName}</strong> <small>(${meta})</small><br>
          Date: ${new Date(rec.date).toLocaleString()}<br>
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
  if (!confirm("Are you sure you want to delete this record?")) return;
  const hist = userWorkoutData[exName];
  hist.records = hist.records.filter(r => r.id !== recordId);
  if (hist.records.length === 0) {
    delete userWorkoutData[exName];
  } else {
    const newMax = Math.max(...hist.records.map(r => r.maxWeight));
    hist.bestWeight = Number.isFinite(newMax) ? newMax : 0;
  }
  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();
  const sel = document.getElementById("history-select");
  if (sel && (exName in userWorkoutData)) {
    sel.value = exName;
    displayExerciseHistory();
  } else {
    const details = document.getElementById("history-details");
    if (details) details.style.display = "none";
  }
}
function editRecord(exName, recordId) {
  const hist = userWorkoutData[exName];
  const rec = hist?.records.find(r => r.id === recordId);
  if (!rec) return;

  // Fill wizard
  wizard.location = HOME_EQUIPMENT.has(rec.equipment) ? "home" : "gym";
  wizard.timing = "past";
  wizard.datetime = rec.date;
  wizard.category = rec.category || "";
  wizard.muscle = rec.muscle || "";
  wizard.equipment = rec.equipment || "";
  wizard.exercise = exName;
  wizard.movementType = rec.movementType || "bilateral";
  wizard.sets = rec.sets || 3;

  if (wizard.movementType === "unilateral" && rec.setWeightsL && rec.setWeightsR) {
    wizard.setRepsL = (rec.setRepsL || []).slice();
    wizard.setWeightsL = (rec.setWeightsL || []).slice();
    wizard.setRepsR = (rec.setRepsR || []).slice();
    wizard.setWeightsR = (rec.setWeightsR || []).slice();
    wizard.setReps = []; wizard.setWeights = [];
  } else {
    wizard.setReps = (rec.setReps || []).slice();
    wizard.setWeights = (rec.setWeights || []).slice();
    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  const { weights } = extractWeightsAndReps(rec);
  const maxW = weights.length ? Math.max(...weights) : (rec.maxWeight || 0);
  wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
  wizard.maxWeightSetCount = weights.filter(w => w === wizard.maxWeight).length || (rec.maxWeightSetCount || 0);

  editingRecord = rec;

  showLoggerView();

  // Sync UI
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = wizard.location;
  const pastRadio = document.querySelector('input[name="timing"][value="past"]'); if (pastRadio) pastRadio.checked = true;
  const dt = document.getElementById("workout-datetime"); if (dt) { dt.removeAttribute("disabled"); dt.value = wizard.datetime; }
  const catSel = document.getElementById("work-on-select"); if (catSel) catSel.value = wizard.category;

  const musGrp = document.getElementById("muscle-select-group");
  const musSel = document.getElementById("muscle-select");
  if (wizard.category === "specific muscle") { if (musGrp) musGrp.style.display = "block"; if (musSel) musSel.value = wizard.muscle; }
  else { if (musGrp) musGrp.style.display = "none"; }

  populateEquipment();
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.value = wizard.equipment;
  populateExercises();
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.value = wizard.exercise;

  // Render rows with values
  renderSetRows();
  if (wizard.movementType === "unilateral") {
    const gridL = document.getElementById("sets-grid-left");
    const gridR = document.getElementById("sets-grid-right");
    if (gridL && gridR) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsL[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsR[i] ?? "");
    }
  } else {
    const grid = document.getElementById("sets-grid");
    if (grid) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");
    }
  }

  currentWorkoutExercises = [{
    id: rec.id,
    date: wizard.datetime,
    name: wizard.exercise,
    category: wizard.category,
    equipment: wizard.equipment,
    muscle: wizard.muscle || null,
    movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(),
    setWeights: wizard.setWeights.slice(),
    setRepsL: wizard.setRepsL.slice(),
    setWeightsL: wizard.setWeightsL.slice(),
    setRepsR: wizard.setRepsR.slice(),
    setWeightsR: wizard.setWeightsR.slice(),
    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();

  goToStep(5);
  const editMsg = document.getElementById("edit-mode-message"); if (editMsg) editMsg.style.display = "block";
}

/* ---------------- Validation dispatcher ---------------- */
function validateAndStore(step) {
  if (step === 1) return validateAndStoreStep1();
  if (step === 2) return validateAndStoreStep2();
  if (step === 3) return validateAndStoreStep3();
  if (step === 4) return validateAndStoreStep4();
  if (step === 5) return validateAndStoreStep5();
  return true;
}

/* ---------------- Debug helpers ---------------- */
window._dumpData = () => console.log("userWorkoutData:", userWorkoutData);
window._clearData = () => {
  if (confirm("Clear ALL workout data?")) {
    localStorage.removeItem("userWorkoutData");
    userWorkoutData = {};
    currentWorkoutExercises = [];
    renderCurrentWorkoutList();
    alert("All data cleared.");
  }
};
window.showHistoryView = showHistoryView;
window.showLoggerView = showLoggerView;
window.addExerciseToWorkout = addExerciseToWorkout;
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
