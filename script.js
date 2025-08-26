/* ===========================
   Helpers & Config
=========================== */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const CATEGORY_WHITELIST = new Set([
  "upper body", "lower body", "push", "pull", "hinge", "squat", "full body", "core", "specific muscle"
]);

const uniq = arr => [...new Set(arr)];
const title = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function allCategories() {
  return uniq(EXERCISES.flatMap(e => e.sections.filter(s => CATEGORY_WHITELIST.has(s)))).sort();
}
function allMuscles() {
  return uniq(EXERCISES.flatMap(e => Array.isArray(e.muscles) ? e.muscles : [])).sort();
}
function byLocation(items, location) {
  if (location === "home") return items.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.includes(eq)));
  return items;
}
function byCategoryAndMuscle(items, category, muscle) {
  if (!category) return [];
  if (category === "specific muscle") {
    if (!muscle) return [];
    return items.filter(e => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle));
  }
  return items.filter(e => e.sections.includes(category));
}

/* ===========================
   Wizard State
=========================== */
let currentStep = 1;
let myChart;
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

// Collected answers
const wizard = {
  location: "",           // gym/home
  timing: "",             // now/past
  datetime: "",           // ISO yyyy-MM-ddTHH:mm
  category: "",
  muscle: "",
  equipment: "",
  exercise: "",
  sets: 3,
  setReps: [],
  setWeights: [],
  maxWeight: 0,
  maxWeightSetCount: 0
};

/* ===========================
   DOM Ready: bind everything
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  // Header buttons
  const toHistory = document.getElementById("to-history");
  const toLogger  = document.getElementById("to-logger");
  if (toHistory) toHistory.addEventListener("click", showHistoryView);
  if (toLogger)  toLogger.addEventListener("click", showLoggerView);

  // Wizard nav
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");
  if (nextBtn) nextBtn.addEventListener("click", () => {
    try { nextStep(); } catch (e) { console.error("nextStep error:", e); alert("Couldn't go next. Check console."); }
  });
  if (prevBtn) prevBtn.addEventListener("click", () => {
    try { prevStep(); } catch (e) { console.error("prevStep error:", e); alert("Couldn't go back. Check console."); }
  });

  // Step 6 actions
  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);

  // Step 5 add exercise
  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);

  // Init steps
  initStep1();
  initStep2();
  initStep3();
  initStep4();
  initStep5();

  goToStep(1);
  document.getElementById('history-details').style.display = "none";
});

/* ===========================
   Step navigation
=========================== */
function goToStep(step) {
  currentStep = step;

  // Show only current step
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });

  // Step badges
  document.querySelectorAll(".step-badge").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });

  // Nav button states
  const prev = document.getElementById("prev-btn");
  const next = document.getElementById("next-btn");
  if (prev) prev.disabled = (step === 1);
  if (next) next.textContent = (step === 6) ? "Save" : (step === 5 ? "Review" : "Next");

  // Build summary upon entering step 6
  if (step === 6) buildSessionSummary();
}
function prevStep() {
  if (currentStep > 1) goToStep(currentStep - 1);
}
function nextStep() {
  if (!validateAndStore(currentStep)) return;
  if (currentStep < 5) {
    goToStep(currentStep + 1);
  } else if (currentStep === 5) {
    goToStep(6); // Summary
  } else {
    saveSession(); // Step 6 Save
  }
}

/* ===========================
   Step 1: Location
=========================== */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (sel) sel.value = wizard.location || "";
}
function validateAndStoreStep1() {
  const val = document.getElementById("workout-type-select").value;
  if (!val) { alert("Please select where you are training."); return false; }
  wizard.location = val;
  return true;
}

/* ===========================
   Step 2: Timing
=========================== */
function initStep2() {
  const timingRadios = document.querySelectorAll('input[name="timing"]');
  timingRadios.forEach(r => r.addEventListener("change", onTimingChange));

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
    document.getElementById("date-hint").textContent = "Pick the date/time for your past session.";
  }
}
function setDateToNow(write) {
  const dt = document.getElementById("workout-datetime");
  const nowIso = new Date().toISOString().slice(0, 16);
  if (write) dt.value = nowIso;
  dt.setAttribute("disabled", "disabled");
  document.getElementById("date-hint").textContent = "Date/time is locked to now.";
}
function validateAndStoreStep2() {
  const dt = document.getElementById("workout-datetime").value;
  if (!wizard.timing) { alert("Please select session timing."); return false; }
  if (wizard.timing === "past" && !dt) { alert("Please choose a date/time for your past session."); return false; }
  wizard.datetime = (wizard.timing === "now") ? new Date().toISOString().slice(0, 16) : dt;
  return true;
}

/* ===========================
   Step 3: Category
=========================== */
function initStep3() {
  const workOnSelect = document.getElementById("work-on-select");
  const cats = allCategories();
  workOnSelect.innerHTML = `<option value="">--Select--</option>` + cats.map(c => `<option value="${c}">${title(c)}</option>`).join('');
  workOnSelect.value = wizard.category || "";

  const musclesSelect = document.getElementById("muscle-select");
  const muscles = allMuscles();
  musclesSelect.innerHTML = `<option value="">--Select--</option>` + muscles.map(m => `<option value="${m}">${m}</option>`).join('');
  musclesSelect.value = wizard.muscle || "";

  workOnSelect.addEventListener("change", () => {
    const cat = workOnSelect.value;
    wizard.category = cat;
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
  const cat = document.getElementById("work-on-select").value;
  if (!cat) { alert("Please select what you're training."); return false; }
  wizard.category = cat;

  if (cat === "specific muscle") {
    const mus = document.getElementById("muscle-select").value;
    if (!mus) { alert("Please choose a specific muscle."); return false; }
    wizard.muscle = mus;
  }
  return true;
}

/* ===========================
   Step 4: Equipment
=========================== */
function initStep4() { populateEquipment(); }
function populateEquipment() {
  const equipmentSelect = document.getElementById("equipment-select");
  equipmentSelect.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EXERCISES, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);
  const eqs = uniq(filtered.flatMap(e => e.equipment));

  equipmentSelect.innerHTML += eqs.map(eq => `<option value="${eq}">${title(eq)}</option>`).join('');
  equipmentSelect.value = wizard.equipment || "";

  equipmentSelect.onchange = () => { wizard.equipment = equipmentSelect.value; populateExercises(); };
}
function validateAndStoreStep4() {
  const val = document.getElementById("equipment-select").value;
  if (!val) { alert("Please select the machine/equipment."); return false; }
  wizard.equipment = val;
  return true;
}

/* ===========================
   Step 5: Exercise + Sets
=========================== */
function initStep5() {
  populateExercises();

  const setsInput = document.getElementById("sets-input");
  setsInput.value = wizard.sets;
  setsInput.addEventListener("change", () => {
    wizard.sets = Math.max(1, parseInt(setsInput.value || "1", 10));
    renderSetRows(wizard.sets);
  });
  renderSetRows(wizard.sets);
}
function populateExercises() {
  const exerciseSelect = document.getElementById("exercise-select");
  exerciseSelect.innerHTML = `<option value="">--Select--</option>`;
  const pool = byLocation(EXERCISES, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter(e => e.equipment.includes(wizard.equipment));

  const names = uniq(filtered.map(e => e.name)).sort();
  exerciseSelect.innerHTML += names.map(n => `<option value="${n}">${n}</option>`).join('');
  exerciseSelect.value = wizard.exercise || "";
  exerciseSelect.onchange = () => wizard.exercise = exerciseSelect.value;
}
function renderSetRows(n) {
  const grid = document.getElementById("sets-grid");
  grid.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `
      <input type="number" min="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i-1}">
      <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i-1}">
    `;
    grid.appendChild(row);
  }
}
function validateAndStoreStep5() {
  const exercise = document.getElementById("exercise-select").value;
  if (!exercise) { alert("Please choose an exercise."); return false; }
  wizard.exercise = exercise;

  const n = Math.max(1, parseInt(document.getElementById("sets-input").value || "1", 10));
  wizard.sets = n;

  const repsInputs = [...document.querySelectorAll('#sets-grid input[data-kind="reps"]')];
  const weightInputs = [...document.querySelectorAll('#sets-grid input[data-kind="weight"]')];

  const setReps = repsInputs.map(i => parseInt(i.value, 10)).filter(v => !Number.isNaN(v) && v > 0);
  const setWeights = weightInputs.map(i => parseFloat(i.value)).filter(v => !Number.isNaN(v) && v >= 0);

  if (setReps.length !== n || setWeights.length !== n) {
    alert("Please fill reps and weight for every set.");
    return false;
  }

  wizard.setReps = setReps;
  wizard.setWeights = setWeights;

  const maxW = Math.max(...setWeights);
  const maxCount = setWeights.filter(w => w === maxW).length;
  wizard.maxWeight = maxW;
  wizard.maxWeightSetCount = maxCount;

  return true;
}

/* Validate wrapper */
function validateAndStore(step) {
  switch (step) {
    case 1: return validateAndStoreStep1();
    case 2: return validateAndStoreStep2();
    case 3: return validateAndStoreStep3();
    case 4: return validateAndStoreStep4();
    case 5: return validateAndStoreStep5();
    case 6: return true;
    default: return true;
  }
}

/* ===========================
   Add to current session
=========================== */
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

  // Reset step-5 inputs for quickly adding another exercise
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  wizard.exercise = "";
  wizard.sets = 3;
  renderSetRows(3);
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
        <button onclick="removeExerciseFromWorkout(${index})" style="float:right; padding:5px 10px; font-size:12px; margin-top:-5px; background:#a55;">Remove</button>
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
}

/* ===========================
   Step 6: Session Summary
=========================== */
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  // Meta
  meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${title(wizard.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${new Date(wizard.datetime).toLocaleString()}</span></div>
  `;

  // Exercises
  exWrap.innerHTML = "";
  if (currentWorkoutExercises.length === 0) {
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added yet. Go back and add some.</em></div>`;
  } else {
    currentWorkoutExercises.forEach(ex => {
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

  // Totals
  let totalVolume = 0;
  let totalSets = 0;
  let totalExercises = currentWorkoutExercises.length;

  currentWorkoutExercises.forEach(ex => {
    totalSets += ex.sets;
    ex.setReps.forEach((r, i) => { totalVolume += r * ex.setWeights[i]; });
  });

  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${totalExercises}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
  `;
}

/* ===========================
   Save Session
=========================== */
function saveSession() {
  const dt = wizard.datetime;
  if (!dt) { alert("Missing session date/time — go back to Step 2."); return; }
  if (currentWorkoutExercises.length === 0) { alert("Add at least one exercise."); return; }

  currentWorkoutExercises.forEach(ex => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id,
      date: ex.date,
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

  // Reset for next session
  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  Object.assign(wizard, {
    location: "", timing: "now", datetime: new Date().toISOString().slice(0,16),
    category: "", muscle: "", equipment: "", exercise: "",
    sets: 3, setReps: [], setWeights: [], maxWeight: 0, maxWeightSetCount: 0
  });

  // UI reset to step 1
  document.getElementById("workout-type-select").value = "";
  const nowRadio = document.querySelector('input[name="timing"][value="now"]');
  if (nowRadio) nowRadio.checked = true;
  setDateToNow(true);
  document.getElementById("work-on-select").value = "";
  document.getElementById("muscle-select").value = "";
  document.getElementById("muscle-select-group").style.display = "none";
  populateEquipment();
  populateExercises();
  document.getElementById("sets-input").value = "3";
  renderSetRows(3);
  goToStep(1);
}

/* ===========================
   History & Charts
=========================== */
function showHistoryView() {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");
  populateHistoryDropdown();
}
function showLoggerView() {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");
  goToStep(1);
}

function populateHistoryDropdown() {
  const historySelect = document.getElementById("history-select");
  const recordedExercises = Object.keys(userWorkoutData);
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

  historyDetails.style.display = "block";
  const history = userWorkoutData[selectedExercise];

  bestWeightTitle.textContent = `Best Weight: ${history.bestWeight}kg`;

  historyLog.innerHTML = "";
  const sortedRecords = history.records.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  const dates = sortedRecords.map(r => new Date(r.date).toLocaleDateString());
  const maxWeights = sortedRecords.map(r => r.maxWeight);

  if (myChart) myChart.destroy();
  const ctx = document.getElementById('history-chart').getContext('2d');
  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Heaviest Lift (kg)',
        data: maxWeights,
        borderColor: 'orange',
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
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

  sortedRecords.forEach(record => {
    const listItem = document.createElement("li");
    const dateString = new Date(record.date).toLocaleString();
    const pairs = record.setReps.map((r, i) => `${r}x${record.setWeights[i]}kg`).join(", ");
    const meta = `${title(record.category)} • ${title(record.equipment)}${record.muscle ? ` • ${record.muscle}` : ""}`;
    listItem.innerHTML = `
      <span>
        <strong>${selectedExercise}</strong> <small>(${meta})</small><br>
        Date: ${dateString} | Sets: ${record.sets} | ${pairs}<br>
        Heaviest: ${record.maxWeight}kg for ${record.maxWeightSetCount} set(s)
      </span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${selectedExercise}', '${record.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${selectedExercise}', '${record.id}')">Delete</button>
      </div>
    `;
    historyLog.appendChild(listItem);
  });
}
function deleteRecord(exerciseName, recordId) {
  if (confirm("Are you sure you want to delete this record?")) {
    const history = userWorkoutData[exerciseName];
    history.records = history.records.filter(record => record.id !== recordId);

    if (history.records.length === 0) {
      delete userWorkoutData[exerciseName];
    } else {
      const newMax = Math.max(...history.records.map(r => r.maxWeight));
      history.bestWeight = isFinite(newMax) ? newMax : 0;
    }

    localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
    populateHistoryDropdown();
    displayExerciseHistory();
  }
}
function editRecord(exerciseName, recordId) {
  const history = userWorkoutData[exerciseName];
  const record = history.records.find(r => r.id === recordId);
  if (!record) return;

  wizard.location = HOME_EQUIPMENT.includes(record.equipment) ? "home" : "gym";
  wizard.timing = "past";
  wizard.datetime = record.date;
  wizard.category = record.category;
  wizard.muscle = record.muscle || "";
  wizard.equipment = record.equipment;
  wizard.exercise = exerciseName;
  wizard.sets = record.sets;
  wizard.setReps = record.setReps.slice();
  wizard.setWeights = record.setWeights.slice();

  showLoggerView();

  // Step 1
  document.getElementById("workout-type-select").value = wizard.location;
  // Step 2
  const pastRadio = document.querySelector('input[name="timing"][value="past"]');
  if (pastRadio) pastRadio.checked = true;
  const dt = document.getElementById("workout-datetime");
  dt.removeAttribute("disabled");
  dt.value = wizard.datetime;

  // Step 3
  const catSel = document.getElementById("work-on-select");
  catSel.value = wizard.category;
  const muscleGroup = document.getElementById("muscle-select-group");
  if (wizard.category === "specific muscle") {
    muscleGroup.style.display = "block";
    document.getElementById("muscle-select").value = wizard.muscle;
  } else {
    muscleGroup.style.display = "none";
  }

  // Step 4
  populateEquipment();
  document.getElementById("equipment-select").value = wizard.equipment;

  // Step 5
  populateExercises();
  document.getElementById("exercise-select").value = wizard.exercise;
  document.getElementById("sets-input").value = wizard.sets;
  renderSetRows(wizard.sets);
  [...document.querySelectorAll('#sets-grid input[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
  [...document.querySelectorAll('#sets-grid input[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");

  editingRecord = record;
  document.getElementById("edit-mode-message").style.display = "block";

  goToStep(5);
}

/* Expose a couple for safety if needed in console */
window.showHistoryView = showHistoryView;
window.showLoggerView = showLoggerView;
