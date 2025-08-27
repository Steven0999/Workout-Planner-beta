// ========================================================
// Workout Logger - script.js
// Full logic file (with exercises stored separately in exercises.js)
// ========================================================
//
// Features included:
// - Step-by-step wizard (location → timing → category → equipment → exercise → review)
// - Unilateral/bilateral input support
// - Previous markers for each set (last weight × reps)
// - Review summary (this vs last vs best with date)
// - Save/load workout sessions with localStorage
// - History view with Chart.js graph + edit/delete
// - Preserve scroll position + wizard step when switching pages
// - Validation helpers + reset
//
// ========================================================


// ========================================================
// --- Global State Variables ---
// ========================================================

// Loaded workout data (per exercise) from localStorage
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};

// Exercises in the current (unsaved) session
let currentWorkoutExercises = [];

// Track current step of the wizard (1–6)
let currentStep = 1;

// Track if we’re editing an existing record
let editingRecord = null;

// Hold reference to Chart.js instance
let myChart;

// Preserve wizard step + scroll positions when switching between Logger and History
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };


// ========================================================
// --- Init on page load ---
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
  // Populate dropdowns
  populateWorkoutTypeDropdown();
  populateWorkOnDropdown();
  populateMuscleDropdown();

  // Start at step 1
  goToStep(1);

  // Keep review button state synced
  updateReviewButtonState();

  // Default workout date/time = now
  document.getElementById("workout-datetime").value = new Date().toISOString().slice(0, 16);

  // Hook up nav events
  document.getElementById("next-btn").addEventListener("click", nextStep);
  document.getElementById("prev-btn").addEventListener("click", prevStep);
  document.getElementById("add-exercise-btn").addEventListener("click", addExerciseToWorkout);
  document.getElementById("edit-exercises-btn").addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn").addEventListener("click", saveSession);

  // Switch between Logger and History
  document.getElementById("to-history").addEventListener("click", showHistoryView);
  document.getElementById("to-logger").addEventListener("click", showLoggerView);

  // Step 2: handle “training now / past session” radio toggle
  document.querySelectorAll("input[name='timing']").forEach(radio => {
    radio.addEventListener("change", e => {
      const dateInput = document.getElementById("workout-datetime");
      if (e.target.value === "now") {
        // Auto-fill with current timestamp, lock the field
        dateInput.value = new Date().toISOString().slice(0, 16);
        dateInput.disabled = true;
      } else {
        // Allow user to pick any datetime
        dateInput.disabled = false;
      }
    });
  });
});


// ========================================================
// --- Navigation (Wizard) ---
// ========================================================

function goToStep(step) {
  currentStep = step;

  // Show the current step, hide others
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });

  // Auto-populate things when entering certain steps
  if (step === 4) populateEquipment();
  else if (step === 5) populateExercises();
  else if (step === 6) buildSessionSummary();

  updateReviewButtonState();
}

function nextStep() {
  // Normal flow: step → step
  if (currentStep < 5) {
    if (!validateAndStore(currentStep)) return; // Stop if validation fails
    goToStep(currentStep + 1);
    return;
  }

  // Step 5 → Step 6 (Review)
  if (currentStep === 5) {
    if (currentWorkoutExercises.length === 0) {
      const s5Hint = document.getElementById("s5-hint");
      if (s5Hint) s5Hint.textContent = "Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6);
    return;
  }

  // Step 6 → Save session
  saveSession();
}

function prevStep() {
  if (currentStep > 1) goToStep(currentStep - 1);
}

// Update the “Next” button’s text and enabled/disabled state
function updateReviewButtonState() {
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
}
// ========================================================
// --- Dropdown population & filtering ---
// ========================================================

/** Location (Gym/Home) */
function populateWorkoutTypeDropdown() {
  const typeSelect = document.getElementById("workout-type-select");
  typeSelect.innerHTML = `
    <option value="">--Select Location--</option>
    <option value="gym">Gym</option>
    <option value="home">Home</option>
  `;
}

/** Training focus categories (from exercises.js) */
function populateWorkOnDropdown() {
  const workOnSelect = document.getElementById("work-on-select");
  // exercisesData is provided by exercises.js (kept separate)
  const categories = [...new Set(
    (window.exercisesData || []).flatMap(e => Array.isArray(e.categories) ? e.categories : [])
  )].sort((a,b)=>a.localeCompare(b));

  workOnSelect.innerHTML =
    `<option value="">--Select--</option>` +
    categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

/** Specific muscle options */
function populateMuscleDropdown() {
  const muscleSelect = document.getElementById("muscle-select");
  const muscles = [
    "Abs","Biceps","Calves","Chest","Forearms","Front Delts","Glute Max","Glute Med",
    "Hamstrings","Lats","Lower Back","Mid Delts","Quads","Rear Delts","Traps","Triceps","Upper Back"
  ].sort((a,b)=>a.localeCompare(b));

  muscleSelect.innerHTML = `<option value="">--Select--</option>` +
    muscles.map(m => `<option value="${m}">${m}</option>`).join('');
}

/** When entering Step 4, populate the equipment list (filtered by location + category [+ muscle]) */
function populateEquipment() {
  const selectedCategory = document.getElementById("work-on-select").value;
  const selectedType = document.getElementById("workout-type-select").value;
  const selectedMuscle = document.getElementById("muscle-select").value;
  const equipmentSelect = document.getElementById("equipment-select");

  if (!selectedCategory) {
    equipmentSelect.innerHTML = `<option value="">--Select--</option>`;
    return;
  }

  // Filter all exercises by category (and muscle if category is 'specific muscle')
  let filtered = (window.exercisesData || []).filter(e =>
    Array.isArray(e.categories) && e.categories.includes(selectedCategory)
  );

  if (selectedCategory.toLowerCase() === "specific muscle" && selectedMuscle) {
    filtered = filtered.filter(e => (e.muscles || []).includes(selectedMuscle));
  }

  // If training at home, limit to home-friendly equipment
  if (selectedType === "home") {
    const HOME_EQUIPMENT = new Set(["body weight","resistance bands","kettlebell"]);
    filtered = filtered.filter(e => HOME_EQUIPMENT.has(e.equipment));
  }

  const eqs = [...new Set(filtered.map(e => e.equipment))].sort((a,b)=>a.localeCompare(b));
  equipmentSelect.innerHTML = `<option value="">--Select--</option>` +
    eqs.map(eq => `<option value="${eq}">${capitalize(eq)}</option>`).join('');
}

/** Populate exercises for the selected category + equipment (+ muscle) */
function populateExercises() {
  const category = document.getElementById("work-on-select").value;
  const equipment = document.getElementById("equipment-select").value;
  const muscle = document.getElementById("muscle-select").value;
  const exerciseSelect = document.getElementById("exercise-select");

  let pool = (window.exercisesData || []).filter(e =>
    Array.isArray(e.categories) && e.categories.includes(category)
  );
  if (category.toLowerCase() === "specific muscle" && muscle) {
    pool = pool.filter(e => (e.muscles || []).includes(muscle));
  }
  if (equipment) pool = pool.filter(e => e.equipment === equipment);

  const names = [...new Set(pool.map(e => e.name))].sort((a,b)=>a.localeCompare(b));
  exerciseSelect.innerHTML = `<option value="">--Select--</option>` +
    names.map(n => `<option value="${n}">${n}</option>`).join('');

  // Create unilateral toggle (only once)
  if (!document.getElementById("unilateral-toggle")) {
    const container = exerciseSelect.parentElement;
    const div = document.createElement("div");
    div.className = "form-group";
    div.innerHTML = `
      <label><input type="checkbox" id="unilateral-toggle"> Unilateral exercise</label>
    `;
    container.appendChild(div);
  }

  // Set input events (rebind safely)
  const setsEl = document.getElementById("sets-input");
  setsEl.removeEventListener("change", renderSetWeightInputs);
  setsEl.addEventListener("change", renderSetWeightInputs);

  exerciseSelect.removeEventListener("change", renderSetWeightInputs);
  exerciseSelect.addEventListener("change", renderSetWeightInputs);

  const uniEl = document.getElementById("unilateral-toggle");
  uniEl.removeEventListener("change", renderSetWeightInputs);
  uniEl.addEventListener("change", renderSetWeightInputs);

  // Render grid for current selection
  renderSetWeightInputs();
}

// ========================================================
// --- Set inputs + per-set previous markers ---
// ========================================================

/**
 * Build the sets grid:
 * - Bilateral: 1 grid; each row = [reps] [Prev: lastWeight × reps] [weight]
 * - Unilateral: 2 grids (“Left side”, “Right side”) with the same structure
 * We read the last record for the selected exercise to populate the Prev label.
 */
function renderSetWeightInputs() {
  const numSets = clampInt(parseInt(document.getElementById("sets-input").value), 1, 99);
  const unilateral = !!document.getElementById("unilateral-toggle")?.checked;
  const container = ensureSetsContainer();
  container.innerHTML = ""; // clear

  const exerciseName = document.getElementById("exercise-select").value;
  const history = userWorkoutData[exerciseName];
  const lastRecord = history ? history.records.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0] : null;

  // Nothing to render if no sets selected or no exercise chosen yet
  if (!numSets || !exerciseName) return;

  if (!unilateral) {
    // --- Bilateral grid ---
    const grid = createSetsGrid();
    for (let i = 0; i < numSets; i++) {
      const prevWeight = lastRecord?.setWeights?.[i] ?? null;
      const prevReps = lastRecord?.reps ?? null; // last record stored single reps for all sets in earlier versions
      const prevLabel = (isFiniteNum(prevWeight) && isFiniteNum(prevReps))
        ? `${stripZeros(prevWeight)}kg × ${stripZeros(prevReps)}`
        : (isFiniteNum(prevWeight) ? `${stripZeros(prevWeight)}kg` : "—");

      grid.appendChild(buildSetRow({
        repsPlaceholder: `Set ${i+1}: Reps`,
        prevText: prevLabel,
        weightPlaceholder: `Set ${i+1}: Weight (kg)`,
        attrs: { "data-kind-reps": "bilateral", "data-kind-weight": "bilateral", "data-idx": String(i) }
      }));
    }
    container.appendChild(grid);
  } else {
    // --- Unilateral grids: Left & Right ---
    const leftBlock = document.createElement("div");
    leftBlock.className = "form-group";
    leftBlock.innerHTML = `<label>Left Side — Reps & Weight</label>`;
    const leftGrid = createSetsGrid();
    for (let i = 0; i < numSets; i++) {
      const prevSide = lastRecord?.leftSetWeights?.[i] ?? lastRecord?.setWeights?.[i] ?? null; // fallback if last was bilateral
      const prevReps = lastRecord?.reps ?? null;
      const prevLabel = (isFiniteNum(prevSide) && isFiniteNum(prevReps))
        ? `${stripZeros(prevSide)}kg × ${stripZeros(prevReps)}`
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

    const rightBlock = document.createElement("div");
    rightBlock.className = "form-group";
    rightBlock.innerHTML = `<label>Right Side — Reps & Weight</label>`;
    const rightGrid = createSetsGrid();
    for (let i = 0; i < numSets; i++) {
      const prevSide = lastRecord?.rightSetWeights?.[i] ?? lastRecord?.setWeights?.[i] ?? null; // fallback if last was bilateral
      const prevReps = lastRecord?.reps ?? null;
      const prevLabel = (isFiniteNum(prevSide) && isFiniteNum(prevReps))
        ? `${stripZeros(prevSide)}kg × ${stripZeros(prevReps)}`
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

/** Helpers for sets grid rendering */
function ensureSetsContainer() {
  let container = document.getElementById("sets-grids-wrapper");
  if (!container) {
    container = document.createElement("div");
    container.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    anchor.appendChild(container);
  }
  return container;
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

  // Tag attributes for later reads
  for (const [k,v] of Object.entries(attrs || {})) {
    reps.setAttribute(k, v);
    weight.setAttribute(k, v);
  }

  row.appendChild(reps);
  row.appendChild(prev);
  row.appendChild(weight);
  return row;
}

// ========================================================
// --- Utility helpers (formatting & coercion) ---
// ========================================================

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function clampInt(n, min, max){ return Math.max(min, Math.min(max, Number.isFinite(n)?n:min)); }
function isFiniteNum(x){ return typeof x === "number" && Number.isFinite(x); }
function stripZeros(n){
  if (!isFiniteNum(n)) return n;
  const s = String(n);
  return s.indexOf('.') >= 0 ? s.replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1') : s;
}
// ========================================================
// --- Add/remove exercises & session list ---
// ========================================================

/**
 * Read the current inputs from Step 5 and push an exercise into
 * the in-memory "currentWorkoutExercises" list.
 */
function addExerciseToWorkout() {
  const exerciseName = document.getElementById("exercise-select").value;
  const sets = clampInt(parseInt(document.getElementById("sets-input").value), 1, 99);
  const unilateral = !!document.getElementById("unilateral-toggle")?.checked;

  // Collect reps & weights
  const repInputs = Array.from(document.querySelectorAll(".rep-input"));
  const weightInputs = Array.from(document.querySelectorAll(".set-weight-input"));

  // Validation
  if (!exerciseName) { alert("Please select an exercise."); return; }
  if (!sets) { alert("Please enter the number of sets."); return; }
  if (repInputs.length === 0 || weightInputs.length === 0) {
    alert("Please render the set inputs first (choose sets/unilateral)."); return;
  }
  // Ensure all reps are provided and at least one weight is provided
  const missingReps = repInputs.some(r => !r.value || parseInt(r.value) <= 0);
  const allWeightsEmpty = weightInputs.every(w => !w.value || parseFloat(w.value) < 0);
  if (missingReps || allWeightsEmpty) {
    alert("Please complete reps and weights for your sets.");
    return;
  }

  // Build exercise payload
  const exercise = {
    id: Date.now().toString(),
    name: exerciseName,
    sets: sets,
    reps: clampInt(parseInt(repInputs[0].value), 1, 999), // keep a reps field (legacy support)
    movementType: unilateral ? "unilateral" : "bilateral"
  };

  if (!unilateral) {
    const weights = weightInputs.map(w => +w.value || 0);
    exercise.setWeights = weights;
    exercise.maxWeight = weights.length ? Math.max(...weights) : 0;
  } else {
    const lefts = weightInputs.filter(w => w.getAttribute("data-side") === "L").map(w => +w.value || 0);
    const rights = weightInputs.filter(w => w.getAttribute("data-side") === "R").map(w => +w.value || 0);
    exercise.leftSetWeights = lefts;
    exercise.rightSetWeights = rights;
    const all = [...lefts, ...rights];
    exercise.maxWeight = all.length ? Math.max(...all) : 0;
  }

  currentWorkoutExercises.push(exercise);
  renderCurrentWorkoutList();
  updateReviewButtonState();

  // Soft reset the inputs for convenience
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  document.getElementById("unilateral-toggle").checked = false;
  ensureSetsContainer().innerHTML = "";
}

/** Visible list under Step 5 */
function renderCurrentWorkoutList() {
  const listContainer = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  list.innerHTML = "";

  if (currentWorkoutExercises.length === 0) {
    listContainer.style.display = "none";
    return;
  }

  listContainer.style.display = "block";
  currentWorkoutExercises.forEach((ex, idx) => {
    const div = document.createElement("div");
    div.className = "workout-item";

    let details = "";
    if (ex.movementType === "unilateral") {
      const L = ex.leftSetWeights || [];
      const R = ex.rightSetWeights || [];
      const pairsL = L.map((w,i)=>`${(document.querySelectorAll('.rep-input')[i]?.value)||'—'}x${stripZeros(w)}kg`).join(", ");
      const pairsR = R.map((w,i)=>`${(document.querySelectorAll('.rep-input')[i]?.value)||'—'}x${stripZeros(w)}kg`).join(", ");
      const maxL = L.length ? Math.max(...L) : 0;
      const maxR = R.length ? Math.max(...R) : 0;
      const countL = L.filter(x=>x===maxL).length;
      const countR = R.filter(x=>x===maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${countL} set(s) • Heaviest Right: ${stripZeros(maxR)}kg × ${countR} set(s)</div>
      `;
    } else {
      const W = ex.setWeights || [];
      const pairs = W.map((w,i)=>`${(document.querySelectorAll('.rep-input')[i]?.value)||'—'}x${stripZeros(w)}kg`).join(", ");
      const c = W.filter(x=>x===ex.maxWeight).length;
      details = `
        <div>${stripZeros(ex.sets)} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${stripZeros(ex.maxWeight)}kg × ${stripZeros(c)} set(s)</div>
      `;
    }

    div.innerHTML = `
      <strong>${ex.name}</strong><br>
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

// ========================================================
// --- Review page (Step 6) ---
// ========================================================

/** Build the review summary and comparison against last & best (with dates) */
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  const when = document.querySelector("input[name='timing']:checked")?.value === "now" ? "Training now" : "Recorded session";
  const dt = document.getElementById("workout-datetime").value;

  meta.innerHTML = `
    <div class="summary-row"><strong>When</strong><span>${when}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${toLocal(dt)}</span></div>
  `;

  exWrap.innerHTML = "";
  if (currentWorkoutExercises.length === 0) {
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added yet. Go back and add some.</em></div>`;
  } else {
    currentWorkoutExercises.forEach(ex => {
      const { lastInfo, bestInfo, trendBadge } = buildComparisons(ex.name, ex.maxWeight);

      let details = "";
      if (ex.movementType === "unilateral") {
        const L = ex.leftSetWeights || [], R = ex.rightSetWeights || [];
        const pairsL = L.map((w,i)=>`${(document.querySelectorAll('.rep-input')[i]?.value)||'—'}x${stripZeros(w)}kg`).join(", ");
        const pairsR = R.map((w,i)=>`${(document.querySelectorAll('.rep-input')[i]?.value)||'—'}x${stripZeros(w)}kg`).join(", ");
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
        const pairs = W.map((w,i)=>`${(document.querySelectorAll('.rep-input')[i]?.value)||'—'}x${stripZeros(w)}kg`).join(", ");
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
      exWrap.appendChild(card);
    });
  }

  // Totals
  let totalVolume = 0, totalSets = 0;
  currentWorkoutExercises.forEach(ex => {
    if (ex.movementType === "unilateral") {
      totalSets += (ex.sets || 0) * 2;
      (ex.leftSetWeights || []).forEach((w,i) => {
        const r = parseInt(document.querySelectorAll('.rep-input')[i]?.value) || 0;
        totalVolume += r * (w || 0);
      });
      (ex.rightSetWeights || []).forEach((w,i) => {
        const r = parseInt(document.querySelectorAll('.rep-input')[i]?.value) || 0;
        totalVolume += r * (w || 0);
      });
    } else {
      totalSets += (ex.sets || 0);
      (ex.setWeights || []).forEach((w,i) => {
        const r = parseInt(document.querySelectorAll('.rep-input')[i]?.value) || 0;
        totalVolume += r * (w || 0);
      });
    }
  });

  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${currentWorkoutExercises.length}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${isFiniteNum(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
  `;
}

/** Comparison helpers (vs last/best) */
function buildComparisons(exName, currentMax) {
  const hist = userWorkoutData[exName];
  const recsDesc = hist ? hist.records.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)) : [];

  // Last
  const last = recsDesc[0];
  const lastMax = isFiniteNum(last?.maxWeight) ? last.maxWeight : null;
  const lastDate = last ? new Date(last.date).toLocaleDateString() : null;
  const lastDelta = (lastMax == null) ? null : +(currentMax - lastMax).toFixed(2);
  const lastDeltaText = (lastMax == null) ? "—" :
    (lastDelta > 0 ? `▲ +${stripZeros(lastDelta)}kg` :
     lastDelta < 0 ? `▼ ${stripZeros(lastDelta)}kg` :
     `= 0kg`);

  // Best
  const bestW = hist ? hist.bestWeight : null;
  let bestDate = null;
  if (isFiniteNum(bestW)) {
    // find first record (chronologically) that hit bestW
    const recsAsc = recsDesc.slice().reverse();
    const hit = recsAsc.find(r => r.maxWeight === bestW);
    bestDate = hit ? new Date(hit.date).toLocaleDateString() : null;
  }
  const bestDelta = (bestW == null) ? null : +(currentMax - bestW).toFixed(2);
  const bestDeltaText = (bestW == null) ? "—" :
    (bestDelta > 0 ? `▲ +${stripZeros(bestDelta)}kg` :
     bestDelta < 0 ? `▼ ${stripZeros(bestDelta)}kg` :
     `= 0kg`);

  // Trend badge against last
  let trendBadge = `<span style="color:#9aa0a6;">— no history</span>`;
  if (lastMax != null) {
    if (lastDelta > 0) trendBadge = ` <span style="color:#4caf50;">▲ +${stripZeros(lastDelta)}kg</span>`;
    else if (lastDelta < 0) trendBadge = ` <span style="color:#ff5252;">▼ ${stripZeros(lastDelta)}kg</span>`;
    else trendBadge = ` <span style="color:#ffb300;">= 0kg</span>`;
  }

  return {
    lastInfo: { deltaText: lastDeltaText, date: lastDate },
    bestInfo: { deltaText: bestDeltaText, date: bestDate },
    trendBadge
  };
}

// ========================================================
// --- Save session (Step 6) ---
// ========================================================

function saveSession() {
  const workoutDateTime = document.getElementById("workout-datetime").value;
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
      setWeights: ex.setWeights,           // bilateral
      leftSetWeights: ex.leftSetWeights,   // unilateral
      rightSetWeights: ex.rightSetWeights, // unilateral
      movementType: ex.movementType,
      maxWeight: ex.maxWeight
    };

    if (!userWorkoutData[ex.name]) {
      userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    }
    userWorkoutData[ex.name].records.push(record);

    // Update bestWeight
    if (isFiniteNum(record.maxWeight) && record.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = record.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved!");

  // Reset the current unsaved session
  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  // Go back to start of wizard (keep your date “now”)
  document.getElementById("workout-datetime").value = new Date().toISOString().slice(0, 16);
  goToStep(1);
  updateReviewButtonState();
}

// ========================================================
// --- History View + Chart + Edit/Delete ---
// ========================================================

function showHistoryView() {
  // preserve logger context
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");

  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}

function showLoggerView() {
  // preserve history scroll
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
}

function populateHistoryDropdown() {
  const historySelect = document.getElementById("history-select");
  const recordedExercises = Object.keys(userWorkoutData).sort((a,b)=>a.localeCompare(b));
  historySelect.innerHTML = `<option value="">--Select an Exercise--</option>` +
    recordedExercises.map(ex => `<option value="${ex}">${ex}</option>`).join('');

  document.getElementById("history-details").style.display = "none";
}

function displayExerciseHistory() {
  const selectedExercise = document.getElementById("history-select").value;
  const historyDetails = document.getElementById("history-details");
  const bestWeightTitle = document.getElementById("best-weight-title");
  const historyLog = document.getElementById("history-log");

  if (!selectedExercise) {
    historyDetails.style.display = "none";
    return;
  }

  const history = userWorkoutData[selectedExercise];
  if (!history || !Array.isArray(history.records) || history.records.length === 0) {
    historyDetails.style.display = "none";
    return;
  }

  historyDetails.style.display = "block";
  bestWeightTitle.textContent = `Best Weight: ${stripZeros(history.bestWeight)}kg`;

  const sorted = history.records.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const dates = sorted.map(r => new Date(r.date).toLocaleDateString());
  const maxWeights = sorted.map(r => r.maxWeight);

  // Chart
  if (myChart) myChart.destroy();
  const ctx = document.getElementById("history-chart").getContext("2d");
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

  // Log
  historyLog.innerHTML = "";
  sorted.forEach(record => {
    const li = document.createElement("li");

    let details = "";
    if (record.movementType === "unilateral" && (record.leftSetWeights || record.rightSetWeights)) {
      const L = record.leftSetWeights || [];
      const R = record.rightSetWeights || [];
      const pairsL = L.map((w,i)=>`${(record.reps)||'—'}x${stripZeros(w)}kg`).join(", ");
      const pairsR = R.map((w,i)=>`${(record.reps)||'—'}x${stripZeros(w)}kg`).join(", ");
      const maxL = L.length ? Math.max(...L) : 0;
      const maxR = R.length ? Math.max(...R) : 0;
      const cL = L.filter(x=>x===maxL).length;
      const cR = R.filter(x=>x===maxR).length;

      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)}</div>
      `;
    } else {
      const W = record.setWeights || [];
      const pairs = W.map((w,i)=>`${(record.reps)||'—'}x${stripZeros(w)}kg`).join(", ");
      const c = W.filter(x=>x===record.maxWeight).length;
      details = `
        <div>Sets: ${stripZeros(record.sets)} → ${pairs || "—"}</div>
        <div>Heaviest: ${stripZeros(record.maxWeight)}kg${c ? ` × ${stripZeros(c)} set(s)` : ""}</div>
      `;
    }

    li.innerHTML = `
      <span>
        <strong>${selectedExercise}</strong><br>
        Date: ${new Date(record.date).toLocaleString()}<br>
        ${details}
      </span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${selectedExercise}', '${record.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${selectedExercise}', '${record.id}')">Delete</button>
      </div>
    `;
    historyLog.appendChild(li);
  });
}

/** Delete a record and recompute best */
function deleteRecord(exerciseName, recordId) {
  if (!confirm("Delete this record?")) return;

  const history = userWorkoutData[exerciseName];
  if (!history) return;

  history.records = history.records.filter(r => r.id !== recordId);

  if (history.records.length === 0) {
    delete userWorkoutData[exerciseName];
  } else {
    const newMax = Math.max(...history.records.map(r => r.maxWeight));
    history.bestWeight = isFiniteNum(newMax) ? newMax : 0;
  }

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();

  // Keep the dropdown on the same exercise if it still exists
  const sel = document.getElementById("history-select");
  if (exerciseName in userWorkoutData) {
    sel.value = exerciseName;
    displayExerciseHistory();
  } else {
    document.getElementById("history-details").style.display = "none";
  }
}

/** Bring a record back to the Logger for editing */
function editRecord(exerciseName, recordId) {
  const history = userWorkoutData[exerciseName];
  const record = history?.records.find(r => r.id === recordId);
  if (!record) return;

  // Switch to logger page
  showLoggerView();

  // Put form into "edit" mode (visual hint)
  editingRecord = record;
  const editMsg = document.getElementById("edit-mode-message");
  if (editMsg) editMsg.style.display = "block";

  // Step 2: set date
  const dtInput = document.getElementById("workout-datetime");
  dtInput.disabled = false; // editing a past record
  dtInput.value = record.date;

  // Step 3/4/5: we try to prefill category/equipment/exercise when possible
  // (We don’t store category/equipment on record in this file to keep history compact;
  //  so user may re-select category/equipment quickly.)
  document.getElementById("work-on-select").value = "";
  document.getElementById("equipment-select").innerHTML = `<option value="">--Select--</option>`;
  document.getElementById("exercise-select").innerHTML = `<option value="">--Select--</option>`;

  // Go to Step 5 directly (user can pick again)
  goToStep(5);

  // Prefill sets and unilateral/bilateral
  const unilateral = record.movementType === "unilateral";
  document.getElementById("unilateral-toggle").checked = unilateral;

  document.getElementById("sets-input").value = record.sets || 3;
  renderSetWeightInputs(); // creates inputs

  // Prefill reps (legacy single reps stored)
  const repsInputs = document.querySelectorAll(".rep-input");
  repsInputs.forEach(r => r.value = record.reps || 10);

  // Prefill weights
  const weightInputs = document.querySelectorAll(".set-weight-input");
  if (!unilateral) {
    const W = record.setWeights || [];
    let i = 0;
    weightInputs.forEach(w => { if (i < W.length) { w.value = W[i++]; } });
  } else {
    let iL = 0, iR = 0;
    const L = record.leftSetWeights || [], R = record.rightSetWeights || [];
    weightInputs.forEach(w => {
      if (w.getAttribute("data-side") === "L") { if (iL < L.length) w.value = L[iL++]; }
      if (w.getAttribute("data-side") === "R") { if (iR < R.length) w.value = R[iR++]; }
    });
  }

  // Replace currentWorkoutExercises with the one being edited
  currentWorkoutExercises = [{
    id: record.id,
    name: exerciseName,
    sets: record.sets,
    reps: record.reps,
    movementType: unilateral ? "unilateral" : "bilateral",
    setWeights: record.setWeights || [],
    leftSetWeights: record.leftSetWeights || [],
    rightSetWeights: record.rightSetWeights || [],
    maxWeight: record.maxWeight || 0
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

// ========================================================
// --- Validation helpers & small utilities ---
// ========================================================

/** Validate per step before moving forward */
function validateAndStore(step) {
  switch (step) {
    case 1: {
      const loc = document.getElementById("workout-type-select").value;
      if (!loc) { alert("Please select where you are training."); return false; }
      return true;
    }
    case 2: {
      const timing = document.querySelector("input[name='timing']:checked");
      if (!timing) { alert("Please select timing (now / past)."); return false; }
      if (timing.value === "past" && !document.getElementById("workout-datetime").value) {
        alert("Please provide a date/time."); return false;
      }
      return true;
    }
    case 3: {
      const cat = document.getElementById("work-on-select").value;
      if (!cat) { alert("Please select what you are training."); return false; }
      // if "specific muscle", ensure muscle selected
      if (cat.toLowerCase() === "specific muscle") {
        const m = document.getElementById("muscle-select").value;
        if (!m) { alert("Please choose a specific muscle."); return false; }
      }
      return true;
    }
    case 4: {
      const eq = document.getElementById("equipment-select").value;
      if (!eq) { alert("Please select equipment."); return false; }
      return true;
    }
    case 5: {
      // Step 5 is validated inside addExerciseToWorkout() when user adds
      return true;
    }
    default: return true;
  }
}

/** Date to local string (defensive) */
function toLocal(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso || "—"; }
}

// Debug utilities (optional)
window._dumpData = () => console.log("userWorkoutData", userWorkoutData);
window._clearData = () => {
  if (confirm("Clear ALL workout data?")) {
    localStorage.removeItem("userWorkoutData");
    userWorkoutData = {};
    alert("All data cleared.");
  }
};

// End of script.js
