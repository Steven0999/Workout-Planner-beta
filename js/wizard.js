/* =========================================================================
   Wizard: Category → Muscle (optional) → Equipment → Exercise → Sets
   - Per-set “Prev” markers (weight × reps) from last session for that set
   - Bilateral/Unilateral toggle (L/R grids for unilateral)
   - Adds item to current session list (expects #add-exercise-btn)
   -------------------------------------------------------------------------
   Assumptions / IDs in the HTML:
     #work-on-select           (category)
     #muscle-select            (muscle, shown only when category === "specific muscle")
     #muscle-select-group      (container to show/hide muscle select)
     #equipment-select         (equipment)
     #exercise-select          (exercise)
     #sets-input               (number of sets)
     #add-exercise-btn         (button to add exercise to session)
     #sets-area                (container where the set inputs are rendered)
     #movement-type-select     (select with "bilateral" | "unilateral")  -- if missing, this script will inject it
     localStorage key: "userWorkoutData"
     Global (optional): window.EXERCISES (exercise library)
   ========================================================================= */

(function(){
  // -----------------------------
  // Safe helpers / fallbacks
  // -----------------------------
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const uniq = (arr) => [...new Set(arr)];
  const toInt   = (v, d=0) => { const n = parseInt(v,10); return Number.isFinite(n) ? n : d; };
  const toFloat = (v, d=0) => { const n = parseFloat(v);  return Number.isFinite(n) ? n : d; };
  const nowIsoMinute = () => new Date().toISOString().slice(0,16);

  // User data store
  let userWorkoutData = {};
  try {
    userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
  } catch { userWorkoutData = {}; }

  // Current session storage – if your app keeps this elsewhere, we also mirror to window
  let currentWorkoutExercises = Array.isArray(window.currentWorkoutExercises) ? window.currentWorkoutExercises : [];
  window.currentWorkoutExercises = currentWorkoutExercises;

  // Exercise library (must be loaded before this file ideally)
  const RAW = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];

  // Normalize: name (str), sections (array lowercased), equipment (array lowercased), muscles (array)
  const EX = RAW.map(e => ({
    name: String(e.name || "").trim(),
    sections: (Array.isArray(e.sections) ? e.sections : []).map(s => String(s).toLowerCase().trim()),
    equipment: (Array.isArray(e.equipment) ? e.equipment : (e.equipment ? [e.equipment] : [])).map(eq => String(eq).toLowerCase().trim()),
    muscles: (Array.isArray(e.muscles) ? e.muscles : []).map(m => String(m).trim())
  })).filter(e => e.name);

  const HOME_EQUIPMENT = new Set(["body weight","resistance bands","kettlebell"]);

  // Category list (suppress muscle names showing here)
  const CATEGORY_WHITELIST = new Set([
    "upper body","lower body","full body","push","pull","legs","hinge","squat","core","specific muscle"
  ]);

  const ALL_CATEGORIES = uniq(EX.flatMap(e => e.sections)).filter(s => CATEGORY_WHITELIST.has(s)).sort();
  const ALL_MUSCLES    = uniq(EX.flatMap(e => e.muscles)).sort();

  // Wizard-local state
  const state = {
    location: "gym",               // gym | home (if you have a step for it)
    category: "",
    muscle: "",
    equipment: "",
    exercise: "",
    movementType: "bilateral",     // bilateral | unilateral
    sets: 3
  };

  // -----------------------------
  // Initialization
  // -----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    // Wire category & muscle & equipment & exercise selects
    initCategorySelect();
    initMuscleSelect();
    initEquipmentSelect();
    initExerciseSelect();
    initSetsAndMovementControls();

    // Button to add exercise
    const addBtn = $("#add-exercise-btn");
    if (addBtn) addBtn.addEventListener("click", addExerciseToSession);

    // If your app sets location elsewhere, we keep a listener (optional)
    $("#workout-type-select")?.addEventListener("change", () => {
      state.location = $("#workout-type-select").value || "gym";
      populateEquipment();   // refresh available equipment for location
      populateExercises();   // refresh exercises for changed equipment pool
      renderSetInputs();     // refresh prev markers
    });

    // First paint
    populateCategory();
    populateMuscle();
    populateEquipment();
    populateExercises();
    renderSetInputs();
  });

  // -----------------------------
  // Select setup & population
  // -----------------------------
  function initCategorySelect() {
    const sel = $("#work-on-select");
    if (!sel) return;
    sel.addEventListener("change", () => {
      const v = sel.value || "";
      state.category = v;
      // show/hide muscle group
      const group = $("#muscle-select-group");
      if (group) group.style.display = (v === "specific muscle") ? "block" : "none";
      if (v !== "specific muscle") {
        state.muscle = "";
        const musSel = $("#muscle-select");
        if (musSel) musSel.value = "";
      }
      state.equipment = "";
      state.exercise = "";
      populateEquipment();
      populateExercises();
      renderSetInputs();
    });
  }

  function populateCategory() {
    const sel = $("#work-on-select");
    if (!sel) return;
    const opts = ["", ...ALL_CATEGORIES];
    sel.innerHTML = opts.map(o => `<option value="${o}">${o ? o : "--Select--"}</option>`).join("");
    sel.value = state.category || "";
    // muscle group visibility
    const group = $("#muscle-select-group");
    if (group) group.style.display = (state.category === "specific muscle") ? "block" : "none";
  }

  function initMuscleSelect() {
    const sel = $("#muscle-select");
    if (!sel) return;
    sel.addEventListener("change", () => {
      state.muscle = sel.value || "";
      state.equipment = "";
      state.exercise = "";
      populateEquipment();
      populateExercises();
      renderSetInputs();
    });
  }

  function populateMuscle() {
    const sel = $("#muscle-select");
    if (!sel) return;
    const opts = ["", ...ALL_MUSCLES];
    sel.innerHTML = opts.map(o => `<option value="${o}">${o ? o : "--Select--"}</option>`).join("");
    sel.value = state.muscle || "";
  }

  function initEquipmentSelect() {
    const sel = $("#equipment-select");
    if (!sel) return;
    sel.addEventListener("change", () => {
      state.equipment = sel.value || "";
      state.exercise = "";
      populateExercises();
      renderSetInputs();
    });
  }

  function populateEquipment() {
    const sel = $("#equipment-select");
    if (!sel) return;
    const pool = filterByLocation(EX, state.location);
    const subset = filterByCategoryAndMuscle(pool, state.category, state.muscle);
    const eqs = uniq(subset.flatMap(e => e.equipment)).sort();
    sel.innerHTML = ["", ...eqs].map(eq => `<option value="${eq}">${eq ? cap(eq) : "--Select--"}</option>`).join("");
    sel.value = eqs.includes(state.equipment) ? state.equipment : "";
  }

  function initExerciseSelect() {
    const sel = $("#exercise-select");
    if (!sel) return;
    sel.addEventListener("change", () => {
      state.exercise = sel.value || "";
      renderSetInputs();
    });
  }

  function populateExercises() {
    const sel = $("#exercise-select");
    if (!sel) return;
    let pool = filterByLocation(EX, state.location);
    pool = filterByCategoryAndMuscle(pool, state.category, state.muscle);
    if (state.equipment) pool = pool.filter(e => e.equipment.includes(state.equipment));

    // Optional: live search term (if you added a search box with id #exercise-search)
    const term = ($("#exercise-search")?.value || "").trim().toLowerCase();
    if (term) {
      pool = pool.filter(e =>
        e.name.toLowerCase().includes(term) ||
        e.sections.some(s => s.includes(term)) ||
        e.equipment.some(eq => eq.includes(term))
      );
    }

    const names = uniq(pool.map(e => e.name)).sort((a,b) => a.localeCompare(b));
    sel.innerHTML = ["", ...names].map(n => `<option value="${n}">${n ? n : "--Select--"}</option>`).join("");
    sel.value = names.includes(state.exercise) ? state.exercise : "";
  }

  // -----------------------------
  // Movement + Sets + Inputs
  // -----------------------------
  function initSetsAndMovementControls() {
    // Movement type (inject if missing)
    let mt = $("#movement-type-select");
    if (!mt) {
      const exGroup = $("#exercise-select")?.closest(".form-group");
      if (exGroup?.parentElement) {
        const wrap = document.createElement("div");
        wrap.className = "form-group";
        wrap.innerHTML = `
          <label for="movement-type-select">Movement Type</label>
          <select id="movement-type-select">
            <option value="bilateral">Bilateral</option>
            <option value="unilateral">Unilateral</option>
          </select>
        `;
        exGroup.parentElement.insertBefore(wrap, exGroup.nextSibling);
        mt = wrap.querySelector("#movement-type-select");
      }
    }
    if (mt) {
      mt.value = state.movementType;
      mt.addEventListener("change", () => {
        state.movementType = mt.value;
        renderSetInputs();
      });
    }

    const setsInput = $("#sets-input");
    if (setsInput) {
      setsInput.value = state.sets;
      setsInput.addEventListener("change", () => {
        state.sets = Math.max(1, toInt(setsInput.value, 3));
        renderSetInputs();
      });
    }

    // Optional: live search field for exercises
    const exSearch = $("#exercise-search");
    if (exSearch) {
      exSearch.addEventListener("input", () => {
        populateExercises();
      });
    }
  }

  function renderSetInputs() {
    const area = $("#sets-area");
    if (!area) return;

    area.innerHTML = "";  // clear

    const sets = Math.max(1, toInt($("#sets-input")?.value, state.sets || 3));
    state.sets = sets;

    if (!state.exercise) {
      area.innerHTML = `<p class="hint">Choose an exercise to enter reps & weights.</p>`;
      return;
    }

    // compute per-set prev markers
    const prev = getPerSetPrev(state.exercise, state.movementType, sets);

    if (state.movementType === "unilateral") {
      // Left
      const leftWrap = document.createElement("div");
      leftWrap.className = "form-group";
      leftWrap.innerHTML = `<label>Left Side — Reps & Weight</label><div class="sets-grid" id="sets-grid-left"></div>`;
      area.appendChild(leftWrap);

      const gridL = $("#sets-grid-left", leftWrap);
      for (let i = 0; i < sets; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const p = prev.prevL[i];
        row.innerHTML = `
          <input type="number" min="1" step="1" class="rep-input"    data-side="L" data-idx="${i}" placeholder="Set ${i+1}: Reps (L)">
          <span class="prev-weight">Prev: ${p ? `${p.w}kg × ${p.r ?? "?"}` : "—"}</span>
          <input type="number" min="0" step="0.5" class="weight-input" data-side="L" data-idx="${i}" placeholder="Set ${i+1}: Weight (kg) (L)">
        `;
        gridL.appendChild(row);
      }

      // Right
      const rightWrap = document.createElement("div");
      rightWrap.className = "form-group";
      rightWrap.innerHTML = `<label>Right Side — Reps & Weight</label><div class="sets-grid" id="sets-grid-right"></div>`;
      area.appendChild(rightWrap);

      const gridR = $("#sets-grid-right", rightWrap);
      for (let i = 0; i < sets; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const p = prev.prevR[i];
        row.innerHTML = `
          <input type="number" min="1" step="1" class="rep-input"    data-side="R" data-idx="${i}" placeholder="Set ${i+1}: Reps (R)">
          <span class="prev-weight">Prev: ${p ? `${p.w}kg × ${p.r ?? "?"}` : "—"}</span>
          <input type="number" min="0" step="0.5" class="weight-input" data-side="R" data-idx="${i}" placeholder="Set ${i+1}: Weight (kg) (R)">
        `;
        gridR.appendChild(row);
      }

    } else {
      // bilateral single grid
      const single = document.createElement("div");
      single.className = "form-group";
      single.innerHTML = `<label>Reps & Weight</label><div class="sets-grid" id="sets-grid"></div>`;
      area.appendChild(single);

      const grid = $("#sets-grid", single);
      for (let i = 0; i < sets; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const p = prev.prev[i];
        row.innerHTML = `
          <input type="number" min="1" step="1" class="rep-input"    data-idx="${i}" placeholder="Set ${i+1}: Reps">
          <span class="prev-weight">Prev: ${p ? `${p.w}kg × ${p.r ?? "?"}` : "—"}</span>
          <input type="number" min="0" step="0.5" class="weight-input" data-idx="${i}" placeholder="Set ${i+1}: Weight (kg)">
        `;
        grid.appendChild(row);
      }
    }
  }

  // -----------------------------
  // Per-set Prev marker logic
  // -----------------------------
  function getPerSetPrev(exName, movementType, setsCount) {
    const blankN = () => Array.from({length: setsCount}, () => null);
    const recs = (userWorkoutData[exName]?.records || [])
      .slice()
      .sort((a,b) => new Date(b.date) - new Date(a.date));
    const last = recs[0];

    if (!last) {
      return movementType === "unilateral"
        ? { prevL: blankN(), prevR: blankN() }
        : { prev: blankN() };
    }

    if (movementType === "unilateral") {
      const PL = blankN(), PR = blankN();

      const lwL = Array.isArray(last.setWeightsL) ? last.setWeightsL : [];
      const lrL = Array.isArray(last.setRepsL)    ? last.setRepsL    : [];
      const lwR = Array.isArray(last.setWeightsR) ? last.setWeightsR : [];
      const lrR = Array.isArray(last.setRepsR)    ? last.setRepsR    : [];

      // if last was bilateral, mirror to both sides
      const bw  = Array.isArray(last.setWeights) ? last.setWeights : [];
      const br  = Array.isArray(last.setReps)    ? last.setReps    : [];

      for (let i=0;i<setsCount;i++){
        if (lwL[i] != null) PL[i] = { w: lwL[i], r: lrL[i] ?? null };
        else if (bw[i] != null) PL[i] = { w: bw[i], r: br[i] ?? null };

        if (lwR[i] != null) PR[i] = { w: lwR[i], r: lrR[i] ?? null };
        else if (bw[i] != null) PR[i] = { w: bw[i], r: br[i] ?? null };
      }
      return { prevL: PL, prevR: PR };
    }

    // bilateral
    const P = blankN();
    const bw  = Array.isArray(last.setWeights) ? last.setWeights : [];
    const br  = Array.isArray(last.setReps)    ? last.setReps    : [];

    const lwL = Array.isArray(last.setWeightsL) ? last.setWeightsL : [];
    const lrL = Array.isArray(last.setRepsL)    ? last.setRepsL    : [];
    const lwR = Array.isArray(last.setWeightsR) ? last.setWeightsR : [];
    const lrR = Array.isArray(last.setRepsR)    ? last.setRepsR    : [];

    for (let i=0;i<setsCount;i++){
      if (bw[i] != null) {
        P[i] = { w: bw[i], r: br[i] ?? null };
      } else {
        // if last was unilateral, pick the heavier of L/R for hint
        const l = lwL[i] ?? null, r = lwR[i] ?? null;
        if (l != null || r != null) {
          const w = Math.max(l ?? -Infinity, r ?? -Infinity);
          // reps: take the reps from the side that matched the chosen w if available
          let reps = null;
          if (w === l && lrL[i] != null) reps = lrL[i];
          else if (w === r && lrR[i] != null) reps = lrR[i];
          P[i] = { w, r: reps };
        }
      }
    }
    return { prev: P };
  }

  // -----------------------------
  // Add Exercise to Session
  // -----------------------------
  function addExerciseToSession() {
    if (!state.exercise) { alert("Choose an exercise."); return; }
    const sets = Math.max(1, toInt($("#sets-input")?.value, state.sets || 3));
    state.sets = sets;

    if (state.movementType === "unilateral") {
      const repsL = $$('#sets-grid-left .rep-input').map(i => toInt(i.value, 0));
      const wtsL  = $$('#sets-grid-left .weight-input').map(i => toFloat(i.value, 0));
      const repsR = $$('#sets-grid-right .rep-input').map(i => toInt(i.value, 0));
      const wtsR  = $$('#sets-grid-right .weight-input').map(i => toFloat(i.value, 0));

      if (repsL.length !== sets || wtsL.length !== sets || repsR.length !== sets || wtsR.length !== sets ||
          repsL.some(v => v <= 0) || wtsL.some(v => v < 0) || repsR.some(v => v <= 0) || wtsR.some(v => v < 0)) {
        alert("Please complete reps and weights for every set on Left and Right.");
        return;
      }

      const maxL = wtsL.length ? Math.max(...wtsL) : 0;
      const maxR = wtsR.length ? Math.max(...wtsR) : 0;
      const maxW = Math.max(maxL, maxR);

      const item = {
        id: Date.now().toString(),
        name: state.exercise,
        category: state.category,
        muscle: state.category === "specific muscle" ? state.muscle : null,
        equipment: state.equipment,
        movementType: "unilateral",
        sets,
        setRepsL: repsL, setWeightsL: wtsL,
        setRepsR: repsR, setWeightsR: wtsR,
        maxWeight: maxW
      };

      currentWorkoutExercises.push(item);
      window.currentWorkoutExercises = currentWorkoutExercises;
      alert(`Added: ${item.name} (Unilateral)`);
      // keep UI; do not reset other choices

    } else {
      const reps = $$('#sets-grid .rep-input').map(i => toInt(i.value, 0));
      const wts  = $$('#sets-grid .weight-input').map(i => toFloat(i.value, 0));

      if (reps.length !== sets || wts.length !== sets || reps.some(v => v <= 0) || wts.some(v => v < 0)) {
        alert("Please complete reps and weights for every set.");
        return;
      }

      const maxW = wts.length ? Math.max(...wts) : 0;

      const item = {
        id: Date.now().toString(),
        name: state.exercise,
        category: state.category,
        muscle: state.category === "specific muscle" ? state.muscle : null,
        equipment: state.equipment,
        movementType: "bilateral",
        sets,
        setReps: reps, setWeights: wts,
        maxWeight: maxW
      };

      currentWorkoutExercises.push(item);
      window.currentWorkoutExercises = currentWorkoutExercises;
      alert(`Added: ${item.name}`);
      // keep UI; do not reset other choices
    }
  }

  // -----------------------------
  // Filtering helpers
  // -----------------------------
  function filterByLocation(items, location) {
    if (location === "home") {
      return items.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.has(eq)));
    }
    return items;
  }

  function normalizeCategory(c) {
    if (!c) return "";
    const s = String(c).toLowerCase().trim();
    if (s === "upper") return "upper body";
    if (s === "lower" || s === "legs") return "lower body";
    return s;
  }

  function filterByCategoryAndMuscle(items, category, muscle) {
    const cat = normalizeCategory(category);
    if (!cat) return [];
    if (cat === "specific muscle") {
      if (!muscle) return [];
      return items.filter(e => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle));
    }
    return items.filter(e => e.sections.includes(cat));
  }

  // Expose a couple of handy fns if you need them elsewhere
  window._wizard_refreshSets = renderSetInputs;
  window._wizard_populateExercises = populateExercises;

})();
