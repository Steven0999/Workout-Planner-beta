// js/filters.js
// Populates: categories (Step 3), muscles (Step 3), equipment (Step 4)
// Depends on: window.EXERCISES (from exercises.js)

(function () {
  const $ = (s) => document.querySelector(s);

  // Canonical top-level categories shown to the user
  const TOP_CATEGORIES = [
    "upper body",
    "lower body",
    "full body",
    "push",
    "pull",
    "hinge",
    "squat",
    "core",
    "specific muscle"
  ];

  function title(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function unique(arr) { return [...new Set(arr)]; }

  function allMusclesFromData() {
    const src = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
    return unique(
      src.flatMap((e) => Array.isArray(e.muscles) ? e.muscles.map(String) : [])
    ).sort((a, b) => a.localeCompare(b));
  }

  function populateCategories() {
    const sel = /** @type {HTMLSelectElement} */ ($("#work-on-select"));
    if (!sel) return;

    sel.innerHTML =
      `<option value="">--Select--</option>` +
      TOP_CATEGORIES.map((c) => `<option value="${c}">${title(c)}</option>`).join("");

    // Restore previously chosen value if still valid
    if (window.wizard?.category && TOP_CATEGORIES.includes(window.wizard.category)) {
      sel.value = window.wizard.category;
    } else {
      sel.value = "";
    }

    // Show/hide muscle group immediately
    toggleMuscleVisibility(sel.value);
  }

  function populateMuscles() {
    const musclesSel = /** @type {HTMLSelectElement} */ ($("#muscle-select"));
    if (!musclesSel) return;

    const muscles = allMusclesFromData();
    musclesSel.innerHTML =
      `<option value="">--Select--</option>` +
      muscles.map((m) => `<option value="${m}">${m}</option>`).join("");

    if (window.wizard?.muscle && muscles.includes(window.wizard.muscle)) {
      musclesSel.value = window.wizard.muscle;
    } else {
      musclesSel.value = "";
    }
  }

  function toggleMuscleVisibility(categoryValue) {
    const group = $("#muscle-select-group");
    if (!group) return;
    const isSpecific = String(categoryValue || "").toLowerCase() === "specific muscle";
    group.style.display = isSpecific ? "block" : "none";
    if (!isSpecific) {
      const musSel = $("#muscle-select");
      if (musSel) musSel.value = "";
      if (window.wizard) window.wizard.muscle = "";
    }
  }

  function byLocation(items, loc) {
    if (loc === "home") {
      const HOME = new Set(["body weight", "resistance bands", "kettlebell"]);
      return items.filter((e) =>
        Array.isArray(e.equipment) &&
        e.equipment.some((eq) => HOME.has(String(eq).toLowerCase()))
      );
    }
    return items;
  }

  function populateEquipment() {
    // Called at Step 4 by wizard.js
    const sel = /** @type {HTMLSelectElement} */ ($("#equipment-select"));
    if (!sel) return;

    const exData   = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
    const location = window.wizard?.location || "";
    const category = (window.wizard?.category || "").toLowerCase();
    const muscle   = window.wizard?.muscle || "";

    // Start from location subset
    let pool = byLocation(exData, location);

    // Filter by category (+ muscle if "specific muscle")
    if (category === "specific muscle" && muscle) {
      pool = pool.filter((e) =>
        Array.isArray(e.sections) &&
        e.sections.map((s) => String(s).toLowerCase()).includes("specific muscle") &&
        Array.isArray(e.muscles) && e.muscles.includes(muscle)
      );
    } else if (category) {
      pool = pool.filter((e) =>
        Array.isArray(e.sections) &&
        e.sections.map((s) => String(s).toLowerCase()).includes(category)
      );
    }

    const equipments = unique(
      pool.flatMap((e) =>
        Array.isArray(e.equipment) ? e.equipment.map((x) => String(x).toLowerCase()) : []
      )
    ).sort((a, b) => a.localeCompare(b));

    sel.innerHTML =
      `<option value="">--Select--</option>` +
      equipments.map((eq) => `<option value="${eq}">${title(eq)}</option>`).join("");

    // Restore selection if still available
    if (window.wizard?.equipment && equipments.includes(window.wizard.equipment)) {
      sel.value = window.wizard.equipment;
    } else {
      sel.value = "";
    }

    // Clear exercises (Step 5 repopulates)
    const exSel = $("#exercise-select");
    if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  }

  // Expose to global
  window.populateCategories = populateCategories;
  window.populateMuscles = populateMuscles;
  window.populateEquipment = populateEquipment;
  window.toggleMuscleVisibility = toggleMuscleVisibility;

  // First-time init after DOM loads
  document.addEventListener("DOMContentLoaded", () => {
    populateCategories();
    populateMuscles();

    // Keep muscle group synced if user changes the category early
    const catSel = $("#work-on-select");
    if (catSel) {
      catSel.addEventListener("change", () => {
        toggleMuscleVisibility(catSel.value);
        // Clear downstream selects
        const eqSel = $("#equipment-select");
        const exSel = $("#exercise-select");
        if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
        if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
      });
    }
  });
})();
