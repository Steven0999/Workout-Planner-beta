

// js/filters.js
// Populates: categories (Step 3), muscles (Step 3), equipment (Step 4)
// Depends on: window.EXERCISES (from exercises.js)

(function () {
  const $ = (s) => document.querySelector(s);

  // ---- Bridge wizard state so window.wizard and App.wizard always point to the same object
  const App = (window.App = window.App || {});
  App.wizard = App.wizard || {};
  window.wizard = window.wizard || App.wizard;   // prefer existing if present
  App.wizard = window.wizard;                    // keep both refs in sync
  const wizard = window.wizard;

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

  const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const unique = (arr) => [...new Set(arr)];

  // --- Equipment aliasing to avoid mismatches ("bodyweight" vs "body weight", band variants, etc.)
  function eqAlias(s) {
    const t = String(s || "").trim().toLowerCase();
    if (t === "bodyweight") return "body weight";
    if (t === "band" || t === "bands" || t === "resistance band" || t === "resistance-band")
      return "resistance bands";
    return t;
  }

  // ---------- Muscles ----------
  function allMusclesFromData() {
    const src = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
    return unique(
      src.flatMap((e) => Array.isArray(e.muscles) ? e.muscles.map(String) : [])
    ).sort((a, b) => a.localeCompare(b));
  }

  function toggleMuscleVisibility(categoryValue) {
    const group = $("#muscle-select-group");
    if (!group) return;
    const isSpecific = String(categoryValue || "").toLowerCase() === "specific muscle";
    group.style.display = isSpecific ? "block" : "none";
    if (!isSpecific) {
      const musSel = /** @type {HTMLSelectElement} */ ($("#muscle-select"));
      if (musSel) musSel.value = "";
      wizard.muscle = "";
    }
  }

  function ensureEnabled(el) {
    try {
      el.disabled = false;
      el.style.pointerEvents = "auto";
      el.style.opacity = "";
    } catch {}
  }

  // ---------- Categories (Step 3) ----------
  function populateCategories() {
    const sel = /** @type {HTMLSelectElement} */ ($("#work-on-select"));
    if (!sel) return;

    // Avoid duplicate re-attachments nuking value mid-change
    sel.onchange = null;

    sel.innerHTML =
      `<option value="">--Select--</option>` +
      TOP_CATEGORIES.map((c) => `<option value="${c}">${title(c)}</option>`).join("");

    // Restore previously chosen value if still valid
    if (wizard.category && TOP_CATEGORIES.includes(wizard.category)) {
      sel.value = wizard.category;
    } else {
      sel.value = "";
    }

    ensureEnabled(sel);
    toggleMuscleVisibility(sel.value);

    // Re-attach a single change handler
    sel.addEventListener("change", () => {
      const val = sel.value;
      toggleMuscleVisibility(val);
      wizard.category = normalizeCategory(val);
      if (wizard.category !== "specific muscle") wizard.muscle = "";

      // Clear downstream selects
      const eqSel = /** @type {HTMLSelectElement} */ ($("#equipment-select"));
      const exSel = /** @type {HTMLSelectElement} */ ($("#exercise-select"));
      if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
      if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;

      // Actively repopulate equipment now (quality-of-life)
      populateEquipment();
    });
  }

  function populateMuscles() {
    const musclesSel = /** @type {HTMLSelectElement} */ ($("#muscle-select"));
    if (!musclesSel) return;

    const muscles = allMusclesFromData();
    musclesSel.innerHTML =
      `<option value="">--Select--</option>` +
      muscles.map((m) => `<option value="${m}">${m}</option>`).join("");

    if (wizard.muscle && muscles.includes(wizard.muscle)) {
      musclesSel.value = wizard.muscle;
    } else {
      musclesSel.value = "";
    }
    ensureEnabled(musclesSel);

    // Keep wizard in sync if user changes muscle
    musclesSel.addEventListener("change", () => {
      wizard.muscle = musclesSel.value || "";

      // changing muscle invalidates downstream choices
      const eqSel = /** @type {HTMLSelectElement} */ ($("#equipment-select"));
      const exSel = /** @type {HTMLSelectElement} */ ($("#exercise-select"));
      if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
      if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;

      // Repopulate equipment immediately if we're already on Step 4
      populateEquipment();
    });
  }

  // ---------- Location filter helper ----------
  function byLocation(items, loc) {
    // If no location picked yet, do NOT over-filter; just return all.
    if (!loc) return items;

    if (loc === "home") {
      const HOME = new Set(["body weight", "resistance bands", "kettlebell"]);
      return items.filter((e) =>
        Array.isArray(e.equipment) &&
        e.equipment.map(eqAlias).some((eq) => HOME.has(eq))
      );
    }
    // gym → everything
    return items;
  }

  // ---------- Equipment (Step 4) ----------
  function populateEquipment() {
    const sel = /** @type {HTMLSelectElement} */ ($("#equipment-select"));
    if (!sel) return;

    const exData   = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
    const location = String(wizard.location || "").toLowerCase();
    const category = String(wizard.category || "").toLowerCase();
    const muscle   = wizard.muscle || "";

    // 1) Start from location-filtered pool (but if no location, keep all)
    let pool = byLocation(exData, location);

    // 2) Filter by category / specific muscle
    if (category === "specific muscle" && muscle) {
      pool = pool.filter((e) =>
        Array.isArray(e.sections) &&
        e.sections.map(s => String(s).toLowerCase()).includes("specific muscle") &&
        Array.isArray(e.muscles) && e.muscles.includes(muscle) // muscles are display-cased; keep exact match
      );
    } else if (category) {
      pool = pool.filter((e) =>
        Array.isArray(e.sections) &&
        e.sections.map(s => String(s).toLowerCase()).includes(category)
      );
    }

    // 3) Collect unique equipments (with aliasing)
    let equipments = [...new Set(
      pool.flatMap((e) =>
        Array.isArray(e.equipment) ? e.equipment.map(eqAlias) : []
      )
    )].sort((a, b) => a.localeCompare(b));

    // 4) Defensive fallback if empty
    if (equipments.length === 0) {
      console.warn("[filters] No equipment matched filters. Using fallback list.");
      equipments = [
        "barbell","dumbbell","cable machine","machine","body weight",
        "resistance bands","kettlebell","smith machine"
      ];
    }

    // 5) Populate <select>
    sel.innerHTML =
      `<option value="">--Select--</option>` +
      equipments.map((eq) => `<option value="${eq}">${title(eq)}</option>`).join("");

    // Restore previously chosen equipment if still valid
    if (wizard.equipment && equipments.includes(eqAlias(wizard.equipment))) {
      sel.value = eqAlias(wizard.equipment);
    } else {
      sel.value = "";
    }

    // Make sure it is usable
    sel.disabled = false;
    sel.style.pointerEvents = "auto";

    // Clear exercise list (Step 5 will repopulate)
    const exSel = /** @type {HTMLSelectElement} */ ($("#exercise-select"));
    if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;

    // Small debug to help verify state
    console.log(`[filters] Equipment options: ${equipments.length} (loc=${location||"n/a"}, cat=${category||"n/a"}, mus=${muscle||"n/a"})`);
  }

  // ---------- Normalizer ----------
  function normalizeCategory(c0) {
    const c = String(c0 || "").toLowerCase().trim();
    if (c === "upper") return "upper body";
    if (c === "lower" || c === "legs") return "lower body";
    return c;
  }

  // ---------- Expose ----------
  window.populateCategories = populateCategories;
  window.populateMuscles = populateMuscles;
  window.populateEquipment = populateEquipment;
  window.toggleMuscleVisibility = toggleMuscleVisibility;
  window.normalizeCategory = normalizeCategory;

  // ---------- First-time init after DOM loads ----------
  document.addEventListener("DOMContentLoaded", () => {
    // Try immediately…
    populateCategories();
    populateMuscles();

    // …and re-try shortly in case exercises.js loaded just after this
    setTimeout(() => {
      const catSel = $("#work-on-select");
      if (catSel && catSel.options.length <= 1) {
        console.warn("[filters] Retrying category populate (first attempt was empty).");
        populateCategories();
      }
      const musSel = $("#muscle-select");
      if (musSel && musSel.options.length <= 1) {
        console.warn("[filters] Retrying muscle populate (first attempt was empty).");
        populateMuscles();
      }
    }, 50);
  });
})();
