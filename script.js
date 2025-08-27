// ========================================================
// Workout Logger - script.js (FULL)
// Requires: Chart.js + exercises.js (loaded BEFORE this file)
// ========================================================
//
// Wizard flow:
//  1) Location (Gym/Home)
//  2) Timing (Now/Past) + datetime
//  3) What you're training (category + muscle if "specific muscle")
//  4) Equipment (auto-filtered by category + muscle + location)
//  5) Exercise + sets grid (unilateral support, per-set prev markers)
//  6) Review (this vs last vs best) + Save
//
// Data model:
//  - exercisesData (from exercises.js) with schema:
//      { name, categories:[], equipment:[], muscles:[] }
//  - userWorkoutData in localStorage keyed by exercise name:
//      userWorkoutData[exerciseName] = { bestWeight, records: [ { id,date,sets,reps,setWeights | left/right, movementType, maxWeight } ] }
//
// Notes:
//  - Case-insensitive matching for categories, muscles, equipment
//  - Accepts both "category" or "categories", "muscle" or "muscles", "equipment" as string or array
//  - Shows home-only equipment (body weight, resistance bands, kettlebell) when location = home
//  - Preserves step + scroll when switching between Logger/History
// ========================================================


// -------------------------
// Global state
// -------------------------
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let currentStep = 1;
let editingRecord = null;
let myChart = null;
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

// -------------------------
// Normalization helpers
// -------------------------
function norm(s){ return (s ?? "").toString().trim().toLowerCase(); }

function categoriesOf(e){
  if (Array.isArray(e?.categories)) return e.categories.map(norm).filter(Boolean);
  if (e?.category) return [norm(e.category)];
  return [];
}
function musclesOf(e){
  if (Array.isArray(e?.muscles)) return e.muscles.map(norm).filter(Boolean);
  if (e?.muscle) return [norm(e.muscle)];
  return [];
}
function equipmentsOf(e){
  if (Array.isArray(e?.equipment)) return e.equipment.map(norm).filter(Boolean);
  if (typeof e?.equipment === "string" && e.equipment.trim()) return [norm(e.equipment)];
  return [];
}
function capEach(s){ return s.split(" ").map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(" "); }

// -------------------------
// DOM helpers
// -------------------------
function on(sel, evt, fn) {
  const el = document.querySelector(sel);
  if (el) el.addEventListener(evt, fn);
}
function bindChange(sel, fn) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.removeEventListener("change", fn);
  el.addEventListener("change", fn);
}
function setOptions(selectSel, arr, mapFn) {
  const el = /** @type {HTMLSelectElement} */(document.querySelector(selectSel));
  if (!el) return;
  const html = (arr || []).map(v => {
    const { value, text } = mapFn ? mapFn(v) : { value: v, text: v };
    return `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`;
  }).join("");
  el.innerHTML = html;
}
function setVal(sel, v) {
  const el = /** @type {HTMLInputElement|HTMLSelectElement} */(document.querySelector(sel));
  if (el) el.value = v;
}
function val(sel) {
  const el = /** @type {HTMLInputElement|HTMLSelectElement} */(document.querySelector(sel));
  return el ? el.value : "";
}

// Numbers & formatting
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function clampInt(n, min, max){ return Math.max(min, Math.min(max, Number.isFinite(n)?n:min)); }
function isFiniteNum(x){ return typeof x === "number" && Number.isFinite(x); }
function stripZeros(n){
  if (!isFiniteNum(n)) return n;
  const s = String(n);
  return s.includes(".") ? s.replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1") : s;
}
function toInt(x){ const n = parseInt(x); return Number.isFinite(n) ? n : 0; }
function getAt(arr, i, fallback=null){ return Array.isArray(arr) ? (i>=0 && i<arr.length ? arr[i] : fallback) : fallback; }
function toLocal(iso){ try { return new Date(iso).toLocaleString(); } catch { return iso || "—"; } }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Debug helpers (optional)
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


// -------------------------
// Init
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  populateWorkoutTypeDropdown();
  populateWorkOnDropdown();
  populateMuscleDropdown();

  const dt = document.getElementById("workout-datetime");
  if (dt) dt.value = new Date().toISOString().slice(0, 16);

  goToStep(1);
  updateReviewButtonState();

  // Nav buttons
  on("#next-btn", "click", nextStep);
  on("#prev-btn", "click", prevStep);
  on("#add-exercise-btn", "click", addExerciseToWorkout);
  on("#edit-exercises-btn", "click", () => goToStep(5));
  on("#save-session-btn", "click", saveSession);

  // Header switchers
  on("#to-history", "click", showHistoryView);
  on("#to-logger", "click", showLoggerView);

  // Timing radios (step 2)
  document.querySelectorAll("input[name='timing']").forEach(radio => {
    radio.addEventListener("change", e => {
      const v = e.target.value;
      const dateInput = /** @type {HTMLInputElement} */(document.getElementById("workout-datetime"));
      if (!dateInput) return;
      if (v === "now") {
        dateInput.value = new Date().toISOString().slice(0, 16);
        dateInput.disabled = true;
      } else {
        dateInput.disabled = false;
      }
    });
  });

  // Category change => toggle muscle picker + clear downstream
  on("#work-on-select", "change", () => {
    const cat = norm(val("#work-on-select"));
    const g = document.getElementById("muscle-select-group");
    if (g) g.style.display = (cat === "specific muscle") ? "block" : "none";
    setOptions("#equipment-select", ["--Select--"]);
    setOptions("#exercise-select", ["--Select--"]);
  });
  // Muscle change => clear downstream
  on("#muscle-select", "change", () => {
    setOptions("#equipment-select", ["--Select--"]);
    setOptions("#exercise-select", ["--Select--"]);
  });
});


// ========================================================
// Wizard nav
// ========================================================
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, i) => {
    el.style.display = (i === step - 1) ? "block" : "none";
  });

  if (step === 4) populateEquipment();
  else if (step === 5) populateExercises();
  else if (step === 6) buildSessionSummary();

  updateReviewButtonState();
}

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
  saveSession();
}

function prevStep() {
  if (currentStep > 1) goToStep(currentStep - 1);
}

function updateReviewButtonState() {
  const next = /** @type {HTMLButtonElement} */(document.getElementById("next-btn"));
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


// ========================================================
// Dropdowns & filtering
// ========================================================
function populateWorkoutTypeDropdown() {
  setOptions("#workout-type-select", ["--Select Location--", "gym", "home"], v => {
    if (v === "--Select Location--") return { value: "", text: v };
    return { value: v, text: capitalize(v) };
  });
}

function populateWorkOnDropdown() {
  const data = Array.isArray(window.exercisesData) ? window.exercisesData : [];
  const found = new Set();
  for (const e of data) categoriesOf(e).forEach(c => found.add(c));

  let categories = Array.from(found).sort((a,b)=>a.localeCompare(b));
  if (categories.length === 0) {
    categories = ["upper body","lower body","full body","push","pull","legs","hinge","squat","specific muscle"];
    console.warn("[populateWorkOnDropdown] No categories in exercisesData. Using fallback.");
  }

  setOptions("#work-on-select", ["--Select--", ...categories], v => {
    if (v === "--Select--") return { value: "", text: v };
    return { value: v, text: capEach(v) };
  });
}

function populateMuscleDropdown() {
  const muscles = [
    "Abs","Biceps","Calves","Chest","Forearms","Front Delts","Glute Max","Glute Med",
    "Hamstrings","Lats","Lower Back","Mid Delts","Quads","Rear Delts","Traps","Triceps","Upper Back"
  ].sort((a,b)=>a.localeCompare(b));

  setOptions("#muscle-select", ["--Select--", ...muscles], v => {
    if (v === "--Select--") return { value: "", text: v };
    return { value: v, text: v };
  });
}

function populateEquipment() {
  const all       = Array.isArray(window.exercisesData) ? window.exercisesData : [];
  const category  = norm(val("#work-on-select"));
  const location  = norm(val("#workout-type-select"));
  const muscle    = norm(val("#muscle-select"));

  if (!category) { setOptions("#equipment-select", ["--Select--"]); return; }

  // category (and optional muscle)
  let filtered = all.filter(e => categoriesOf(e).includes(category));
  if (category === "specific muscle" && muscle) {
    filtered = filtered.filter(e => musclesOf(e).includes(muscle));
  }

  // Home-only equipment
  if (location === "home") {
    const HOME = new Set(["body weight","resistance bands","kettlebell"]);
    filtered = filtered.filter(e => equipmentsOf(e).some(eq => HOME.has(eq)));
  }

  const equipments = [...new Set(filtered.flatMap(equipmentsOf))].sort((a,b)=>a.localeCompare(b));

  // Diagnostics
  if (equipments.length === 0) {
    console.warn("[populateEquipment] No equipment found", { category, muscle: muscle || "(n/a)", location });
  }

  setOptions("#equipment-select", ["--Select--", ...equipments], v => {
    if (v === "--Select--") return { value: "", text: v };
    return { value: v, text: capEach(v) };
  });

  setOptions("#exercise-select", ["--Select--"]);
}

function populateExercises() {
  const all        = Array.isArray(window.exercisesData) ? window.exercisesData : [];
  const category   = norm(val("#work-on-select"));
  const equipment  = norm(val("#equipment-select"));
  const muscle     = norm(val("#muscle-select"));

  if (!category || !equipment) { setOptions("#exercise-select", ["--Select--"]); return; }

  let pool = all.filter(e => categoriesOf(e).includes(category));
  if (category === "specific muscle" && muscle) {
    pool = pool.filter(e => musclesOf(e).includes(muscle));
  }
  pool = pool.filter(e => equipmentsOf(e).includes(equipment));

  const names = [...new Set(pool.map(e => e.name))].sort((a,b)=>a.localeCompare(b));
  setOptions("#exercise-select", ["--Select--", ...names], v => {
    if (v === "--Select--") return { value: "", text: v };
    return { value: v, text: v };
  });

  // Ensure unilateral toggle exists
  if (!document.getElementById("unilateral-toggle")) {
    const select = document.getElementById("exercise-select");
    if (select?.parentElement) {
      const div = document.createElement("div");
      div.className = "form-group";
      div.innerHTML = `<label><input type="checkbox" id="unilateral-toggle"> Unilateral exercise</label>`;
      select.parentElement.appendChild(div);
    }
  }

  bindChange("#sets-input", renderSetWeightInputs);
  bindChange("#exercise-select", renderSetWeightInputs);
  bindChange("#unilateral-toggle", renderSetWeightInputs);

  renderSetWeightInputs();
}


// ========================================================
// Sets grid + per-set "Prev" markers
// ========================================================
function renderSetWeightInputs() {
  const sets = clampInt(parseInt(val("#sets-input")), 1, 99);
  const unilateral = !!document.getElementById("unilateral-toggle")?.checked;
  const container = ensureSetsContainer();
  container.innerHTML = "";

  const exName = val("#exercise-select");
  if (!exName || !sets) return;

  const hist = userWorkoutData[exName];
  const last = hist ? hist.records.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0] : null;

  if (!unilateral) {
    const grid = createSetsGrid();
    for (let i = 0; i < sets; i++) {
      const prevW = getAt(last?.setWeights, i);
      const prevR = toInt(last?.reps);
      const prevLabel = (isFiniteNum(prevW) && isFiniteNum(prevR))
        ? `${stripZeros(prevW)}kg × ${stripZeros(prevR)}`
        : (isFiniteNum(prevW) ? `${stripZeros(prevW)}kg` : "—");

      grid.appendChild(buildSetRow({
        repsPlaceholder: `Set ${i+1}: Reps`,
        prevText: prevLabel,
        weightPlaceholder: `Set ${i+1}: Weight (kg)`,
        attrs: { "data-kind-reps": "bilateral", "data-kind-weight": "bilateral", "data-idx": String(i) }
      }));
    }
    container.appendChild(grid);
  } else {
    // Left
    const leftBlock = document.createElement("div");
    leftBlock.className = "form-group";
    leftBlock.innerHTML = `<label>Left Side — Reps & Weight</label>`;
    const leftGrid = createSetsGrid();
    for (let i = 0; i < sets; i++) {
      const prevSide = getAt(last?.leftSetWeights, i, getAt(last?.setWeights, i, null));
      const prevR = toInt(last?.reps);
      const prevLabel = (isFiniteNum(prevSide) && isFiniteNum(prevR))
        ? `${stripZeros(prevSide)}kg × ${stripZeros(prevR)}`
        : (isFiniteNum(prevSide) ? `${stripZeros(prevSide)}kg` : "—");

      leftGrid.appendChild(buildSetRow({
        repsPlaceholder: `Left Set ${i+1}: Reps`,
        prevText: prevLabel,
        weightPlaceholder: `Left Set ${i+1}: Weight (kg)`,
        attrs: { "data-side": "L", "data-kind-reps": "unilateral", "data-kind-weight": "unilateral", "data-idx": String(i) }
      }));
    }
    leftBlock.appendChild(leftGrid);
    container.appendChild(leftBlock);

    // Right
    const rightBlock = document.createElement("div");
    rightBlock.className = "form-group";
    rightBlock.innerHTML = `<label>Right Side — Reps & Weight</label>`;
    const rightGrid = createSetsGrid();
    for (let i = 0; i < sets; i++) {
      const prevSide = getAt(last?.rightSetWeights, i, getAt(last?.setWeights, i, null));
      const prevR = toInt(last?.reps);
      const prevLabel = (isFiniteNum(prevSide) && isFiniteNum(prevR))
        ? `${stripZeros(prevSide)}kg × ${stripZeros(prevR)}`
        : (isFiniteNum(prevSide) ? `${stripZeros(prevSide)}kg` : "—");

      rightGrid.appendChild(buildSetRow({
        repsPlaceholder: `Right Set ${i+1}: Reps`,
        prevText: prevLabel,
        weightPlaceholder: `Right Set ${i+1}: Weight (kg)`,
        attrs: { "data-side": "R", "data-kind-reps": "unilateral", "data-kind-weight": "unilateral", "data-idx": String(i) }
      }));
    }
    rightBlock.appendChild(rightGrid);
    container.appendChild(rightBlock);
  }
}

function ensureSetsContainer() {
  let el = document.getElementById("sets-grids-wrapper");
  if (!el) {
    el = document.createElement("div");
    el.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    if (anchor) anchor.appendChild(el);
  }
  return el;
}
function createSetsGrid() {
  const grid = document.createElement("div");
  grid.className = "sets-grid";
  return grid;
}
function buildSetRow({ repsPlaceholder, prevText, weightPlaceholder, attrs = {} }) {
  const row = document.createElement("div");
  row.className = "set-row";

  const reps = document.createElement("input");
  reps.type = "number"; reps.min = "1"; reps.step = "1";
  reps.placeholder = repsPlaceholder;
  reps.className = "rep-input";

  const prev = document.createElement("span");
  prev.className = "prev-weight";
  prev.textContent = `Prev: ${prevText}`;

  const weight = document.createElement("input");
  weight.type = "number"; weight.min = "0"; weight.step = "0.5";
  weight.placeholder = weightPlaceholder;
  weight.className = "set-weight-input";

  for (const [k,v] of Object.entries(attrs)) {
    reps.setAttribute(k, v);
    weight.setAttribute(k, v);
  }

  row.appendChild(reps);
  row.appendChild(prev);
  row.appendChild(weight);
  return row;
}


// ========================================================
// Add/remove exercises (Step 5)
// ========================================================
function addExerciseToWorkout() {
  const exerciseName = val("#exercise-select");
  const sets = clampInt(parseInt(val("#sets-input")), 1, 99);
  const unilateral = !!document.getElementById("unilateral-toggle")?.checked;

  const repInputs = Array.from(document.querySelectorAll(".rep-input"));
  const weightInputs = Array.from(document.querySelectorAll(".set-weight-input"));

  if (!exerciseName) return alert("Please select an exercise.");
  if (!sets) return alert("Please enter number of sets.");
  if (repInputs.length === 0 || weightInputs.length === 0) return alert("Please render set inputs first.");

  const missingReps = repInputs.some(r => !r.value || parseInt(r.value) <= 0);
  const allWeightsEmpty = weightInputs.every(w => !w.value || parseFloat(w.value) < 0);
  if (missingReps || allWeightsEmpty) return alert("Please complete reps and weights.");

  const ex = {
    id: String(Date.now()),
    name: exerciseName,
    sets: sets,
    reps: clampInt(parseInt(repInputs[0].value), 1, 999),
    movementType: unilateral ? "unilateral" : "bilateral",
    maxWeight: 0
  };

  if (!unilateral) {
    const weights = weightInputs.map(w => +w.value || 0);
    ex.setWeights = weights;
    ex.maxWeight = weights.length ? Math.max(...weights) : 0;
  } else {
    const lefts = weightInputs.filter(w => w.getAttribute("data-side") === "L").map(w => +w.value || 0);
    const rights = weightInputs.filter(w => w.getAttribute("data-side") === "R").map(w => +w.value || 0);
    ex.leftSetWeights = lefts;
    ex.rightSetWeights = rights;
    ex.maxWeight = Math.max(...lefts, ...rights);
  }

  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();
  updateReviewButtonState();

  // convenience clear
  setVal("#exercise-select", "");
  setVal("#sets-input", "3");
  const uni = document.getElementById("unilateral-toggle");
  if (uni) uni.checked = false;
  ensureSetsContainer().innerHTML = "";
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

  currentWorkoutExercises.forEach((ex, i) => {
    const item = document.createElement("div");
    item.className = "workout-item";

    let body = "";
    if (ex.movementType === "unilateral") {
      const L = ex.leftSetWeights || [];
      const R = ex.rightSetWeights || [];
      const repsVal = ex.reps || 0;

      const pairsL = L.map(w => `${repsVal}x${stripZeros(w)}kg`).join(", ");
      const pairsR = R.map(w => `${repsVal}x${stripZeros(w)}kg`).join(", ");

      const maxL = L.length ? Math.max(...L) : 0;
      const maxR = R.length ? Math.max(...R) : 0;
      const cL = L.filter(x => x === maxL).length;
      const cR = R.filter(x => x === maxR).length;

      body = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} set(s) • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)} set(s)</div>
      `;
    } else {
      const W = ex.setWeights || [];
      const repsVal = ex.reps || 0;

      const pairs = W.map(w => `${repsVal}x${stripZeros(w)}kg`).join(", ");
      const c = W.filter(x => x === ex.maxWeight).length;

      body = `
        <div>${stripZeros(ex.sets)} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${stripZeros(ex.maxWeight)}kg × ${stripZeros(c)} set(s)</div>
      `;
    }

    item.innerHTML = `
      <strong>${ex.name}</strong><br>
      ${body}
      <button style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;" onclick="removeExerciseFromWorkout(${i})">Remove</button>
    `;
    list.appendChild(item);
  });
}

function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}


// ========================================================
// Review (Step 6)
// ========================================================
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  const timing = (document.querySelector("input[name='timing']:checked")?.value === "now") ? "Training now" : "Recorded session";
  const dt = val("#workout-datetime");

  if (meta) meta.innerHTML = `
    <div class="summary-row"><strong>When</strong><span>${timing}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${toLocal(dt)}</span></div>
  `;

  if (exWrap) exWrap.innerHTML = "";

  (currentWorkoutExercises || []).forEach(ex => {
    const { lastInfo, bestInfo, trendBadge } = buildComparisons(ex.name, ex.maxWeight);

    let details = "";
    if (ex.movementType === "unilateral") {
      const L = ex.leftSetWeights || [], R = ex.rightSetWeights || [];
      const repsVal = ex.reps || 0;

      const pairsL = L.map(w=>`${repsVal}x${stripZeros(w)}kg`).join(", ");
      const pairsR = R.map(w=>`${repsVal}x${stripZeros(w)}kg`).join(", ");
      const maxL = L.length ? Math.max(...L) : 0;
      const maxR = R.length ? Math.max(...R) : 0;
      const cL = L.filter(x=>x===maxL).length;
      const cR = R.filter(x=>x===maxR).length;

      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest (overall): <strong>${stripZeros(ex.maxWeight)}kg</strong> ${trendBadge}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} set(s) • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)} set(s)</div>
        <div>vs Last ${lastInfo.date ? `(${lastInfo.date})` : ""}: <strong>${lastInfo.deltaText}</strong></div>
        <div>vs Best ${bestInfo.date ? `(${bestInfo.date})` : ""}: <strong>${bestInfo.deltaText}</strong></div>
      `;
    } else {
      const W = ex.setWeights || [];
      const repsVal = ex.reps || 0;
      const pairs = W.map(w=>`${repsVal}x${stripZeros(w)}kg`).join(", ");

      details = `
        <div>${stripZeros(ex.sets)} sets → ${pairs || "—"}</div>
        <div>Heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong> ${trendBadge}</div>
        <div>vs Last ${lastInfo.date ? `(${lastInfo.date})` : ""}: <strong>${lastInfo.deltaText}</strong></div>
        <div>vs Best ${bestInfo.date ? `(${bestInfo.date})` : ""}: <strong>${bestInfo.deltaText}</strong></div>
      `;
    }

    const card = document.createElement("div");
    card.className = "summary-exercise";
    card.innerHTML = `<strong>${ex.name}</strong><br>${details}`;
    if (exWrap) exWrap.appendChild(card);
  });

  // Totals
  let totalVolume = 0, totalSets = 0;
  currentWorkoutExercises.forEach(ex => {
    const repsVal = ex.reps || 0;
    if (ex.movementType === "unilateral") {
      totalSets += (ex.sets || 0) * 2;
      (ex.leftSetWeights || []).forEach(w => totalVolume += repsVal * (w || 0));
      (ex.rightSetWeights || []).forEach(w => totalVolume += repsVal * (w || 0));
    } else {
      totalSets += (ex.sets || 0);
      (ex.setWeights || []).forEach(w => totalVolume += repsVal * (w || 0));
    }
  });

  if (totals) {
    totals.innerHTML = `
      <div><strong>Total Exercises:</strong> ${currentWorkoutExercises.length}</div>
      <div><strong>Total Sets:</strong> ${totalSets}</div>
      <div><strong>Estimated Volume:</strong> ${isFiniteNum(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
    `;
  }
}

function buildComparisons(exName, currentMax) {
  const hist = userWorkoutData[exName];
  const recsDesc = hist ? hist.records.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)) : [];

  const last = recsDesc[0];
  const lastMax = isFiniteNum(last?.maxWeight) ? last.maxWeight : null;
  const lastDate = last ? new Date(last.date).toLocaleDateString() : null;
  const lastDelta = (lastMax == null) ? null : +((currentMax || 0) - lastMax).toFixed(2);
  const lastDeltaText = (lastMax == null) ? "—" :
    (lastDelta > 0 ? `▲ +${stripZeros(lastDelta)}kg` :
     lastDelta < 0 ? `▼ ${stripZeros(Math.abs(lastDelta))}kg` :
     `= 0kg`);

  const bestW = hist ? hist.bestWeight : null;
  let bestDate = null;
  if (isFiniteNum(bestW)) {
    const recsAsc = recsDesc.slice().reverse();
    const hit = recsAsc.find(r => r.maxWeight === bestW);
    bestDate = hit ? new Date(hit.date).toLocaleDateString() : null;
  }
  const bestDelta = (bestW == null) ? null : +((currentMax || 0) - bestW).toFixed(2);
  const bestDeltaText = (bestW == null) ? "—" :
    (bestDelta > 0 ? `▲ +${stripZeros(bestDelta)}kg` :
     bestDelta < 0 ? `▼ ${stripZeros(Math.abs(bestDelta))}kg` :
     `= 0kg`);

  let trendBadge = `<span style="color:#9aa0a6;">— no history</span>`;
  if (lastMax != null) {
    if (lastDelta > 0) trendBadge = ` <span style="color:#4caf50;">▲ +${stripZeros(lastDelta)}kg</span>`;
    else if (lastDelta < 0) trendBadge = ` <span style="color:#ff5252;">▼ ${stripZeros(Math.abs(lastDelta))}kg</span>`;
    else trendBadge = ` <span style="color:#ffb300;">= 0kg</span>`;
  }

  return {
    lastInfo: { deltaText: lastDeltaText, date: lastDate },
    bestInfo: { deltaText: bestDeltaText, date: bestDate },
    trendBadge
  };
}


// ========================================================
// Save session
// ========================================================
function saveSession() {
  const workoutDateTime = val("#workout-datetime");
  if (!workoutDateTime || currentWorkoutExercises.length === 0) {
    alert("Please complete your session (date & at least one exercise).");
    return;
  }

  currentWorkoutExercises.forEach(ex => {
    const record = {
      id: ex.id,
      date: workoutDateTime,
      sets: ex.sets,
      reps: ex.reps,
      setWeights: ex.setWeights,
      leftSetWeights: ex.leftSetWeights,
      rightSetWeights: ex.rightSetWeights,
      movementType: ex.movementType,
      maxWeight: ex.maxWeight
    };

    if (!userWorkoutData[ex.name]) {
      userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    }
    userWorkoutData[ex.name].records.push(record);

    if (isFiniteNum(record.maxWeight) && record.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = record.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved!");

  currentWorkoutExercises = [];
  renderCurrentWorkoutList();
  const dt = document.getElementById("workout-datetime");
  if (dt) dt.value = new Date().toISOString().slice(0, 16);
  goToStep(1);
  updateReviewButtonState();
}


// ========================================================
// History view + chart + edit/delete
// ========================================================
function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  switchPage("#workout-history");
  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}

function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  switchPage("#workout-logger");
  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
}

function switchPage(sel) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.querySelector(sel);
  if (page) page.classList.add("active");
}

function populateHistoryDropdown() {
  const sel = /** @type {HTMLSelectElement} */(document.getElementById("history-select"));
  if (!sel) return;

  const keys = Object.keys(userWorkoutData).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = `<option value="">--Select an Exercise--</option>` +
    keys.map(k => `<option value="${k}">${k}</option>`).join("");

  const details = document.getElementById("history-details");
  if (details) details.style.display = "none";

  sel.onchange = displayExerciseHistory;
}

function displayExerciseHistory() {
  const exName = val("#history-select");
  const details = document.getElementById("history-details");
  const bestTitle = document.getElementById("best-weight-title");
  const log = document.getElementById("history-log");

  if (!exName || !userWorkoutData[exName]?.records?.length) {
    if (details) details.style.display = "none";
    return;
  }

  const hist = userWorkoutData[exName];
  if (details) details.style.display = "block";
  if (bestTitle) bestTitle.textContent = `Best Weight: ${stripZeros(hist.bestWeight)}kg`;

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
      let detailsHtml = "";
      if (rec.movementType === "unilateral" && (rec.leftSetWeights || rec.rightSetWeights)) {
        const L = rec.leftSetWeights || [];
        const R = rec.rightSetWeights || [];
        const pairsL = L.map(w => `${rec.reps || 0}x${stripZeros(w)}kg`).join(", ");
        const pairsR = R.map(w => `${rec.reps || 0}x${stripZeros(w)}kg`).join(", ");
        const maxL = L.length ? Math.max(...L) : 0;
        const maxR = R.length ? Math.max(...R) : 0;
        const cL = L.filter(x=>x===maxL).length;
        const cR = R.filter(x=>x===maxR).length;

        detailsHtml = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)}</div>
        `;
      } else {
        const W = rec.setWeights || [];
        const pairs = W.map(w => `${rec.reps || 0}x${stripZeros(w)}kg`).join(", ");
        const c = W.filter(x=>x===rec.maxWeight).length;
        detailsHtml = `
          <div>Sets: ${stripZeros(rec.sets)} → ${pairs || "—"}</div>
          <div>Heaviest: ${stripZeros(rec.maxWeight)}kg${c ? ` × ${stripZeros(c)} set(s)` : ""}</div>
        `;
      }

      const li = document.createElement("li");
      li.innerHTML = `
        <span>
          <strong>${exName}</strong><br>
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
  if (!confirm("Delete this record?")) return;

  const hist = userWorkoutData[exName];
  if (!hist) return;

  hist.records = hist.records.filter(r => r.id !== recordId);

  if (hist.records.length === 0) {
    delete userWorkoutData[exName];
  } else {
    const newMax = Math.max(...hist.records.map(r => r.maxWeight));
    hist.bestWeight = isFiniteNum(newMax) ? newMax : 0;
  }

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();

  const sel = /** @type {HTMLSelectElement} */(document.getElementById("history-select"));
  if (userWorkoutData[exName]) {
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

  showLoggerView();

  editingRecord = rec;
  const msg = document.getElementById("edit-mode-message");
  if (msg) msg.style.display = "block";

  const dt = /** @type {HTMLInputElement} */(document.getElementById("workout-datetime"));
  if (dt) { dt.disabled = false; dt.value = rec.date; }

  // Jump to step 5 to modify sets quickly
  goToStep(5);

  // Unilateral toggle + sets
  const uni = /** @type {HTMLInputElement} */(document.getElementById("unilateral-toggle"));
  if (uni) uni.checked = (rec.movementType === "unilateral");

  setVal("#sets-input", rec.sets || 3);
  renderSetWeightInputs();

  // Reps
  document.querySelectorAll(".rep-input").forEach(r => r.value = rec.reps || 10);

  // Weights
  const weightInputs = Array.from(document.querySelectorAll(".set-weight-input"));
  if (rec.movementType !== "unilateral") {
    let i = 0; (rec.setWeights || []).forEach(w => { if (weightInputs[i]) weightInputs[i++].value = w; });
  } else {
    let iL = 0, iR = 0;
    const L = rec.leftSetWeights || [], R = rec.rightSetWeights || [];
    weightInputs.forEach(w => {
      if (w.getAttribute("data-side") === "L") { if (iL < L.length) w.value = L[iL++]; }
      if (w.getAttribute("data-side") === "R") { if (iR < R.length) w.value = R[iR++]; }
    });
  }

  currentWorkoutExercises = [{
    id: rec.id,
    name: exName,
    sets: rec.sets,
    reps: rec.reps,
    movementType: rec.movementType,
    setWeights: rec.setWeights || [],
    leftSetWeights: rec.leftSetWeights || [],
    rightSetWeights: rec.rightSetWeights || [],
    maxWeight: rec.maxWeight || 0
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();
}


// ========================================================
// Validation
// ========================================================
function validateAndStore(step) {
  switch (step) {
    case 1:
      if (!val("#workout-type-select")) { alert("Please select where you are training."); return false; }
      return true;
    case 2: {
      const timing = document.querySelector("input[name='timing']:checked");
      if (!timing) { alert("Please select timing (now / past)."); return false; }
      if (timing.value === "past" && !val("#workout-datetime")) { alert("Please provide a date/time."); return false; }
      return true;
    }
    case 3: {
      const cat = val("#work-on-select");
      if (!cat) { alert("Please select what you are training."); return false; }
      if (norm(cat) === "specific muscle" && !val("#muscle-select")) {
        alert("Please choose a specific muscle."); return false;
      }
      return true;
    }
    case 4:
      if (!val("#equipment-select")) { alert("Please select equipment."); return false; }
      return true;
    default:
      return true;
  }
}
