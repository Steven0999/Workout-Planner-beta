/* =======================================================================
   sets.js
   Responsibilities:
     • Build the set-entry grids for Bilateral / Unilateral
     • Show per-set "Prev" markers (now: weight × reps)
     • Read current inputs into the wizard
     • Add the configured exercise to the in-session list
   Depends on globals provided elsewhere:
     - wizard (object with step-5 state)
     - userWorkoutData (history store)
     - currentWorkoutExercises (array)
     - renderCurrentWorkoutList(), updateReviewButtonState()
     - getExerciseRecordsDesc(exName)  // from history/data helpers
     - title(), toInt(), toFloat()     // small utils
======================================================================= */

/* -----------------------------------------------------------------------
   computePrevPerSet(exName, movementType, setsCount)
   Returns per-set previous strings (“50kg × 10”) for last session.
   • Bilateral:   { prev:  [ "W×R", ... ] }
   • Unilateral:  { prevL: [ "W×R", ... ], prevR: [ "W×R", ... ] }
------------------------------------------------------------------------ */
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

  // Helper to pair W & R safely
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

    // If last session had distinct L/R arrays, use them.
    if (Array.isArray(last.setWeightsL) && Array.isArray(last.setRepsL)) {
      for (let i = 0; i < setsCount; i++) {
        const w = i < last.setWeightsL.length ? last.setWeightsL[i] : null;
        const r = i < last.setRepsL.length    ? last.setRepsL[i]    : null;
        const s = pairWR(w, r);
        if (s) prevL[i] = s;
      }
    } else if (Array.isArray(last.setWeights) && Array.isArray(last.setReps)) {
      // Last was bilateral → mirror to both sides as a reference.
      for (let i = 0; i < setsCount; i++) {
        const w = i < last.setWeights.length ? last.setWeights[i] : null;
        const r = i < last.setReps.length    ? last.setReps[i]    : null;
        const s = pairWR(w, r);
        if (s) { prevL[i] = s; prevR[i] = s; }
      }
    } else {
      // Fall back to a maxWeight marker if present.
      if (typeof last.maxWeight === "number" && Number.isFinite(last.maxWeight)) {
        const s = `${trimZeros(last.maxWeight)}kg`;
        for (let i = 0; i < setsCount; i++) { prevL[i] = s; prevR[i] = s; }
      }
    }

    // Right side arrays if present
    if (Array.isArray(last.setWeightsR) && Array.isArray(last.setRepsR)) {
      for (let i = 0; i < setsCount; i++) {
        const w = i < last.setWeightsR.length ? last.setWeightsR[i] : null;
        const r = i < last.setRepsR.length    ? last.setRepsR[i]    : null;
        const s = pairWR(w, r);
        if (s) prevR[i] = s;
      }
    }

    return { prevL, prevR };
  }

  // Bilateral current movement
  const prev = blanks.slice();

  if (Array.isArray(last.setWeights) && Array.isArray(last.setReps)) {
    for (let i = 0; i < setsCount; i++) {
      const w = i < last.setWeights.length ? last.setWeights[i] : null;
      const r = i < last.setReps.length    ? last.setReps[i]    : null;
      const s = pairWR(w, r);
      if (s) prev[i] = s;
    }
  } else if (
    (Array.isArray(last.setWeightsL) && Array.isArray(last.setRepsL)) ||
    (Array.isArray(last.setWeightsR) && Array.isArray(last.setRepsR))
  ) {
    // Last was unilateral → take the heavier/more complete side per set index
    for (let i = 0; i < setsCount; i++) {
      const wL = Array.isArray(last.setWeightsL) && i < last.setWeightsL.length ? last.setWeightsL[i] : null;
      const rL = Array.isArray(last.setRepsL)    && i < last.setRepsL.length    ? last.setRepsL[i]    : null;
      const wR = Array.isArray(last.setWeightsR) && i < last.setWeightsR.length ? last.setWeightsR[i] : null;
      const rR = Array.isArray(last.setRepsR)    && i < last.setRepsR.length    ? last.setRepsR[i]    : null;

      // Prefer heavier weight if both present
      let w = null, r = null;
      if (isFiniteNum(wL) && isFiniteNum(wR)) { w = Math.max(wL, wR); r = (w === wL ? rL : rR); }
      else if (isFiniteNum(wL)) { w = wL; r = rL; }
      else if (isFiniteNum(wR)) { w = wR; r = rR; }

      const s = pairWR(w, r);
      if (s) prev[i] = s;
    }
  } else if (typeof last.maxWeight === "number" && Number.isFinite(last.maxWeight)) {
    const s = `${trimZeros(last.maxWeight)}kg`;
    for (let i = 0; i < setsCount; i++) prev[i] = s;
  }

  return { prev };
};

/* -----------------------------------------------------------------------
   renderSetRows()
   Builds the input grids for sets (and shows "Prev: …" markers).
------------------------------------------------------------------------ */
window.renderSetRows = function renderSetRows() {
  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value ?? 1, 1));
  wizard.sets = n;

  // Ensure container exists
  let container = document.getElementById("sets-grids-wrapper");
  if (!container) {
    container = document.createElement("div");
    container.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    if (anchor) anchor.appendChild(container);
  }
  container.innerHTML = "";

  // Compute last-session per-set markers
  const prev = window.computePrevPerSet(wizard.exercise, wizard.movementType, n);

  if (wizard.movementType === "unilateral") {
    // LEFT
    const leftBlock = document.createElement("div");
    leftBlock.className = "form-group";
    leftBlock.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(leftBlock);

    const gridL = leftBlock.querySelector("#sets-grid-left");
    for (let i = 1; i <= n; i++) {
      const rowL = document.createElement("div");
      rowL.className = "set-row";
      const prevValL = (prev.prevL && prev.prevL[i - 1]) ? prev.prevL[i - 1] : "";
      rowL.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)"
               data-side="L" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight" title="Previous for this set">Prev: ${prevValL || "—"}</span>
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
      const rowR = document.createElement("div");
      rowR.className = "set-row";
      const prevValR = (prev.prevR && prev.prevR[i - 1]) ? prev.prevR[i - 1] : "";
      rowR.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)"
               data-side="R" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight" title="Previous for this set">Prev: ${prevValR || "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)"
               data-side="R" data-kind="weight" data-idx="${i - 1}">
      `;
      gridR.appendChild(rowR);
    }

    // Prefill from wizard (editing)
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
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prev && prev.prev[i - 1]) ? prev.prev[i - 1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps"
               data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight" title="Previous for this set">Prev: ${prevVal || "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)"
               data-kind="weight" data-idx="${i - 1}">
      `;
      grid.appendChild(row);
    }

    // Prefill from wizard if editing
    if (wizard.setReps?.length === n && wizard.setWeights?.length === n) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");
    }
  }
};

/* -----------------------------------------------------------------------
   readSetsIntoWizard()
   Reads the visible grid inputs into wizard.* arrays and computes max.
------------------------------------------------------------------------ */
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

/* -----------------------------------------------------------------------
   validateCurrentSetGrid()
   Ensures all visible rows have valid reps/weight before adding.
------------------------------------------------------------------------ */
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

/* -----------------------------------------------------------------------
   addExerciseToWorkout()
   Reads the grid → pushes a normalized exercise object to the session list.
------------------------------------------------------------------------ */
window.addExerciseToWorkout = function addExerciseToWorkout() {
  if (!validateCurrentSetGrid()) return;

  // Pull inputs into wizard.* and compute max
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

    // Bilateral
    setReps: (wizard.setReps || []).slice(),
    setWeights: (wizard.setWeights || []).slice(),

    // Unilateral
    setRepsL: (wizard.setRepsL || []).slice(),
    setWeightsL: (wizard.setWeightsL || []).slice(),
    setRepsR: (wizard.setRepsR || []).slice(),
    setWeightsR: (wizard.setWeightsR || []).slice(),

    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount
  };

  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();

  // Reset the inline editor for the next add (keep exercise selection empty)
  const exSel = document.getElementById("exercise-select");
  if (exSel) exSel.value = "";
  const setsInput = document.getElementById("sets-input");
  if (setsInput) setsInput.value = "3";

  // Reset editor state
  wizard.exercise = "";
  wizard.sets = 3;
  wizard.movementType = "bilateral";
  wizard.setReps = []; wizard.setWeights = [];
  wizard.setRepsL = []; wizard.setWeightsL = [];
  wizard.setRepsR = []; wizard.setWeightsR = [];
  wizard.maxWeight = 0; wizard.maxWeightSetCount = 0;

  // Rebuild grid (now blank)
  renderSetRows();

  // Clear insights if you show a box under the select
  const insights = document.getElementById("exercise-insights");
  if (insights) insights.textContent = "";

  updateReviewButtonState();
};

/* -----------------------------------------------------------------------
   Utilities (local)
------------------------------------------------------------------------ */
function isFiniteNum(x){ return typeof x === "number" && Number.isFinite(x); }
function trimZeros(n){
  if (!isFiniteNum(n)) return n;
  const s = String(n);
  return s.includes(".")
    ? s.replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1")
    : s;
                               }
