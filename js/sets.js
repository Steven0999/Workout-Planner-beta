/* ======================================
   sets.js — per-set prev markers & set rows rendering
====================================== */

function getExerciseRecordsDesc(exName) {
  const recs = (userWorkoutData[exName]?.records || []).slice();
  recs.sort((a, b) => new Date(b.date) - new Date(a.date));
  return recs;
}

function extractWeightsAndReps(record) {
  if (record.setWeightsL && record.setWeightsR) {
    const wAll = [...record.setWeightsL, ...record.setWeightsR];
    const rAll = [
      ...(record.setRepsL || Array(record.setWeightsL.length).fill(null)),
      ...(record.setRepsR || Array(record.setWeightsR.length).fill(null))
    ];
    return { weights: wAll, reps: rAll };
  }
  return {
    weights: Array.isArray(record.setWeights) ? record.setWeights : [],
    reps: Array.isArray(record.setReps) ? record.setReps : []
  };
}

window.getLastHeaviestWithReps = function getLastHeaviestWithReps(exName) {
  const recs = getExerciseRecordsDesc(exName);
  if (recs.length === 0) return null;
  const r = recs[0];
  const { weights, reps } = extractWeightsAndReps(r);
  if (weights.length === 0) return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };
  const maxW = Math.max(...weights);
  const idx = weights.findIndex((w) => w === maxW);
  const repsAtMax = idx >= 0 ? reps[idx] ?? null : null;
  return { maxWeight: maxW, reps: repsAtMax, date: r.date };
};

window.getBestHeaviestWithReps = function getBestHeaviestWithReps(exName) {
  const bestW = userWorkoutData[exName]?.bestWeight ?? null;
  if (bestW == null) return null;
  const recs = getExerciseRecordsDesc(exName).slice().reverse();
  for (const r of recs) {
    const { weights, reps } = extractWeightsAndReps(r);
    const i = weights.findIndex((w) => w === bestW);
    if (i >= 0) return { maxWeight: bestW, reps: reps[i] ?? null, date: r.date };
  }
  return { maxWeight: bestW, reps: null, date: null };
};

window.getTrendAgainstLast = function getTrendAgainstLast(exName, currentMax) {
  const last = getLastHeaviestWithReps(exName);
  if (!last || last.maxWeight == null) return { dir: "na", delta: null };
  const delta = Number((currentMax - last.maxWeight).toFixed(2));
  if (delta > 0) return { dir: "up", delta };
  if (delta < 0) return { dir: "down", delta };
  return { dir: "same", delta: 0 };
};

window.computePrevPerSet = function computePrevPerSet(exName, movementType, setsCount) {
  const blankN = Array(setsCount).fill("");
  if (!exName) {
    return movementType === "unilateral"
      ? { prevL: blankN.slice(), prevR: blankN.slice() }
      : { prev: blankN.slice() };
  }
  const last = getExerciseRecordsDesc(exName)[0];
  if (!last) {
    return movementType === "unilateral"
      ? { prevL: blankN.slice(), prevR: blankN.slice() }
      : { prev: blankN.slice() };
  }

  if (movementType === "unilateral") {
    let prevL = blankN.slice(), prevR = blankN.slice();
    if (Array.isArray(last.setWeightsL) && Array.isArray(last.setWeightsR)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeightsL.length) prevL[i] = last.setWeightsL[i];
        if (i < last.setWeightsR.length) prevR[i] = last.setWeightsR[i];
      }
    } else if (Array.isArray(last.setWeights)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeights.length) {
          prevL[i] = last.setWeights[i];
          prevR[i] = last.setWeights[i];
        }
      }
    } else if (typeof last.maxWeight === "number") {
      prevL = Array(setsCount).fill(last.maxWeight);
      prevR = Array(setsCount).fill(last.maxWeight);
    }
    return { prevL, prevR };
  }

  let prev = blankN.slice();
  if (Array.isArray(last.setWeights)) {
    for (let i = 0; i < setsCount; i++) if (i < last.setWeights.length) prev[i] = last.setWeights[i];
  } else if (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)) {
    for (let i = 0; i < setsCount; i++) {
      const l = Array.isArray(last.setWeightsL) && i < last.setWeightsL.length ? last.setWeightsL[i] : null;
      const r = Array.isArray(last.setWeightsR) && i < last.setWeightsR.length ? last.setWeightsR[i] : null;
      if (l != null && r != null) prev[i] = Math.max(l, r);
      else if (l != null) prev[i] = l;
      else if (r != null) prev[i] = r;
    }
  } else if (typeof last.maxWeight === "number") {
    prev = Array(setsCount).fill(last.maxWeight);
  }
  return { prev };
};

window.renderSetRows = function renderSetRows() {
  const setsInput = document.getElementById("sets-input");
  const n = Math.max(1, toInt(setsInput.value, 1));
  wizard.sets = n;

  let container = document.getElementById("sets-grids-wrapper");
  if (!container) {
    container = document.createElement("div");
    container.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    if (anchor) anchor.appendChild(container);
  }
  container.innerHTML = "";

  const prev = computePrevPerSet(wizard.exercise, wizard.movementType, n);

  if (wizard.movementType === "unilateral") {
    const left = document.createElement("div");
    left.className = "form-group";
    left.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(left);

    const right = document.createElement("div");
    right.className = "form-group";
    right.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    container.appendChild(right);

    const gridL = left.querySelector("#sets-grid-left");
    const gridR = right.querySelector("#sets-grid-right");

    for (let i = 1; i <= n; i++) {
      const rowL = document.createElement("div");
      rowL.className = "set-row";
      const prevValL = (prev.prevL && prev.prevL[i - 1] !== "" && prev.prevL[i - 1] != null) ? prev.prevL[i - 1] : "";
      rowL.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)" data-side="L" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevValL === "" ? "—" : prevValL + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (L)" data-side="L" data-kind="weight" data-idx="${i - 1}">
      `;
      gridL.appendChild(rowL);

      const rowR = document.createElement("div");
      rowR.className = "set-row";
      const prevValR = (prev.prevR && prev.prevR[i - 1] !== "" && prev.prevR[i - 1] != null) ? prev.prevR[i - 1] : "";
      rowR.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)" data-side="R" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevValR === "" ? "—" : prevValR + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)" data-side="R" data-kind="weight" data-idx="${i - 1}">
      `;
      gridR.appendChild(rowR);
    }

    // Prefill if returning to step
    if (wizard.setRepsL.length === n && wizard.setWeightsL.length === n) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsL[i] ?? "");
    }
    if (wizard.setRepsR.length === n && wizard.setWeightsR.length === n) {
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsR[i] ?? "");
    }

  } else {
    const single = document.createElement("div");
    single.className = "form-group";
    single.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    container.appendChild(single);

    const grid = single.querySelector("#sets-grid");
    for (let i = 1; i <= n; i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prev && prev.prev[i - 1] !== "" && prev.prev[i - 1] != null) ? prev.prev[i - 1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : prevVal + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i - 1}">
      `;
      grid.appendChild(row);
    }
    if (wizard.setReps.length === n && wizard.setWeights.length === n) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");
    }
  }
};
