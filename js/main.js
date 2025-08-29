/* =======================================================================
   filters.js
   Populates: categories, muscles, equipment, exercises.
   Ensures Step 5 sets grid is rendered whenever the exercise or movement
   type changes. No resets after Add.
   Depends on:
     - window.EXERCISES (from exercises.js)
     - wizard, byLocation(), normalizeCategory(), title(), uniq()
     - renderSetRows(), showExerciseInsights()
======================================================================= */

(function() {
  const RAW = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
  const NORM = RAW.map(e => ({
    name: e.name,
    sections: (e.sections || []).map(s => String(s).toLowerCase().trim()),
    equipment: (e.equipment || []).map(s => String(s).toLowerCase().trim()),
    muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
  }));

  const CATEGORY_WHITELIST = new Set([
    "upper body", "lower body", "push", "pull",
    "hinge", "squat", "full body", "core", "specific muscle"
  ]);

  function allCategories() {
    const set = new Set();
    for (const e of NORM) {
      for (const s of e.sections) if (CATEGORY_WHITELIST.has(s)) set.add(s);
    }
    return [...set].sort();
  }
  function allMuscles() {
    const set = new Set();
    for (const e of NORM) (e.muscles || []).forEach(m => set.add(m));
    return [...set].sort((a,b)=>a.localeCompare(b));
  }
  function uniq(arr){ return [...new Set(arr)]; }
  function title(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  window._EX_NORM = NORM; // debug access

  // ----- Step 3: What are you working on (category + muscle) -----
  window.populateWorkOnDropdown = function populateWorkOnDropdown() {
    const cats = allCategories();
    const sel = document.getElementById("work-on-select");
    sel.innerHTML = `<option value="">--Select--</option>` + cats.map(c => `<option value="${c}">${title(c)}</option>`).join("");
    if (wizard.category) sel.value = wizard.category;

    // Muscles
    const musSel = document.getElementById("muscle-select");
    const musGrp = document.getElementById("muscle-select-group");
    const muscles = allMuscles();
    musSel.innerHTML = `<option value="">--Select--</option>` + muscles.map(m => `<option value="${m}">${m}</option>`).join("");
    if (wizard.muscle) musSel.value = wizard.muscle;

    sel.onchange = () => {
      const v = normalizeCategory(sel.value);
      wizard.category = v;
      if (v === "specific muscle") {
        musGrp.style.display = "block";
      } else {
        musGrp.style.display = "none";
        wizard.muscle = "";
        musSel.value = "";
      }
      // Clear downstream
      document.getElementById("equipment-select").innerHTML = `<option value="">--Select--</option>`;
      document.getElementById("exercise-select").innerHTML = `<option value="">--Select--</option>`;
    };
    musSel.onchange = () => { wizard.muscle = musSel.value; };
  };

  // ----- Step 4: Equipment -----
  window.populateEquipment = function populateEquipment() {
    const sel = document.getElementById("equipment-select");
    sel.innerHTML = `<option value="">--Select--</option>`;

    const pool = byLocation(NORM, wizard.location);
    let filtered = pool.filter(e => e.sections.includes(wizard.category));
    if (wizard.category === "specific muscle" && wizard.muscle) {
      filtered = filtered.filter(e => (e.muscles || []).includes(wizard.muscle));
    }

    const eqs = uniq(filtered.flatMap(e => e.equipment)).sort((a,b)=>a.localeCompare(b));
    sel.innerHTML += eqs.map(eq => `<option value="${eq}">${title(eq)}</option>`).join("");

    if (eqs.includes(wizard.equipment)) sel.value = wizard.equipment;

    sel.onchange = () => {
      wizard.equipment = sel.value;
      populateExercises();
    };
  };

  // ----- Step 5: Exercises (plus movement type control) -----
  window.populateExercises = function populateExercises() {
    const sel = document.getElementById("exercise-select");
    sel.innerHTML = `<option value="">--Select--</option>`;

    const pool = byLocation(NORM, wizard.location);
    let filtered = pool.filter(e => e.sections.includes(wizard.category));
    if (wizard.category === "specific muscle" && wizard.muscle) {
      filtered = filtered.filter(e => (e.muscles || []).includes(wizard.muscle));
    }
    if (wizard.equipment) {
      filtered = filtered.filter(e => e.equipment.includes(wizard.equipment));
    }

    const names = uniq(filtered.map(e => e.name)).sort((a,b)=>a.localeCompare(b));
    sel.innerHTML += names.map(n => `<option value="${n}">${n}</option>`).join("");
    if (names.includes(wizard.exercise)) sel.value = wizard.exercise;

    // Movement type control (bilateral/unilateral)
    ensureMovementTypeControl();

    // Insights + render grid
    showExerciseInsights(sel.value || null);
    renderSetRows();

    sel.onchange = () => {
      wizard.exercise = sel.value;
      showExerciseInsights(wizard.exercise);
      renderSetRows();
    };
  };

  function ensureMovementTypeControl() {
    let wrap = document.getElementById("movement-type-wrap");
    if (!wrap) {
      const host = document.getElementById("exercise-select").closest(".form-group");
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
      host.parentElement.insertBefore(wrap, host.nextSibling);
      wrap.querySelector("#movement-type-select").addEventListener("change", (e) => {
        wizard.movementType = e.target.value;
        renderSetRows();
      });
    }
    wrap.querySelector("#movement-type-select").value = wizard.movementType || "bilateral";
  }
})();
