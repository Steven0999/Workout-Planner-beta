// js/wizard.js
// Step navigation + Step 3/4 patch integration + Step 5 exercise/sets UI
// Depends on: exercises.js (window.EXERCISES), js/filters.js (populateCategories, populateMuscles, populateEquipment, normalizeCategory)
// Optional helpers from other modules: session.js (saveSession/render list), sets/history may exist
// This file is self-sufficient for steps 1–5 (it renders the sets UI with per-set “Prev” markers).

(function () {
  // ---------- Tiny DOM helpers ----------
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const uniq = (a) => [...new Set(a)];
  const toInt = (v, d = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  };
  const toNum = (v, d = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };
  const nowIsoMinute = () => new Date().toISOString().slice(0, 16);

  // ---------- Global-ish app state ----------
  // Expose wizard so filters.js can read/write it
  window.wizard = window.wizard || {
    location: "",          // gym | home
    timing: "now",         // now | past
    datetime: nowIsoMinute(),
    category: "",          // push/pull/upper body/lower body/.../specific muscle
    muscle: "",            // when category === specific muscle
    equipment: "",         // selected equipment at step 4
    exercise: "",          // chosen exercise at step 5
    movementType: "bilateral", // bilateral | unilateral
    sets: 3,
    // inputs captured at step 5:
    setReps: [], setWeights: [],          // bilateral
    setRepsL: [], setWeightsL: [],        // unilateral left
    setRepsR: [], setWeightsR: [],        // unilateral right
    maxWeight: 0,
    maxWeightSetCount: 0
  };

  // Session working list (so Add Exercise works even if session.js isn’t present)
  window.currentWorkoutExercises = window.currentWorkoutExercises || [];

  // Track current step
  window.currentStep = window.currentStep || 1;

  // ---------- Location/home filter helper (mirrors filters.js behavior) ----------
  const HOME_EQ = new Set(["body weight", "resistance bands", "kettlebell"]);
  function byLocation(items, loc) {
    if (!loc) return items;                 // not chosen yet → show all
    if (loc === "home") {
      return items.filter(e =>
        Array.isArray(e.equipment) &&
        e.equipment.map(x => String(x).toLowerCase()).some(eq => HOME_EQ.has(eq))
      );
    }
    return items; // gym → everything
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    // Wire nav buttons
    $("#next-btn")?.addEventListener("click", nextStep);
    $("#prev-btn")?.addEventListener("click", prevStep);

    // Step 1: location
    $("#workout-type-select")?.addEventListener("change", (e) => {
      wizard.location = e.target.value || "";
    });

    // Step 2: timing + date control
    $$("input[name='timing']").forEach(r => {
      r.addEventListener("change", (e) => {
        wizard.timing = e.target.value;
        const dt = /** @type {HTMLInputElement} */($("#workout-datetime"));
        if (!dt) return;
        if (wizard.timing === "now") {
          dt.value = nowIsoMinute();
          dt.setAttribute("disabled", "disabled");
        } else {
          dt.removeAttribute("disabled");
        }
      });
    });
    const dt = /** @type {HTMLInputElement} */($("#workout-datetime"));
    if (dt) {
      dt.value = wizard.datetime;
      if (wizard.timing === "now") dt.setAttribute("disabled", "disabled");
    }

    // Step 3: category+muscle — actual population is done by filters.js;
    // also listen to location changes that might affect equip later
    $("#work-on-select")?.addEventListener("change", () => {
      // normalize via filters.js util if present
      if (typeof window.normalizeCategory === "function") {
        wizard.category = window.normalizeCategory($("#work-on-select").value);
      } else {
        wizard.category = ($("#work-on-select").value || "").toLowerCase();
      }
      // reset downstream
      wizard.muscle = "";
      wizard.equipment = "";
      wizard.exercise = "";
      if ($("#muscle-select")) $("#muscle-select").value = "";
      if ($("#equipment-select")) $("#equipment-select").innerHTML = `<option value="">--Select--</option>`;
      if ($("#exercise-select")) $("#exercise-select").innerHTML = `<option value="">--Select--</option>`;
      // if non-specific, we can pre-populate equipment
      if (wizard.category && wizard.category !== "specific muscle" && typeof window.populateEquipment === "function") {
        window.populateEquipment();
      }
    });
    $("#muscle-select")?.addEventListener("change", (e) => {
      wizard.muscle = e.target.value || "";
      // muscle change should repopulate equipment
      if (typeof window.populateEquipment === "function") {
        window.populateEquipment();
      }
    });

    // Step 4: equipment change
    $("#equipment-select")?.addEventListener("change", (e) => {
      wizard.equipment = (e.target.value || "").toLowerCase();
      // exercise list in step 5 depends on this; we’ll populate when entering step 5
    });

    // Step 5: movement type + sets listeners
    $("#movement-type-select")?.addEventListener("change", (e) => {
      wizard.movementType = e.target.value || "bilateral";
      renderSetRows(); // rerender inputs
    });
    $("#sets-input")?.addEventListener("change", (e) => {
      wizard.sets = Math.max(1, toInt(e.target.value, 3));
      renderSetRows();
    });
    $("#exercise-select")?.addEventListener("change", (e) => {
      wizard.exercise = e.target.value || "";
      renderSetRows(); // refresh prev markers for this exercise
      showExerciseInsights();
    });

    // Add Exercise button
    $("#add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);

    // Go to first step
    goToStep(1);
  });

  // ---------- Step navigation ----------
  function goToStep(step) {
    window.currentStep = step;
    $$(".wizard-step").forEach((el, i) => {
      el.style.display = (i === step - 1) ? "block" : "none";
    });

    // Patch: ensure Step 3/4/5 data are populated at the right time
    if (step === 3) {
      if (typeof window.populateCategories === "function") window.populateCategories();
      if (typeof window.populateMuscles === "function") window.populateMuscles();
      // Keep muscle group visibility correct if restoring state
      if (typeof window.toggleMuscleVisibility === "function") {
        window.toggleMuscleVisibility(wizard.category);
      }
    }

    if (step === 4) {
      if (typeof window.populateEquipment === "function") window.populateEquipment();
    }

    if (step === 5) {
      populateExercises();   // below in this file
      renderSetRows();       // below in this file
      showExerciseInsights();// last/best info
      // Reset any hint
      const h = $("#s5-hint"); if (h) h.textContent = "";
    }

    updateNextButtonState();
  }
  function prevStep() {
    if (window.currentStep > 1) goToStep(window.currentStep - 1);
  }
  function nextStep() {
    // Validate current step before moving on
    if (!validateAndStore(window.currentStep)) return;

    if (window.currentStep < 5) {
      goToStep(window.currentStep + 1);
      return;
    }
    if (window.currentStep === 5) {
      // Step 5's "Next" is actually "Review" in some UIs.
      // If you have a separate Review step (6), go there; otherwise you can
      // change the button label in your UI and keep user on the same step to add multiple exercises.
      // For now, prevent progressing if no exercises in the list.
      if (!Array.isArray(window.currentWorkoutExercises) || window.currentWorkoutExercises.length === 0) {
        const h = $("#s5-hint");
        if (h) h.textContent = "Please add at least one exercise to the session before continuing.";
        return;
      }
      // If you have a review step, uncomment:
      // goToStep(6);
      // Otherwise, you could trigger save here or leave to a separate button.
      return;
    }
  }
  function updateNextButtonState() {
    const btn = /** @type {HTMLButtonElement} */($("#next-btn"));
    if (!btn) return;

    if (window.currentStep === 5) {
      btn.textContent = "Review";
      const disabled = !Array.isArray(window.currentWorkoutExercises) || window.currentWorkoutExercises.length === 0;
      btn.disabled = disabled;
      btn.classList.toggle("is-disabled", disabled);
    } else {
      btn.textContent = "Next";
      btn.disabled = false;
      btn.classList.remove("is-disabled");
    }
  }

  // ---------- Validation ----------
  function validateAndStore(step) {
    switch (step) {
      case 1: {
        const loc = $("#workout-type-select")?.value || "";
        if (!loc) { alert("Please select where you are training (Gym or Home)."); return false; }
        wizard.location = loc;
        return true;
      }
      case 2: {
        const chosen = $$("input[name='timing']:checked")[0];
        if (!chosen) { alert("Please select whether you're training now or recording a past session."); return false; }
        wizard.timing = chosen.value;
        const dt = /** @type {HTMLInputElement} */($("#workout-datetime"));
        if (wizard.timing === "past") {
          if (!dt || !dt.value) { alert("Please select a date/time for your past session."); return false; }
          wizard.datetime = dt.value;
        } else {
          wizard.datetime = nowIsoMinute();
        }
        return true;
      }
      case 3: {
        const catRaw = $("#work-on-select")?.value || "";
        if (!catRaw) { alert("Please select what you are training (e.g., Push, Pull, Lower Body, etc.)."); return false; }
        wizard.category = (typeof window.normalizeCategory === "function")
          ? window.normalizeCategory(catRaw)
          : catRaw.toLowerCase();
        if (wizard.category === "specific muscle") {
          const mus = $("#muscle-select")?.value || "";
          if (!mus) { alert("Please choose a specific muscle."); return false; }
          wizard.muscle = mus;
        } else {
          wizard.muscle = "";
        }
        return true;
      }
      case 4: {
        const eq = $("#equipment-select")?.value || "";
        if (!eq) { alert("Please select the equipment (e.g., Barbell, Dumbbell…)."); return false; }
        wizard.equipment = eq.toLowerCase();
        return true;
      }
      case 5: {
        // validation of set inputs happens when adding an exercise
        return true;
      }
      default:
        return true;
    }
  }

  // ---------- Step 5: Exercises ----------
  function populateExercises() {
    const select = /** @type {HTMLSelectElement} */($("#exercise-select"));
    if (!select) return;

    // Build a filtered list from EXERCISES (case-insensitive)
    const raw = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
    const data = raw.map(e => ({
      name: String(e.name || ""),
      sections: Array.isArray(e.sections) ? e.sections.map(s => String(s).toLowerCase().trim()) : [],
      equipment: Array.isArray(e.equipment) ? e.equipment.map(eq => String(eq).toLowerCase().trim()) : [],
      muscles: Array.isArray(e.muscles) ? e.muscles.map(m => String(m)) : []
    }));

    let pool = byLocation(data, wizard.location);

    if (wizard.category === "specific muscle") {
      if (wizard.muscle) {
        const mLow = wizard.muscle.toLowerCase();
        pool = pool.filter(e =>
          e.sections.includes("specific muscle") &&
          e.muscles.some(m => String(m).toLowerCase() === mLow)
        );
      } else {
        pool = pool.filter(e => e.sections.includes("specific muscle"));
      }
    } else if (wizard.category) {
      pool = pool.filter(e => e.sections.includes(wizard.category));
    }

    if (wizard.equipment) {
      pool = pool.filter(e => e.equipment.includes(wizard.equipment));
    }

    const names = uniq(pool.map(e => e.name)).sort((a, b) => a.localeCompare(b));
    select.innerHTML =
      `<option value="">--Select--</option>` +
      names.map(n => `<option value="${n}">${n}</option>`).join("");

    // Restore if still valid
    if (wizard.exercise && names.includes(wizard.exercise)) {
      select.value = wizard.exercise;
    } else {
      select.value = "";
      wizard.exercise = "";
    }
  }

  // ---------- Step 5: Insights (Last/Best with reps if present) ----------
  function showExerciseInsights() {
    const box = $("#exercise-insights");
    if (!box) return;
    const name = wizard.exercise;
    if (!name) { box.innerHTML = ""; return; }

    const hist = (JSON.parse(localStorage.getItem("userWorkoutData") || "{}"))[name];
    if (!hist || !Array.isArray(hist.records) || hist.records.length === 0) {
      box.innerHTML = `Last: <em>no history</em> • Heaviest: <em>no history</em>`;
      return;
    }

    const recsDesc = hist.records.slice().sort((a,b)=>new Date(b.date) - new Date(a.date));
    const last = recsDesc[0];

    // Extract heaviest with reps for "last"
    const { maxW: lastW, repsAt: lastR } = heaviestWithReps(last);
    // Extract best with reps overall
    const bestW = hist.bestWeight;
    let bestR = null, bestDate = null;
    for (let i = recsDesc.length - 1; i >= 0; i--) {
      const r = recsDesc[i];
      const { indexOfMax, weights, reps } = heaviestWithReps(r, true);
      if (typeof bestW === "number" && weights.includes(bestW)) {
        bestR = (indexOfMax >= 0 && Array.isArray(reps)) ? reps[indexOfMax] : null;
        bestDate = r.date;
        break;
      }
    }

    box.innerHTML =
      `Last: <strong>${fmtWeightReps(lastW, lastR)}</strong> (${fmtDate(last?.date)}) &nbsp;•&nbsp; ` +
      `Heaviest: <strong>${fmtWeightReps(bestW, bestR)}</strong>${bestDate ? ` (${fmtDate(bestDate)})` : ""}`;
  }

  function heaviestWithReps(record, returnArrays = false) {
    let weights = [], reps = [];
    if (Array.isArray(record.setWeightsL) && Array.isArray(record.setWeightsR)) {
      weights = [...record.setWeightsL, ...record.setWeightsR];
      reps = [
        ...(Array.isArray(record.setRepsL) ? record.setRepsL : Array(record.setWeightsL.length).fill(null)),
        ...(Array.isArray(record.setRepsR) ? record.setRepsR : Array(record.setWeightsR.length).fill(null))
      ];
    } else if (Array.isArray(record.setWeights)) {
      weights = record.setWeights.slice();
      reps = Array.isArray(record.setReps) ? record.setReps.slice() : Array(weights.length).fill(null);
    } else if (typeof record.maxWeight === "number") {
      weights = [record.maxWeight];
      reps = [Array.isArray(record.setReps) && record.setReps.length ? record.setReps[0] : (record.reps ?? null)];
    }
    const maxW = weights.length ? Math.max(...weights) : (record.maxWeight ?? 0);
    const idx = weights.findIndex(w => w === maxW);
    const repsAt = (idx >= 0 && Array.isArray(reps)) ? reps[idx] : null;
    if (returnArrays) return { maxW, repsAt, indexOfMax: idx, weights, reps };
    return { maxW, repsAt };
  }

  function fmtWeightReps(w, r) {
    if (w == null) return "—";
    if (r == null) return `${stripZeros(w)}kg`;
    return `${stripZeros(w)}kg × ${stripZeros(r)}`;
    function stripZeros(n) {
      if (!Number.isFinite(n)) return n;
      const s = String(n);
      return s.includes(".") ? s.replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1") : s;
    }
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(); } catch { return "—"; }
  }

  // ---------- Step 5: render sets (with per-set Prev markers) ----------
  function renderSetRows() {
    const container = ensureSetsContainer();
    container.innerHTML = "";

    // Ensure movement type select exists (if your HTML includes it, this just syncs value)
    ensureMovementTypeSelect();

    const n = Math.max(1, toInt($("#sets-input")?.value, 3));
    wizard.sets = n;

    if (!wizard.exercise) {
      container.innerHTML = `<div class="hint">Select an exercise to enter sets.</div>`;
      return;
    }

    // compute previous per-set values for this exercise from localStorage
    const prev = computePrevPerSet(wizard.exercise, wizard.movementType, n);

    if (wizard.movementType === "unilateral") {
      // LEFT
      const left = document.createElement("div");
      left.className = "form-group";
      left.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
      container.appendChild(left);
      const gl = left.querySelector("#sets-grid-left");
      for (let i = 1; i <= n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevVal = (prev.prevL && prev.prevL[i - 1] !== "" && prev.prevL[i - 1] != null) ? prev.prevL[i - 1] : "";
        row.innerHTML = `
          <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)" data-side="L" data-kind="reps" data-idx="${i-1}">
          <span class="prev-weight">Prev: ${prevVal === "" ? "—" : (prevVal + "kg")}</span>
          <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (L)" data-side="L" data-kind="weight" data-idx="${i-1}">
        `;
        gl.appendChild(row);
      }

      // RIGHT
      const right = document.createElement("div");
      right.className = "form-group";
      right.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
      container.appendChild(right);
      const gr = right.querySelector("#sets-grid-right");
      for (let i = 1; i <= n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevVal = (prev.prevR && prev.prevR[i - 1] !== "" && prev.prevR[i - 1] != null) ? prev.prevR[i - 1] : "";
        row.innerHTML = `
          <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)" data-side="R" data-kind="reps" data-idx="${i-1}">
          <span class="prev-weight">Prev: ${prevVal === "" ? "—" : (prevVal + "kg")}</span>
          <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)" data-side="R" data-kind="weight" data-idx="${i-1}">
        `;
        gr.appendChild(row);
      }
    } else {
      const wrap = document.createElement("div");
      wrap.className = "form-group";
      wrap.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
      container.appendChild(wrap);
      const grid = wrap.querySelector("#sets-grid");
      for (let i = 1; i <= n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevVal = (prev.prev && prev.prev[i - 1] !== "" && prev.prev[i - 1] != null) ? prev.prev[i - 1] : "";
        row.innerHTML = `
          <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i-1}">
          <span class="prev-weight">Prev: ${prevVal === "" ? "—" : (prevVal + "kg")}</span>
          <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i-1}">
        `;
        grid.appendChild(row);
      }
    }
  }

  function ensureSetsContainer() {
    let el = $("#sets-grids-wrapper");
    if (!el) {
      el = document.createElement("div");
      el.id = "sets-grids-wrapper";
      const anchor = $("#exercise-inputs") || $("#step5-anchor") || $("#exercise-select")?.parentElement;
      (anchor || document.body).appendChild(el);
    }
    return el;
  }

  function ensureMovementTypeSelect() {
    let wrap = $("#movement-type-wrap");
    if (!wrap) {
      const after = $("#exercise-select")?.closest(".form-group") || $("#exercise-select-group") || $("#exercise-select")?.parentElement;
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
      if (after?.parentElement) after.parentElement.insertBefore(wrap, after.nextSibling);
      else document.body.appendChild(wrap);
      // bind
      $("#movement-type-select").addEventListener("change", (e) => {
        wizard.movementType = e.target.value || "bilateral";
        renderSetRows();
      });
    }
    $("#movement-type-select").value = wizard.movementType || "bilateral";
  }

  // Compute previous per-set weights from last record of this exercise
  function computePrevPerSet(exName, movementType, setsCount) {
    const blank = Array(setsCount).fill("");
    if (!exName) return movementType === "unilateral"
      ? { prevL: blank.slice(), prevR: blank.slice() }
      : { prev: blank.slice() };

    const data = JSON.parse(localStorage.getItem("userWorkoutData") || "{}");
    const hist = data[exName];
    if (!hist || !Array.isArray(hist.records) || hist.records.length === 0) {
      return movementType === "unilateral"
        ? { prevL: blank.slice(), prevR: blank.slice() }
        : { prev: blank.slice() };
    }
    const last = hist.records.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0];

    if (movementType === "unilateral") {
      const prevL = blank.slice();
      const prevR = blank.slice();
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
        for (let i = 0; i < setsCount; i++) prevL[i] = prevR[i] = last.maxWeight;
      }
      return { prevL, prevR };
    }

    const prev = blank.slice();
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
      for (let i = 0; i < setsCount; i++) prev[i] = last.maxWeight;
    }
    return { prev };
  }

  // ---------- Add Exercise to session list ----------
  function addExerciseToWorkout() {
    // collect + validate current set inputs
    if (!wizard.exercise) { alert("Please select an exercise."); return; }

    const n = Math.max(1, toInt($("#sets-input")?.value, 3));
    wizard.sets = n;

    if (wizard.movementType === "unilateral") {
      const repsL = $$('#sets-grids-wrapper [data-side="L"][data-kind="reps"]').map(i => toInt(i.value, 0));
      const wtsL  = $$('#sets-grids-wrapper [data-side="L"][data-kind="weight"]').map(i => toNum(i.value, 0));
      const repsR = $$('#sets-grids-wrapper [data-side="R"][data-kind="reps"]').map(i => toInt(i.value, 0));
      const wtsR  = $$('#sets-grids-wrapper [data-side="R"][data-kind="weight"]').map(i => toNum(i.value, 0));

      if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
          repsL.some(v => v <= 0) || repsR.some(v => v <= 0)) {
        const h = $("#s5-hint"); if (h) h.textContent = "Please fill reps & weight for every set on both Left and Right.";
        return;
      }

      wizard.setRepsL = repsL; wizard.setWeightsL = wtsL;
      wizard.setRepsR = repsR; wizard.setWeightsR = wtsR;

      const maxL = wtsL.length ? Math.max(...wtsL) : 0;
      const maxR = wtsR.length ? Math.max(...wtsR) : 0;
      const overall = Math.max(maxL, maxR);
      const cnt = [...wtsL, ...wtsR].filter(w => w === overall).length;
      wizard.maxWeight = overall;
      wizard.maxWeightSetCount = cnt;

      wizard.setReps = []; wizard.setWeights = [];
    } else {
      const reps = $$('#sets-grids-wrapper [data-kind="reps"]').map(i => toInt(i.value, 0));
      const wts  = $$('#sets-grids-wrapper [data-kind="weight"]').map(i => toNum(i.value, 0));
      if (reps.length !== n || wts.length !== n || reps.some(v => v <= 0)) {
        const h = $("#s5-hint"); if (h) h.textContent = "Please fill reps & weight for every set.";
        return;
      }
      wizard.setReps = reps; wizard.setWeights = wts;
      const maxW = wts.length ? Math.max(...wts) : 0;
      const cnt = wts.filter(w => w === maxW).length;
      wizard.maxWeight = maxW; wizard.maxWeightSetCount = cnt;

      wizard.setRepsL = []; wizard.setWeightsL = [];
      wizard.setRepsR = []; wizard.setWeightsR = [];
    }

    // Build exercise object and push to currentWorkoutExercises
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
    window.currentWorkoutExercises.push(ex);

    // Show in current list if your UI has it (optional simple render)
    renderCurrentWorkoutList();

    // Reset exercise-specific inputs for convenience
    const exSel = /** @type {HTMLSelectElement} */($("#exercise-select"));
    if (exSel) exSel.value = "";
    wizard.exercise = "";
    $("#sets-input").value = "3";
    wizard.sets = 3;
    wizard.movementType = "bilateral";
    $("#movement-type-select").value = "bilateral";
    wizard.setReps = []; wizard.setWeights = [];
    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
    wizard.maxWeight = 0; wizard.maxWeightSetCount = 0;
    renderSetRows();

    updateNextButtonState();
  }
  window.addExerciseToWorkout = addExerciseToWorkout; // in case others call it

  // Simple current list renderer (optional; your session.js may replace this)
  function renderCurrentWorkoutList() {
    const wrap = $("#current-workout-list-container");
    const list = $("#current-workout-list");
    if (!wrap || !list) return;
    list.innerHTML = "";
    if (!window.currentWorkoutExercises.length) { wrap.style.display = "none"; return; }
    wrap.style.display = "block";
    window.currentWorkoutExercises.forEach((ex, idx) => {
      const div = document.createElement("div");
      div.className = "workout-item";
      let body = "";
      if (ex.movementType === "unilateral") {
        const pairsL = ex.setRepsL.map((r, i) => `${r}x${ex.setWeightsL[i]}kg`).join(", ");
        const pairsR = ex.setRepsR.map((r, i) => `${r}x${ex.setWeightsR[i]}kg`).join(", ");
        const maxL = ex.setWeightsL.length ? Math.max(...ex.setWeightsL) : 0;
        const maxR = ex.setWeightsR.length ? Math.max(...ex.setWeightsR) : 0;
        const cntL = ex.setWeightsL.filter(w => w === maxL).length;
        const cntR = ex.setWeightsR.filter(w => w === maxR).length;
        body = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${maxL}kg × ${cntL} • Heaviest Right: ${maxR}kg × ${cntR}</div>
        `;
      } else {
        const pairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
        body = `
          <div>${ex.sets} sets → ${pairs || "—"}</div>
          <div>Heaviest: ${ex.maxWeight}kg × ${ex.maxWeightSetCount}</div>
        `;
      }

      const meta = `${cap(ex.category)} • ${cap(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${cap(ex.movementType)}`;
      div.innerHTML = `
        <strong>${ex.name}</strong> <small>(${meta})</small><br>
        ${body}
        <button style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;"
          onclick="(function(i){ window.currentWorkoutExercises.splice(i,1); (${renderCurrentWorkoutList.toString()})(); ((${updateNextButtonState.toString()})()) })(${idx})">Remove</button>
      `;
      list.appendChild(div);
    });
  }

})();
