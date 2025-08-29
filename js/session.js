(function () {
  const App = (window.App = window.App || {});
  const { q, qa, toInt, toFloat, setOptions, isoToLocalString, stripZeros } = App.utils;
  const { wizard } = App.wizard;

  function collectSetValues() {
    const movement = q("#movement-type-select").value || "bilateral";
    const n = Math.max(1, toInt(q("#sets-input").value, 1));

    if (movement === "unilateral") {
      const repsL = qa('#sets-grids-wrapper [data-side="L"][data-kind="reps"]').map((el) => toInt(el.value));
      const wtsL  = qa('#sets-grids-wrapper [data-side="L"][data-kind="weight"]').map((el) => toFloat(el.value));
      const repsR = qa('#sets-grids-wrapper [data-side="R"][data-kind="reps"]').map((el) => toInt(el.value));
      const wtsR  = qa('#sets-grids-wrapper [data-side="R"][data-kind="weight"]').map((el) => toFloat(el.value));

      if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
          repsL.some(v => v <= 0) || wtsL.some(v => v < 0) || repsR.some(v => v <= 0) || wtsR.some(v => v < 0)) {
        q("#s5-hint").textContent = "Fill reps & weight for every set on both Left and Right sides.";
        return null;
      }

      const maxL = Math.max(...wtsL);
      const maxR = Math.max(...wtsR);

      return {
        movementType: "unilateral",
        setRepsL: repsL, setWeightsL: wtsL,
        setRepsR: repsR, setWeightsR: wtsR,
        maxWeight: Math.max(maxL, maxR),
        maxWeightSetCount: [...wtsL, ...wtsR].filter(w => w === Math.max(maxL, maxR)).length
      };
    }

    // bilateral
    const reps = qa('#sets-grids-wrapper [data-kind="reps"]').map((el) => toInt(el.value));
    const wts  = qa('#sets-grids-wrapper [data-kind="weight"]').map((el) => toFloat(el.value));
    if (reps.length !== n || wts.length !== n || reps.some(v => v <= 0) || wts.some(v => v < 0)) {
      q("#s5-hint").textContent = "Fill reps & weight for every set.";
      return null;
    }
    const maxW = Math.max(...wts);
    return {
      movementType: "bilateral",
      setReps: reps, setWeights: wts,
      maxWeight: maxW,
      maxWeightSetCount: wts.filter(w => w === maxW).length
    };
  }

  function addExerciseToWorkout() {
    q("#s5-hint").textContent = "";
    const exerciseName = q("#exercise-select").value;
    if (!exerciseName) { q("#s5-hint").textContent = "Choose an exercise."; return; }

    const setsNum = Math.max(1, toInt(q("#sets-input").value, 1));
    const collected = collectSetValues();
    if (!collected) return;

    const ex = {
      id: Date.now().toString(),
      date: wizard.datetime,
      name: exerciseName,
      category: wizard.category,
      equipment: wizard.equipment,
      muscle: wizard.category === "specific muscle" ? wizard.muscle : null,
      movementType: collected.movementType,
      sets: setsNum,
      setReps: collected.setReps || [],
      setWeights: collected.setWeights || [],
      setRepsL: collected.setRepsL || [],
      setWeightsL: collected.setWeightsL || [],
      setRepsR: collected.setRepsR || [],
      setWeightsR: collected.setWeightsR || [],
      maxWeight: collected.maxWeight,
      maxWeightSetCount: collected.maxWeightSetCount
    };

    App.state.currentWorkoutExercises.push(ex);
    renderCurrentWorkoutList();

    // Reset inputs (keep the grid visible)
    q("#exercise-select").value = "";
  }

  function renderCurrentWorkoutList() {
    const wrap = q("#current-workout-list-container");
    const list = q("#current-workout-list");
    list.innerHTML = "";

    const items = App.state.currentWorkoutExercises;
    if (!items.length) { wrap.style.display = "none"; return; }
    wrap.style.display = "block";

    items.forEach((ex, idx) => {
      let details = "";
      if (ex.movementType === "unilateral") {
        const pairsL = ex.setRepsL.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsL[i])}kg`).join(", ");
        const pairsR = ex.setRepsR.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsR[i])}kg`).join(", ");
        const maxL = Math.max(...ex.setWeightsL);
        const maxR = Math.max(...ex.setWeightsR);
        const cL = ex.setWeightsL.filter(w => w === maxL).length;
        const cR = ex.setWeightsR.filter(w => w === maxR).length;
        details = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} set(s) • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)} set(s)</div>
        `;
      } else {
        const pairs = ex.setReps.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeights[i])}kg`).join(", ");
        details = `
          <div>${stripZeros(ex.sets)} sets → ${pairs || "—"}</div>
          <div>Heaviest: ${stripZeros(ex.maxWeight)}kg × ${stripZeros(ex.maxWeightSetCount)} set(s)</div>
        `;
      }

      const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
      const div = document.createElement("div");
      div.className = "workout-item";
      div.innerHTML = `
        <strong>${ex.name}</strong> <small>(${meta})</small><br>
        ${details}
        <button onclick="App.session.removeExerciseFromWorkout(${idx})" style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;">Remove</button>
      `;
      list.appendChild(div);
    });
    App.session.updateReviewButtonState();
  }

  function removeExerciseFromWorkout(index) {
    App.state.currentWorkoutExercises.splice(index, 1);
    renderCurrentWorkoutList();
  }

  // Review page builder
  function buildSessionSummary() {
    const meta = q("#summary-meta");
    const exWrap = q("#summary-exercises");
    const totals = q("#summary-totals");

    meta.innerHTML = `
      <div class="summary-row"><strong>Location</strong><span>${title(wizard.location)}</span></div>
      <div class="summary-row"><strong>When</strong><span>${wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
      <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocalString(wizard.datetime)}</span></div>
    `;

    exWrap.innerHTML = "";
    const items = App.state.currentWorkoutExercises;
    if (!items.length) {
      exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added yet. Go back and add some.</em></div>`;
    } else {
      items.forEach((ex) => {
        // Compare against last & best
        const hist = App.state.userWorkoutData[ex.name];
        const recsDesc = hist ? hist.records.slice().sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
        const last = recsDesc[0];
        const lastMax = last?.maxWeight ?? null;
        const lastDate = last ? new Date(last.date).toLocaleDateString() : null;
        const deltaLast = lastMax == null ? null : +(ex.maxWeight - lastMax).toFixed(2);

        const best = hist?.bestWeight ?? null;
        let bestDate = null;
        if (best != null) {
          const asc = recsDesc.slice().reverse();
          const hit = asc.find((r) => r.maxWeight === best);
          bestDate = hit ? new Date(hit.date).toLocaleDateString() : null;
        }
        const deltaBest = best == null ? null : +(ex.maxWeight - best).toFixed(2);

        const badge =
          lastMax == null ? `<span style="color:#9aa0a6;">— no history</span>`
          : deltaLast > 0 ? `<span style="color:#4caf50;">▲ +${stripZeros(deltaLast)}kg</span>`
          : deltaLast < 0 ? `<span style="color:#ff5252;">▼ ${stripZeros(Math.abs(deltaLast))}kg</span>`
          : `<span style="color:#ffb300;">= 0kg</span>`;

        let details = "";
        if (ex.movementType === "unilateral") {
          const pairsL = ex.setRepsL.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsL[i])}kg`).join(", ");
          const pairsR = ex.setRepsR.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeightsR[i])}kg`).join(", ");
          const maxL = Math.max(...ex.setWeightsL);
          const maxR = Math.max(...ex.setWeightsR);
          const cL = ex.setWeightsL.filter(w => w === maxL).length;
          const cR = ex.setWeightsR.filter(w => w === maxR).length;
          details = `
            <div><em>Left:</em> ${pairsL || "—"}</div>
            <div><em>Right:</em> ${pairsR || "—"}</div>
            <div>Overall Heaviest: <strong>${stripZeros(ex.maxWeight)}kg</strong> ${badge}</div>
            <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} set(s) • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)} set(s)</div>
            <div>vs Last ${lastDate ? `(${lastDate})` : ""}: <strong>${
              lastMax == null ? "—" : (deltaLast > 0 ? `▲ +${stripZeros(deltaLast)}kg` : (deltaLast < 0 ? `▼ ${stripZeros(Math.abs(deltaLast))}kg` : `= 0kg`))
            }</strong></div>
            <div>vs Best ${bestDate ? `(${bestDate})` : ""}: <strong>${
              best == null ? "—" : (deltaBest > 0 ? `▲ +${stripZeros(deltaBest)}kg` : (deltaBest < 0 ? `▼ ${stripZeros(Math.abs(deltaBest))}kg` : `= 0kg`))
            }</strong></div>
          `;
        } else {
          const pairs = ex.setReps.map((r, i) => `${stripZeros(r)}x${stripZeros(ex.setWeights[i])}kg`).join(", ");
          details = `
            <div>${stripZeros(ex.sets)} sets → ${pairs || "—"}</div>
            <div>Heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong> ${badge}</div>
            <div>vs Last ${lastDate ? `(${lastDate})` : ""}: <strong>${
              lastMax == null ? "—" : (deltaLast > 0 ? `▲ +${stripZeros(deltaLast)}kg` : (deltaLast < 0 ? `▼ ${stripZeros(Math.abs(deltaLast))}kg` : `= 0kg`))
            }</strong></div>
            <div>vs Best ${bestDate ? `(${bestDate})` : ""}: <strong>${
              best == null ? "—" : (deltaBest > 0 ? `▲ +${stripZeros(deltaBest)}kg` : (deltaBest < 0 ? `▼ ${stripZeros(Math.abs(deltaBest))}kg` : `= 0kg`))
            }</strong></div>
          `;
        }

        const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
        const card = document.createElement("div");
        card.className = "summary-exercise";
        card.innerHTML = `<strong>${ex.name}</strong> <small>(${meta})</small><br>${details}`;
        exWrap.appendChild(card);
      });
    }

    // Totals
    let totalVolume = 0, totalSets = 0;
    App.state.currentWorkoutExercises.forEach((ex) => {
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
      <div><strong>Total Exercises:</strong> ${App.state.currentWorkoutExercises.length}</div>
      <div><strong>Total Sets:</strong> ${totalSets}</div>
      <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
    `;
  }

  function saveSession() {
    const dt = wizard.datetime;
    if (!dt) { alert("Missing session date/time — go back to Step 2."); return; }
    if (!App.state.currentWorkoutExercises.length) { alert("Add at least one exercise before saving."); return; }

    App.state.currentWorkoutExercises.forEach((ex) => {
      const key = ex.name;
      if (!App.state.userWorkoutData[key]) App.state.userWorkoutData[key] = { bestWeight: 0, records: [] };
      App.state.userWorkoutData[key].records.push({
        id: ex.id, date: dt,
        category: ex.category, equipment: ex.equipment, muscle: ex.muscle,
        movementType: ex.movementType,
        setReps: ex.setReps, setWeights: ex.setWeights,
        setRepsL: ex.setRepsL, setWeightsL: ex.setWeightsL,
        setRepsR: ex.setRepsR, setWeightsR: ex.setWeightsR,
        sets: ex.sets,
        maxWeight: ex.maxWeight, maxWeightSetCount: ex.maxWeightSetCount
      });
      if (ex.maxWeight > (App.state.userWorkoutData[key].bestWeight || 0)) {
        App.state.userWorkoutData[key].bestWeight = ex.maxWeight;
      }
    });

    App.utils.saveData(App.state.userWorkoutData);
    alert("Workout session saved successfully!");

    App.state.currentWorkoutExercises = [];
    renderCurrentWorkoutList();

    // Reset wizard to step 1
    wizard.step = 1;
    // keep date if training now
    if (wizard.timing === "now") wizard.datetime = App.utils.nowIsoMinute();
    App.wizard.goToStep(1);
  }

  function updateReviewButtonState() {
    const next = q("#next-btn");
    if (!next) return;

    if (wizard.step === 5) {
      next.textContent = "Review";
      const disabled = App.state.currentWorkoutExercises.length === 0;
      next.disabled = disabled;
      next.classList.toggle("is-disabled", disabled);
    } else if (wizard.step === 6) {
      next.textContent = "Save";
      next.disabled = false;
      next.classList.remove("is-disabled");
    } else {
      next.textContent = "Next";
      next.disabled = false;
      next.classList.remove("is-disabled");
    }
  }

  App.session = {
    addExerciseToWorkout,
    renderCurrentWorkoutList,
    removeExerciseFromWorkout,
    buildSessionSummary,
    saveSession,
    updateReviewButtonState
  };
})();
