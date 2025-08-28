/* ======================================
   search.js — exercise search bar (Step 5)
====================================== */
window.exerciseSearchTerm = "";
window._exerciseBaseNames = [];

function renderExerciseOptions(selectEl, baseNames, term) {
  const filtered = term
    ? baseNames.filter(n => n.toLowerCase().includes(term.toLowerCase()))
    : baseNames;

  selectEl.innerHTML =
    `<option value="">--Select--</option>` +
    filtered.map(n => `<option value="${n}">${n}</option>`).join("");

  if (filtered.includes(wizard.exercise)) {
    selectEl.value = wizard.exercise;
  }
}

window.ensureExerciseSearchControl = function ensureExerciseSearchControl() {
  const select = document.getElementById("exercise-select");
  if (!select) return null;

  let search = document.getElementById("exercise-search");
  if (!search) {
    const parent = select.closest(".form-group") || select.parentElement;
    search = document.createElement("input");
    search.id = "exercise-search";
    search.type = "search";
    search.placeholder = "Search exercises...";
    search.autocomplete = "off";
    search.style.marginBottom = "8px";
    search.style.width = "100%";
    search.style.padding = "8px";

    parent.insertBefore(search, select);

    search.addEventListener("input", () => {
      window.exerciseSearchTerm = search.value || "";
      renderExerciseOptions(
        document.getElementById("exercise-select"),
        window._exerciseBaseNames || [],
        window.exerciseSearchTerm
      );
    });
  }
  search.value = window.exerciseSearchTerm;
  return search;
};

window.renderExerciseOptions = renderExerciseOptions;
