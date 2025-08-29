(function () {
  const App = (window.App = window.App || {});
  const { q, setOptions, title } = App.utils;
  const { EXERCISES, allCategories, allMuscles, byLocation, byCategoryAndMuscle } = App.data;

  function populateCategories() {
    const catSel = q("#work-on-select");
    const cats = allCategories();
    setOptions(catSel, ["--Select--", ...cats], (v) => ({
      value: v === "--Select--" ? "" : v,
      text: v === "--Select--" ? v : v
    }));
  }

  function populateMuscles() {
    const musSel = q("#muscle-select");
    const mus = allMuscles();
    setOptions(musSel, ["--Select--", ...mus], (v) => ({
      value: v === "--Select--" ? "" : v,
      text: v
    }));
  }

  function populateEquipment() {
    const location = q("#workout-type-select").value;
    const category = q("#work-on-select").value;
    const muscle = q("#muscle-select").value;

    const eqSel = q("#equipment-select");
    setOptions(eqSel, ["--Select--"]); // reset

    if (!category) return;

    const pool = byLocation(EXERCISES, location);
    const filtered = byCategoryAndMuscle(pool, category, muscle);
    const eqs = [...new Set(filtered.flatMap((e) => e.equipment))].sort((a, b) => a.localeCompare(b));

    setOptions(eqSel, ["--Select--", ...eqs], (v) => ({
      value: v === "--Select--" ? "" : v,
      text: v === "--Select--" ? v : title(v)
    }));
  }

  App.filters = { populateCategories, populateMuscles, populateEquipment };
})();
