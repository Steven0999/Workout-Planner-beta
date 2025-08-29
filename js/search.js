(function () {
  const App = (window.App = window.App || {});
  const { q } = App.utils;

  // Filters the #exercise-select options by the text typed in #exercise-search
  function wireExerciseSearch() {
    const input = q("#exercise-search");
    const select = q("#exercise-select");
    if (!input || !select) return;

    input.addEventListener("input", () => {
      const needle = input.value.trim().toLowerCase();
      Array.from(select.options).forEach((opt, idx) => {
        if (idx === 0) { opt.hidden = false; return; } // keep placeholder
        const show = opt.textContent.toLowerCase().includes(needle);
        opt.hidden = !show;
      });
      // If the current value is hidden, clear selection to avoid confusion
      const currentOption = select.options[select.selectedIndex];
      if (currentOption && currentOption.hidden) select.value = "";
    });
  }

  App.search = { wireExerciseSearch };
})();
