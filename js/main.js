(function () {
  const App = (window.App = window.App || {});
  const { q, nowIsoMinute } = App.utils;

  document.addEventListener("DOMContentLoaded", () => {
    // Initial data load
    App.state = App.state || {};
    App.state.userWorkoutData = App.state.userWorkoutData || App.utils.loadData();
    App.state.currentWorkoutExercises = App.state.currentWorkoutExercises || [];

    // Populate Step 3 dropdowns
    App.wizard.populateCategories();
    App.wizard.populateMuscles();

    // Default timing
    const dt = q("#workout-datetime");
    if (dt) dt.value = nowIsoMinute();

    // Step 3 show/hide muscle group
    q("#work-on-select").addEventListener("change", () => {
      const cat = q("#work-on-select").value;
      const group = q("#muscle-select-group");
      group.style.display = (cat === "specific muscle") ? "block" : "none";
      if (cat !== "specific muscle") q("#muscle-select").value = "";
      // Clear downstream and repopulate
      App.wizard.populateEquipment();
      q("#exercise-select").innerHTML = `<option value="">--Select--</option>`;
    });
    q("#muscle-select").addEventListener("change", () => {
      App.wizard.populateEquipment();
      q("#exercise-select").innerHTML = `<option value="">--Select--</option>`;
    });

    // Step 4 equipment repopulation when location changes
    q("#workout-type-select").addEventListener("change", () => {
      // resetting step 3/4/5 dependent selects
      q("#work-on-select").value = "";
      q("#muscle-select").value = "";
      q("#muscle-select-group").style.display = "none";
      q("#equipment-select").innerHTML = `<option value="">--Select--</option>`;
      q("#exercise-select").innerHTML = `<option value="">--Select--</option>`;
    });

    // Next/Prev buttons
    q("#next-btn").addEventListener("click", App.wizard.nextStep);
    q("#prev-btn").addEventListener("click", App.wizard.prevStep);

    // Add exercise button
    q("#add-exercise-btn").addEventListener("click", App.session.addExerciseToWorkout);

    // Edit list goes back to step 5
    q("#edit-exercises-btn").addEventListener("click", () => App.wizard.goToStep(5));

    // History / Logger header buttons
    q("#to-history").addEventListener("click", App.wizard.showHistoryView);
    q("#to-logger").addEventListener("click", App.wizard.showLoggerView);

    // Start at step 1
    App.wizard.goToStep(1);
  });
})();
