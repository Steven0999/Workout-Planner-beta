/* =======================================================================
   sets.js
   Builds the Step 5 sets UI, shows per-set "Prev: 50kg × 10" markers,
   validates & reads inputs, and adds the exercise to the session—without
   clearing the user’s current selection (exercise / unilateral / sets).
   Depends on:
     - wizard, userWorkoutData, currentWorkoutExercises
     - renderCurrentWorkoutList(), updateReviewButtonState()
     - getExerciseRecordsDesc(), showExerciseInsights()
     - toInt(), toFloat(), isFiniteNum(), trimZeros()
======================================================================= */

/* ---------- Prev markers (weight × reps) pulled from LAST record ---------- */
window.computePrevPerSet = function computePrevPerSet(exName, movementType, setsCount) {
  const blanks = Array(setsCount).fill("");

  if (!exName) {
    return movementType === "unilateral"
      ? { prevL: blanks.slice(), prevR: blanks.slice() }
      : { prev: blanks.slice() };
  }

  const last = getExerciseRecordsDesc(exName)[0];
  if (!last) {
    return movementType === "unilateral"
      ? { prevL: blanks.slice(), prevR: blanks.slice() }
      : { prev: blanks.slice() };
  }

  const pairWR = (w, r) => {
    const hasW = typeof w === "number" && Number.isFinite(w);
    const hasR = typeof r === "number" && Number.isFinite(r);
    if (hasW && hasR) return `${trimZeros(w)}kg × ${trimZeros(r)}`;
    if (hasW) return `${trimZeros(w)}kg`;
    if (hasR) return `× ${trimZeros(r)}`;
    return "";
  };

  if (movementType === "unilateral") {
    const prevL = blanks.slice();
    const prevR = blanks.slice();

    // Prefer true L/R arrays if present
    if (Array.isArray(last.setWeightsL) || Array.isArray(last.setRepsL)) {
      for (let i = 0; i < setsCount; i++) {
        const w = Array.isArray(last.setWeightsL) ? last.setWeightsL[i] : null;
        const r = Array.isArray(last.setRepsL) ? last.setRepsL[i] : null;
        const s = pairWR(w, r);
        if (s) prevL[i] = s;
      }
    }
    if (Array.isArray(last.setWeightsR) || Array.isArray(last.setRepsR)) {
      for (let i = 0; i < setsCount; i++) {
        const w = Array.isArray(last.setWeightsR) ? last.setWeightsR[i] : null;
        const r = Array.isArray(last.setRepsR) ? last.setRepsR[i] : null;
        const s = pairWR(w, r);
        if (s) prevR[i] = s;
      }
    }

    // Fallback: mirror bilateral history to both sides
    if (prevL.every(v => v === "") && prevR.every(v => v === "")) {
      if (Array.isArray(last.setWeights) || Array.isArray(last.setReps)) {
        for (let i = 0; i < setsCount; i++) {
          const w = Array.isArray(last.setWeights) ? last.setWeights[i] : null;
          const r = Array.isArray(last.setReps) ? last.setReps[i] : null;
          const s = pairWR(w, r);
          if (s) { prevL[i] = s; prevR[i] = s; }
        }
      } else if (isFiniteNum(last.maxWeight)) {
        const s = `${trimZeros(last.maxWeight)}kg`;
        prevL.fill(s); prevR.fill(s);
      }
    }
    return { prevL, prevR };
  }

  // Bilateral
  const prev = blanks.slice();
  if (Array.isArray(last.setWeights) || Array.isArray(last.setReps)) {
    for (let i = 0; i < setsCount; i++) {
      const w = Array.isArray(last.setWeights) ? last.setWeights[i] : null;
      const r = Array.isArray(last.setReps) ? last.setReps[i] : null;
      const s = pairWR(w, r);
      if (s) prev[i] = s;
    }
  } else if (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)) {
    // If last was unilateral, choose heavier side (and its reps) per index
    for (let i = 0; i < setsCount; i++) {
      const wL = Array.isArray(last.setWeightsL) ? last.setWeightsL[i] : null;
      const rL = Array.isArray(last.setRepsL) ? last.setRepsL[i] : null;
      const wR = Array.isArray(last.setWeightsR) ? last.setWeightsR[i] : null;
      const rR = Array.isArray(last.setRepsR) ? last.setRepsR[i] : null;

      let w = null, r = null;
      if (isFiniteNum(wL) && isFiniteNum(wR)) { w = Math.max(wL, wR); r = (w === wL ? rL : rR); }
      else if (isFiniteNum(wL)) { w = wL; r = rL; }
      else if (isFiniteNum(wR)) { w = wR; r = rR; }

      const s = pairWR(w, r);
      if (s) prev[i] = s;
    }
  } else if (isFiniteNum(last.maxWeight)) {
    const s = `${trimZeros(last.maxWeight)}kg`;
    prev.fill(s);
  }
  return { prev };
};

/* --------------------------- Render the rows --------------------------- */
window.renderSetRows = function renderSetRows() {
  const setsInputEl = document.getElementById("sets-input");
  const n = Math.max(1, toInt(setsInputEl?.value ?? 1, 1));
  wizard.sets = n;

  // Ensure container
  let container = document.getElementById("sets-grids-wrapper");
  if (!container) {
    container = document.createElement("div");
    container.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    if (anchor) anchor.appendChild(container);
  }
  container.innerHTML = "";

  // Prev markers
  const prev = window.computePrevPerSet(wizard.exercise, wizard.movementType, n);

  if (wizard.movementType === "unilateral") {
    // LEFT
    const leftBlock = document.createElement("div");
    leftBlock.className = "form-group";
    leftBlock.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(leftBlock);
    const gridL = leftBlock.querySelector("#sets-grid-left");

    for (let i = 1; i <= n; i++) {
      const prevValL = (prev.prevL && prev.prevL[i - 1]) ? prev.prevL[i - 1] : "";
      const rowL = document.createElement("div");
      rowL.className = "set-row";
      rowL.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)"
               data-side="L" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevValL || "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (L)"
               data-side="L" data-kind="weight" data-idx="${i - 1}">
      `;
      gridL.appendChild(rowL);
    }

    // RIGHT
    const rightBlock = document.createElement("div");
    rightBlock.className = "form-group";
    rightBlock.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    container.appendChild(rightBlock);
    const gridR = rightBlock.querySelector("#sets-grid-right");

    for (let i = 1; i <= n; i++) {
      const prevValR = (prev.prevR && prev.prevR[i - 1]) ? prev.prevR[i - 1] : "";
      const rowR = document.createElement("div");
      rowR.className = "set-row";
      rowR.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)"
               data-side="R" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevValR || "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)"
               data-side="R" data-kind="weight" data-idx="${i - 1}">
      `;
      gridR.appendChild(rowR);
    }

    // Prefill if editing
    if (wizard.setRepsL?.length === n && wizard.setWeightsL?.length === n) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsL[i] ?? "");
    }
    if (wizard.setRepsR?.length === n && wizard.setWeightsR?.length === n) {
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsR[i] ?? "");
    }

  } else {
    // BILATERAL
    const single = document.createElement("div");
    single.className = "form-group";
    single.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    container.appendChild(single);
    const grid = single.querySelector("#sets-grid");

    for (let i = 1; i <= n; i++) {
      const prevVal = (prev.prev && prev.prev[i - 1]) ? prev.prev[i - 1] : "";
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps"
               data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevVal || "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)"
               data-kind="weight" data-idx="${i - 1}">
      `;
      grid.appendChild(row);
    }

    // Prefill if editing
    if (wizard.setReps?.length === n && wizard.setWeights?.length === n) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");
    }
  }
};

/* ---------------------- Read grid → wizard + compute max ---------------------- */
function readSetsIntoWizard() {
  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value ?? 1, 1));
  wizard.sets = n;

  if (wizard.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    wizard.setRepsL = repsL; wizard.setWeightsL = wtsL;
    wizard.setRepsR = repsR; wizard.setWeightsR = wtsR;
    wizard.setReps = []; wizard.setWeights = [];

    const maxL = wtsL.length ? Math.max(...wtsL) : 0;
    const maxR = wtsR.length ? Math.max(...wtsR) : 0;
    const maxW = Math.max(maxL, maxR);

    wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
    wizard.maxWeightSetCount = [...wtsL, ...wtsR].filter(w => w === wizard.maxWeight).length || 0;
    return;
  }

  // Bilateral
  const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i => toInt(i.value));
  const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i => toFloat(i.value));

  wizard.setReps = reps; wizard.setWeights = wts;
  wizard.setRepsL = []; wizard.setWeightsL = [];
  wizard.setRepsR = []; wizard.setWeightsR = [];

  const maxW = wts.length ? Math.max(...wts) : 0;
  wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
  wizard.maxWeightSetCount = wts.filter(w => w === wizard.maxWeight).length || 0;
}

/* -------------------------- Validate visible grid -------------------------- */
function validateCurrentSetGrid() {
  const hint = document.getElementById("s5-hint");
  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value ?? 1, 1));

  if (!wizard.exercise) {
    if (hint) hint.textContent = "Choose an exercise.";
    return false;
  }

  if (wizard.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    const ok =
      repsL.length === n && wtsL.length === n &&
      repsR.length === n && wtsR.length === n &&
      repsL.every(v => v > 0) && wtsL.every(v => v >= 0) &&
      repsR.every(v => v > 0) && wtsR.every(v => v >= 0);

    if (!ok) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right.";
      return false;
    }
  } else {
    const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i => toInt(i.value));
    const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i => toFloat(i.value));

    const ok =
      reps.length === n && wts.length === n &&
      reps.every(v => v > 0) && wts.every(v => v >= 0);

    if (!ok) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return false;
    }
  }

  if (hint) hint.textContent = "";
  return true;
}

/* ----------------------------- Add to session ----------------------------- */
window.addExerciseToWorkout = function addExerciseToWorkout() {
  if (!validateCurrentSetGrid()) return;

  // Read inputs into wizard & compute max
  readSetsIntoWizard();

  const ex = {
    id: Date.now().toString(),
    date: wizard.datetime,
    name: wizard.exercise,
    category: wizard.category,
    equipment: wizard.equipment,
    muscle: wizard.category === "specific muscle" ? wizard.muscle : null,
    movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: (wizard.setReps || []).slice(),
    setWeights: (wizard.setWeights || []).slice(),
    setRepsL: (wizard.setRepsL || []).slice(),
    setWeightsL: (wizard.setWeightsL || []).slice(),
    setRepsR: (wizard.setRepsR || []).slice(),
    setWeightsR: (wizard.setWeightsR || []).slice(),
    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount
  };

  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();
  updateReviewButtonState();

  // IMPORTANT: Keep selection. Only clear input arrays & re-render.
  wizard.setReps = []; wizard.setWeights = [];
  wizard.setRepsL = []; wizard.setWeightsL = [];
  wizard.setRepsR = []; wizard.setWeightsR = [];
  wizard.maxWeight = 0; wizard.maxWeightSetCount = 0;

  renderSetRows(); // stays visible with Prev for the same exercise

  const info = document.getElementById("exercise-insights");
  if (info && typeof showExerciseInsights === "function") {
    showExerciseInsights(wizard.exercise);
  }
};

/* ------------------------------ Small utils ------------------------------ */
function isFiniteNum(x){ return typeof x === "number" && Number.isFinite(x); }
function trimZeros(n){
  if (!isFiniteNum(n)) return n;
  const s = String(n);
  return s.includes(".")
    ? s.replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1")
    : s;
        }
