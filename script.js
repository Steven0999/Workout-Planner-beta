/* =======================================================================
   Workout Session Logger — script.js (FULL)
   -----------------------------------------------------------------------
   Features:
   - Multi-step wizard:
       1) Location (Gym/Home)
       2) Timing (Now/Past) + datetime
       3) Category (upper/lower/full/push/pull/hinge/squat/core/specific muscle)
       4) Equipment (filtered by location+category+muscle)
       5) Exercise picker + dynamic set rows (reps/weight) + Add-to-session
       6) Review/Save summary (Review disabled until ≥1 exercise)
   - Exercise library loaded from exercises.js as global EXERCISES (condensed)
   - LocalStorage persistence with best weight tracking
   - History page with Chart.js + edit/delete; edit flows back into wizard
   - Accessible, mobile-friendly
   ======================================================================= */

/* ==============================
   Crash Guard (Surface errors)
   ============================== */
window.addEventListener("error", (e) => {
  console.error("[Fatal JS Error]", e.error || e.message);
});

/* ==========================================
   Constants, Helpers, Normalization
   ========================================== */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];

const CATEGORY_WHITELIST = new Set([
  "upper body",
  "lower body",
  "push",
  "pull",
  "hinge",
  "squat",
  "full body",
  "core",
  "specific muscle"
]);

const uniq  = (arr) => [...new Set(arr)];
const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function normalizeCategory(cat) {
  const c = String(cat || "").toLowerCase().trim();
  if (c === "upper") return "upper body";
  if (c === "lower" || c === "legs") return "lower body";
  return c;
}

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function toFloat(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function nowIsoMinute() {
  return new Date().toISOString().slice(0, 16);
}
function isoToLocalString(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/* ==========================================
   Load & Normalize Exercise Library
   ========================================== */
const RAW_EXERCISES = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];

const EXERCISES_NORM = RAW_EXERCISES.map((e) => ({
  name: e.name,
  sections: (e.sections || []).map((s) => String(s).toLowerCase()),
  equipment: (e.equipment || []).map((eq) => String(eq).toLowerCase()),
  muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
}));

function allCategories() {
  return uniq(
    EXERCISES_NORM.flatMap((e) => e.sections.filter((s) => CATEGORY_WHITELIST.has(s)))
  ).sort();
}
function allMuscles() {
  return uniq(EXERCISES_NORM.flatMap((e) => e.muscles)).sort();
}
function byLocation(items, location) {
  if (location === "home") {
    return items.filter((e) => e.equipment.some((eq) => HOME_EQUIPMENT.includes(eq)));
  }
  return items;
}
function byCategoryAndMuscle(items, category, muscle) {
  const cat = normalizeCategory(category);
  if (!cat) return [];
  if (cat === "specific muscle") {
    if (!muscle) return [];
    return items.filter(
      (e) => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle)
    );
  }
  return items.filter((e) => e.sections.includes(cat));
}

/* ==========================================
   Global State
   ========================================== */
let currentStep = 1;
let myChart = null;

let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

const wizard = {
  location: "", timing: "", datetime: "",
  category: "", muscle: "", equipment: "", exercise: "",
  sets: 3, setReps: [], setWeights: [],
  maxWeight: 0, maxWeightSetCount: 0
};

/* ==========================================
   DOM Ready — Wire everything
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Page nav (if present)
  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);

  // Wizard nav
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);

  // Step 6 actions
  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);

  // Step 5: add exercise
  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);

  // History select (if not wired inline)
  const historySelect = document.getElementById("history-select");
  if (historySelect) historySelect.addEventListener("change", displayExerciseHistory);

  // Init steps
  initStep1(); initStep2(); initStep3(); initStep4(); initStep5();

  // Start
  goToStep(1);
  updateReviewButtonState();
});

/* ==========================================
   Step navigation
   ========================================== */
function goToStep(step) {
  currentStep = step;

  // Show only the active step panel
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = idx === step - 1 ? "block" : "none";
  });

  // Optional step badges
  document.querySelectorAll(".step-badge").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });

  // Prev button state
  const prev = document.getElementById("prev-btn");
  if (prev) prev.disabled = step === 1;

  // Populate per-entry
  if (step === 4)      populateEquipment();
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
    // Require at least one exercise in the list
    if (currentWorkoutExercises.length === 0) {
      const s5Hint = document.getElementById("s5-hint");
      if (s5Hint) s5Hint.textContent = "Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6);
    return;
  }

  // Step 6 -> Save
  saveSession();
}

/* Control Next/Review/Save button and disabled state */
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

/* ==========================================
   Step 1 — Location (Gym/Home)
   ========================================== */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (sel) sel.value = wizard.location || "";
}
function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  const val = document.getElementById("workout-type-select").value;
  if (!val) { if (hint) hint.textContent = "Please select where you are training."; return false; }
  if (hint) hint.textContent = "";
  wizard.location = val;
  return true;
}

/* ==========================================
   Step 2 — Timing (Now/Past) + Datetime
   ========================================== */
function initStep2() {
  const timingRadios = document.querySelectorAll('input[name="timing"]');
  timingRadios.forEach((r) => r.addEventListener("change", onTimingChange));

  // Default to "now"
  if (!wizard.timing) {
    const nowRadio = document.querySelector('input[name="timing"][value="now"]');
    if (nowRadio) nowRadio.checked = true;
    wizard.timing = "now";
    setDateToNow(true);
  } else {
    const chosen = document.querySelector(`input[name="timing"][value="${wizard.timing}"]`);
    if (chosen) chosen.checked = true;
    if (wizard.timing === "now") setDateToNow(true);
  }
}
function onTimingChange(e) {
  wizard.timing = e.target.value;
  if (wizard.timing === "now") {
    setDateToNow(true);
  } else {
    const dt = document.getElementById("workout-datetime");
    dt.removeAttribute("disabled");
    const hint = document.getElementById("date-hint");
    if (hint) hint.textContent = "Pick the date/time for your past session.";
  }
}
function setDateToNow(writeValue) {
  const dt = document.getElementById("workout-datetime");
  const now = nowIsoMinute();
  if (writeValue) dt.value = now;
  dt.setAttribute("disabled", "disabled");
  const hint = document.getElementById("date-hint");
  if (hint) hint.textContent = "Date/time is locked to now.";
}
function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  const dt = document.getElementById("workout-datetime").value;
  if (!wizard.timing) { if (hint) hint.textContent = "Select session timing."; return false; }
  if (wizard.timing === "past" && !dt) { if (hint) hint.textContent = "Choose a date/time for your past session."; return false; }
  wizard.datetime = wizard.timing === "now" ? nowIsoMinute() : dt;
  if (hint) hint.textContent = "";
  return true;
}

/* ==========================================
   Step 3 — Category (+ Specific Muscle)
   ========================================== */
function initStep3() {
  const workOnSelect = document.getElementById("work-on-select");
  const cats = allCategories();
  workOnSelect.innerHTML =
    `<option value="">--Select--</option>` + cats.map((c) => `<option value="${c}">${title(c)}</option>`).join("");
  workOnSelect.value = wizard.category || "";

  const musclesSelect = document.getElementById("muscle-select");
  const muscles = allMuscles();
  musclesSelect.innerHTML =
    `<option value="">--Select--</option>` + muscles.map((m) => `<option value="${m}">${m}</option>`).join("");
  musclesSelect.value = wizard.muscle || "";

  workOnSelect.addEventListener("change", () => {
    const cat = normalizeCategory(workOnSelect.value);
    wizard.category = cat;
    wizard.equipment = "";
    wizard.exercise  = "";
    const muscleGroup = document.getElementById("muscle-select-group");
    if (cat === "specific muscle") {
      muscleGroup.style.display = "block";
    } else {
      muscleGroup.style.display = "none";
      wizard.muscle = "";
      musclesSelect.value = "";
    }
  });

  musclesSelect.addEventListener("change", () => {
    wizard.muscle = musclesSelect.value;
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

/* ==========================================
   Step 4 — Equipment
   ========================================== */
function initStep4() { /* populated on entry */ }
function populateEquipment() {
  const equipmentSelect = document.getElementById("equipment-select");
  equipmentSelect.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);
  const eqs = uniq(filtered.flatMap((e) => e.equipment));

  equipmentSelect.innerHTML += eqs.map((eq) => `<option value="${eq}">${title(eq)}</option>`).join('');

  if (eqs.includes(wizard.equipment)) equipmentSelect.value = wizard.equipment;

  equipmentSelect.onchange = () => { wizard.equipment = equipmentSelect.value; populateExercises(); };
}
function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  const val = document.getElementById("equipment-select").value;
  if (!val) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  wizard.equipment = val;
  if (hint) hint.textContent = "";
  return true;
}

/* ==========================================
   Step 5 — Exercise + Sets
   ========================================== */
function initStep5() {
  const setsInput = document.getElementById("sets-input");
  setsInput.value = wizard.sets;
  setsInput.addEventListener("change", () => {
    wizard.sets = Math.max(1, toInt(setsInput.value, 1));
    renderSetRows(wizard.sets);
  });
  renderSetRows(wizard.sets);
}
function populateExercises() {
  const exerciseSelect = document.getElementById("exercise-select");
  exerciseSelect.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter((e) => wizard.equipment ? e.equipment.includes(wizard.equipment) : true);

  const names = uniq(filtered.map((e) => e.name)).sort();
  exerciseSelect.innerHTML += names.map((n) => `<option value="${n}">${n}</option>`).join('');

  if (names.includes(wizard.exercise)) exerciseSelect.value = wizard.exercise;

  exerciseSelect.onchange = () => { wizard.exercise = exerciseSelect.value; };
}
function renderSetRows(n) {
  const grid = document.getElementById("sets-grid");
  grid.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `
      <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i-1}">
      <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i-1}">
    `;
    grid.appendChild(row);
  }
}
function validateAndStoreStep5() {
  const hint = document.getElementById("s5-hint");
  const exercise = document.getElementById("exercise-select").value;
  if (!exercise) { if (hint) hint.textContent = "Choose an exercise."; return false; }
  wizard.exercise = exercise;

  const n = Math.max(1, toInt(document.getElementById("sets-input").value, 1));
  wizard.sets = n;

  const repsInputs   = [...document.querySelectorAll('#sets-grid input[data-kind="reps"]')];
  const weightInputs = [...document.querySelectorAll('#sets-grid input[data-kind="weight"]')];

  const setReps    = repsInputs.map((i) => toInt(i.value)).filter((v) => v > 0);
  const setWeights = weightInputs.map((i) => toFloat(i.value)).filter((v) => v >= 0);

  if (setReps.length !== n || setWeights.length !== n) {
    if (hint) hint.textContent = "Fill reps and weight for every set.";
    return false;
  }

  wizard.setReps = setReps;
  wizard.setWeights = setWeights;

  const maxW = Math.max(...setWeights);
  const maxCount = setWeights.filter((w) => w === maxW).length;
  wizard.maxWeight = maxW;
  wizard.maxWeightSetCount = maxCount;

  if (hint) hint.textContent = "";
  return true;
}

/* ==========================================
   Current Session list (Step 5)
   ========================================== */
function addExerciseToWorkout() {
  if (!validateAndStoreStep5()) return;

  const newExercise = {
    id: Date.now().toString(),
    date: wizard.datetime,
    name: wizard.exercise,
    category: wizard.category,
    equipment: wizard.equipment,
    muscle: wizard.category === "specific muscle" ? wizard.muscle : null,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(),
    setWeights: wizard.setWeights.slice(),
    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount
  };

  currentWorkoutExercises.push(newExercise);
  renderCurrentWorkoutList();

  // reset inline inputs for next add
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  wizard.exercise = "";
  wizard.sets = 3;
  renderSetRows(3);

  updateReviewButtonState();
}
function renderCurrentWorkoutList() {
  const listContainer = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  list.innerHTML = "";

  if (currentWorkoutExercises.length > 0) {
    listContainer.style.display = "block";
    currentWorkoutExercises.forEach((ex, index) => {
      const setPairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
      const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""}`;

      const item = document.createElement("div");
      item.className = "workout-item";
      item.innerHTML = `
        <strong>${ex.name}</strong> <small>(${meta})</small><br>
        ${ex.sets} sets → ${setPairs}<br>
        Heaviest: ${ex.maxWeight}kg for ${ex.maxWeightSetCount} set(s)
        <button onclick="removeExerciseFromWorkout(${index})" style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;">Remove</button>
      `;
      list.appendChild(item);
    });
  } else {
    listContainer.style.display = "none";
  }
}
function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

/* ==========================================
   Step 6 — Summary (Review) + Save
   ========================================== */
function buildSessionSummary() {
  const meta   = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${title(wizard.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocalString(wizard.datetime)}</span></div>
  `;

  exWrap.innerHTML = "";
  if (currentWorkoutExercises.length === 0) {
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added yet. Go back and add some.</em></div>`;
  } else {
    currentWorkoutExercises.forEach((ex) => {
      const pairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
      const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""}`;
      const card = document.createElement("div");
      card.className = "summary-exercise";
      card.innerHTML = `
        <strong>${ex.name}</strong> <small>(${metaLine})</small><br>
        ${ex.sets} sets → ${pairs}<br>
        Heaviest: ${ex.maxWeight}kg for ${ex.maxWeightSetCount} set(s)
      `;
      exWrap.appendChild(card);
    });
  }

  let totalVolume = 0;
  let totalSets = 0;
  let totalExercises = currentWorkoutExercises.length;

  currentWorkoutExercises.forEach((ex) => {
    totalSets += ex.sets;
    ex.setReps.forEach((r, i) => { totalVolume += r * ex.setWeights[i]; });
  });

  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${totalExercises}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
  `;
}

function saveSession() {
  const dt = wizard.datetime;
  if (!dt) { alert("Missing session date/time — go back to Step 2."); return; }
  if (currentWorkoutExercises.length === 0) { alert("Add at least one exercise before saving."); return; }

  currentWorkoutExercises.forEach((ex) => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id,
      date: dt,
      category: ex.category,
      equipment: ex.equipment,
      muscle: ex.muscle,
      sets: ex.sets,
      setReps: ex.setReps,
      setWeights: ex.setWeights,
      maxWeight: ex.maxWeight,
      maxWeightSetCount: ex.maxWeightSetCount
    });
    if (ex.maxWeight > userWorkoutData[ex.name].bestWeight) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  // Reset session items
  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  // Reset wizard state
  Object.assign(wizard, {
    location: "", timing: "now", datetime: nowIsoMinute(),
    category: "", muscle: "", equipment: "", exercise: "",
    sets: 3, setReps: [], setWeights: [], maxWeight: 0, maxWeightSetCount: 0
  });

  // UI resets
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = "";
  const nowRadio = document.querySelector('input[name="timing"][value="now"]'); if (nowRadio) nowRadio.checked = true;
  const dtInput = document.getElementById("workout-datetime");
  if (dtInput) { dtInput.setAttribute("disabled", "disabled"); dtInput.value = wizard.datetime; }
  const workOnSelect = document.getElementById("work-on-select"); if (workOnSelect) workOnSelect.value = "";
  const muscleSelect = document.getElementById("muscle-select"); if (muscleSelect) muscleSelect.value = "";
  const muscleGroup = document.getElementById("muscle-select-group"); if (muscleGroup) muscleGroup.style.display = "none";
  const equipSel = document.getElementById("equipment-select"); if (equipSel) equipSel.innerHTML = `<option value="">--Select--</option>`;
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  const setsInput = document.getElementById("sets-input"); if (setsInput) setsInput.value = "3";
  renderSetRows(3);

  goToStep(1);
}

/* ==========================================
   History View + Chart.js
   ========================================== */
function showHistoryView() {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");
  populateHistoryDropdown();
}
function showLoggerView() {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");
  goToStep(1);
  updateReviewButtonState();
}
function populateHistoryDropdown() {
  const historySelect = document.getElementById("history-select");
  const recordedExercises = Object.keys(userWorkoutData);
  historySelect.innerHTML =
    `<option value="">--Select an Exercise--</option>` +
    recordedExercises.map((ex) => `<option value="${ex}">${ex}</option>`).join("");
  document.getElementById("history-details").style.display = "none";
}
function displayExerciseHistory() {
  const selectedExercise = document.getElementById("history-select").value;
  const historyDetails   = document.getElementById("history-details");
  const bestWeightTitle  = document.getElementById("best-weight-title");
  const historyLog       = document.getElementById("history-log");

  if (!selectedExercise) { historyDetails.style.display = "none"; return; }

  historyDetails.style.display = "block";
  const history = userWorkoutData[selectedExercise];

  bestWeightTitle.textContent = `Best Weight: ${history.bestWeight}kg`;

  const sortedRecords = history.records.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const dates      = sortedRecords.map((r) => new Date(r.date).toLocaleDateString());
  const maxWeights = sortedRecords.map((r) => r.maxWeight);

  if (myChart) myChart.destroy();
  const ctx = document.getElementById("history-chart").getContext("2d");
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
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Date", color: "white" }, ticks: { color: "white" } },
        y: { title: { display: true, text: "Weight (kg)", color: "white" }, ticks: { color: "white" } }
      },
      plugins: { legend: { labels: { color: "white" } } }
    }
  });

  historyLog.innerHTML = "";
  sortedRecords.forEach((record) => {
    const dateString = new Date(record.date).toLocaleString();
    const pairs = record.setReps
      ? record.setReps.map((r, i) => `${r}x${record.setWeights[i]}kg`).join(", ")
      : `Reps: ${record.reps} | Weights: ${record.setWeights.join(", ")}kg`;
    const meta = `${title(record.category || "n/a")} • ${title(record.equipment || "n/a")}${record.muscle ? ` • ${record.muscle}` : ""}`;

    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        <strong>${selectedExercise}</strong> <small>(${meta})</small><br>
        Date: ${dateString} | Sets: ${record.sets} | ${pairs}<br>
        Heaviest: ${record.maxWeight}kg${record.maxWeightSetCount ? ` for ${record.maxWeightSetCount} set(s)` : ""}
      </span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${selectedExercise}', '${record.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${selectedExercise}', '${record.id}')">Delete</button>
      </div>
    `;
    historyLog.appendChild(li);
  });
}
function deleteRecord(exerciseName, recordId) {
  if (!confirm("Are you sure you want to delete this record?")) return;

  const history = userWorkoutData[exerciseName];
  history.records = history.records.filter((r) => r.id !== recordId);

  if (history.records.length === 0) {
    delete userWorkoutData[exerciseName];
  } else {
    const newMax = Math.max(...history.records.map((r) => r.maxWeight));
    history.bestWeight = Number.isFinite(newMax) ? newMax : 0;
  }

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();

  const historySelect = document.getElementById("history-select");
  if (historySelect && (exerciseName in userWorkoutData)) {
    historySelect.value = exerciseName;
    displayExerciseHistory();
  } else {
    document.getElementById("history-details").style.display = "none";
  }
}
function editRecord(exerciseName, recordId) {
  const history = userWorkoutData[exerciseName];
  const record = history.records.find((r) => r.id === recordId);
  if (!record) return;

  wizard.location  = HOME_EQUIPMENT.includes(record.equipment) ? "home" : "gym";
  wizard.timing    = "past";
  wizard.datetime  = record.date;
  wizard.category  = record.category || "";
  wizard.muscle    = record.muscle || "";
  wizard.equipment = record.equipment || "";
  wizard.exercise  = exerciseName;
  wizard.sets      = record.sets || (record.setWeights ? record.setWeights.length : 3);
  wizard.setReps   = record.setReps ? record.setReps.slice() : Array(wizard.sets).fill(record.reps || 10);
  wizard.setWeights = record.setWeights ? record.setWeights.slice() : Array(wizard.sets).fill(0);

  const maxW = Math.max(...wizard.setWeights);
  wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
  wizard.maxWeightSetCount = wizard.setWeights.filter((w) => w === wizard.maxWeight).length;

  editingRecord = record;

  showLoggerView();

  // Step 1
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = wizard.location;

  // Step 2
  const pastRadio = document.querySelector('input[name="timing"][value="past"]'); if (pastRadio) pastRadio.checked = true;
  const dt = document.getElementById("workout-datetime");
  if (dt) { dt.removeAttribute("disabled"); dt.value = wizard.datetime; }

  // Step 3
  const catSel = document.getElementById("work-on-select"); if (catSel) catSel.value = wizard.category;
  const muscleGroup = document.getElementById("muscle-select-group");
  const muscleSel   = document.getElementById("muscle-select");
  if (wizard.category === "specific muscle") {
    if (muscleGroup) muscleGroup.style.display = "block";
    if (muscleSel) muscleSel.value = wizard.muscle;
  } else { if (muscleGroup) muscleGroup.style.display = "none"; }

  // Step 4
  populateEquipment();
  const equipSel = document.getElementById("equipment-select"); if (equipSel) equipSel.value = wizard.equipment;

  // Step 5
  populateExercises();
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.value = wizard.exercise;
  const setsInput = document.getElementById("sets-input"); if (setsInput) setsInput.value = wizard.sets;
  renderSetRows(wizard.sets);
  const repInputs = [...document.querySelectorAll('#sets-grid input[data-kind="reps"]')];
  const wtInputs  = [...document.querySelectorAll('#sets-grid input[data-kind="weight"]')];
  repInputs.forEach((el, i) => (el.value = wizard.setReps[i] ?? ""));
  wtInputs.forEach((el, i) => (el.value = wizard.setWeights[i] ?? ""));

  currentWorkoutExercises = [{
    id: record.id,
    date: wizard.datetime,
    name: wizard.exercise,
    category: wizard.category,
    equipment: wizard.equipment,
    muscle: wizard.muscle || null,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(),
    setWeights: wizard.setWeights.slice(),
    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();

  goToStep(5);

  const editMsg = document.getElementById("edit-mode-message");
  if (editMsg) editMsg.style.display = "block";
}

/* ==========================================
   Validation Dispatcher
   ========================================== */
function validateAndStore(step) {
  switch (step) {
    case 1: return validateAndStoreStep1();
    case 2: return validateAndStoreStep2();
    case 3: return validateAndStoreStep3();
    case 4: return validateAndStoreStep4();
    case 5: return validateAndStoreStep5();
    default: return true;
  }
}

/* ==========================================
   Debug Helpers (optional)
   ========================================== */
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

// Expose a few for console/inlined handlers
window.showHistoryView = showHistoryView;
window.showLoggerView  = showLoggerView;
window.addExerciseToWorkout = addExerciseToWorkout;
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
