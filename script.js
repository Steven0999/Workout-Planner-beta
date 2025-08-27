/* =======================================================================
   Workout Session Logger — script.js (FULL, with normalization patch)
   Fixes: Equipment dropdown not showing due to casing / field-name mismatches.
   - Accepts window.EXERCISES or window.exercisesData
   - Accepts sections OR categories/category
   - Accepts equipment as array OR string
   - Normalizes all to lowercase for matching
   - Filters Home equipment to: body weight, resistance bands, kettlebell
   - Preserves your wizard flow, prev weight markers, unilateral mode,
     review vs last/best, history chart, and page state.
======================================================================= */

/* ---- Crash guard (helps you see errors in console) ---- */
window.addEventListener("error", (e) => console.error("[JS Error]", e.error || e.message));

/* ---- Helpers / small utils ---- */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const uniq = (a) => [...new Set(a)];
const nowIsoMinute = () => new Date().toISOString().slice(0, 16);
const toInt = (v, f = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : f; };
const toFloat = (v, f = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : f; };
const isoToLocalString = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || "—"; } };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const fmtDelta = (d) => (d == null ? "—" : d > 0 ? `▲ +${d.toFixed(2)}kg` : d < 0 ? `▼ ${Math.abs(d).toFixed(2)}kg` : `= 0kg`);
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

/* ---- Normalization PATCH (robustly read your library) ---- */
function toLowerArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter(Boolean).map((x) => String(x).toLowerCase().trim());
  return [String(val).toLowerCase().trim()];
}
const RAW_EXERCISES = Array.isArray(window.EXERCISES)
  ? window.EXERCISES
  : (Array.isArray(window.exercisesData) ? window.exercisesData : []);

/* Map any shape to a canonical shape the rest of the app uses */
const EXERCISES_NORM = RAW_EXERCISES.map((e) => {
  const sections = uniq([
    ...toLowerArray(e.sections),
    ...toLowerArray(e.categories),
    ...toLowerArray(e.category),
  ]);
  const equipment = uniq([
    ...toLowerArray(e.equipment),
  ]);
  const muscles = uniq([
    ...toLowerArray(e.muscles),
    ...toLowerArray(e.muscle),
  ]);
  return {
    name: e.name || "Unnamed Exercise",
    sections,
    equipment,
    muscles,
  };
});

/* Build category and muscle lists from normalized data */
const allCategories = () => uniq(EXERCISES_NORM.flatMap((e) => e.sections)).sort((a,b)=>a.localeCompare(b));
const allMuscles = () => uniq(EXERCISES_NORM.flatMap((e) => e.muscles)).sort((a,b)=>a.localeCompare(b));

/* Location filter (Home restricts to home-friendly equipment) */
const byLocation = (items, loc) =>
  (loc === "home")
    ? items.filter((e) => e.equipment.some((eq) => HOME_EQUIPMENT.includes(eq)))
    : items;

/* Category + muscle filter (if cat === 'specific muscle', require muscle match) */
function byCategoryAndMuscle(items, category, muscle) {
  const cat = String(category || "").toLowerCase();
  if (!cat) return [];
  if (cat === "specific muscle") {
    const m = String(muscle || "").toLowerCase();
    if (!m) return [];
    return items.filter((e) => e.sections.includes("specific muscle") && e.muscles.includes(m));
  }
  return items.filter((e) => e.sections.includes(cat));
}

/* ---- App state ---- */
let currentStep = 1;
let myChart = null;

let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

const wizard = {
  location: "",
  timing: "now",
  datetime: nowIsoMinute(),
  category: "",
  muscle: "",
  equipment: "",
  exercise: "",
  movementType: "bilateral",  // 'bilateral' | 'unilateral'
  sets: 3,
  // bilateral arrays
  setReps: [],
  setWeights: [],
  // unilateral arrays
  setRepsL: [], setWeightsL: [],
  setRepsR: [], setWeightsR: [],
  maxWeight: 0,
  maxWeightSetCount: 0,
};

/* Preserve wizard step + scroll between pages */
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

/* ======================================================================
   History helpers (last / best) + trend
====================================================================== */

function getExerciseRecordsDesc(exName) {
  const recs = (userWorkoutData[exName]?.records || []).slice();
  recs.sort((a, b) => new Date(b.date) - new Date(a.date));
  return recs;
}

function extractWeightsAndReps(record) {
  if (record.setWeightsL && record.setWeightsR) {
    const wAll = [...(record.setWeightsL || []), ...(record.setWeightsR || [])];
    const rAll = [
      ...(record.setRepsL || Array(record.setWeightsL?.length || 0).fill(null)),
      ...(record.setRepsR || Array(record.setWeightsR?.length || 0).fill(null)),
    ];
    return { weights: wAll, reps: rAll };
  }
  return {
    weights: Array.isArray(record.setWeights) ? record.setWeights : [],
    reps: Array.isArray(record.setReps) ? record.setReps : [],
  };
}

function getLastHeaviestWithReps(exName) {
  const recs = getExerciseRecordsDesc(exName);
  if (recs.length === 0) return null;
  const r = recs[0];
  const { weights, reps } = extractWeightsAndReps(r);
  if (!weights.length) return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };
  const maxW = Math.max(...weights);
  const idx = weights.findIndex((w) => w === maxW);
  return { maxWeight: maxW, reps: idx >= 0 ? (reps[idx] ?? null) : null, date: r.date };
}

function getBestHeaviestWithReps(exName) {
  const bestW = userWorkoutData[exName]?.bestWeight ?? null;
  if (bestW == null) return null;
  const recs = getExerciseRecordsDesc(exName).slice().reverse(); // oldest → newest
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

/* Per-set "Prev" markers for inputs */
function computePrevPerSet(exName, movementType, setsCount) {
  const blankN = Array(setsCount).fill("");
  if (!exName) {
    return movementType === "unilateral"
      ? { prevL: blankN.slice(), prevR: blankN.slice() }
      : { prev: blankN.slice() };
  }
  const last = getExerciseRecordsDesc(exName)[0];
  if (!last) {
    return movementType === "unilateral"
      ? { prevL: blankN.slice(), prevR: blankN.slice() }
      : { prev: blankN.slice() };
  }

  if (movementType === "unilateral") {
    let prevL = blankN.slice(), prevR = blankN.slice();
    if (Array.isArray(last.setWeightsL) && Array.isArray(last.setWeightsR)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeightsL.length) prevL[i] = last.setWeightsL[i];
        if (i < last.setWeightsR.length) prevR[i] = last.setWeightsR[i];
      }
    } else if (Array.isArray(last.setWeights)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeights.length) {
          prevL[i] = last.setWeights[i];
          prevR[i] = last.setWeights[i];
        }
      }
    } else if (typeof last.maxWeight === "number") {
      prevL = Array(setsCount).fill(last.maxWeight);
      prevR = Array(setsCount).fill(last.maxWeight);
    }
    return { prevL, prevR };
  }

  let prev = blankN.slice();
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

/* ======================================================================
   DOM Ready
====================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Top nav
  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);

  // Wizard nav
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);

  // Step 5 actions
  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);
  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);

  // History select
  document.getElementById("history-select")?.addEventListener("change", displayExerciseHistory);

  // Initialize steps
  initStep1();
  initStep2();
  initStep3();
  // Step 4,5 are populated when entered
  goToStep(1);
  updateReviewButtonState();
});

/* ======================================================================
   Step navigation
====================================================================== */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });

  // badges (optional)
  document.querySelectorAll(".step-badge").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });

  const prev = document.getElementById("prev-btn");
  if (prev) prev.disabled = step === 1;

  if (step === 4) populateEquipment();
  else if (step === 5) populateExercises();
  else if (step === 6) buildSessionSummary();

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
    if (currentWorkoutExercises.length === 0) {
      const s5 = document.getElementById("s5-hint");
      if (s5) s5.textContent = "Please add at least one exercise before reviewing.";
      return;
    }
    goToStep(6);
    return;
  }
  // step 6 → save
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

/* ======================================================================
   Step 1 — Location
====================================================================== */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (!sel) return;
  sel.innerHTML = `
    <option value="">--Select Location--</option>
    <option value="gym">Gym</option>
    <option value="home">Home</option>
  `;
  sel.value = wizard.location || "";
}
function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  const val = document.getElementById("workout-type-select").value;
  if (!val) { if (hint) hint.textContent = "Please select where you are training."; return false; }
  wizard.location = val;
  if (hint) hint.textContent = "";
  return true;
}

/* ======================================================================
   Step 2 — Timing + Date
====================================================================== */
function initStep2() {
  const nowRadio = document.querySelector('input[name="timing"][value="now"]');
  const pastRadio = document.querySelector('input[name="timing"][value="past"]');
  const dt = document.getElementById("workout-datetime");

  // default to "now"
  if (wizard.timing === "now") {
    if (nowRadio) nowRadio.checked = true;
    if (dt) { dt.value = wizard.datetime; dt.setAttribute("disabled", "disabled"); }
  } else {
    if (pastRadio) pastRadio.checked = true;
    if (dt) { dt.value = wizard.datetime; dt.removeAttribute("disabled"); }
  }

  document.querySelectorAll('input[name="timing"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      wizard.timing = e.target.value;
      if (wizard.timing === "now") {
        wizard.datetime = nowIsoMinute();
        if (dt) { dt.value = wizard.datetime; dt.setAttribute("disabled", "disabled"); }
        const hint = document.getElementById("date-hint");
        if (hint) hint.textContent = "Date/time is locked to now.";
      } else {
        if (dt) dt.removeAttribute("disabled");
        const hint = document.getElementById("date-hint");
        if (hint) hint.textContent = "Pick a date/time for your past session.";
      }
    });
  });
}
function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  const dt = document.getElementById("workout-datetime");
  if (wizard.timing === "past") {
    if (!dt?.value) { if (hint) hint.textContent = "Please choose a date/time for your past session."; return false; }
    wizard.datetime = dt.value;
  } else {
    wizard.datetime = nowIsoMinute();
  }
  if (hint) hint.textContent = "";
  return true;
}

/* ======================================================================
   Step 3 — Category (+ specific muscle)
====================================================================== */
function initStep3() {
  const workOn = document.getElementById("work-on-select");
  const musclesSel = document.getElementById("muscle-select");
  const muscleGroup = document.getElementById("muscle-select-group");

  // Build categories from FIXED_CATEGORIES only (no auto-scan from data)
  workOn.innerHTML =
    `<option value="">--Select--</option>` +
    FIXED_CATEGORIES.map((c) => `<option value="${c}">${capitalize(c)}</option>`).join("");

  // Build muscle list (either a static list you already had, or derive from data if you like)
  const muscles =
    Array.from(
      new Set(
        (Array.isArray(EXERCISES_NORM) ? EXERCISES_NORM : [])
          .flatMap((e) => Array.isArray(e.muscles) ? e.muscles : [])
          .map((m) => String(m).trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

  musclesSel.innerHTML =
    `<option value="">--Select--</option>` +
    muscles.map((m) => `<option value="${m}">${m}</option>`).join("");

  // Restore existing wizard state if any
  if (wizard.category) workOn.value = wizard.category;
  if (wizard.muscle) musclesSel.value = wizard.muscle;
  muscleGroup.style.display = (wizard.category === "specific muscle") ? "block" : "none";

  // Handlers
  workOn.addEventListener("change", () => {
    const cat = normalizeCategory(workOn.value);
    wizard.category = cat;
    wizard.equipment = "";
    wizard.exercise = "";

    // Show/hide muscle picker only for "specific muscle"
    if (cat === "specific muscle") {
      muscleGroup.style.display = "block";
    } else {
      muscleGroup.style.display = "none";
      wizard.muscle = "";
      musclesSel.value = "";
    }

    // Clearing downstream when category changes
    setOptions("#equipment-select", ["--Select--"]);
    setOptions("#exercise-select", ["--Select--"]);
  });

  musclesSel.addEventListener("change", () => {
    wizard.muscle = musclesSel.value;
    // Clear downstream when muscle changes
    setOptions("#equipment-select", ["--Select--"]);
    setOptions("#exercise-select", ["--Select--"]);
  });
}

function validateAndStoreStep3() {
  const hint = document.getElementById("s3-hint");
  const raw = document.getElementById("work-on-select").value;
  if (!raw) { if (hint) hint.textContent = "Please select what you're training."; return false; }
  const cat = normalizeCategory(raw);
  wizard.category = cat;

  if (cat === "specific muscle") {
    const mus = document.getElementById("muscle-select").value;
    if (!mus) { if (hint) hint.textContent = "Please choose a specific muscle."; return false; }
    wizard.muscle = mus;
  }

  if (hint) hint.textContent = "";
  return true;
}
/* ======================================================================
   Step 4 — Equipment (THIS IS WHERE THE PATCH MATTERS)
====================================================================== */
function populateEquipment() {
  const sel = document.getElementById("equipment-select");
  const hint = document.getElementById("s4-hint");
  if (!sel) return;

  sel.innerHTML = `<option value="">--Select--</option>`;

  // Filter by location first (gym/home), then by category (+ muscle if needed)
  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);

  // Collect available equipment from the filtered exercise set
  const eqs = uniq(filtered.flatMap((e) => e.equipment)).sort((a,b)=>a.localeCompare(b));

  // Populate the dropdown
  sel.innerHTML += eqs.map((eq) => `<option value="${eq}">${title(eq)}</option>`).join("");

  // Restore prior selection if still valid
  if (wizard.equipment && eqs.includes(wizard.equipment)) {
    sel.value = wizard.equipment;
  }

  // Change handler: store and move forward to exercises population
  sel.onchange = () => {
    wizard.equipment = sel.value;
    if (hint) hint.textContent = "";
    populateExercises();
  };
}

function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  const val = document.getElementById("equipment-select").value;
  if (!val) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  wizard.equipment = val;
  if (hint) hint.textContent = "";
  return true;
}

/* ======================================================================
   Step 5 — Exercise + sets (unilateral/bilateral, prev markers)
====================================================================== */
function populateExercises() {
  const select = document.getElementById("exercise-select");
  if (!select) return;

  select.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter((e) => !wizard.equipment || e.equipment.includes(wizard.equipment));

  const names = uniq(filtered.map((e) => e.name)).sort((a,b)=>a.localeCompare(b));

  select.innerHTML += names.map((n) => `<option value="${n}">${n}</option>`).join("");

  if (wizard.exercise && names.includes(wizard.exercise)) {
    select.value = wizard.exercise;
  }

  // Exercise change
  select.onchange = () => {
    wizard.exercise = select.value;
    showExerciseInsights(wizard.exercise);
    ensureMovementTypeControl();
    renderSetRows(); // re-render to update "Prev" markers for this exercise
  };

  // Movement type control + initial rows + insights
  ensureMovementTypeControl();
  showExerciseInsights(select.value || "");
  renderSetRows();

  // Sets input change
  const setsInput = document.getElementById("sets-input");
  if (setsInput) {
    setsInput.value = wizard.sets;
    setsInput.onchange = () => {
      wizard.sets = Math.max(1, toInt(setsInput.value, 1));
      renderSetRows();
    };
  }
}

/* Movement type dropdown under exercise select */
function ensureMovementTypeControl() {
  let wrap = document.getElementById("movement-type-wrap");
  const exerciseGroup = document.getElementById("exercise-select")?.closest(".form-group");
  if (!wrap && exerciseGroup && exerciseGroup.parentElement) {
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
    exerciseGroup.parentElement.insertBefore(wrap, exerciseGroup.nextSibling);
    const typeSel = wrap.querySelector("#movement-type-select");
    typeSel.addEventListener("change", () => {
      wizard.movementType = typeSel.value;
      renderSetRows();
    });
  }
  const typeSel = document.getElementById("movement-type-select");
  if (typeSel) typeSel.value = wizard.movementType || "bilateral";
}

/* Dynamic insights under exercise select: last & best with reps and dates */
function showExerciseInsights(name) {
  let node = document.getElementById("exercise-insights");
  if (!node) {
    node = document.createElement("div");
    node.id = "exercise-insights";
    node.className = "hint";
    const grp = document.getElementById("exercise-select")?.closest(".form-group");
    if (grp && grp.parentElement) grp.parentElement.insertBefore(node, grp.nextSibling);
  }
  if (!name) { node.textContent = ""; return; }

  const last = getLastHeaviestWithReps(name);
  const best = getBestHeaviestWithReps(name);

  const parts = [];
  if (last) parts.push(`Last: <strong>${last.maxWeight ?? 0}kg</strong>${last.reps != null ? ` × <strong>${last.reps} reps</strong>` : ""} (${fmtDate(last.date)})`);
  else parts.push(`Last: <em>no history</em>`);

  if (best) parts.push(`Heaviest: <strong>${best.maxWeight ?? 0}kg</strong>${best.reps != null ? ` × <strong>${best.reps} reps</strong>` : ""}${best.date ? ` (${fmtDate(best.date)})` : ""}`);
  else parts.push(`Heaviest: <em>no history</em>`);

  node.innerHTML = parts.join(" &nbsp;•&nbsp; ");
}

/* Render set rows (with per-set Prev labels) */
function renderSetRows() {
  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value, 1));
  wizard.sets = n;

  let container = document.getElementById("sets-grids-wrapper");
  if (!container) {
    container = document.createElement("div");
    container.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    if (anchor) anchor.appendChild(container);
  }
  container.innerHTML = "";

  const prev = computePrevPerSet(wizard.exercise, wizard.movementType, n);

  if (wizard.movementType === "unilateral") {
    // Left
    const left = document.createElement("div");
    left.className = "form-group";
    left.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(left);
    const gridL = left.querySelector("#sets-grid-left");
    for (let i = 1; i <= n; i++) {
      const pv = (prev.prevL && prev.prevL[i-1] !== "" && prev.prevL[i-1] != null) ? prev.prevL[i-1] : "";
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)" data-side="L" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${pv === "" ? "—" : pv + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (L)" data-side="L" data-kind="weight" data-idx="${i-1}">
      `;
      gridL.appendChild(row);
    }

    // Right
    const right = document.createElement("div");
    right.className = "form-group";
    right.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    container.appendChild(right);
    const gridR = right.querySelector("#sets-grid-right");
    for (let i = 1; i <= n; i++) {
      const pv = (prev.prevR && prev.prevR[i-1] !== "" && prev.prevR[i-1] != null) ? prev.prevR[i-1] : "";
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)" data-side="R" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${pv === "" ? "—" : pv + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)" data-side="R" data-kind="weight" data-idx="${i-1}">
      `;
      gridR.appendChild(row);
    }
  } else {
    // Bilateral
    const single = document.createElement("div");
    single.className = "form-group";
    single.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    container.appendChild(single);
    const grid = single.querySelector("#sets-grid");
    for (let i = 1; i <= n; i++) {
      const pv = (prev.prev && prev.prev[i-1] !== "" && prev.prev[i-1] != null) ? prev.prev[i-1] : "";
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${pv === "" ? "—" : pv + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i-1}">
      `;
      grid.appendChild(row);
    }
  }
}

/* Validate inputs for step 5 and stash in wizard */
function validateAndStoreStep5() {
  const hint = document.getElementById("s5-hint");
  const exercise = document.getElementById("exercise-select").value;
  if (!exercise) { if (hint) hint.textContent = "Choose an exercise."; return false; }
  wizard.exercise = exercise;

  const n = Math.max(1, toInt(document.getElementById("sets-input").value, 1));
  wizard.sets = n;

  if (wizard.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(el => toInt(el.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(el => toFloat(el.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(el => toInt(el.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(el => toFloat(el.value));

    if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
        repsL.some(v=>v<=0) || repsR.some(v=>v<=0) || wtsL.some(v=>v<0) || wtsR.some(v=>v<0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both sides.";
      return false;
    }

    wizard.setRepsL = repsL; wizard.setWeightsL = wtsL;
    wizard.setRepsR = repsR; wizard.setWeightsR = wtsR;

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    const overall = Math.max(maxL, maxR);
    const overallCount = [...wtsL, ...wtsR].filter(w => w === overall).length;

    wizard.maxWeight = overall;
    wizard.maxWeightSetCount = overallCount;

    wizard.setReps = []; wizard.setWeights = [];
  } else {
    const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(el => toInt(el.value));
    const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(el => toFloat(el.value));

    if (reps.length !== n || wts.length !== n || reps.some(v=>v<=0) || wts.some(v=>v<0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return false;
    }

    wizard.setReps = reps; wizard.setWeights = wts;
    const maxW = Math.max(...wts);
    wizard.maxWeight = maxW;
    wizard.maxWeightSetCount = wts.filter(w => w === maxW).length;

    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  if (hint) hint.textContent = "";
  return true;
}

/* Add to current session list */
function addExerciseToWorkout() {
  if (!validateAndStoreStep5()) return;

  const ex = {
    id: Date.now().toString(),
    date: wizard.datetime,
    name: wizard.exercise,
    category: wizard.category,
    equipment: wizard.equipment,
    muscle: String(wizard.category).toLowerCase() === "specific muscle" ? wizard.muscle : null,
    movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(),
    setWeights: wizard.setWeights.slice(),
    setRepsL: wizard.setRepsL.slice(),
    setWeightsL: wizard.setWeightsL.slice(),
    setRepsR: wizard.setRepsR.slice(),
    setWeightsR: wizard.setWeightsR.slice(),
    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount,
  };

  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();

  // reset inline fields for next add
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  wizard.exercise = ""; wizard.sets = 3;
  wizard.movementType = "bilateral";
  wizard.setReps = []; wizard.setWeights = [];
  wizard.setRepsL = []; wizard.setWeightsL = [];
  wizard.setRepsR = []; wizard.setWeightsR = [];
  wizard.maxWeight = 0; wizard.maxWeightSetCount = 0;
  renderSetRows();
  showExerciseInsights(""); // clear

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
    const div = document.createElement("div");
    div.className = "workout-item";

    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r,i)=>`${r}x${ex.setWeightsL[i]}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r,i)=>`${r}x${ex.setWeightsR[i]}kg`).join(", ");
      const maxL = Math.max(...ex.setWeightsL);
      const maxR = Math.max(...ex.setWeightsR);
      const cL = ex.setWeightsL.filter(w=>w===maxL).length;
      const cR = ex.setWeightsR.filter(w=>w===maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${maxL}kg × ${cL} • Heaviest Right: ${maxR}kg × ${cR}</div>
      `;
    } else {
      const pairs = ex.setReps.map((r,i)=>`${r}x${ex.setWeights[i]}kg`).join(", ");
      details = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${ex.maxWeight}kg × ${ex.maxWeightSetCount}</div>
      `;
    }

    const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;

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

/* ======================================================================
   Step 6 — Review + Save
====================================================================== */
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

  (currentWorkoutExercises || []).forEach((ex) => {
    const trend = getTrendAgainstLast(ex.name, ex.maxWeight);
    let badge = "";
    if (trend.dir === "up")   badge = ` <span style="color:#4caf50;">▲ +${trend.delta.toFixed(2)}kg</span>`;
    if (trend.dir === "down") badge = ` <span style="color:#ff5252;">▼ ${Math.abs(trend.delta).toFixed(2)}kg</span>`;
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
      const cL = ex.setWeightsL.filter(w => w===maxL).length;
      const cR = ex.setWeightsR.filter(w => w===maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: <strong>${maxL}kg</strong> (${cL} set${cL!==1?"s":""}) • Heaviest Right: <strong>${maxR}kg</strong> (${cR} set${cR!==1?"s":""})</div>
        <div>Overall Heaviest this session: <strong>${ex.maxWeight}kg</strong>${badge}</div>
        <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
        <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
      `;
    } else {
      const pairs = ex.setReps.map((r,i)=>`${r}x${ex.setWeights[i]}kg`).join(", ");
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
    card.innerHTML = `<strong>${ex.name}</strong> <small>(${metaLine})</small><br>${details}`;
    if (exWrap) exWrap.appendChild(card);
  });

  // Totals
  let totalVolume = 0, totalSets = 0;
  currentWorkoutExercises.forEach((ex) => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets * 2;
      ex.setRepsL.forEach((r,i)=> totalVolume += r * ex.setWeightsL[i]);
      ex.setRepsR.forEach((r,i)=> totalVolume += r * ex.setWeightsR[i]);
    } else {
      totalSets += ex.sets;
      ex.setReps.forEach((r,i)=> totalVolume += r * ex.setWeights[i]);
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

  currentWorkoutExercises.forEach((ex) => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id, date: dt,
      category: ex.category, equipment: ex.equipment, muscle: ex.muscle,
      movementType: ex.movementType,
      setReps: ex.setReps, setWeights: ex.setWeights,
      setRepsL: ex.setRepsL, setWeightsL: ex.setWeightsL,
      setRepsR: ex.setRepsR, setWeightsR: ex.setWeightsR,
      sets: ex.sets,
      maxWeight: ex.maxWeight, maxWeightSetCount: ex.maxWeightSetCount,
    });
    if (ex.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  // reset session
  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  // reset wizard (keep user on step 1)
  Object.assign(wizard, {
    location: "", timing: "now", datetime: nowIsoMinute(),
    category: "", muscle: "", equipment: "", exercise: "",
    movementType: "bilateral",
    sets: 3,
    setReps: [], setWeights: [],
    setRepsL: [], setWeightsL: [],
    setRepsR: [], setWeightsR: [],
    maxWeight: 0, maxWeightSetCount: 0,
  });

  // reset DOM
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = "";
  const nowRadio = document.querySelector('input[name="timing"][value="now"]'); if (nowRadio) nowRadio.checked = true;
  const dtInput = document.getElementById("workout-datetime"); if (dtInput) { dtInput.value = wizard.datetime; dtInput.setAttribute("disabled","disabled"); }
  const workOn = document.getElementById("work-on-select"); if (workOn) workOn.value = "";
  const musSel = document.getElementById("muscle-select"); if (musSel) musSel.value = "";
  const musGrp = document.getElementById("muscle-select-group"); if (musGrp) musGrp.style.display = "none";
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  const setsInput = document.getElementById("sets-input"); if (setsInput) setsInput.value = "3";
  const grids = document.getElementById("sets-grids-wrapper"); if (grids) grids.innerHTML = "";

  goToStep(1);
}

/* ======================================================================
   History View (Chart, log, edit/delete)
====================================================================== */
function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-history")?.classList.add("active");

  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}

function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-logger")?.classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
}

function populateHistoryDropdown() {
  const historySelect = document.getElementById("history-select");
  if (!historySelect) return;
  const keys = Object.keys(userWorkoutData).sort((a,b)=>a.localeCompare(b));
  historySelect.innerHTML = `<option value="">--Select an Exercise--</option>` +
    keys.map(k => `<option value="${k}">${k}</option>`).join("");
  const details = document.getElementById("history-details");
  if (details) details.style.display = "none";
}

function displayExerciseHistory() {
  const selectedExercise = document.getElementById("history-select").value;
  const historyDetails = document.getElementById("history-details");
  const bestWeightTitle = document.getElementById("best-weight-title");
  const historyLog = document.getElementById("history-log");

  if (!selectedExercise || !userWorkoutData[selectedExercise]) {
    if (historyDetails) historyDetails.style.display = "none";
    return;
  }

  const history = userWorkoutData[selectedExercise];
  if (historyDetails) historyDetails.style.display = "block";
  if (bestWeightTitle) bestWeightTitle.textContent = `Best Weight: ${history.bestWeight}kg`;

  const sorted = history.records.slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
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
          backgroundColor: "rgba(255, 165, 0, 0.2)",
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

  if (historyLog) {
    historyLog.innerHTML = "";
    sorted.forEach((record) => {
      const dateString = new Date(record.date).toLocaleString();
      let details = "";
      if (record.movementType === "unilateral" && record.setWeightsL && record.setWeightsR) {
        const pairsL = (record.setRepsL || []).map((r,i)=> `${r}x${record.setWeightsL[i]}kg`).join(", ");
        const pairsR = (record.setRepsR || []).map((r,i)=> `${r}x${record.setWeightsR[i]}kg`).join(", ");
        const maxL = Math.max(...record.setWeightsL);
        const maxR = Math.max(...record.setWeightsR);
        const cL = record.setWeightsL.filter(w => w===maxL).length;
        const cR = record.setWeightsR.filter(w => w===maxR).length;
        details = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${maxL}kg × ${cL} • Heaviest Right: ${maxR}kg × ${cR}</div>
        `;
      } else {
        const pairs = (record.setReps || []).map((r,i)=> `${r}x${(record.setWeights || [])[i]}kg`).join(", ");
        const extra = record.maxWeightSetCount ? ` × ${record.maxWeightSetCount} set(s)` : "";
        details = `
          <div>Sets: ${record.sets} → ${pairs || "—"}</div>
          <div>Heaviest: ${record.maxWeight}kg${extra}</div>
        `;
      }

      const meta = `${title(record.category || "n/a")} • ${title(record.equipment || "n/a")}${record.muscle ? ` • ${record.muscle}` : ""} • ${title(record.movementType || "bilateral")}`;

      const li = document.createElement("li");
      li.innerHTML = `
        <span>
          <strong>${selectedExercise}</strong> <small>(${meta})</small><br>
          Date: ${dateString}<br>
          ${details}
        </span>
        <div class="history-actions">
          <button class="edit-btn" onclick="editRecord('${selectedExercise}','${record.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteRecord('${selectedExercise}','${record.id}')">Delete</button>
        </div>
      `;
      historyLog.appendChild(li);
    });
  }
}

function deleteRecord(exerciseName, recordId) {
  if (!confirm("Are you sure you want to delete this record?")) return;
  const hist = userWorkoutData[exerciseName];
  if (!hist) return;
  hist.records = hist.records.filter(r => r.id !== recordId);
  if (hist.records.length === 0) {
    delete userWorkoutData[exerciseName];
  } else {
    const newMax = Math.max(...hist.records.map(r => r.maxWeight));
    hist.bestWeight = Number.isFinite(newMax) ? newMax : 0;
  }
  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();

  const sel = document.getElementById("history-select");
  if (sel && userWorkoutData[exerciseName]) {
    sel.value = exerciseName;
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

  // prime wizard
  wizard.location = HOME_EQUIPMENT.includes(rec.equipment) ? "home" : "gym";
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
  wizard.maxWeight = weights.length ? Math.max(...weights) : (rec.maxWeight || 0);
  wizard.maxWeightSetCount = weights.filter(w => w === wizard.maxWeight).length || (rec.maxWeightSetCount || 0);

  editingRecord = rec;

  // move to logger view/step 5
  showLoggerView();
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = wizard.location;

  const pastRadio = document.querySelector('input[name="timing"][value="past"]'); if (pastRadio) pastRadio.checked = true;
  const dt = document.getElementById("workout-datetime"); if (dt) { dt.removeAttribute("disabled"); dt.value = wizard.datetime; }

  const catSel = document.getElementById("work-on-select"); if (catSel) catSel.value = wizard.category;

  const muscleGroup = document.getElementById("muscle-select-group");
  const muscleSel = document.getElementById("muscle-select");
  if (String(wizard.category).toLowerCase() === "specific muscle") { if (muscleGroup) muscleGroup.style.display = "block"; if (muscleSel) muscleSel.value = wizard.muscle; }
  else { if (muscleGroup) muscleGroup.style.display = "none"; }

  populateEquipment();
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.value = wizard.equipment;
  populateExercises();
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.value = wizard.exercise;

  // Render rows with existing values
  renderSetRows();
  if (wizard.movementType === "unilateral") {
    const gridL = document.getElementById("sets-grid-left");
    const gridR = document.getElementById("sets-grid-right");
    if (gridL && gridR) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeightsL[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeightsR[i] ?? "");
    }
  } else {
    const grid = document.getElementById("sets-grid");
    if (grid) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeights[i] ?? "");
    }
  }

  currentWorkoutExercises = [{
    id: rec.id, date: wizard.datetime, name: wizard.exercise, category: wizard.category,
    equipment: wizard.equipment, muscle: wizard.muscle || null, movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(), setWeights: wizard.setWeights.slice(),
    setRepsL: wizard.setRepsL.slice(), setWeightsL: wizard.setWeightsL.slice(),
    setRepsR: wizard.setRepsR.slice(), setWeightsR: wizard.setWeightsR.slice(),
    maxWeight: wizard.maxWeight, maxWeightSetCount: wizard.maxWeightSetCount,
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();
  goToStep(5);

  const editMsg = document.getElementById("edit-mode-message"); if (editMsg) editMsg.style.display = "block";
}

/* ======================================================================
   Validation dispatcher
====================================================================== */
function validateAndStore(step) {
  if (step === 1) return validateAndStoreStep1();
  if (step === 2) return validateAndStoreStep2();
  if (step === 3) return validateAndStoreStep3();
  if (step === 4) return validateAndStoreStep4();
  if (step === 5) return validateAndStoreStep5();
  return true;
}

/* ======================================================================
   Debug helpers
====================================================================== */
window._wipeAllWorkoutData = function () {
  if (confirm("Delete ALL saved workout history? This cannot be undone.")) {
    userWorkoutData = {};
    localStorage.removeItem("userWorkoutData");
    currentWorkoutExercises = [];
    renderCurrentWorkoutList();
    populateHistoryDropdown();
    alert("All saved workout history cleared.");
  }
};

// expose for inline onclick handlers used in generated HTML
window.showHistoryView = showHistoryView;
window.showLoggerView = showLoggerView;
window.addExerciseToWorkout = addExerciseToWorkout;
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
