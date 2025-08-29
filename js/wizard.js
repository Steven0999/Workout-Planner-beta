(function () {
  const App = (window.App = window.App || {});
  const { q, setOptions, title, nowIsoMinute } = App.utils;
  const { EXERCISES, allCategories, allMuscles, byLocation, byCategoryAndMuscle } = App.data;
  const { populateCategories, populateMuscles, populateEquipment } = App.filters;
  const { renderSetRows } = App.sets;
  const { wireExerciseSearch } = App.search;

  // Global state
  App.state = App.state || {};
  App.state.userWorkoutData = App.state.userWorkoutData || App.utils.loadData();
  App.state.currentWorkoutExercises = App.state.currentWorkoutExercises || [];

  const wizard = (App.state.wizard = App.state.wizard || {
    step: 1,
    location: "",
    timing: "now",
    datetime: nowIsoMinute(),
    category: "",
    muscle: "",
    equipment: "",
    exercise: "",
    movementType: "bilateral",
    sets: 3
  });

  let lastLoggerStep = 1;

  function goToStep(step) {
    wizard.step = step;
    document.querySelectorAll(".wizard-step").forEach((el, idx) => {
      el.style.display = idx === step - 1 ? "block" : "none";
    });
    document.querySelectorAll(".step-badge").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.step) === step);
    });

    if (step === 4) populateEquipment();
    if (step === 5) populateExercisesAndWiring();
    if (step === 6) App.session.buildSessionSummary();

    App.session.updateReviewButtonState();
  }

  // Step validations
  function validateStep(step) {
    if (step === 1) {
      const v = q("#workout-type-select").value;
      if (!v) { q("#s1-hint").textContent = "Please select where you are training."; return false; }
      q("#s1-hint").textContent = "";
      wizard.location = v;
      return true;
    }
    if (step === 2) {
      const selected = document.querySelector('input[name="timing"]:checked');
      if (!selected) { q("#s2-hint").textContent = "Select session timing."; return false; }
      wizard.timing = selected.value;
      if (wizard.timing === "now") {
        const dt = q("#workout-datetime");
        dt.value = nowIsoMinute();
        dt.setAttribute("disabled", "disabled");
        wizard.datetime = dt.value;
      } else {
        const dt = q("#workout-datetime").value;
        if (!dt) { q("#s2-hint").textContent = "Pick date/time for past session."; return false; }
        wizard.datetime = dt;
        q("#workout-datetime").removeAttribute("disabled");
      }
      q("#s2-hint").textContent = "";
      return true;
    }
    if (step === 3) {
      const cat = q("#work-on-select").value;
      if (!cat) { q("#s3-hint").textContent = "Please select what you're training."; return false; }
      wizard.category = cat;
      if (cat === "specific muscle") {
        const mus = q("#muscle-select").value;
        if (!mus) { q("#s3-hint").textContent = "Please choose a specific muscle."; return false; }
        wizard.muscle = mus;
      } else {
        wizard.muscle = "";
      }
      q("#s3-hint").textContent = "";
      return true;
    }
    if (step === 4) {
      const eq = q("#equipment-select").value;
      if (!eq) { q("#s4-hint").textContent = "Please select the machine/equipment."; return false; }
      wizard.equipment = eq; q("#s4-hint").textContent = "";
      return true;
    }
    return true;
  }

  function nextStep() {
    if (wizard.step < 5) {
      if (!validateStep(wizard.step)) return;
      goToStep(wizard.step + 1);
      return;
    }
    if (wizard.step === 5) {
      if (App.state.currentWorkoutExercises.length === 0) {
        q("#s5-hint").textContent = "Please add at least one exercise before reviewing your session.";
        return;
      }
      goToStep(6);
      return;
    }
    App.session.saveSession();
  }
  function prevStep() {
    if (wizard.step > 1) goToStep(wizard.step - 1);
  }

  // Populate exercises for step 5 + wire search + movement type + sets count
  function populateExercisesAndWiring() {
    const exerciseSel = q("#exercise-select");
    const pool = byLocation(EXERCISES, wizard.location);
    const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
      .filter((e) => wizard.equipment ? e.equipment.includes(wizard.equipment) : true);

    const names = [...new Set(filtered.map((e) => e.name))].sort((a, b) => a.localeCompare(b));
    setOptions(exerciseSel, ["--Select--", ...names], (v) => ({
      value: v === "--Select--" ? "" : v,
      text: v
    }));
    exerciseSel.value = wizard.exercise || "";

    // Wire exercise search
    App.search.wireExerciseSearch();

    // Wire movement type
    const typeSel = q("#movement-type-select");
    typeSel.value = wizard.movementType || "bilateral";
    typeSel.onchange = () => { wizard.movementType = typeSel.value; renderSetRows(); };

    // Wire sets input
    const setsInput = q("#sets-input");
    setsInput.value = wizard.sets || 3;
    setsInput.onchange = () => {
      wizard.sets = Math.max(1, App.utils.toInt(setsInput.value, 1));
      renderSetRows();
    };

    // Show insights
    showExerciseInsights(exerciseSel.value);

    // Change exercise
    exerciseSel.onchange = () => {
      wizard.exercise = exerciseSel.value;
      showExerciseInsights(wizard.exercise);
      renderSetRows();
    };

    // Initial render of sets grid
    renderSetRows();
  }

  function showExerciseInsights(name) {
    const node = q("#exercise-insights");
    if (!node) return;
    if (!name) { node.textContent = ""; return; }

    // Last
    const recs = (App.state.userWorkoutData[name]?.records || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = recs[0] || null;

    // Best
    const bestW = App.state.userWorkoutData[name]?.bestWeight ?? null;
    let best = null;
    if (bestW != null) {
      const asc = recs.slice().reverse();
      const hit = asc.find((r) => r.maxWeight === bestW);
      if (hit) best = hit;
    }

    function heaviestWithReps(r) {
      if (!r) return null;
      let weights = [], reps = [];
      if (Array.isArray(r.setWeightsL) || Array.isArray(r.setWeightsR)) {
        const L = r.setWeightsL || [], R = r.setWeightsR || [];
        const RL = r.setRepsL || Array(L.length).fill(null);
        const RR = r.setRepsR || Array(R.length).fill(null);
        weights = [...L, ...R];
        reps = [...RL, ...RR];
      } else if (Array.isArray(r.setWeights)) {
        weights = r.setWeights;
        reps = r.setReps || Array(weights.length).fill(null);
      }
      if (weights.length === 0) return { w: r.maxWeight ?? 0, reps: null, date: r.date };
      const max = Math.max(...weights);
      const idx = weights.findIndex((x) => x === max);
      return { w: max, reps: (idx >= 0 ? reps[idx] : null), date: r.date };
    }

    const lastInfo = heaviestWithReps(last);
    const bestInfo = best ? heaviestWithReps(best) : (bestW != null ? { w: bestW, reps: null, date: best?.date || null } : null);

    const parts = [];
    if (lastInfo) {
      parts.push(`Last: <strong>${App.utils.stripZeros(lastInfo.w)} kg</strong>${lastInfo.reps != null ? ` × <strong>${App.utils.stripZeros(lastInfo.reps)}</strong>` : ""} (${new Date(lastInfo.date).toLocaleDateString()})`);
    } else {
      parts.push(`Last: <em>no history</em>`);
    }
    if (bestInfo) {
      parts.push(`Heaviest: <strong>${App.utils.stripZeros(bestInfo.w)} kg</strong>${bestInfo.reps != null ? ` × <strong>${App.utils.stripZeros(bestInfo.reps)}</strong>` : ""}${bestInfo.date ? ` (${new Date(bestInfo.date).toLocaleDateString()})` : ""}`);
    } else {
      parts.push(`Heaviest: <em>no history</em>`);
    }
    node.innerHTML = parts.join(" &nbsp;•&nbsp; ");
  }

  function showHistoryView() {
    lastLoggerStep = wizard.step || lastLoggerStep;
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    q("#workout-history").classList.add("active");
    q("#to-history").style.display = "none";
    q("#to-logger").style.display = "inline-block";
    App.history.populateHistoryDropdown();
  }
  function showLoggerView() {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    q("#workout-logger").classList.add("active");
    q("#to-logger").style.display = "none";
    q("#to-history").style.display = "inline-block";
    goToStep(lastLoggerStep);
    App.session.updateReviewButtonState();
  }

  App.wizard = {
    goToStep, nextStep, prevStep,
    showHistoryView, showLoggerView,
    populateExercisesAndWiring,
    populateCategories, populateMuscles, populateEquipment,
    wizard
  };
})();
