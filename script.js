// ===== Config / helpers =====
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const CATEGORY_WHITELIST = new Set([
  "upper body", "lower body", "push", "pull", "hinge", "squat", "full body", "core", "specific muscle"
]);

const uniq = arr => [...new Set(arr)];
const title = s => s.charAt(0).toUpperCase() + s.slice(1);

// Derive all app categories from EXERCISES
function allCategories() {
  return uniq(
    EXERCISES.flatMap(e => e.sections.filter(s => CATEGORY_WHITELIST.has(s)))
  ).sort();
}

// Derive all muscles from EXERCISES where provided
function allMuscles() {
  return uniq(
    EXERCISES.flatMap(e => Array.isArray(e.muscles) ? e.muscles : [])
  ).sort();
}

// Filter by location (home vs gym)
function byLocation(items, location) {
  if (location === "home") {
    return items.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.includes(eq)));
  }
  return items; // gym: all
}

// Filter exercises by category and (optional) muscle
function byCategoryAndMuscle(items, category, muscle) {
  if (!category) return [];
  if (category === "specific muscle") {
    if (!muscle) return [];
    return items.filter(e => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle));
  }
  return items.filter(e => e.sections.includes(category));
}

// ===== State =====
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let myChart;
let editingRecord = null;

// ===== Initial setup =====
document.addEventListener("DOMContentLoaded", () => {
  populateWorkoutTypeDropdown();
  populateWorkOnDropdown();
  populateMuscleDropdown();
  showLoggerView();
  document.getElementById('workout-datetime').value = new Date().toISOString().slice(0, 16);
  renderSetWeightInputs();
});

// ===== UI Management =====
function showLoggerView() {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");
  resetLoggerForm();
}

function showHistoryView() {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");
  populateHistoryDropdown();
}

// ===== Dropdown population =====
function populateWorkoutTypeDropdown() {
  const typeSelect = document.getElementById("workout-type-select");
  typeSelect.innerHTML = `
    <option value="">--Select Location--</option>
    <option value="gym">Gym</option>
    <option value="home">Home</option>
  `;
}

function populateWorkOnDropdown() {
  const workOnSelect = document.getElementById("work-on-select");
  const cats = allCategories();
  workOnSelect.innerHTML = `<option value="">--Select--</option>` +
    cats.map(cat => `<option value="${cat}">${title(cat)}</option>`).join('');
}

function populateMuscleDropdown() {
  const muscleSelect = document.getElementById("muscle-select");
  const muscles = allMuscles();
  muscleSelect.innerHTML = `<option value="">--Select--</option>` +
    muscles.map(m => `<option value="${m}">${m}</option>`).join('');
}

// ===== Filtering chain =====
function filterEquipmentByWorkoutType() {
  // Reset dependent selects
  document.getElementById("work-on-select").value = "";
  filterEquipment();
}

function filterEquipment() {
  const location = document.getElementById("workout-type-select").value; // gym/home
  const category = document.getElementById("work-on-select").value;
  const muscleSelectGroup = document.getElementById("muscle-select-group");
  const equipmentSelect = document.getElementById("equipment-select");
  const exerciseSelect = document.getElementById("exercise-select");

  // Reset downstream
  equipmentSelect.innerHTML = `<option value="">--Select--</option>`;
  exerciseSelect.innerHTML = `<option value="">--Select--</option>`;

  // Muscle group visibility
  if (category === "specific muscle") {
    muscleSelectGroup.style.display = "block";
  } else {
    muscleSelectGroup.style.display = "none";
    document.getElementById("muscle-select").value = "";
  }

  // Compute equipment based on filters
  const selectedMuscle = document.getElementById("muscle-select").value;
  const pool = byLocation(EXERCISES, location);
  const filtered = byCategoryAndMuscle(pool, category, selectedMuscle);

  const equipments = uniq(filtered.flatMap(e => e.equipment));
  equipmentSelect.innerHTML += equipments.map(eq => `<option value="${eq}">${title(eq)}</option>`).join('');
}

function filterExercises() {
  const location = document.getElementById("workout-type-select").value;
  const category = document.getElementById("work-on-select").value;
  const selectedEquipment = document.getElementById("equipment-select").value;
  const selectedMuscle = document.getElementById("muscle-select").value;
  const exerciseSelect = document.getElementById("exercise-select");

  exerciseSelect.innerHTML = `<option value="">--Select--</option>`;
  if (!category || !selectedEquipment) return;

  const pool = byLocation(EXERCISES, location);
  const filtered = byCategoryAndMuscle(pool, category, selectedMuscle)
    .filter(e => e.equipment.includes(selectedEquipment));

  const names = uniq(filtered.map(e => e.name)).sort();
  exerciseSelect.innerHTML += names.map(n => `<option value="${n}">${n}</option>`).join('');
}

// ===== Inputs for sets/weights =====
function renderSetWeightInputs() {
  const setsInput = document.getElementById("sets-input");
  const numSets = parseInt(setsInput.value, 10);
  const container = document.getElementById("weight-inputs-container");
  container.innerHTML = "";

  if (numSets > 0) {
    for (let i = 1; i <= numSets; i++) {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.placeholder = `Set ${i} (kg)`;
      input.className = "set-weight-input";
      container.appendChild(input);
    }
  }
}

// ===== Add to current session =====
function addExerciseToWorkout() {
  const exerciseName = document.getElementById("exercise-select").value;
  const category = document.getElementById("work-on-select").value;
  const equipment = document.getElementById("equipment-select").value;
  const selectedMuscle = document.getElementById("muscle-select").value || null;
  const sets = parseInt(document.getElementById("sets-input").value, 10);
  const reps = parseInt(document.getElementById("reps-input").value, 10);

  const setWeightInputs = Array.from(document.querySelectorAll('.set-weight-input'));
  const setWeights = setWeightInputs.map(input => parseFloat(input.value)).filter(w => !isNaN(w));

  if (!exerciseName || !category || !equipment || !sets || !reps || setWeights.length === 0) {
    alert("Please select an exercise and fill in all details.");
    return;
  }

  const maxWeight = Math.max(...setWeights);

  const newExercise = {
    id: editingRecord ? editingRecord.id : Date.now().toString(),
    name: exerciseName,
    category,
    equipment,
    muscle: category === "specific muscle" ? selectedMuscle : null,
    sets,
    reps,
    setWeights,
    maxWeight
  };

  if (editingRecord) {
    const idx = currentWorkoutExercises.findIndex(ex => ex.id === editingRecord.id);
    if (idx > -1) currentWorkoutExercises[idx] = newExercise;
    else currentWorkoutExercises.push(newExercise);
  } else {
    currentWorkoutExercises.push(newExercise);
  }

  renderCurrentWorkoutList();
  resetLoggerForm();
}

function renderCurrentWorkoutList() {
  const listContainer = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  list.innerHTML = "";

  if (currentWorkoutExercises.length > 0) {
    listContainer.style.display = "block";
    currentWorkoutExercises.forEach((ex, index) => {
      const item = document.createElement("div");
      item.className = "workout-item";
      const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""}`;
      item.innerHTML = `
        <strong>${ex.name}</strong> <small>(${meta})</small><br>
        ${ex.sets} sets of ${ex.reps} reps. Heaviest: ${ex.maxWeight}kg
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

// ===== Save / Update session =====
function resetLoggerForm() {
  editingRecord = null;
  document.getElementById("edit-mode-message").style.display = "none";
  document.getElementById("workout-type-select").value = "";
  document.getElementById("work-on-select").value = "";
  document.getElementById("muscle-select-group").style.display = "none";
  document.getElementById("muscle-select").value = "";
  document.getElementById("equipment-select").innerHTML = `<option value="">--Select--</option>`;
  document.getElementById("exercise-select").innerHTML = `<option value="">--Select--</option>`;
  document.getElementById("sets-input").value = "3";
  document.getElementById("reps-input").value = "10";
  renderSetWeightInputs();
  document.getElementById("add-exercise-btn").textContent = "Add Exercise to Session";
  document.getElementById("save-session-btn").textContent = "Save Entire Session";
}

function saveSession() {
  const workoutDateTime = document.getElementById('workout-datetime').value;
  if (currentWorkoutExercises.length === 0 || !workoutDateTime) {
    alert("Please add at least one exercise and specify a date/time.");
    return;
  }

  const isUpdating = document.getElementById("save-session-btn").textContent.includes("Update");

  if (isUpdating) {
    updateSavedRecord(currentWorkoutExercises[0], workoutDateTime);
  } else {
    currentWorkoutExercises.forEach(ex => {
      const record = {
        id: ex.id,
        date: workoutDateTime,
        category: ex.category,
        equipment: ex.equipment,
        muscle: ex.muscle,
        sets: ex.sets,
        reps: ex.reps,
        setWeights: ex.setWeights,
        maxWeight: ex.maxWeight
      };
      if (!userWorkoutData[ex.name]) {
        userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
      }
      userWorkoutData[ex.name].records.push(record);
      if (record.maxWeight > userWorkoutData[ex.name].bestWeight) {
        userWorkoutData[ex.name].bestWeight = record.maxWeight;
      }
    });
  }

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert(isUpdating ? "Workout session updated successfully!" : "Workout session saved successfully!");

  currentWorkoutExercises = [];
  renderCurrentWorkoutList();
  resetLoggerForm();
  document.getElementById('workout-datetime').value = new Date().toISOString().slice(0, 16);
}

function updateSavedRecord(updatedRecord, workoutDateTime) {
  if (!editingRecord) return;
  const exerciseName = editingRecord.name;
  const recordId = editingRecord.id;

  const history = userWorkoutData[exerciseName];
  const recordIndex = history.records.findIndex(r => r.id === recordId);

  if (recordIndex > -1) {
    history.records[recordIndex] = {
      ...updatedRecord,
      date: workoutDateTime,
      name: exerciseName,
      id: recordId
    };
    const newMax = Math.max(...history.records.map(r => r.maxWeight));
    history.bestWeight = isFinite(newMax) ? newMax : 0;
  }
  editingRecord = null;
}

// ===== History =====
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
  const sortedRecords = history.records
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Chart data
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
    const weightsString = record.setWeights.join(', ');
    const meta = `${title(record.category)} • ${title(record.equipment)}${record.muscle ? ` • ${record.muscle}` : ""}`;
    listItem.innerHTML = `
      <span>
        <strong>${selectedExercise}</strong> <small>(${meta})</small><br>
        Date: ${dateString} | Sets: ${record.sets} | Reps: ${record.reps} | Weights: ${weightsString}kg
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
  const recordToEdit = history.records.find(record => record.id === recordId);

  if (recordToEdit) {
    showLoggerView();

    editingRecord = recordToEdit;
    document.getElementById("edit-mode-message").style.display = "block";
    document.getElementById("add-exercise-btn").textContent = "Update Exercise";
    document.getElementById("save-session-btn").textContent = "Update Session";

    document.getElementById("workout-datetime").value = recordToEdit.date;

    // Restore selections from the saved record
    document.getElementById("work-on-select").value = recordToEdit.category;
    if (recordToEdit.category === "specific muscle") {
      document.getElementById("muscle-select-group").style.display = "block";
      document.getElementById("muscle-select").value = recordToEdit.muscle || "";
    } else {
      document.getElementById("muscle-select-group").style.display = "none";
    }

    filterEquipment();
    document.getElementById("equipment-select").value = recordToEdit.equipment;
    filterExercises();
    document.getElementById("exercise-select").value = exerciseName;

    document.getElementById("sets-input").value = recordToEdit.sets;
    document.getElementById("reps-input").value = recordToEdit.reps;

    renderSetWeightInputs();
    const setWeightInputs = document.querySelectorAll('.set-weight-input');
    recordToEdit.setWeights.forEach((weight, index) => {
      if (setWeightInputs[index]) setWeightInputs[index].value = weight;
    });

    currentWorkoutExercises = [recordToEdit];
    renderCurrentWorkoutList();
  }
    }
