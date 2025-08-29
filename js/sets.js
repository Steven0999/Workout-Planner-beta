// js/sets.js
// Step 5: Exercise list + per-set reps/weights UI + per-set Prev markers + add-to-session

/* ====== Assumes these globals exist ======
   - window.EXERCISES (from exercises.js)
   - window.userWorkoutData (from data.js / session.js init)
   - window.wizard (from wizard.js)
   - helpers from utils.js: uniq, title, toInt, toFloat
   - helpers from filters.js / data.js: EXERCISES_NORM, byLocation, byCategoryAndMuscle
*/

(function () {
  // --------- Small guards ----------
  const has = (sel) => Boolean(document.querySelector(sel));
  const el  = (sel) => document.querySelector(sel);

  // ======= History helpers: last & per-set previous with reps =======
  function getExerciseRecordsDesc(name) {
    const recs = (window.userWorkoutData?.[name]?.records || []).slice();
    recs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return recs;
  }

  /** Build arrays of prev weights + reps for each set index.
   * Returns one of:
   *  - bilateral: { prevW: number[]|""[], prevR: number[]|""[] }
   *  - unilateral: { prevWL:[], prevWR:[], prevRL:[], prevRR:[] }
   */
  function computePrevPerSetWithReps(exName, movementType, setCount) {
    const blanks = (n) => Array(n).fill("");
    if (!exName) {
      return movementType === "unilateral"
        ? { prevWL: blanks(setCount), prevWR: blanks(setCount), prevRL: blanks(setCount), prevRR: blanks(setCount) }
        : { prevW: blanks(setCount), prevR: blanks(setCount) };
    }

    const last = getExerciseRecordsDesc(exName)[0];
    if (!last) {
      return movementType === "unilateral"
        ? { prevWL: blanks(setCount), prevWR: blanks(setCount), prevRL: blanks(setCount), prevRR: blanks(setCount) }
        : { prevW: blanks(setCount), prevR: blanks(setCount) };
    }

    // If UI is unilateral, map last → L/R smartly
    if (movementType === "unilateral") {
      const WL = blanks(setCount), WR = blanks(setCount), RL = blanks(setCount), RR = blanks(setCount);

      if (Array.isArray(last.setWeightsL) && Array.isArray(last.setWeightsR)) {
        // true unilateral last time
        for (let i = 0; i < setCount; i++) {
          if (i < last.setWeightsL.length) WL[i] = last.setWeightsL[i];
          if (i < last.setWeightsR.length) WR[i] = last.setWeightsR[i];
          if (Array.isArray(last.setRepsL) && i < last.setRepsL.length) RL[i] = last.setRepsL[i];
          if (Array.isArray(last.setRepsR) && i < last.setRepsR.length) RR[i] = last.setRepsR[i];
        }
      } else if (Array.isArray(last.setWeights)) {
        // last time was bilateral → mirror to both sides
        for (let i = 0; i < setCount; i++) {
          if (i < last.setWeights.length) {
            WL[i] = last.setWeights[i];
            WR[i] = last.setWeights[i];
          }
          if (Array.isArray(last.setReps) && i < last.setReps.length) {
            RL[i] = last.setReps[i];
            RR[i] = last.setReps[i];
          }
        }
      } else if (typeof last.maxWeight === "number") {
        WL.fill(last.maxWeight);
        WR.fill(last.maxWeight);
        // reps unknown: leave as ""
      }
      return { prevWL: WL, prevWR: WR, prevRL: RL, prevRR: RR };
    }

    // Bilateral UI: collapse L/R if needed
    const W = blanks(setCount), R = blanks(setCount);
    if (Array.isArray(last.setWeights)) {
      for (let i = 0; i < setCount; i++) if (i < last.setWeights.length) W[i] = last.setWeights[i];
      if (Array.isArray(last.setReps)) for (let i = 0; i < setCount; i++) if (i < last.setReps.length) R[i] = last.setReps[i];
    } else if (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)) {
      for (let i = 0; i < setCount; i++) {
        const l = Array.isArray(last.setWeightsL) && i < last.setWeightsL.length ? last.setWeightsL[i] : null;
        const r = Array.isArray(last.setWeightsR) && i < last.setWeightsR.length ? last.setWeightsR[i] : null;
        const wl = Array.isArray(last.setRepsL) && i < last.setRepsL.length ? last.setRepsL[i] : "";
        const wr = Array.isArray(last.setRepsR) && i < last.setRepsR.length ? last.setRepsR[i] : "";
        if (l != null && r != null) {
          W[i] = Math.max(l, r);
          R[i] = (wl || wr || "");
        } else if (l != null) {
          W[i] = l; R[i] = wl;
        } else if (r != null) {
          W[i] = r; R[i] = wr;
        }
      }
    } else if (typeof last.maxWeight === "number") {
      W.fill(last.maxWeight);
      // reps unknown
    }
    return { prevW: W, prevR: R };
  }

  // ====== Exercise list for Step 5 (filtered by category/equipment/search) ======
  function populateExercises() {
    const sel = el("#exercise-select");
    if (!sel) return;

    const searchTerm = (el("#exercise-search")?.value || "").trim().toLowerCase();

    // Pool: by location
    const pool = window.byLocation(window.EXERCISES_NORM || [], window.wizard.location);
    // Filter by category (+ muscle for specific muscle)
    let filtered = window.byCategoryAndMuscle(pool, window.wizard.category, window.wizard.muscle);
    // Filter by equipment if chosen
    if (window.wizard.equipment) {
      filtered = filtered.filter((e) => (e.equipment || []).includes(window.wizard.equipment));
    }
    // Apply search term
    if (searchTerm) {
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(searchTerm));
    }

    const names = uniq(filtered.map((e) => e.name)).sort((a, b) => a.localeCompare(b));
    sel.innerHTML = `<option value="">--Select--</option>` + names.map((n) => `<option value="${n}">${n}</option>`).join("");
    if (names.includes(window.wizard.exercise)) sel.value = window.wizard.exercise;

    // Movement type control (bilateral/unilateral)
    ensureMovementTypeControl();

    // When exercise changes → refresh prev markers + rows
    sel.onchange = () => {
      window.wizard.exercise = sel.value;
      renderSetRows();
    };

    // Initial render
    renderSetRows();
  }

  // ====== Movement type selector (bilateral/unilateral) ======
  function ensureMovementTypeControl() {
    let wrap = el("#movement-type-wrap");
    const anchor = el("#exercise-select-group");
    if (!anchor) return;
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "movement-type-wrap";
      wrap.className = "form-group";
      wrap.innerHTML = `
        <label>Movement Type</label>
        <select id="movement-type-select">
          <option value="bilateral">Bilateral</option>
          <option value="unilateral">Unilateral</option>
        </select>
      `;
      anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
    }
    const typeSel = wrap.querySelector("#movement-type-select");
    typeSel.value = window.wizard.movementType || "bilateral";
    typeSel.onchange = () => {
      window.wizard.movementType = typeSel.value;
      renderSetRows();
    };
  }

  // ====== Render per-set reps & weight inputs with "Prev: W × R" markers ======
  function renderSetRows() {
    const n = Math.max(1, toInt(el("#sets-input")?.value || 1, 1));
    window.wizard.sets = n;

    const container = ensureSetsContainer();
    container.innerHTML = "";

    const exName = window.wizard.exercise || "";
    if (!exName) {
      // nothing to render until exercise is chosen
      return;
    }

    // Compute previous set-by-set values
    const prev = computePrevPerSetWithReps(exName, window.wizard.movementType, n);

    if (window.wizard.movementType === "unilateral") {
      // LEFT
      const leftBlock = document.createElement("div");
      leftBlock.className = "form-group";
      leftBlock.innerHTML = `<label>Left Side — Reps &amp; Weight</label>`;
      const gridL = document.createElement("div");
      gridL.className = "sets-grid";
      leftBlock.appendChild(gridL);

      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";

        const reps = document.createElement("input");
        reps.type = "number"; reps.min = "1"; reps.step = "1";
        reps.placeholder = `Left Set ${i + 1}: Reps`;
        reps.dataset.side = "L"; reps.dataset.kind = "reps"; reps.dataset.idx = String(i);

        const prevSpan = document.createElement("span");
        prevSpan.className = "prev-weight";
        const pw = prev.prevWL?.[i] ?? "";
        const pr = prev.prevRL?.[i] ?? "";
        const label = (pw !== "" && pr !== "") ? `${pw}kg × ${pr}` :
                      (pw !== "" && pr === "") ? `${pw}kg` :
                      (pw === "" && pr !== "") ? `× ${pr}` : "—";
        prevSpan.textContent = `Prev: ${label}`;

        const weight = document.createElement("input");
        weight.type = "number"; weight.min = "0"; weight.step = "0.5";
        weight.placeholder = `Left Set ${i + 1}: Weight (kg)`;
        weight.dataset.side = "L"; weight.dataset.kind = "weight"; weight.dataset.idx = String(i);

        row.appendChild(reps);
        row.appendChild(prevSpan);
        row.appendChild(weight);
        gridL.appendChild(row);
      }

      // RIGHT
      const rightBlock = document.createElement("div");
      rightBlock.className = "form-group";
      rightBlock.innerHTML = `<label>Right Side — Reps &amp; Weight</label>`;
      const gridR = document.createElement("div");
      gridR.className = "sets-grid";
      rightBlock.appendChild(gridR);

      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";

        const reps = document.createElement("input");
        reps.type = "number"; reps.min = "1"; reps.step = "1";
        reps.placeholder = `Right Set ${i + 1}: Reps`;
        reps.dataset.side = "R"; reps.dataset.kind = "reps"; reps.dataset.idx = String(i);

        const prevSpan = document.createElement("span");
        prevSpan.className = "prev-weight";
        const pw = prev.prevWR?.[i] ?? "";
        const pr = prev.prevRR?.[i] ?? "";
        const label = (pw !== "" && pr !== "") ? `${pw}kg × ${pr}` :
                      (pw !== "" && pr === "") ? `${pw}kg` :
                      (pw === "" && pr !== "") ? `× ${pr}` : "—";
        prevSpan.textContent = `Prev: ${label}`;

        const weight = document.createElement("input");
        weight.type = "number"; weight.min = "0"; weight.step = "0.5";
        weight.placeholder = `Right Set ${i + 1}: Weight (kg)`;
        weight.dataset.side = "R"; weight.dataset.kind = "weight"; weight.dataset.idx = String(i);

        row.appendChild(reps);
        row.appendChild(prevSpan);
        row.appendChild(weight);
        gridR.appendChild(row);
      }

      container.appendChild(leftBlock);
      container.appendChild(rightBlock);
    } else {
      // BILATERAL
      const block = document.createElement("div");
      block.className = "form-group";
      block.innerHTML = `<label>Reps &amp; Weight</label>`;
      const grid = document.createElement("div");
      grid.className = "sets-grid";
      block.appendChild(grid);

      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";

        const reps = document.createElement("input");
        reps.type = "number"; reps.min = "1"; reps.step = "1";
        reps.placeholder = `Set ${i + 1}: Reps`;
        reps.dataset.kind = "reps"; reps.dataset.idx = String(i);

        const prevSpan = document.createElement("span");
        prevSpan.className = "prev-weight";
        const pw = prev.prevW?.[i] ?? "";
        const pr = prev.prevR?.[i] ?? "";
        const label = (pw !== "" && pr !== "") ? `${pw}kg × ${pr}` :
                      (pw !== "" && pr === "") ? `${pw}kg` :
                      (pw === "" && pr !== "") ? `× ${pr}` : "—";
        prevSpan.textContent = `Prev: ${label}`;

        const weight = document.createElement("input");
        weight.type = "number"; weight.min = "0"; weight.step = "0.5";
        weight.placeholder = `Set ${i + 1}: Weight (kg)`;
        weight.dataset.kind = "weight"; weight.dataset.idx = String(i);

        row.appendChild(reps);
        row.appendChild(prevSpan);
        row.appendChild(weight);
        grid.appendChild(row);
      }

      container.appendChild(block);
    }
  }

  function ensureSetsContainer() {
    let c = el("#sets-grids-wrapper");
    if (!c) {
      c = document.createElement("div");
      c.id = "sets-grids-wrapper";
      el("#exercise-inputs")?.appendChild(c);
    }
    return c;
  }

  // ====== Add Exercise button: collect per-set reps/weights + push to session ======
  function addExerciseToWorkout() {
    const hint = el("#s5-hint");
    if (hint) hint.textContent = "";

    const exerciseName = el("#exercise-select")?.value || "";
    if (!exerciseName) { if (hint) hint.textContent = "Choose an exercise."; return; }

    const n = Math.max(1, toInt(el("#sets-input")?.value || 1, 1));
    window.wizard.sets = n;

    if (window.wizard.movementType === "unilateral") {
      const repsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
      const wtsL   = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
      const repsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
      const wtsR   = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

      const invalid = (
        repsL.length !== n || wtsL.length !== n ||
        repsR.length !== n || wtsR.length !== n ||
        repsL.some(v => v <= 0) || wtsL.some(v => v < 0) ||
        repsR.some(v => v <= 0) || wtsR.some(v => v < 0)
      );
      if (invalid) { if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right."; return; }

      const maxW = Math.max(...wtsL, ...wtsR);
      const maxCount = [...wtsL, ...wtsR].filter(w => w === maxW).length;

      const ex = {
        id: Date.now().toString(),
        date: window.wizard.datetime,
        name: exerciseName,
        category: window.wizard.category,
        equipment: window.wizard.equipment,
        muscle: window.wizard.category === "specific muscle" ? window.wizard.muscle : null,
        movementType: "unilateral",
        sets: n,
        setRepsL: repsL, setWeightsL: wtsL,
        setRepsR: repsR, setWeightsR: wtsR,
        maxWeight: maxW, maxWeightSetCount: maxCount
      };

      window.currentWorkoutExercises.push(ex);
    } else {
      const reps  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i => toInt(i.value));
      const wts   = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i => toFloat(i.value));

      const invalid = (reps.length !== n || wts.length !== n || reps.some(v => v <= 0) || wts.some(v => v < 0));
      if (invalid) { if (hint) hint.textContent = "Fill reps & weight for every set."; return; }

      const maxW = Math.max(...wts);
      const maxCount = wts.filter(w => w === maxW).length;

      const ex = {
        id: Date.now().toString(),
        date: window.wizard.datetime,
        name: exerciseName,
        category: window.wizard.category,
        equipment: window.wizard.equipment,
        muscle: window.wizard.category === "specific muscle" ? window.wizard.muscle : null,
        movementType: "bilateral",
        sets: n,
        setReps: reps, setWeights: wts,
        maxWeight: maxW, maxWeightSetCount: maxCount
      };

      window.currentWorkoutExercises.push(ex);
    }

    // Refresh the session list + clear inputs
    if (typeof window.renderCurrentWorkoutList === "function") {
      window.renderCurrentWorkoutList();
    }
    // reset inputs for next add
    el("#exercise-select").value = "";
    el("#sets-input").value = "3";
    window.wizard.exercise = "";
    window.wizard.sets = 3;
    renderSetRows();

    if (typeof window.updateReviewButtonState === "function") {
      window.updateReviewButtonState();
    }
  }

  // ====== wire up listeners within Step 5 ======
  function initSetsStep() {
    // sets change
    const setsInput = el("#sets-input");
    if (setsInput) {
      setsInput.onchange = () => {
        window.wizard.sets = Math.max(1, toInt(setsInput.value, 1));
        renderSetRows();
      };
    }

    // search filter
    const search = el("#exercise-search");
    if (search) {
      search.oninput = () => populateExercises();
    }

    // add button
    const addBtn = el("#add-exercise-btn");
    if (addBtn) addBtn.onclick = addExerciseToWorkout;
  }

  // export
  window.populateExercises = populateExercises;
  window.renderSetRows = renderSetRows;
  window.addExerciseToWorkout = addExerciseToWorkout;
  window.initSetsStep = initSetsStep;
})();
