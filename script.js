// ========================================================
// Workout Logger — Full JS (Part 1)
// ========================================================

// --- State ---
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let currentStep = 1;
let editingRecord = null;
let myChart;

// preserve wizard step + scroll positions
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

// ========================================================
// Init
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
  populateWorkoutTypeDropdown();
  populateWorkOnDropdown();
  populateMuscleDropdown();
  goToStep(1);
  updateReviewButtonState();

  document.getElementById("workout-datetime").value = new Date().toISOString().slice(0, 16);

  // nav events
  document.getElementById("next-btn").addEventListener("click", nextStep);
  document.getElementById("prev-btn").addEventListener("click", prevStep);
  document.getElementById("add-exercise-btn").addEventListener("click", addExerciseToWorkout);
  document.getElementById("edit-exercises-btn").addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn").addEventListener("click", saveSession);

  document.getElementById("to-history").addEventListener("click", showHistoryView);
  document.getElementById("to-logger").addEventListener("click", showLoggerView);

  // step 2 toggle
  document.querySelectorAll("input[name='timing']").forEach(radio => {
    radio.addEventListener("change", e => {
      const dateInput = document.getElementById("workout-datetime");
      if (e.target.value === "now") {
        dateInput.value = new Date().toISOString().slice(0, 16);
        dateInput.disabled = true;
      } else {
        dateInput.disabled = false;
      }
    });
  });
});

// ========================================================
// Navigation
// ========================================================
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
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
      const s5Hint = document.getElementById("s5-hint");
      if (s5Hint) s5Hint.textContent = "Please add at least one exercise before reviewing your session.";
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
// Dropdown population
// ========================================================
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
  const categories = [...new Set(exercisesData.flatMap(e => e.categories))];
  workOnSelect.innerHTML =
    `<option value="">--Select--</option>` +
    categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function populateMuscleDropdown() {
  const muscleSelect = document.getElementById("muscle-select");
  const muscles = [
    "Abs","Biceps","Calves","Chest","Forearms","Front Delts","Glute Max","Glute Med",
    "Hamstrings","Lats","Lower Back","Mid Delts","Quads","Rear Delts","Traps","Triceps","Upper Back"
  ].sort();
  muscleSelect.innerHTML = `<option value="">--Select--</option>` +
    muscles.map(m => `<option value="${m}">${m}</option>`).join('');
}

function populateEquipment() {
  const selectedCategory = document.getElementById("work-on-select").value;
  const selectedType = document.getElementById("workout-type-select").value;
  const equipmentSelect = document.getElementById("equipment-select");

  let filtered = exercisesData.filter(e => e.categories.includes(selectedCategory));
  if (selectedType === "home") {
    filtered = filtered.filter(e => ["body weight","resistance bands","kettlebell"].includes(e.equipment));
  }
  const eqs = [...new Set(filtered.map(e => e.equipment))];
  equipmentSelect.innerHTML = `<option value="">--Select--</option>` +
    eqs.map(eq => `<option value="${eq}">${eq}</option>`).join('');
}

function populateExercises() {
  const category = document.getElementById("work-on-select").value;
  const equipment = document.getElementById("equipment-select").value;
  const exerciseSelect = document.getElementById("exercise-select");

  let filtered = exercisesData.filter(e =>
    e.categories.includes(category) && e.equipment === equipment
  );
  exerciseSelect.innerHTML = `<option value="">--Select--</option>` +
    filtered.map(ex => `<option value="${ex.name}">${ex.name}</option>`).join('');

  // Add unilateral toggle if not already present
  if (!document.getElementById("unilateral-toggle")) {
    const container = exerciseSelect.parentElement;
    const div = document.createElement("div");
    div.className = "form-group";
    div.innerHTML = `
      <label><input type="checkbox" id="unilateral-toggle"> Unilateral exercise</label>
    `;
    container.appendChild(div);
  }

  // Set input events
  document.getElementById("sets-input").addEventListener("change", renderSetWeightInputs);
  exerciseSelect.addEventListener("change", renderSetWeightInputs);
  document.getElementById("unilateral-toggle").addEventListener("change", renderSetWeightInputs);

  renderSetWeightInputs();
}

// ========================================================
// Set inputs + prev markers
// ========================================================
function renderSetWeightInputs() {
  const numSets = parseInt(document.getElementById("sets-input").value);
  const unilateral = document.getElementById("unilateral-toggle")?.checked;
  const container = document.getElementById("sets-grid");
  container.innerHTML = "";

  const exerciseName = document.getElementById("exercise-select").value;
  const history = userWorkoutData[exerciseName];
  const lastRecord = history ? history.records[history.records.length - 1] : null;

  if (!numSets || !exerciseName) return;

  if (!unilateral) {
    // --- Bilateral exercise ---
    for (let i = 0; i < numSets; i++) {
      const row = document.createElement("div");
      row.className = "set-row";

      const prevWeight = lastRecord?.setWeights?.[i] ?? null;
      const prevReps = lastRecord?.reps ?? null;
      const prevLabel = (prevWeight && prevReps)
        ? `${prevWeight}kg × ${prevReps}`
        : (prevWeight ? `${prevWeight}kg` : "-");

      row.innerHTML = `
        <input type="number" class="rep-input" placeholder="Reps" min="1">
        <div class="prev-weight">${prevLabel}</div>
        <input type="number" class="set-weight-input" placeholder="Weight (kg)" min="0">
      `;
      container.appendChild(row);
    }
  } else {
    // --- Unilateral exercise (Left + Right) ---
    ["Left","Right"].forEach(side => {
      const sideLabel = document.createElement("h4");
      sideLabel.textContent = side + " side";
      container.appendChild(sideLabel);

      for (let i = 0; i < numSets; i++) {
        const row = document.createElement("div");
        row.className = "set-row";

        const prevSide = lastRecord?.[side.toLowerCase()+"SetWeights"]?.[i] ?? null;
        const prevReps = lastRecord?.reps ?? null;
        const prevLabel = (prevSide && prevReps)
          ? `${prevSide}kg × ${prevReps}`
          : (prevSide ? `${prevSide}kg` : "-");

        row.innerHTML = `
          <input type="number" class="rep-input" placeholder="Reps" min="1">
          <div class="prev-weight">${prevLabel}</div>
          <input type="number" class="set-weight-input" data-side="${side}" placeholder="Weight (kg)" min="0">
        `;
        container.appendChild(row);
      }
    });
  }
       }
// ========================================================
// Add/remove exercises
// ========================================================
function addExerciseToWorkout() {
  const exerciseName = document.getElementById("exercise-select").value;
  const sets = parseInt(document.getElementById("sets-input").value);
  const repsInputs = Array.from(document.querySelectorAll(".rep-input"));
  const weightInputs = Array.from(document.querySelectorAll(".set-weight-input"));
  const unilateral = document.getElementById("unilateral-toggle")?.checked;

  if (!exerciseName || !sets || repsInputs.some(r => !r.value) || weightInputs.every(w => !w.value)) {
    alert("Please complete exercise, reps and weights.");
    return;
  }

  const newExercise = {
    id: Date.now().toString(),
    name: exerciseName,
    sets: sets,
    reps: parseInt(repsInputs[0].value),
    maxWeight: 0
  };

  if (!unilateral) {
    newExercise.setWeights = weightInputs.map(w => parseFloat(w.value) || 0);
    newExercise.maxWeight = Math.max(...newExercise.setWeights);
  } else {
    const lefts = weightInputs.filter(w => w.dataset.side === "Left").map(w => parseFloat(w.value) || 0);
    const rights = weightInputs.filter(w => w.dataset.side === "Right").map(w => parseFloat(w.value) || 0);
    newExercise.leftSetWeights = lefts;
    newExercise.rightSetWeights = rights;
    newExercise.maxWeight = Math.max(...lefts.concat(rights));
  }

  currentWorkoutExercises.push(newExercise);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

function renderCurrentWorkoutList() {
  const listContainer = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  list.innerHTML = "";
  if (currentWorkoutExercises.length > 0) {
    listContainer.style.display = "block";
    currentWorkoutExercises.forEach((ex, idx) => {
      const div = document.createElement("div");
      div.className = "workout-item";
      div.innerHTML = `
        ${ex.name}: ${ex.sets} sets × ${ex.reps} reps. Heaviest: ${ex.maxWeight}kg
        <button onclick="removeExerciseFromWorkout(${idx})">Remove</button>
      `;
      list.appendChild(div);
    });
  } else {
    listContainer.style.display = "none";
  }
}

function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index,1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

// ========================================================
// Review summary
// ========================================================
function buildSessionSummary() {
  const summaryMeta = document.getElementById("summary-meta");
  const summaryExercises = document.getElementById("summary-exercises");
  summaryMeta.innerHTML = `<p><strong>Date:</strong> ${document.getElementById("workout-datetime").value}</p>`;
  summaryExercises.innerHTML = "";

  currentWorkoutExercises.forEach(ex => {
    const history = userWorkoutData[ex.name];
    const lastRecord = history ? history.records[history.records.length-1] : null;
    const bestRecord = history ? history.records.find(r => r.maxWeight === history.bestWeight) : null;

    const change = lastRecord ? (ex.maxWeight - lastRecord.maxWeight) : 0;
    const changeStr = !lastRecord ? "" :
      change > 0 ? `↑ ${change}kg` :
      change < 0 ? `↓ ${Math.abs(change)}kg` : "same";

    const row = document.createElement("div");
    row.className = "summary-exercise";
    row.innerHTML = `
      <strong>${ex.name}</strong><br>
      This: ${ex.maxWeight}kg × ${ex.reps}<br>
      Last: ${lastRecord ? lastRecord.maxWeight + "kg × " + lastRecord.reps : "-"}<br>
      Best: ${bestRecord ? bestRecord.maxWeight + "kg × " + bestRecord.reps + " (" + new Date(bestRecord.date).toLocaleDateString() + ")" : "-"}<br>
      Change vs last: ${changeStr}
    `;
    summaryExercises.appendChild(row);
  });
           }
// ========================================================
// Save Session
// ========================================================
function saveSession() {
  const workoutDateTime = document.getElementById("workout-datetime").value;
  if (!workoutDateTime || currentWorkoutExercises.length === 0) {
    alert("Please complete your session.");
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

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Session saved!");
  currentWorkoutExercises = [];
  renderCurrentWorkoutList();
  goToStep(1);
}

// ========================================================
// History View
// ========================================================
function showHistoryView() {
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
  const recordedExercises = Object.keys(userWorkoutData);
  historySelect.innerHTML = `<option value="">--Select an Exercise--</option>` +
    recordedExercises.map(ex => `<option value="${ex}">${ex}</option>`).join('');
  document.getElementById("history-details").style.display = "none";
}

function displayExerciseHistory() {
  const selectedExercise = document.getElementById("history-select").value;
  const historyDetails = document.getElementById("history-details");
  if (!selectedExercise) {
    historyDetails.style.display = "none";
    return;
  }

  historyDetails.style.display = "block";
  const history = userWorkoutData[selectedExercise];
  document.getElementById("best-weight-title").textContent = `Best Weight: ${history.bestWeight}kg`;

  const sortedRecords = history.records.sort((a,b) => new Date(a.date) - new Date(b.date));
  const dates = sortedRecords.map(r => new Date(r.date).toLocaleDateString());
  const maxWeights = sortedRecords.map(r => r.maxWeight);

  if (myChart) myChart.destroy();
  const ctx = document.getElementById("history-chart").getContext("2d");
  myChart = new Chart(ctx, {
    type: 'line',
    data: { 
      labels: dates, 
      datasets:[{
        label:'Heaviest (kg)',
        data:maxWeights,
        borderColor:'orange',
        fill:true,
        backgroundColor:'rgba(255,165,0,0.2)'
      }] 
    },
    options: { 
      responsive:true, 
      maintainAspectRatio:false,
      scales:{
        x:{ ticks:{ color:'white' }, title:{ display:true,text:'Date',color:'white'} },
        y:{ ticks:{ color:'white' }, title:{ display:true,text:'Weight (kg)',color:'white'} }
      },
      plugins:{ legend:{ labels:{ color:'white'} } }
    }
  });

  const historyLog = document.getElementById("history-log");
  historyLog.innerHTML = "";
  sortedRecords.forEach(record => {
    const li = document.createElement("li");
    const weightsStr = record.setWeights ? record.setWeights.join(", ") : "";
    li.innerHTML = `
      <span>Date: ${new Date(record.date).toLocaleString()} | Sets: ${record.sets} | Reps: ${record.reps} | Weights: ${weightsStr}</span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${selectedExercise}','${record.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${selectedExercise}','${record.id}')">Delete</button>
      </div>
    `;
    historyLog.appendChild(li);
  });
}

// ========================================================
// Edit/Delete Records
// ========================================================
function deleteRecord(exerciseName, recordId) {
  if (confirm("Are you sure you want to delete this record?")) {
    const history = userWorkoutData[exerciseName];
    history.records = history.records.filter(r => r.id !== recordId);

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
  const recordToEdit = history.records.find(r => r.id === recordId);
  
  if (recordToEdit) {
    showLoggerView();
    editingRecord = recordToEdit;
    document.getElementById("edit-mode-message").style.display = "block";
    document.getElementById("add-exercise-btn").textContent = "Update Exercise";
    document.getElementById("save-session-btn").textContent = "Update Session";

    document.getElementById("workout-datetime").value = recordToEdit.date;
    document.getElementById("work-on-select").value = exercisesData.find(e => e.name === exerciseName).categories[0];
    filterEquipment();
    document.getElementById("equipment-select").value = exercisesData.find(e => e.name === exerciseName).equipment;
    populateExercises();
    document.getElementById("exercise-select").value = exerciseName;

    document.getElementById("sets-input").value = recordToEdit.sets;
    renderSetWeightInputs();

    const repInputs = document.querySelectorAll(".rep-input");
    repInputs.forEach(r => r.value = recordToEdit.reps);

    const weightInputs = document.querySelectorAll(".set-weight-input");
    if (recordToEdit.setWeights) {
      recordToEdit.setWeights.forEach((w,i) => { if(weightInputs[i]) weightInputs[i].value = w; });
    }
    if (recordToEdit.leftSetWeights) {
      let i=0; weightInputs.forEach(w => { if(w.dataset.side==="Left") { w.value = recordToEdit.leftSetWeights[i++] || ""; } });
    }
    if (recordToEdit.rightSetWeights) {
      let i=0; weightInputs.forEach(w => { if(w.dataset.side==="Right") { w.value = recordToEdit.rightSetWeights[i++] || ""; } });
    }

    currentWorkoutExercises = [recordToEdit];
    renderCurrentWorkoutList();
  }
}
// ========================================================
// Validation + Utilities
// ========================================================

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
      return true;
    }
    case 4: {
      const eq = document.getElementById("equipment-select").value;
      if (!eq) { alert("Please select equipment."); return false; }
      return true;
    }
    case 5: {
      // handled separately in nextStep
      return true;
    }
    default: return true;
  }
}

// ========================================================
// Reset Logger Form (after save/edit)
// ========================================================
function resetLoggerForm() {
  editingRecord = null;
  document.getElementById("edit-mode-message").style.display = "none";
  document.getElementById("workout-type-select").value = "";
  document.getElementById("work-on-select").value = "";
  document.getElementById("muscle-select").value = "";
  document.getElementById("equipment-select").innerHTML = `<option value="">--Select--</option>`;
  document.getElementById("exercise-select").innerHTML = `<option value="">--Select--</option>`;
  document.getElementById("sets-input").value = "3";
  renderSetWeightInputs();
  document.getElementById("add-exercise-btn").textContent = "Add Exercise to Session";
  document.getElementById("save-session-btn").textContent = "Save Entire Session";
}

// ========================================================
// Debug helpers (optional)
// ========================================================
function dumpData() {
  console.log("User workout data:", userWorkoutData);
}
function clearData() {
  if (confirm("Clear ALL workout data?")) {
    localStorage.removeItem("userWorkoutData");
    userWorkoutData = {};
    currentWorkoutExercises = [];
    renderCurrentWorkoutList();
    alert("All data cleared.");
  }
}

// ========================================================
// End of script.js
// ========================================================
