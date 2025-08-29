// filters.js
// Builds the "What are you working on?" (category/section) and muscle dropdowns
// Robust to load order, casing, and weird data. Requires window.EXERCISES from exercises.js.

// ---- Config ----
const CATEGORY_WHITELIST = new Set([
  "upper body",
  "lower body",
  "push",
  "pull",
  "hinge",
  "squat",
  "legs",
  "full body",
  "core",
  "specific muscle"
]);

const DEFAULT_CATEGORIES = [
  "upper body",
  "lower body",
  "push",
  "pull",
  "hinge",
  "squat",
  "legs",
  "full body",
  "core",
  "specific muscle"
];

const DEFAULT_MUSCLES = [
  "Abs","Biceps","Calves","Chest","Forearms","Front Delts","Glute Max","Glute Med",
  "Hamstrings","Lats","Lower Back","Mid Delts","Quads","Rear Delts","Traps","Triceps","Upper Back"
];

// ---- Utils ----
const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const uniq = (a) => [...new Set(a)];
const qs  = (sel) => document.querySelector(sel);

// Normalize a single section token to lowercase, trimmed.
function normSection(s) {
  return String(s || "").toLowerCase().trim();
}

// Build normalized copy of EXERCISES to avoid repeated work
function normalizeExercises(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(e => ({
    name: String(e?.name || "").trim(),
    sections: Array.isArray(e?.sections) ? e.sections.map(normSection) : [],
    equipment: Array.isArray(e?.equipment) ? e.equipment.map(normSection) : [],
    muscles: Array.isArray(e?.muscles) ? e.muscles.slice() : []
  }));
}

// Extract top-level categories from sections using whitelist
function buildCategories(exNorm) {
  const all = new Set();
  exNorm.forEach(ex => {
    ex.sections.forEach(sec => {
      if (CATEGORY_WHITELIST.has(sec)) all.add(sec);
    });
  });
  const out = [...all].sort((a,b)=>a.localeCompare(b));
  return out.length ? out : DEFAULT_CATEGORIES.slice();
}

// Build muscles list (from data or fallback)
function buildMuscles(exNorm) {
  const mus = exNorm.flatMap(e => e.muscles || []);
  const cleaned = uniq(mus).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  return cleaned.length ? cleaned : DEFAULT_MUSCLES.slice().sort((a,b)=>a.localeCompare(b));
}

// Fill a <select> with options
function fillSelect(sel, values, placeholder="--Select--") {
  if (!sel) return;
  const opts = [`<option value="">${placeholder}</option>`]
    .concat(values.map(v => `<option value="${v}">${title(v)}</option>`));
  sel.innerHTML = opts.join("");
}

// ---- Public: populate the two dropdowns ----
function populateWorkOnDropdown() {
  const workOnSel   = qs("#work-on-select");
  const muscleGroup = qs("#muscle-select-group");
  const muscleSel   = qs("#muscle-select");

  if (!workOnSel || !muscleSel) {
    console.warn("[filters] Missing #work-on-select or #muscle-select in DOM.");
    return;
  }

  // Ensure EXERCISES is present
  if (!Array.isArray(window.EXERCISES)) {
    console.warn("[filters] window.EXERCISES is not available yet. Falling back to defaults.");
    fillSelect(workOnSel, DEFAULT_CATEGORIES, "--Select--");
    fillSelect(muscleSel, DEFAULT_MUSCLES, "--Select--");
    if (muscleGroup) muscleGroup.style.display = "none";
    return;
  }

  const exNorm = normalizeExercises(window.EXERCISES);
  const cats   = buildCategories(exNorm);
  const muscles = buildMuscles(exNorm);

  // Fill selects
  fillSelect(workOnSel, cats, "--Select--");
  fillSelect(muscleSel, muscles, "--Select--");

  // Show/hide muscle group when category changes
  workOnSel.addEventListener("change", () => {
    const val = String(workOnSel.value || "").toLowerCase();
    if (muscleGroup) muscleGroup.style.display = (val === "specific muscle") ? "block" : "none";
    // Reset downstream selects when category changes
    const eqSel = qs("#equipment-select");
    const exSel = qs("#exercise-select");
    if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
    if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  });

  // Initially hide muscle picker
  if (muscleGroup) muscleGroup.style.display = "none";
}

// Export to window so main.js can call it
window.populateWorkOnDropdown = populateWorkOnDropdown;

// Auto-init when DOM is ready (safe to call multiple times)
document.addEventListener("DOMContentLoaded", () => {
  try {
    populateWorkOnDropdown();
  } catch (err) {
    console.error("[filters] populateWorkOnDropdown failed:", err);
  }
});
