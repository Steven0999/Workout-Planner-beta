/* ======================================
   data.js — exercise normalization & app state
====================================== */
const RAW_EXERCISES = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
window.EXERCISES_NORM = RAW_EXERCISES.map((e) => ({
  name: e.name,
  sections: (e.sections || []).map((s) => String(s).toLowerCase()),
  equipment: (e.equipment || []).map((eq) => String(eq).toLowerCase()),
  muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
}));

window.allCategories = () =>
  uniq(EXERCISES_NORM.flatMap((e) => e.sections.filter((s) => CATEGORY_WHITELIST.has(s)))).sort((a,b)=>a.localeCompare(b));
window.allMuscles = () => uniq(EXERCISES_NORM.flatMap((e) => e.muscles)).sort((a,b)=>a.localeCompare(b));
window.byLocation = (items, loc) =>
  loc === "home" ? items.filter((e) => e.equipment.some((eq) => HOME_EQUIPMENT.includes(eq))) : items;
window.byCategoryAndMuscle = (items, category, muscle) => {
  const cat = normalizeCategory(category);
  if (!cat) return [];
  if (cat === "specific muscle") {
    if (!muscle) return [];
    return items.filter(
      (e) => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle)
    );
  }
  return items.filter((e) => e.sections.includes(cat));
};

/* ---- App state ---- */
window.currentStep = 1;
window.myChart = null;

window.userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
window.currentWorkoutExercises = [];
window.editingRecord = null;

window.wizard = {
  location: "", timing: "", datetime: "",
  category: "", muscle: "", equipment: "", exercise: "",
  movementType: "bilateral",
  sets: 3,
  setReps: [], setWeights: [],
  setRepsL: [], setWeightsL: [],
  setRepsR: [], setWeightsR: [],
  maxWeight: 0, maxWeightSetCount: 0
};

window.lastLoggerStep = 1;
window.pageScroll = { logger: 0, history: 0 };
