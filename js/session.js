/* ======================================
   session.js — validate step 5, build review, add/remove, save
====================================== */
window.validateAndStoreStep5 = function validateAndStoreStep5() {
  const hint = document.getElementById("s5-hint");
  const exercise = document.getElementById("exercise-select").value;
  if (!exercise) { if (hint) hint.textContent = "Choose an exercise."; return false; }
  wizard.exercise = exercise;

  const n = Math.max(1, toInt(document.getElementById("sets-input").value, 1));
  wizard.sets = n;

  if (wizard.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
        repsL.some(v => v <= 0) || wtsL.some(v => v < 0) || repsR.some(v => v <= 0) || wtsR.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right sides.";
      return false;
    }

    wizard.setRepsL = repsL; wizard.setWeightsL = wtsL;
    wizard.setRepsR = repsR; wizard.setWeightsR = wtsR;

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    const overallMax = Math.max(maxL, maxR);
    const countOverall = [...wtsL, ...wtsR].filter(w => w === overallMax).length;

    wizard.maxWeight = overallMax;
    wizard.maxWeightSetCount = countOverall;

    wizard.setReps = []; wizard.setWeights = [];

  } else {
    const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i => toInt(i.value));
    const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i => toFloat(i.value));

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
};

window.addExerciseToWorkout = function addExerciseToWorkout() {
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

  // reset inline inputs
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  window.exerciseSearchTerm = ""; const s = document.getElementById("exercise-search"); if (s) s.value = "";

  wizard.exercise = ""; wizard.sets = 3;
  wizard.movementType = "bilateral";
  wizard.setReps = []; wizard.setWeights = [];
  wizard.setRepsL = []; wizard.setWeightsL = [];
  wizard.setRepsR = []; wizard.setWeightsR = [];
  wizard.maxWeight = 0; wizard.maxWeightSetCount = 0;
  renderSetRows();

  updateReviewButtonState();
};

window.renderCurrentWorkoutList = function renderCurrentWorkoutList() {
  const wrap = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  list.innerHTML = "";
  if (currentWorkoutExercises.length > 0) {
    wrap.style.display = "block";
    currentWorkoutExercises.forEach((ex, idx) => {
      let details = "";
      if (ex.movementType === "unilateral") {
        const pairsL = ex.setRepsL.map((r, i) => `${r}x${ex.setWeightsL[i]}kg`).join(", ");
        const pairsR = ex.setRepsR.map((r, i) => `${r}x${ex.setWeightsR[i]}kg`).join(", ");
        const maxL = Math.max(...ex.setWeightsL);
        const maxR = Math.max(...ex.setWeightsR);
        const cL = ex.setWeightsL.filter(w => w === maxL).length;
        const cR = ex.setWeightsR.filter(w => w === maxR).length;
        details = `
          <div><em>Left:</em> ${pairsL}</div>
          <div><em>Right:</em> ${pairsR}</div>
          <div>Heaviest Left: ${maxL}kg for ${cL} set(s) • Heaviest Right: ${maxR}kg for ${cR} set(s)</div>
        `;
      } else {
        const pairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
        details = `
          <div>${ex.sets} sets → ${pairs}</div>
          <div>Heaviest: ${ex.maxWeight}kg for ${ex.maxWeightSetCount} set(s)</div>
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
  } else {
    wrap.style.display = "none";
  }
};
window.removeExerciseFromWorkout = function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
};

window.buildSessionSummary = function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${title(wizard.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocalString(wizard.datetime)}</span></div>
  `;

  exWrap.innerHTML = "";
  currentWorkoutExercises.forEach((ex) => {
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
        <div><em>Left:</em> ${pairsL}</div>
        <div><em>Right:</em> ${pairsR}</div>
        <div>Heaviest Left: <strong>${maxL}kg</strong> (${cL} set${cL!==1?"s":""}) • Heaviest Right: <strong>${maxR}kg</strong> (${cR} set${cR!==1?"s":""})</div>
        <div>Overall Heaviest this session: <strong>${ex.maxWeight}kg</strong>${badge}</div>
        <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
        <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
      `;
    } else {
      const pairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
      details = `
        <div>${ex.sets} sets → ${pairs}</div>
        <div>Heaviest this session: <strong>${ex.maxWeight}kg</strong>${badge}</div>
        <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
        <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
      `;
    }

    const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
    const card = document.createElement("div");
    card.className = "summary-exercise";
    card.innerHTML = `<strong>${ex.name}</strong> <small>(${metaLine})</small><br>${details}`;
    exWrap.appendChild(card);
  });

  // Totals
  let totalVolume = 0, totalSets = 0, totalExercises = currentWorkoutExercises.length;
  currentWorkoutExercises.forEach((ex) => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets * 2;
      ex.setRepsL.forEach((r, i) => totalVolume += r * ex.setWeightsL[i]);
      ex.setRepsR.forEach((r, i) => totalVolume += r * ex.setWeightsR[i]);
    } else {
      totalSets += ex.sets;
      ex.setReps.forEach((r, i) => totalVolume += r * ex.setWeights[i]);
    }
  });
  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${totalExercises}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
  `;
};

window.saveSession = function saveSession() {
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
      maxWeight: ex.maxWeight, maxWeightSetCount: ex.maxWeightSetCount
    });
    if (ex.maxWeight > userWorkoutData[ex.name].bestWeight) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  currentWorkoutExercises = []; renderCurrentWorkoutList();

  Object.assign(wizard, {
    location: "", timing: "now", datetime: nowIsoMinute(),
    category: "", muscle: "", equipment: "", exercise: "",
    movementType: "bilateral",
    sets: 3,
    setReps: [], setWeights: [],
    setRepsL: [], setWeightsL: [],
    setRepsR: [], setWeightsR: [],
    maxWeight: 0, maxWeightSetCount: 0
  });

  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = "";
  const nowRadio = document.querySelector('input[name="timing"][value="now"]'); if (nowRadio) nowRadio.checked = true;
  const dtInput = document.getElementById("workout-datetime"); if (dtInput) { dtInput.setAttribute("disabled", "disabled"); dtInput.value = wizard.datetime; }
  const workOn = document.getElementById("work-on-select"); if (workOn) workOn.value = "";
  const musSel = document.getElementById("muscle-select"); if (musSel) musSel.value = "";
  const musGrp = document.getElementById("muscle-select-group"); if (musGrp) musGrp.style.display = "none";
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  const setsInput = document.getElementById("sets-input"); if (setsInput) setsInput.value = "3";
  window.exerciseSearchTerm = ""; const s = document.getElementById("exercise-search"); if (s) s.value = "";
  renderSetRows();

  goToStep(1);
};
