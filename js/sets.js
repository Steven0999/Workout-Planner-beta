(function () {
  const App = (window.App = window.App || {});
  const { q, qa, toInt, toFloat, stripZeros } = App.utils;

  // Pull latest record for an exercise
  function getExerciseRecordsDesc(name) {
    const hist = App.state.userWorkoutData[name];
    const recs = (hist?.records || []).slice();
    recs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return recs;
  }

  // Build per-set previous arrays for bilateral or unilateral
  function computePrevPerSet(exName, movementType, setsCount) {
    const empty = Array(setsCount).fill("");
    const last = exName ? getExerciseRecordsDesc(exName)[0] : null;

    if (!last) {
      return movementType === "unilateral"
        ? { prevL: empty.slice(), prevR: empty.slice(), prevRepsL: empty.slice(), prevRepsR: empty.slice() }
        : { prev: empty.slice(), prevReps: empty.slice() };
    }

    // Modern shape (new saver) includes setReps arrays; older saves might not.
    const hasUni = Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR);
    const hasBil = Array.isArray(last.setWeights);

    if (movementType === "unilateral") {
      const prevL = empty.slice();
      const prevR = empty.slice();
      const prevRepsL = empty.slice();
      const prevRepsR = empty.slice();

      if (hasUni) {
        for (let i = 0; i < setsCount; i++) {
          if (last.setWeightsL && i < last.setWeightsL.length) prevL[i] = last.setWeightsL[i];
          if (last.setWeightsR && i < last.setWeightsR.length) prevR[i] = last.setWeightsR[i];
          if (last.setRepsL && i < last.setRepsL.length) prevRepsL[i] = last.setRepsL[i];
          if (last.setRepsR && i < last.setRepsR.length) prevRepsR[i] = last.setRepsR[i];
        }
      } else if (hasBil) {
        for (let i = 0; i < setsCount; i++) {
          if (i < last.setWeights.length) {
            prevL[i] = last.setWeights[i];
            prevR[i] = last.setWeights[i];
          }
          if (last.setReps && i < last.setReps.length) {
            prevRepsL[i] = last.setReps[i];
            prevRepsR[i] = last.setReps[i];
          }
        }
      } else if (typeof last.maxWeight === "number") {
        return {
          prevL: Array(setsCount).fill(last.maxWeight),
          prevR: Array(setsCount).fill(last.maxWeight),
          prevRepsL: empty.slice(),
          prevRepsR: empty.slice()
        };
      }

      return { prevL, prevR, prevRepsL, prevRepsR };
    }

    // Bilateral current
    const prev = empty.slice();
    const prevReps = empty.slice();

    if (hasBil) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeights.length) prev[i] = last.setWeights[i];
        if (last.setReps && i < last.setReps.length) prevReps[i] = last.setReps[i];
      }
    } else if (hasUni) {
      for (let i = 0; i < setsCount; i++) {
        const l = last.setWeightsL && i < last.setWeightsL.length ? last.setWeightsL[i] : null;
        const r = last.setWeightsR && i < last.setWeightsR.length ? last.setWeightsR[i] : null;
        const repL = last.setRepsL && i < last.setRepsL.length ? last.setRepsL[i] : "";
        const repR = last.setRepsR && i < last.setRepsR.length ? last.setRepsR[i] : "";
        const use = (l != null && r != null) ? Math.max(l, r) : (l != null ? l : r);
        prev[i] = use ?? "";
        prevReps[i] = repL || repR || "";
      }
    } else if (typeof last.maxWeight === "number") {
      return { prev: Array(setsCount).fill(last.maxWeight), prevReps };
    }

    return { prev, prevReps };
  }

  // Render the sets UI
  function renderSetRows() {
    const exName = q("#exercise-select").value;
    const movement = q("#movement-type-select").value || "bilateral";
    const n = Math.max(1, toInt(q("#sets-input").value, 1));
    const wrap = q("#sets-grids-wrapper");
    if (!wrap) return;
    wrap.innerHTML = "";

    const prev = computePrevPerSet(exName, movement, n);

    if (movement === "unilateral") {
      // Left
      const left = document.createElement("div");
      left.className = "form-group";
      left.innerHTML = `<label>Left Side — Reps & Weight</label><div class="sets-grid" id="sets-grid-left"></div>`;
      wrap.appendChild(left);

      const gridL = left.querySelector("#sets-grid-left");
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevW = prev.prevL?.[i];
        const prevR = prev.prevRepsL?.[i];
        const label = (prevW !== "" && prevW != null)
          ? `Prev: ${stripZeros(prevW)}kg${(prevR !== "" && prevR != null) ? ` × ${stripZeros(prevR)}` : ""}`
          : "Prev: —";
        row.innerHTML = `
          <input type="number" min="1" step="1" data-side="L" data-kind="reps" data-idx="${i}" placeholder="Left Set ${i+1}: Reps">
          <span class="prev-weight">${label}</span>
          <input type="number" min="0" step="0.5" data-side="L" data-kind="weight" data-idx="${i}" placeholder="Left Set ${i+1}: Weight (kg)">
        `;
        gridL.appendChild(row);
      }

      // Right
      const right = document.createElement("div");
      right.className = "form-group";
      right.innerHTML = `<label>Right Side — Reps & Weight</label><div class="sets-grid" id="sets-grid-right"></div>`;
      wrap.appendChild(right);

      const gridR = right.querySelector("#sets-grid-right");
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevW = prev.prevR?.[i];
        const prevR = prev.prevRepsR?.[i];
        const label = (prevW !== "" && prevW != null)
          ? `Prev: ${stripZeros(prevW)}kg${(prevR !== "" && prevR != null) ? ` × ${stripZeros(prevR)}` : ""}`
          : "Prev: —";
        row.innerHTML = `
          <input type="number" min="1" step="1" data-side="R" data-kind="reps" data-idx="${i}" placeholder="Right Set ${i+1}: Reps">
          <span class="prev-weight">${label}</span>
          <input type="number" min="0" step="0.5" data-side="R" data-kind="weight" data-idx="${i}" placeholder="Right Set ${i+1}: Weight (kg)">
        `;
        gridR.appendChild(row);
      }
    } else {
      const single = document.createElement("div");
      single.className = "form-group";
      single.innerHTML = `<label>Reps & Weight</label><div class="sets-grid" id="sets-grid"></div>`;
      wrap.appendChild(single);

      const grid = single.querySelector("#sets-grid");
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevW = prev.prev?.[i];
        const prevR = prev.prevReps?.[i];
        const label = (prevW !== "" && prevW != null)
          ? `Prev: ${stripZeros(prevW)}kg${(prevR !== "" && prevR != null) ? ` × ${stripZeros(prevR)}` : ""}`
          : "Prev: —";
        row.innerHTML = `
          <input type="number" min="1" step="1" data-kind="reps" data-idx="${i}" placeholder="Set ${i+1}: Reps">
          <span class="prev-weight">${label}</span>
          <input type="number" min="0" step="0.5" data-kind="weight" data-idx="${i}" placeholder="Set ${i+1}: Weight (kg)">
        `;
        grid.appendChild(row);
      }
    }
  }

  App.sets = { renderSetRows };
})();
