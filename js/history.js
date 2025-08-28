/* ======================================
   history.js — history view, chart, edit/delete
====================================== */
window.showHistoryView = function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");

  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
};
window.showLoggerView = function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
};

window.populateHistoryDropdown = function populateHistoryDropdown() {
  const historySelect = document.getElementById("history-select");
  const recordedExercises = Object.keys(userWorkoutData);
  historySelect.innerHTML =
    `<option value="">--Select an Exercise--</option>` +
    recordedExercises.map((ex) => `<option value="${ex}">${ex}</option>`).join("");
  document.getElementById("history-details").style.display = "none";
};

window.displayExerciseHistory = function displayExerciseHistory() {
  const selectedExercise = document.getElementById("history-select").value;
  const historyDetails = document.getElementById("history-details");
  const bestWeightTitle = document.getElementById("best-weight-title");
  const historyLog = document.getElementById("history-log");
  if (!selectedExercise) { historyDetails.style.display = "none"; return; }

  historyDetails.style.display = "block";
  const history = userWorkoutData[selectedExercise];

  bestWeightTitle.textContent = `Best Weight: ${history.bestWeight}kg`;

  const sortedRecords = history.records.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const dates = sortedRecords.map((r) => new Date(r.date).toLocaleDateString());
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
      responsive: true, maintainAspectRatio: false,
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

    let details = "";
    if (record.movementType === "unilateral" && record.setWeightsL && record.setWeightsR) {
      const pairsL = record.setRepsL.map((r, i) => `${r}x${record.setWeightsL[i]}kg`).join(", ");
      const pairsR = record.setRepsR.map((r, i) => `${r}x${record.setWeightsR[i]}kg`).join(", ");
      const maxL = Math.max(...record.setWeightsL);
      const maxR = Math.max(...record.setWeightsR);
      const cL = record.setWeightsL.filter(w => w === maxL).length;
      const cR = record.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL}</div>
        <div><em>Right:</em> ${pairsR}</div>
        <div>Heaviest Left: ${maxL}kg for ${cL} set(s) • Heaviest Right: ${maxR}kg for ${cR} set(s)</div>
      `;
    } else {
      const pairs = record.setReps
        ? record.setReps.map((r, i) => `${r}x${record.setWeights[i]}kg`).join(", ")
        : `Reps: ${record.reps} | Weights: ${record.setWeights.join(", ")}kg`;
      details = `
        <div>Sets: ${record.sets} → ${pairs}</div>
        <div>Heaviest: ${record.maxWeight}kg${record.maxWeightSetCount ? ` for ${record.maxWeightSetCount} set(s)` : ""}</div>
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
        <button class="edit-btn" onclick="editRecord('${selectedExercise}', '${record.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${selectedExercise}', '${record.id}')">Delete</button>
      </div>
    `;
    historyLog.appendChild(li);
  });
};

window.deleteRecord = function deleteRecord(exerciseName, recordId) {
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
};

window.editRecord = function editRecord(exerciseName, recordId) {
  const history = userWorkoutData[exerciseName];
  const record = history.records.find((r) => r.id === recordId);
  if (!record) return;

  wizard.location = HOME_EQUIPMENT.includes(record.equipment) ? "home" : "gym";
  wizard.timing = "past";
  wizard.datetime = record.date;
  wizard.category = record.category || "";
  wizard.muscle = record.muscle || "";
  wizard.equipment = record.equipment || "";
  wizard.exercise = exerciseName;
  wizard.movementType = record.movementType || "bilateral";

  wizard.sets = record.sets || 3;

  if (wizard.movementType === "unilateral" && record.setWeightsL && record.setWeightsR) {
    wizard.setRepsL = (record.setRepsL || []).slice();
    wizard.setWeightsL = (record.setWeightsL || []).slice();
    wizard.setRepsR = (record.setRepsR || []).slice();
    wizard.setWeightsR = (record.setWeightsR || []).slice();
    wizard.setReps = []; wizard.setWeights = [];
  } else {
    wizard.setReps = (record.setReps || []).slice();
    wizard.setWeights = (record.setWeights || []).slice();
    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  const recWeights = (function(){
    if (record.setWeightsL && record.setWeightsR) return [...record.setWeightsL, ...record.setWeightsR];
    return Array.isArray(record.setWeights) ? record.setWeights : [];
  })();
  const maxW = recWeights.length ? Math.max(...recWeights) : (record.maxWeight || 0);
  wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
  wizard.maxWeightSetCount = recWeights.filter(w => w === wizard.maxWeight).length || (record.maxWeightSetCount || 0);

  editingRecord = record;

  showLoggerView();

  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = wizard.location;
  const pastRadio = document.querySelector('input[name="timing"][value="past"]'); if (pastRadio) pastRadio.checked = true;
  const dt = document.getElementById("workout-datetime"); if (dt) { dt.removeAttribute("disabled"); dt.value = wizard.datetime; }
  const catSel = document.getElementById("work-on-select"); if (catSel) catSel.value = wizard.category;

  const muscleGroup = document.getElementById("muscle-select-group");
  const muscleSel = document.getElementById("muscle-select");
  if (wizard.category === "specific muscle") { if (muscleGroup) muscleGroup.style.display = "block"; if (muscleSel) muscleSel.value = wizard.muscle; }
  else { if (muscleGroup) muscleGroup.style.display = "none"; }

  populateEquipment();
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.value = wizard.equipment;
  populateExercises();
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.value = wizard.exercise;

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
    id: record.id, date: wizard.datetime, name: wizard.exercise, category: wizard.category,
    equipment: wizard.equipment, muscle: wizard.muscle || null, movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(), setWeights: wizard.setWeights.slice(),
    setRepsL: wizard.setRepsL.slice(), setWeightsL: wizard.setWeightsL.slice(),
    setRepsR: wizard.setRepsR.slice(), setWeightsR: wizard.setWeightsR.slice(),
    maxWeight: wizard.maxWeight, maxWeightSetCount: wizard.maxWeightSetCount
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();

  goToStep(5);
  const editMsg = document.getElementById("edit-mode-message"); if (editMsg) editMsg.style.display = "block";
};
