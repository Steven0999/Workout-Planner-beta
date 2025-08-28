/* ======================================
   main.js — wire up events & boot the wizard
====================================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);

  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);

  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);

  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);

  const historySelect = document.getElementById("history-select");
  if (historySelect) historySelect.addEventListener("change", displayExerciseHistory);

  initStep1(); initStep2(); initStep3(); initStep4(); initStep5();
  goToStep(1);
  updateReviewButtonState();
});
