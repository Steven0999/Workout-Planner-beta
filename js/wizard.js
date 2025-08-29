/* =======================================================================
   Workout Session Logger — wizard.js (FULL)
   - Steps 1..6 wizard flow
   - Equipment/Exercise filtering incl. location + category + muscle
   - Sets & reps UI (bilateral or unilateral), with per-set Prev markers
   - Session list + Review (vs Last & vs Best with dates & deltas)
   - Save to localStorage structure compatible with history.js
   - Preserves step & scroll when switching Logger/History (via main.js)
   - Hot-fix appendix at the very end (adds robust fallbacks)
======================================================================= */

/* ---- Crash guard ---- */
window.addEventListener("error", (e) => console.error("[JS Error]", e.error || e.message));

/* ---- Helpers ---- */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const uniq = (a) => [...new Set(a)];
const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const toInt = (v, f = 0) => {
  const n = parseInt(v,10);
  return Number.isFinite(n) ? n : f;
};
const toFloat = (v, f = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : f;
};
const nowIsoMinute = () => new Date().toISOString().slice(0, 16);
const isoToLocalString = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const normalizeSection = (s0) => String(s0 || "").toLowerCase().trim();

/* ---- Data: exercises from exercises.js ---- */
const RAW_EXERCISES = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const EXES = RAW_EXERCISES.map(e => ({
  name: e.name,
  sections: (e.sections || []).map(s => normalizeSection(s)),
  equipment: (e.equipment || []).map(eq => normalizeSection(eq)),
  muscles:  Array.isArray(e.muscles) ? e.muscles.slice() : []
}));

/* Sections we show in “What are you training?” */
const SECTION_WHITELIST = new Set([
  "upper body","lower body","push","pull","hinge","squat","full body","core","specific muscle"
]);

function allSections() {
  const set = new Set();
  EXES.forEach(e => e.sections.forEach(s => { if (SECTION_WHITELIST.has(s)) set.add(s); }));
  return [...set].sort((a,b)=>a.localeCompare(b));
}
function allMuscles() {
  return uniq(EXES.flatMap(e => e.muscles)).sort((a,b)=>a.localeCompare(b));
}

/* ---- App state ---- */
let currentStep = 1;
let myChart = null;

let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

/* Wizard scratch (W) */
window.W = {
  location: "",
  timing: "now",
  datetime: nowIsoMinute(),
  section: "",     // (aka category)
  muscle: "",
  equipment: "",
  exercise: "",
  movementType: "bilateral", // bilateral | unilateral
  sets: 3,

  // Bilateral
  setReps: [],
  setWeights: [],

  // Unilateral
  setRepsL: [],
  setWeightsL: [],
  setRepsR: [],
  setWeightsR: [],

  maxWeight: 0,
  maxWeightSetCount: 0
};

/* Preserve logger step & scroll (main.js will use these) */
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

/* ======================================================================
   History helpers (last & best) + per-set previous arrays
====================================================================== */
function getExerciseRecordsDesc(name) {
  const recs = (userWorkoutData[name]?.records || []).slice();
  recs.sort((a,b)=>new Date(b.date)-new Date(a.date));
  return recs;
}
function extractWeightsAndReps(record) {
  if (record.setWeightsL && record.setWeightsR) {
    const wAll = [...(record.setWeightsL || []), ...(record.setWeightsR || [])];
    const rAll = [
      ...(record.setRepsL || Array(record.setWeightsL?.length || 0).fill(null)),
      ...(record.setRepsR || Array(record.setWeightsR?.length || 0).fill(null))
    ];
    return { weights: wAll, reps: rAll };
  }
  return {
    weights: Array.isArray(record.setWeights) ? record.setWeights : [],
    reps: Array.isArray(record.setReps) ? record.setReps : []
  };
}
function getLastHeaviestWithReps(exName) {
  const recs = getExerciseRecordsDesc(exName);
  if (!recs.length) return null;
  const r = recs[0];
  const { weights, reps } = extractWeightsAndReps(r);
  if (!weights.length) {
    return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };
  }
  const m = Math.max(...weights);
  const idx = weights.findIndex(w => w === m);
  return { maxWeight: m, reps: (idx>=0 ? reps[idx] ?? null : null), date: r.date };
}
function getBestHeaviestWithReps(exName) {
  const best = userWorkoutData[exName]?.bestWeight ?? null;
  if (best == null) return null;
  const recsAsc = getExerciseRecordsDesc(exName).slice().reverse();
  for (const r of recsAsc) {
    const { weights, reps } = extractWeightsAndReps(r);
    const i = weights.findIndex(w => w === best);
    if (i >= 0) return { maxWeight: best, reps: reps[i] ?? null, date: r.date };
  }
  return { maxWeight: best, reps: null, date: null };
}
function computePrevPerSet(exName, movementType, setsCount) {
  const blanks = Array(setsCount).fill("");
  if (!exName) return movementType === "unilateral"
    ? { prevL: blanks.slice(), prevR: blanks.slice() }
    : { prev: blanks.slice() };

  const last = getExerciseRecordsDesc(exName)[0];
  if (!last) return movementType === "unilateral"
    ? { prevL: blanks.slice(), prevR: blanks.slice() }
    : { prev: blanks.slice() };

  if (movementType === "unilateral") {
    let prevL = blanks.slice(), prevR = blanks.slice();
    if (Array.isArray(last.setWeightsL) && Array.isArray(last.setWeightsR)) {
      for (let i=0;i<setsCount;i++){
        if (i<last.setWeightsL.length) prevL[i] = last.setWeightsL[i];
        if (i<last.setWeightsR.length) prevR[i] = last.setWeightsR[i];
      }
    } else if (Array.isArray(last.setWeights)) {
      for (let i=0;i<setsCount;i++){
        if (i<last.setWeights.length) prevL[i] = prevR[i] = last.setWeights[i];
      }
    } else if (typeof last.maxWeight === "number") {
      prevL = Array(setsCount).fill(last.maxWeight);
      prevR = Array(setsCount).fill(last.maxWeight);
    }
    return { prevL, prevR };
  }

  // bilateral
  let prev = blanks.slice();
  if (Array.isArray(last.setWeights)) {
    for (let i=0;i<setsCount;i++){
      if (i<last.setWeights.length) prev[i] = last.setWeights[i];
    }
  } else if (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)) {
    for (let i=0;i<setsCount;i++){
      const L = (Array.isArray(last.setWeightsL) && i<last.setWeightsL.length) ? last.setWeightsL[i] : null;
      const R = (Array.isArray(last.setWeightsR) && i<last.setWeightsR.length) ? last.setWeightsR[i] : null;
      if (L!=null && R!=null) prev[i] = Math.max(L,R);
      else if (L!=null) prev[i] = L;
      else if (R!=null) prev[i] = R;
    }
  } else if (typeof last.maxWeight === "number") {
    prev = Array(setsCount).fill(last.maxWeight);
  }
  return { prev };
}

/* ======================================================================
   Navigation
====================================================================== */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });
  document.querySelectorAll(".step-badge").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });

  const prevBtn = document.getElementById("prev-btn");
  if (prevBtn) prevBtn.disabled = (step === 1);

  if (step === 4) populateEquipment();
  else if (step === 5) populateExercises();
  else if (step === 6) buildSessionSummary();

  updateNextButtonState();
}
function prevStep() {
  if (currentStep > 1) goToStep(currentStep - 1);
}
function nextStep() {
  if (currentStep < 5) {
    if (!validateAndStore(currentStep)) return;
    goToStep(currentStep + 1);
    return;
  }
  if (currentStep === 5) {
    if (currentWorkoutExercises.length === 0) {
      const hint = document.getElementById("s5-hint");
      if (hint) hint.textContent = "Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6);
    return;
  }
  saveSession();
}
function updateNextButtonState() {
  const next = document.getElementById("next-btn");
  if (!next) return;
  if (currentStep === 5) {
    next.textContent = "Review";
    const disabled = currentWorkoutExercises.length === 0;
    next.disabled = disabled;
    next.classList.toggle("is-disabled", disabled);
  } else if (currentStep === 6) {
    next.textContent = "Save";
    next.disabled = false;
    next.classList.remove("is-disabled");
  } else {
    next.textContent = "Next";
    next.disabled = false;
    next.classList.remove("is-disabled");
  }
}

/* ======================================================================
   Step 1 — Location
====================================================================== */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (sel) {
    sel.value = W.location || "";
    sel.addEventListener("change", () => W.location = sel.value);
  }
}
function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  if (!W.location) {
    if (hint) hint.textContent = "Please select where you are training.";
    return false;
  }
  if (hint) hint.textContent = "";
  return true;
}

/* ======================================================================
   Step 2 — Timing + Date
====================================================================== */
function initStep2() {
  const nowRadio  = document.querySelector('input[name="timing"][value="now"]');
  const pastRadio = document.querySelector('input[name="timing"][value="past"]');
  const dt = document.getElementById("workout-datetime");
  const hint = document.getElementById("date-hint");

  if (W.timing === "now") {
    if (nowRadio) nowRadio.checked = true;
    if (dt) { dt.value = nowIsoMinute(); dt.setAttribute("disabled","disabled"); }
    if (hint) hint.textContent = "Date/time is locked to now.";
  } else {
    if (pastRadio) pastRadio.checked = true;
    if (dt) { dt.removeAttribute("disabled"); dt.value = W.datetime || "";}
    if (hint) hint.textContent = "Pick the date/time for your past session.";
  }

  [nowRadio, pastRadio].forEach(r => {
    r?.addEventListener("change", (e) => {
      W.timing = e.target.value;
      if (W.timing === "now") {
        if (dt) { dt.value = nowIsoMinute(); dt.setAttribute("disabled","disabled"); }
        if (hint) hint.textContent = "Date/time is locked to now.";
        W.datetime = nowIsoMinute();
      } else {
        if (dt) { dt.removeAttribute("disabled"); }
        if (hint) hint.textContent = "Pick the date/time for your past session.";
      }
    });
  });

  dt?.addEventListener("change", () => {
    if (W.timing === "past") W.datetime = dt.value;
  });
}
function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  if (!W.timing) { if (hint) hint.textContent = "Select session timing."; return false; }
  if (W.timing === "past" && !W.datetime) { if (hint) hint.textContent = "Choose a date/time for your past session."; return false; }
  if (W.timing === "now") W.datetime = nowIsoMinute();
  if (hint) hint.textContent = ""; return true;
}

/* ======================================================================
   Step 3 — Section (category) + Specific Muscle
====================================================================== */
function initStep3() {
  const sectionSel = document.getElementById("work-on-select");
  const muscleSel  = document.getElementById("muscle-select");
  const muscleGroup = document.getElementById("muscle-select-group");

  // build whitelist sections
  const sections = allSections();
  sectionSel.innerHTML = `<option value="">--Select--</option>` + sections.map(s => `<option value="${s}">${title(s)}</option>`).join("");
  sectionSel.value = W.section || "";

  const muscles = allMuscles();
  muscleSel.innerHTML = `<option value="">--Select--</option>` + muscles.map(m => `<option value="${m}">${m}</option>`).join("");
  muscleSel.value = W.muscle || "";

  const refreshMuscleVisibility = () => {
    if (W.section === "specific muscle") {
      muscleGroup.style.display = "block";
    } else {
      muscleGroup.style.display = "none";
      W.muscle = "";
      muscleSel.value = "";
    }
  };
  refreshMuscleVisibility();

  sectionSel.addEventListener("change", () => {
    W.section = sectionSel.value || "";
    refreshMuscleVisibility();
    // Reset downstream
    W.equipment = ""; W.exercise = "";
    const eqSel = document.getElementById("equipment-select");
    if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
    const exSel = document.getElementById("exercise-select");
    if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  });
  muscleSel.addEventListener("change", () => {
    W.muscle = muscleSel.value || "";
    // reset equipment/exercise
    W.equipment = ""; W.exercise = "";
    const eqSel = document.getElementById("equipment-select");
    if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
    const exSel = document.getElementById("exercise-select");
    if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  });
}
function validateAndStoreStep3() {
  const hint = document.getElementById("s3-hint");
  if (!W.section) { if (hint) hint.textContent = "Please select what you're training."; return false; }
  if (W.section === "specific muscle" && !W.muscle) {
    if (hint) hint.textContent = "Please choose a specific muscle."; return false;
  }
  if (hint) hint.textContent = ""; return true;
}

/* ======================================================================
   Step 4 — Equipment (filtered by location + section + (muscle))
====================================================================== */
function populateEquipment() {
  const eqSel = document.getElementById("equipment-select");
  if (!eqSel) return;
  eqSel.innerHTML = `<option value="">--Select--</option>`;

  let pool = EXES.slice();
  if (W.location === "home") {
    const HOME = new Set(HOME_EQUIPMENT);
    pool = pool.filter(e => e.equipment.some(eq => HOME.has(eq)));
  }

  if (W.section) {
    const sec = W.section;
    if (sec === "specific muscle" && W.muscle) {
      pool = pool.filter(e => e.sections.includes("specific muscle") && e.muscles.includes(W.muscle));
    } else {
      pool = pool.filter(e => e.sections.includes(sec));
    }
  }

  const eqs = uniq(pool.flatMap(e => e.equipment)).sort((a,b)=>a.localeCompare(b));
  eqSel.innerHTML += eqs.map(eq => `<option value="${eq}">${title(eq)}</option>`).join("");

  eqSel.value = W.equipment || "";
  eqSel.onchange = () => {
    W.equipment = eqSel.value || "";
    populateExercises();
  };
}
function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  if (!W.equipment) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  if (hint) hint.textContent = ""; return true;
}

/* ======================================================================
   Step 5 — Exercise + sets (with previous markers & unilateral L/R)
====================================================================== */
function ensureMovementTypeControl() {
  let wrap = document.getElementById("movement-type-wrap");
  if (!wrap) {
    const insightsAnchor = document.getElementById("exercise-select").closest(".form-group");
    wrap = document.createElement("div");
    wrap.id = "movement-type-wrap";
    wrap.className = "form-group";
    wrap.innerHTML = `
      <label>Movement Type</label>
      <select id="movement-type-select">
        <option value="bilateral">Bilateral</option>
        <option value="unilateral">Unilateral</option>
      </select>
    `;
    insightsAnchor.parentElement.insertBefore(wrap, insightsAnchor.nextSibling);
  }
  const sel = wrap.querySelector("#movement-type-select");
  sel.value = W.movementType || "bilateral";
  sel.onchange = () => { W.movementType = sel.value; renderSetsUI(); };
}
function showExerciseInsights(name) {
  let box = document.getElementById("exercise-insights");
  if (!box) {
    const grp = document.getElementById("exercise-select").closest(".form-group");
    box = document.createElement("div");
    box.id = "exercise-insights";
    box.className = "hint";
    box.style.marginTop = "8px";
    grp.parentElement.insertBefore(box, grp.nextSibling);
  }
  if (!name) { box.innerHTML = ""; return; }

  const last = getLastHeaviestWithReps(name);
  const best = getBestHeaviestWithReps(name);
  const parts = [];
  if (last) {
    parts.push(`Last: <strong>${last.maxWeight ?? 0} kg</strong>${last.reps != null ? ` × <strong>${last.reps} reps</strong>` : ""} (${fmtDate(last.date)})`);
  } else parts.push(`Last: <em>no history</em>`);
  if (best) {
    parts.push(`Heaviest: <strong>${best.maxWeight ?? 0} kg</strong>${best.reps != null ? ` × <strong>${best.reps} reps</strong>` : ""}${best.date ? ` (${fmtDate(best.date)})` : ""}`);
  } else parts.push(`Heaviest: <em>no history</em>`);
  box.innerHTML = parts.join(" &nbsp;•&nbsp; ");
}
function populateExercises(query) {
  const exSel = document.getElementById("exercise-select");
  if (!exSel) return;
  exSel.innerHTML = `<option value="">--Select--</option>`;

  let pool = EXES.slice();

  if (W.location === "home") {
    const HOME = new Set(HOME_EQUIPMENT);
    pool = pool.filter(e => e.equipment.some(eq => HOME.has(eq)));
  }

  if (W.section) {
    if (W.section === "specific muscle" && W.muscle) {
      pool = pool.filter(e => e.sections.includes("specific muscle") && e.muscles.includes(W.muscle));
    } else {
      pool = pool.filter(e => e.sections.includes(W.section));
    }
  }

  if (W.equipment) {
    pool = pool.filter(e => e.equipment.includes(W.equipment));
  }

  let names = uniq(pool.map(e => e.name)).sort((a,b)=>a.localeCompare(b));
  if (query) {
    const q = String(query).toLowerCase();
    names = names.filter(n => n.toLowerCase().includes(q));
  }

  exSel.innerHTML += names.map(n => `<option value="${n}">${n}</option>`).join("");
  exSel.value = W.exercise || "";
  exSel.onchange = () => { W.exercise = exSel.value || ""; showExerciseInsights(W.exercise); renderSetsUI(); };

  // Search input (if present)
  const search = document.getElementById("exercise-search");
  if (search && !search._bound) {
    search.addEventListener("input", () => populateExercises(search.value));
    search._bound = true;
  }

  showExerciseInsights(exSel.value || "");
  ensureMovementTypeControl();
  renderSetsUI();
}

function renderSetsUI() {
  const container = getSetsContainer();
  container.innerHTML = "";

  const setsInput = document.getElementById("sets-input");
  if (setsInput) setsInput.value = String(W.sets || 3);
  setsInput?.addEventListener("change", () => {
    W.sets = Math.max(1, toInt(setsInput.value,1));
    renderSetsUI();
  });

  const exName = W.exercise;
  if (!exName) return;

  const prev = computePrevPerSet(exName, W.movementType, W.sets);

  if (W.movementType === "unilateral") {
    // Left
    const leftWrap = document.createElement("div");
    leftWrap.className = "form-group";
    leftWrap.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(leftWrap);

    const gridL = leftWrap.querySelector("#sets-grid-left");
    for (let i=0;i<W.sets;i++){
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prevL && prev.prevL[i] !== "" && prev.prevL[i] != null) ? prev.prevL[i] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i+1}: Reps (L)" data-side="L" data-kind="reps" data-idx="${i}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : `${prevVal}kg`}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i+1}: Weight (kg) (L)" data-side="L" data-kind="weight" data-idx="${i}">
      `;
      gridL.appendChild(row);
    }

    // Right
    const rightWrap = document.createElement("div");
    rightWrap.className = "form-group";
    rightWrap.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    container.appendChild(rightWrap);

    const gridR = rightWrap.querySelector("#sets-grid-right");
    for (let i=0;i<W.sets;i++){
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prevR && prev.prevR[i] !== "" && prev.prevR[i] != null) ? prev.prevR[i] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i+1}: Reps (R)" data-side="R" data-kind="reps" data-idx="${i}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : `${prevVal}kg`}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i+1}: Weight (kg) (R)" data-side="R" data-kind="weight" data-idx="${i}">
      `;
      gridR.appendChild(row);
    }
  } else {
    const single = document.createElement("div");
    single.className = "form-group";
    single.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    container.appendChild(single);

    const grid = single.querySelector("#sets-grid");
    for (let i=0;i<W.sets;i++){
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prev && prev.prev[i] !== "" && prev.prev[i] != null) ? prev.prev[i] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i+1}: Reps" data-kind="reps" data-idx="${i}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : `${prevVal}kg`}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i+1}: Weight (kg)" data-kind="weight" data-idx="${i}">
      `;
      grid.appendChild(row);
    }
  }
}
function getSetsContainer() {
  let el = document.getElementById("sets-grids-wrapper");
  if (!el) {
    el = document.createElement("div");
    el.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    anchor?.appendChild(el);
  }
  return el;
}

function validateAndStoreStep5() {
  const hint = document.getElementById("s5-hint");
  if (!W.exercise) { if (hint) hint.textContent = "Choose an exercise."; return false; }
  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value, 1));
  W.sets = n;

  if (W.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i=>toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i=>toFloat(i.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i=>toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i=>toFloat(i.value));

    if (repsL.length!==n || wtsL.length!==n || repsR.length!==n || wtsR.length!==n ||
        repsL.some(v=>v<=0) || repsR.some(v=>v<=0) ||
        wtsL.some(v=>v<0)  || wtsR.some(v=>v<0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both sides.";
      return false;
    }

    W.setRepsL = repsL; W.setWeightsL = wtsL;
    W.setRepsR = repsR; W.setWeightsR = wtsR;

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    const overall = Math.max(maxL, maxR);
    const countOverall = [...wtsL,...wtsR].filter(w => w === overall).length;

    W.maxWeight = overall;
    W.maxWeightSetCount = countOverall;

    W.setReps = []; W.setWeights = [];

  } else {
    const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i=>toInt(i.value));
    const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i=>toFloat(i.value));

    if (reps.length!==n || wts.length!==n || reps.some(v=>v<=0) || wts.some(v=>v<0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return false;
    }

    W.setReps = reps; W.setWeights = wts;
    const maxW = Math.max(...wts);
    W.maxWeight = maxW;
    W.maxWeightSetCount = wts.filter(w => w === maxW).length;

    W.setRepsL = []; W.setWeightsL = [];
    W.setRepsR = []; W.setWeightsR = [];
  }

  if (hint) hint.textContent = "";
  return true;
}

/* Add to current workout list */
function addExerciseToWorkout() {
  if (!validateAndStoreStep5()) return;

  const ex = {
    id: Date.now().toString(),
    date: W.datetime,
    name: W.exercise,
    category: W.section,
    equipment: W.equipment,
    muscle: W.section === "specific muscle" ? W.muscle : null,
    movementType: W.movementType,
    sets: W.sets,
    setReps: W.setReps.slice(),
    setWeights: W.setWeights.slice(),
    setRepsL: W.setRepsL.slice(),
    setWeightsL: W.setWeightsL.slice(),
    setRepsR: W.setRepsR.slice(),
    setWeightsR: W.setWeightsR.slice(),
    maxWeight: W.maxWeight,
    maxWeightSetCount: W.maxWeightSetCount
  };
  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();

  // Reset inline inputs for the next add
  const exSel = document.getElementById("exercise-select");
  if (exSel) exSel.value = "";
  const setsInput = document.getElementById("sets-input");
  if (setsInput) setsInput.value = "3";
  Object.assign(W, {
    exercise: "", sets: 3,
    movementType: "bilateral",
    setReps: [], setWeights: [],
    setRepsL: [], setWeightsL: [],
    setRepsR: [], setWeightsR: [],
    maxWeight: 0, maxWeightSetCount: 0
  });
  renderSetsUI();
  const insights = document.getElementById("exercise-insights");
  if (insights) insights.innerHTML = "";

  updateNextButtonState();
}

function renderCurrentWorkoutList() {
  const wrap = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  if (!wrap || !list) return;

  list.innerHTML = "";
  if (!currentWorkoutExercises.length) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";

  currentWorkoutExercises.forEach((ex, idx) => {
    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r,i)=>`${r}x${ex.setWeightsL[i]}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r,i)=>`${r}x${ex.setWeightsR[i]}kg`).join(", ");
      const maxL = Math.max(...ex.setWeightsL);
      const maxR = Math.max(...ex.setWeightsR);
      const cL = ex.setWeightsL.filter(w=>w===maxL).length;
      const cR = ex.setWeightsR.filter(w=>w===maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${maxL}kg × ${cL} set(s) • Heaviest Right: ${maxR}kg × ${cR} set(s)</div>
      `;
    } else {
      const pairs = ex.setReps.map((r,i)=>`${r}x${ex.setWeights[i]}kg`).join(", ");
      details = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${ex.maxWeight}kg × ${ex.maxWeightSetCount} set(s)</div>
      `;
    }
    const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;

    const div = document.createElement("div");
    div.className = "workout-item";
    div.innerHTML = `
      <strong>${ex.name}</strong> <small>(${meta})</small><br>
      ${details}
      <button onclick="removeExerciseFromWorkout(${idx})" style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;">Remove</button>
    `;
    list.appendChild(div);
  });
}
function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateNextButtonState();
}

/* ======================================================================
   Step 6 — Review & Save
====================================================================== */
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${title(W.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${W.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocalString(W.datetime)}</span></div>
  `;

  exWrap.innerHTML = "";
  if (!currentWorkoutExercises.length) {
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added yet. Go back and add some.</em></div>`;
  } else {
    currentWorkoutExercises.forEach(ex => {
      // trend vs last
      const last = getLastHeaviestWithReps(ex.name);
      const best = getBestHeaviestWithReps(ex.name);

      let badge = `<span style="color:#9aa0a6;">— no history</span>`;
      if (last && typeof last.maxWeight === "number") {
        const delta = Number((ex.maxWeight - last.maxWeight).toFixed(2));
        if      (delta > 0) badge = ` <span style="color:#4caf50;">▲ +${delta}kg</span>`;
        else if (delta < 0) badge = ` <span style="color:#ff5252;">▼ ${Math.abs(delta)}kg</span>`;
        else                badge = ` <span style="color:#ffb300;">= 0kg</span>`;
      }

      const lastDelta = last ? ex.maxWeight - last.maxWeight : null;
      const bestDelta = best ? ex.maxWeight - best.maxWeight : null;

      let details = "";
      if (ex.movementType === "unilateral") {
        const pairsL = ex.setRepsL.map((r,i)=>`${r}x${ex.setWeightsL[i]}kg`).join(", ");
        const pairsR = ex.setRepsR.map((r,i)=>`${r}x${ex.setWeightsR[i]}kg`).join(", ");
        const maxL = Math.max(...ex.setWeightsL);
        const maxR = Math.max(...ex.setWeightsR);
        const cL = ex.setWeightsL.filter(w=>w===maxL).length;
        const cR = ex.setWeightsR.filter(w=>w===maxR).length;
        details = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: <strong>${maxL}kg</strong> (${cL} set${cL!==1?"s":""}) • Heaviest Right: <strong>${maxR}kg</strong> (${cR} set${cR!==1?"s":""})</div>
          <div>Overall Heaviest this session: <strong>${ex.maxWeight}kg</strong>${badge}</div>
          <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${lastDelta == null ? "—" : (lastDelta>0?`▲ +${lastDelta}kg`:(lastDelta<0?`▼ ${Math.abs(lastDelta)}kg`:`= 0kg`))}</strong></div>
          <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${bestDelta == null ? "—" : (bestDelta>0?`▲ +${bestDelta}kg`:(bestDelta<0?`▼ ${Math.abs(bestDelta)}kg`:`= 0kg`))}</strong></div>
        `;
      } else {
        const pairs = ex.setReps.map((r,i)=>`${r}x${ex.setWeights[i]}kg`).join(", ");
        details = `
          <div>${ex.sets} sets → ${pairs || "—"}</div>
          <div>Heaviest this session: <strong>${ex.maxWeight}kg</strong>${badge}</div>
          <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${lastDelta == null ? "—" : (lastDelta>0?`▲ +${lastDelta}kg`:(lastDelta<0?`▼ ${Math.abs(lastDelta)}kg`:`= 0kg`))}</strong></div>
          <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${bestDelta == null ? "—" : (bestDelta>0?`▲ +${bestDelta}kg`:(bestDelta<0?`▼ ${Math.abs(bestDelta)}kg`:`= 0kg`))}</strong></div>
        `;
      }

      const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
      const card = document.createElement("div");
      card.className = "summary-exercise";
      card.innerHTML = `<strong>${ex.name}</strong> <small>(${metaLine})</small><br>${details}`;
      exWrap.appendChild(card);
    });
  }

  // Totals
  let totalVolume = 0, totalSets = 0;
  currentWorkoutExercises.forEach(ex => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets * 2;
      ex.setRepsL.forEach((r,i)=> totalVolume += r * (ex.setWeightsL[i] || 0));
      ex.setRepsR.forEach((r,i)=> totalVolume += r * (ex.setWeightsR[i] || 0));
    } else {
      totalSets += ex.sets;
      ex.setReps.forEach((r,i)=> totalVolume += r * (ex.setWeights[i] || 0));
    }
  });
  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${currentWorkoutExercises.length}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
  `;
}

function saveSession() {
  if (!W.datetime) { alert("Missing session date/time — go back to Step 2."); return; }
  if (!currentWorkoutExercises.length) { alert("Add at least one exercise before saving."); return; }

  currentWorkoutExercises.forEach(ex => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id, date: W.datetime,
      category: ex.category, equipment: ex.equipment, muscle: ex.muscle,
      movementType: ex.movementType,
      setReps: ex.setReps, setWeights: ex.setWeights,
      setRepsL: ex.setRepsL, setWeightsL: ex.setWeightsL,
      setRepsR: ex.setRepsR, setWeightsR: ex.setWeightsR,
      sets: ex.sets,
      maxWeight: ex.maxWeight, maxWeightSetCount: ex.maxWeightSetCount
    });
    if (ex.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  // Reset wizard for a new session
  Object.assign(W, {
    timing: "now",
    datetime: nowIsoMinute(),
    equipment: "",
    exercise: "",
    movementType: "bilateral",
    sets: 3,
    setReps: [], setWeights: [],
    setRepsL: [], setWeightsL: [],
    setRepsR: [], setWeightsR: [],
    maxWeight: 0, maxWeightSetCount: 0
  });
  const dt = document.getElementById("workout-datetime");
  if (dt) { dt.value = W.datetime; dt.setAttribute("disabled","disabled"); }
  const exSel = document.getElementById("exercise-select");
  if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  const eqSel = document.getElementById("equipment-select");
  if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
  const setsInput = document.getElementById("sets-input");
  if (setsInput) setsInput.value = "3";
  renderSetsUI();

  goToStep(1);
}

/* ======================================================================
   Validation dispatcher & init
====================================================================== */
function validateAndStore(step) {
  if (step === 1) return validateAndStoreStep1();
  if (step === 2) return validateAndStoreStep2();
  if (step === 3) return validateAndStoreStep3();
  if (step === 4) return validateAndStoreStep4();
  if (step === 5) return validateAndStoreStep5();
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  // buttons (main.js might also bind; this is safe)
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);
  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);

  // init steps
  initStep1();
  initStep2();
  initStep3();

  // defaults
  goToStep(1);
  updateNextButtonState();
});

/* =======================================================================
   🔧 HOTFIX APPENDIX — DO NOT REMOVE EXISTING CODE ABOVE
   - Ensures Equipment & Exercises populate even if filters are tight
   - Ensures sets/reps grid renders when selection changes
   ======================================================================= */

/* Utility (safe title) */
(function(){
  if (!window._fixTitleCase) {
    window._fixTitleCase = function(s){
      if (!s) return s;
      s = String(s);
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
  }
})();

/* 1) Equipment fallback */
(function(){
  const originalPopulateEquipment = window.populateEquipment;
  window.populateEquipment = function(){
    if (typeof originalPopulateEquipment === "function") originalPopulateEquipment();

    const sel = document.getElementById("equipment-select");
    if (!sel) return;

    const hasOnlyPlaceholder = sel.options.length <= 1;
    if (hasOnlyPlaceholder) {
      const raw = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
      const allEq = [...new Set(
        raw.flatMap(e => Array.isArray(e.equipment) ? e.equipment : [])
           .map(eq => String(eq).toLowerCase())
      )].sort((a,b)=>a.localeCompare(b));

      if (allEq.length) {
        sel.innerHTML = `<option value="">--Select--</option>` +
          allEq.map(eq => `<option value="${eq}">${window._fixTitleCase(eq)}</option>`).join("");
      }
    }

    sel.onchange = () => {
      if (window.W) window.W.equipment = sel.value;
      if (typeof window.populateExercises === "function") window.populateExercises();
      if (typeof window.renderSetsUI === "function") window.renderSetsUI();
    };
  };
})();

/* 2) Exercises fallback */
(function(){
  const originalPopulateExercises = window.populateExercises;
  window.populateExercises = function(query){
    if (typeof originalPopulateExercises === "function") originalPopulateExercises(query);

    const exSel = document.getElementById("exercise-select");
    if (!exSel) return;

    const onlyPlaceholder = exSel.options.length <= 1;
    if (onlyPlaceholder) {
      const raw = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];

      const loc = document.getElementById("workout-type-select")?.value || (window.W?.location || "");
      const cat = document.getElementById("work-on-select")?.value || (window.W?.section || "");
      const mus = document.getElementById("muscle-select")?.value || (window.W?.muscle || "");
      const eq  = document.getElementById("equipment-select")?.value || (window.W?.equipment || "");

      let pool = raw.slice();

      if (loc === "home") {
        const HOME = new Set(["body weight","resistance bands","kettlebell"]);
        pool = pool.filter(e => (e.equipment || []).map(x=>String(x).toLowerCase()).some(x => HOME.has(x)));
      }

      if (cat) {
        const catLc = String(cat).toLowerCase();
        if (catLc === "specific muscle" && mus) {
          pool = pool.filter(e =>
            (e.sections || []).map(s=>String(s).toLowerCase()).includes("specific muscle") &&
            (e.muscles  || []).includes(mus)
          );
        } else {
          pool = pool.filter(e =>
            (e.sections || []).map(s=>String(s).toLowerCase()).includes(catLc)
          );
        }
      }

      if (eq) {
        const eqLc = String(eq).toLowerCase();
        pool = pool.filter(e => (e.equipment || []).map(s=>String(s).toLowerCase()).includes(eqLc));
      }

      let names = [...new Set(pool.map(e => e.name))].sort((a,b)=>a.localeCompare(b));
      if (query) {
        const q = String(query).toLowerCase();
        names = names.filter(n => n.toLowerCase().includes(q));
      }

      if (names.length) {
        exSel.innerHTML = `<option value="">--Select--</option>` +
          names.map(n => `<option value="${n}">${n}</option>`).join("");
      }
    }

    exSel.onchange = () => {
      if (window.W) window.W.exercise = exSel.value;
      if (typeof window.renderSetsUI === "function") window.renderSetsUI();
    };
  };
})();

/* 3) Force sets grid to update on changes */
document.addEventListener("DOMContentLoaded", () => {
  const setsInput = document.getElementById("sets-input");
  if (setsInput && !setsInput._hotfix_bound) {
    setsInput.addEventListener("change", () => {
      if (window.W) window.W.sets = Math.max(1, parseInt(setsInput.value || "1", 10));
      if (typeof window.renderSetsUI === "function") window.renderSetsUI();
    });
    setsInput._hotfix_bound = true;
  }

  const moveSel = document.getElementById("movement-type-select");
  if (moveSel && !moveSel._hotfix_bound) {
    moveSel.addEventListener("change", () => {
      if (window.W) window.W.movementType = moveSel.value || "bilateral";
      if (typeof window.renderSetsUI === "function") window.renderSetsUI();
    });
    moveSel._hotfix_bound = true;
  }

  const exSel = document.getElementById("exercise-select");
  if (exSel && !exSel._hotfix_bound) {
    exSel.addEventListener("change", () => {
      if (window.W) window.W.exercise = exSel.value;
      if (typeof window.renderSetsUI === "function") window.renderSetsUI();
    });
    exSel._hotfix_bound = true;
  }
});

/* 4) Safety rescue when entering step 4/5 */
(function(){
  const tryRescue = () => {
    const step4 = document.querySelector('.wizard-step[data-step="4"]');
    if (step4 && step4.style.display !== "none") {
      const eqSel = document.getElementById("equipment-select");
      if (eqSel && eqSel.options.length <= 1 && typeof window.populateEquipment === "function") {
        window.populateEquipment();
      }
    }
    const step5 = document.querySelector('.wizard-step[data-step="5"]');
    if (step5 && step5.style.display !== "none") {
      const exSel = document.getElementById("exercise-select");
      if (exSel && exSel.options.length <= 1 && typeof window.populateExercises === "function") {
        window.populateExercises();
      }
      if (typeof window.renderSetsUI === "function") window.renderSetsUI();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(tryRescue, 50);
    setTimeout(tryRescue, 200);
  });

  (function bindNavButtons(){
    const next = document.getElementById("next-btn");
    const prev = document.getElementById("prev-btn");
    if (next && !next._hotfix_rescue) {
      next.addEventListener("click", () => setTimeout(tryRescue, 30));
      next._hotfix_rescue = true;
    }
    if (prev && !prev._hotfix_rescue) {
      prev.addEventListener("click", () => setTimeout(tryRescue, 30));
      prev._hotfix_rescue = true;
    }
  })();
})();
