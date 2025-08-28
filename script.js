/* =======================================================================
   Workout Session Logger — FULL script.js
   - Uses exercises.js (must be loaded BEFORE this file) which defines window.EXERCISES
   - Wizard steps:
       1) Location (Gym/Home)
       2) Timing (Now/Past) + Date
       3) What are you training (Category) + optional Specific Muscle
       4) Equipment (filtered by location & category)
       5) Exercise + Sets/Reps/Weights (with bilateral/unilateral + per-set Prev markers)
       6) Review & Save (shows vs Last and vs Best with dates & deltas)
   - History View with Chart.js
   - Preserves logger step + scroll when switching Logger ↔ History
   - IMPORTANT: Step 5 HTML must include (or this script will create it):
       #exercise-select, #sets-input, and a container #exercise-inputs
   ======================================================================= */

/* ---------------- Crash guard ---------------- */
window.addEventListener("error", (e) => console.error("[JS Error]", e.error || e.message));

/* ---------------- Small helpers ---------------- */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const WHITELIST_SECTIONS = new Set([
  "upper body", "lower body", "push", "pull", "hinge", "squat", "full body", "core", "specific muscle", "legs"
]);
const uniq = (a) => [...new Set(a)];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const toInt = (v, f = 0) => Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : f;
const toFloat = (v, f = 0) => Number.isFinite(parseFloat(v)) ? parseFloat(v) : f;
const nowIsoMinute = () => new Date().toISOString().slice(0, 16);
const isoToLocal = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || "—"; } };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const fmtDelta = (d) => {
  if (d == null) return "—";
  const dd = Number(d.toFixed(2));
  if (dd > 0) return `▲ +${dd}kg`;
  if (dd < 0) return `▼ ${Math.abs(dd)}kg`;
  return `= 0kg`;
};
const stripZeros = (n) => {
  if (!Number.isFinite(n)) return n;
  const s = String(n);
  return s.includes(".") ? s.replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1") : s;
};

/* ---------------- Exercise data normalization ----------------
   EXPECTS: window.EXERCISES = [{ name, sections[], equipment[], muscles[] }, ...]
---------------------------------------------------------------- */
const RAW = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const EX = RAW.map(e => ({
  name: e.name,
  sections: (e.sections || []).map(s => String(s).toLowerCase().trim()),
  equipment: (e.equipment || []).map(x => String(x).toLowerCase().trim()),
  muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
}));

function normalizeCategory(c0) {
  const c = String(c0 || "").toLowerCase().trim();
  if (c === "upper") return "upper body";
  if (c === "lower" || c === "legs") return "lower body";
  return c;
}
function allCategories() {
  const raw = uniq(EX.flatMap(e => e.sections));
  const cats = raw.filter(s => WHITELIST_SECTIONS.has(s));
  // Put common first
  const order = ["upper body","lower body","push","pull","full body","hinge","squat","core","specific muscle"];
  const rest = cats.filter(c => !order.includes(c)).sort();
  return [...order.filter(c => cats.includes(c)), ...rest];
}
function allMuscles() {
  return uniq(EX.flatMap(e => e.muscles)).sort((a,b)=>a.localeCompare(b));
}
function byLocation(items, loc) {
  return loc === "home" ? items.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.includes(eq))) : items;
}
function byCategoryAndMuscle(items, category, muscle) {
  const cat = normalizeCategory(category);
  if (!cat) return [];
  if (cat === "specific muscle") {
    if (!muscle) return [];
    return items.filter(e => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle));
  }
  return items.filter(e => e.sections.includes(cat));
}

/* ---------------- App state ---------------- */
let currentStep = 1;
let myChart = null;

let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

const wizard = {
  location: "",
  timing: "now", // "now" | "past"
  datetime: nowIsoMinute(),
  category: "",
  muscle: "",
  equipment: "",
  exercise: "",
  movementType: "bilateral", // 'bilateral' | 'unilateral'
  sets: 3,
  // Bilateral arrays
  setReps: [],
  setWeights: [],
  // Unilateral arrays (Left / Right)
  setRepsL: [],
  setWeightsL: [],
  setRepsR: [],
  setWeightsR: [],
  maxWeight: 0,
  maxWeightSetCount: 0
};

/* ---------------- History helpers (last/best) ---------------- */
function getExerciseRecordsDesc(name) {
  const recs = (userWorkoutData[name]?.records || []).slice();
  recs.sort((a,b)=> new Date(b.date) - new Date(a.date));
  return recs;
}
function extractWeightsAndReps(record) {
  if (record.setWeightsL && record.setWeightsR) {
    const w = [...(record.setWeightsL||[]), ...(record.setWeightsR||[])];
    const r = [
      ...(record.setRepsL || Array((record.setWeightsL||[]).length).fill(null)),
      ...(record.setRepsR || Array((record.setWeightsR||[]).length).fill(null)),
    ];
    return { weights: w, reps: r };
  }
  return {
    weights: Array.isArray(record.setWeights) ? record.setWeights : [],
    reps: Array.isArray(record.setReps) ? record.setReps : []
  };
}
function getLastHeaviestWithReps(name) {
  const recs = getExerciseRecordsDesc(name);
  if (!recs.length) return null;
  const r = recs[0];
  const { weights, reps } = extractWeightsAndReps(r);
  if (!weights.length) return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };
  const maxW = Math.max(...weights);
  const idx = weights.findIndex(w => w === maxW);
  const repsAt = idx >= 0 ? (reps[idx] ?? null) : null;
  return { maxWeight: maxW, reps: repsAt, date: r.date };
}
function getBestHeaviestWithReps(name) {
  const best = userWorkoutData[name]?.bestWeight ?? null;
  if (best == null) return null;
  const recs = getExerciseRecordsDesc(name).slice().reverse(); // oldest→newest
  for (const r of recs) {
    const { weights, reps } = extractWeightsAndReps(r);
    const i = weights.findIndex(w => w === best);
    if (i >= 0) return { maxWeight: best, reps: reps[i] ?? null, date: r.date };
  }
  return { maxWeight: best, reps: null, date: null };
}
function computePrevPerSet(name, movementType, setsCount) {
  const blank = Array(setsCount).fill("");
  if (!name) return movementType === "unilateral" ? { prevL: blank, prevR: blank } : { prev: blank };
  const last = getExerciseRecordsDesc(name)[0];
  if (!last) return movementType === "unilateral" ? { prevL: blank, prevR: blank } : { prev: blank };

  if (movementType === "unilateral") {
    let prevL = blank.slice(), prevR = blank.slice();
    if (Array.isArray(last.setWeightsL) && Array.isArray(last.setWeightsR)) {
      for (let i=0;i<setsCount;i++) {
        if (i < last.setWeightsL.length) prevL[i] = last.setWeightsL[i];
        if (i < last.setWeightsR.length) prevR[i] = last.setWeightsR[i];
      }
    } else if (Array.isArray(last.setWeights)) {
      for (let i=0;i<setsCount;i++) {
        if (i < last.setWeights.length) prevL[i] = prevR[i] = last.setWeights[i];
      }
    } else if (typeof last.maxWeight === "number") {
      prevL = Array(setsCount).fill(last.maxWeight);
      prevR = Array(setsCount).fill(last.maxWeight);
    }
    return { prevL, prevR };
  }

  let prev = blank.slice();
  if (Array.isArray(last.setWeights)) {
    for (let i=0;i<setsCount;i++) if (i<last.setWeights.length) prev[i] = last.setWeights[i];
  } else if (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)) {
    for (let i=0;i<setsCount;i++) {
      const l = Array.isArray(last.setWeightsL) && i<last.setWeightsL.length ? last.setWeightsL[i] : null;
      const r = Array.isArray(last.setWeightsR) && i<last.setWeightsR.length ? last.setWeightsR[i] : null;
      if (l!=null && r!=null) prev[i] = Math.max(l,r);
      else if (l!=null) prev[i] = l;
      else if (r!=null) prev[i] = r;
    }
  } else if (typeof last.maxWeight === "number") {
    prev = Array(setsCount).fill(last.maxWeight);
  }
  return { prev };
}

/* ---------------- DOM bootstrap ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  // top nav
  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);

  // wizard nav
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);

  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);
  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);

  const histSel = document.getElementById("history-select");
  if (histSel) histSel.addEventListener("change", displayExerciseHistory);

  initStep1();
  initStep2();
  initStep3();
  // step 4 & 5 set up on entry
  goToStep(1);
  updateReviewButtonState();
});

/* ---------------- Wizard navigation ---------------- */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = (idx === step - 1) ? "block" : "none";
  });
  document.querySelectorAll(".step-badge").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });

  // enable/disable prev
  const prev = document.getElementById("prev-btn");
  if (prev) prev.disabled = (step === 1);

  if (step === 4) populateEquipment();
  else if (step === 5) initStep5(); // includes populateExercises + sets grid render
  else if (step === 6) buildSessionSummary();

  updateReviewButtonState();
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
function updateReviewButtonState() {
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

/* ---------------- Step 1: Location ---------------- */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">--Select Location--</option>
                   <option value="gym">Gym</option>
                   <option value="home">Home</option>`;
  sel.value = wizard.location || "";
}
function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  const v = document.getElementById("workout-type-select").value;
  if (!v) { if (hint) hint.textContent = "Please select where you are training."; return false; }
  wizard.location = v;
  if (hint) hint.textContent = "";
  return true;
}

/* ---------------- Step 2: Timing + Date ---------------- */
function initStep2() {
  document.querySelectorAll('input[name="timing"]').forEach(r => {
    r.addEventListener("change", onTimingChange);
  });
  // default to "now"
  const dt = document.getElementById("workout-datetime");
  if (wizard.timing === "now") {
    const radio = document.querySelector('input[name="timing"][value="now"]');
    if (radio) radio.checked = true;
    if (dt) { dt.value = wizard.datetime; dt.setAttribute("disabled","disabled"); }
  } else {
    const radio = document.querySelector('input[name="timing"][value="past"]');
    if (radio) radio.checked = true;
    if (dt) { dt.value = wizard.datetime; dt.removeAttribute("disabled"); }
  }
}
function onTimingChange(e) {
  wizard.timing = e.target.value;
  const dt = document.getElementById("workout-datetime");
  if (wizard.timing === "now") {
    wizard.datetime = nowIsoMinute();
    if (dt) { dt.value = wizard.datetime; dt.setAttribute("disabled","disabled"); }
    const hint = document.getElementById("date-hint");
    if (hint) hint.textContent = "Date/time is locked to now.";
  } else {
    if (dt) { dt.removeAttribute("disabled"); }
    const hint = document.getElementById("date-hint");
    if (hint) hint.textContent = "Pick the date/time for your past session.";
  }
}
function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  const dt = document.getElementById("workout-datetime");
  if (wizard.timing === "past") {
    if (!dt || !dt.value) { if (hint) hint.textContent = "Choose a date/time for your past session."; return false; }
    wizard.datetime = dt.value;
  } else {
    wizard.datetime = nowIsoMinute();
  }
  if (hint) hint.textContent = "";
  return true;
}

/* ---------------- Step 3: What are you training ---------------- */
function initStep3() {
  const selCat = document.getElementById("work-on-select");
  const cats = allCategories();
  selCat.innerHTML = `<option value="">--Select--</option>` + cats.map(c => `<option value="${c}">${cap(c)}</option>`).join("");
  selCat.value = wizard.category || "";

  const selMus = document.getElementById("muscle-select");
  const muscles = allMuscles();
  selMus.innerHTML = `<option value="">--Select--</option>` + muscles.map(m => `<option value="${m}">${m}</option>`).join("");
  selMus.value = wizard.muscle || "";

  const group = document.getElementById("muscle-select-group");
  if (wizard.category === "specific muscle") group.style.display = "block"; else group.style.display = "none";

  selCat.addEventListener("change", () => {
    const c = normalizeCategory(selCat.value);
    wizard.category = c;
    if (c === "specific muscle") group.style.display = "block";
    else { group.style.display = "none"; wizard.muscle = ""; selMus.value = ""; }
    // clear downstream selections
    const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
    const exSel = document.getElementById("exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  });
  selMus.addEventListener("change", () => {
    wizard.muscle = selMus.value;
    // clear downstream
    const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
    const exSel = document.getElementById("exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  });
}
function validateAndStoreStep3() {
  const hint = document.getElementById("s3-hint");
  const raw = document.getElementById("work-on-select").value;
  if (!raw) { if (hint) hint.textContent = "Please select what you're training."; return false; }
  const cat = normalizeCategory(raw);
  wizard.category = cat;
  if (cat === "specific muscle") {
    const mus = document.getElementById("muscle-select").value;
    if (!mus) { if (hint) hint.textContent = "Please choose a specific muscle."; return false; }
    wizard.muscle = mus;
  }
  if (hint) hint.textContent = "";
  return true;
}

/* ---------------- Step 4: Equipment ---------------- */
function populateEquipment() {
  const sel = document.getElementById("equipment-select");
  const hint = document.getElementById("s4-hint");
  if (!sel) return;

  sel.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EX, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);
  const equipments = uniq(filtered.flatMap(e => e.equipment)).sort((a,b)=>a.localeCompare(b));

  if (!equipments.length) {
    if (hint) hint.textContent = "No equipment matches your selection (try a different category or muscle).";
  } else if (hint) hint.textContent = "";

  sel.innerHTML += equipments.map(eq => `<option value="${eq}">${cap(eq)}</option>`).join("");
  sel.value = wizard.equipment || "";

  sel.onchange = () => {
    wizard.equipment = sel.value;
    populateExercises();
  };
}
function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  const val = document.getElementById("equipment-select").value;
  if (!val) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  wizard.equipment = val;
  if (hint) hint.textContent = "";
  return true;
}

/* ---------------- Step 5: Exercise + Sets grid ---------------- */
// Ensure a safe container for set rows, even if HTML missed it
function ensureExerciseInputsContainer() {
  let container = document.getElementById("exercise-inputs");
  if (!container) {
    const host = document.querySelector('.wizard-step[data-step="5"]')
              || document.getElementById("exercise-select-group")
              || document.getElementById("workout-logger")
              || document.body;
    container = document.createElement("div");
    container.id = "exercise-inputs";
    host.appendChild(container);
  }
  return container;
}

function ensureInsightsNode() {
  let box = document.getElementById("exercise-insights");
  if (!box) {
    const parent = document.getElementById("exercise-select-group") || document.getElementById("exercise-select")?.parentElement;
    box = document.createElement("div");
    box.id = "exercise-insights";
    box.className = "hint";
    box.style.marginTop = "6px";
    (parent?.parentElement || parent || document.body).appendChild(box);
  }
  return box;
}

function ensureMovementTypeControl() {
  let wrap = document.getElementById("movement-type-wrap");
  if (!wrap) {
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
    const anchor = ensureInsightsNode();
    anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
    wrap.querySelector("#movement-type-select").addEventListener("change", (e) => {
      wizard.movementType = e.target.value;
      renderSetRows();
    });
  }
  wrap.querySelector("#movement-type-select").value = wizard.movementType || "bilateral";
  return wrap;
}

function showExerciseInsights(name) {
  const box = ensureInsightsNode();
  if (!name) { box.textContent = ""; return; }
  const last = getLastHeaviestWithReps(name);
  const best = getBestHeaviestWithReps(name);
  const bits = [];
  if (last) {
    bits.push(`Last: <strong>${stripZeros(last.maxWeight ?? 0)}kg</strong>${last.reps!=null ? ` × <strong>${last.reps}</strong>`:""} (${fmtDate(last.date)})`);
  } else {
    bits.push(`Last: <em>no history</em>`);
  }
  if (best) {
    bits.push(`Heaviest: <strong>${stripZeros(best.maxWeight ?? 0)}kg</strong>${best.reps!=null ? ` × <strong>${best.reps}</strong>`:""}${best.date ? ` (${fmtDate(best.date)})`:""}`);
  } else {
    bits.push(`Heaviest: <em>no history</em>`);
  }
  box.innerHTML = bits.join(" &nbsp;•&nbsp; ");
}

function populateExercises() {
  const select = document.getElementById("exercise-select");
  if (!select) return;
  select.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EX, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter(e => wizard.equipment ? e.equipment.includes(wizard.equipment) : true);

  const names = uniq(filtered.map(e => e.name)).sort((a,b)=>a.localeCompare(b));
  select.innerHTML += names.map(n => `<option value="${n}">${n}</option>`).join("");
  select.value = wizard.exercise || "";

  // insights + movement type control
  showExerciseInsights(select.value || "");
  ensureMovementTypeControl();

  // change handler
  select.onchange = () => {
    wizard.exercise = select.value;
    showExerciseInsights(wizard.exercise);
    ensureMovementTypeControl();
    renderSetRows();
  };

  renderSetRows();
}

function initStep5() {
  // exercise select will be populated when entering step 5 via populateExercises()
  populateExercises();
  // sets input handler
  const setsInput = document.getElementById("sets-input");
  if (setsInput) {
    setsInput.value = wizard.sets;
    setsInput.onchange = () => {
      wizard.sets = Math.max(1, toInt(setsInput.value, 1));
      renderSetRows();
    };
  }
}

function renderSetRows() {
  const container = ensureExerciseInputsContainer(); // auto-create if missing
  const n = Math.max(1, toInt(document.getElementById("sets-input")?.value, 1));
  wizard.sets = n;

  container.innerHTML = "";

  const exName = wizard.exercise || "";
  const isUni = (wizard.movementType === "unilateral");

  const prev = computePrevPerSet(exName, isUni ? "unilateral" : "bilateral", n);

  if (isUni) {
    // Left block
    const left = document.createElement("div");
    left.className = "form-group";
    left.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(left);

    const gridL = left.querySelector("#sets-grid-left");
    for (let i=1;i<=n;i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prevL && prev.prevL[i-1] !== "" && prev.prevL[i-1] != null) ? prev.prevL[i-1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)" data-side="L" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : stripZeros(prevVal) + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (L)" data-side="L" data-kind="weight" data-idx="${i-1}">
      `;
      gridL.appendChild(row);
    }

    // Right block
    const right = document.createElement("div");
    right.className = "form-group";
    right.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    container.appendChild(right);

    const gridR = right.querySelector("#sets-grid-right");
    for (let i=1;i<=n;i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prevR && prev.prevR[i-1] !== "" && prev.prevR[i-1] != null) ? prev.prevR[i-1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)" data-side="R" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : stripZeros(prevVal) + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)" data-side="R" data-kind="weight" data-idx="${i-1}">
      `;
      gridR.appendChild(row);
    }

    // Prefill (if editing)
    if (wizard.setRepsL.length === n) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeightsL[i] ?? "");
    }
    if (wizard.setRepsR.length === n) {
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeightsR[i] ?? "");
    }
  } else {
    const block = document.createElement("div");
    block.className = "form-group";
    block.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    container.appendChild(block);

    const grid = block.querySelector("#sets-grid");
    for (let i=1;i<=n;i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const prevVal = (prev.prev && prev.prev[i-1] !== "" && prev.prev[i-1] != null) ? prev.prev[i-1] : "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${prevVal === "" ? "—" : stripZeros(prevVal) + "kg"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i-1}">
      `;
      grid.appendChild(row);
    }

    if (wizard.setReps.length === n) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeights[i] ?? "");
    }
  }
}

function validateAndStoreStep5() {
  const hint = document.getElementById("s5-hint");
  const exercise = document.getElementById("exercise-select").value;
  if (!exercise) { if (hint) hint.textContent = "Choose an exercise."; return false; }
  wizard.exercise = exercise;

  const n = Math.max(1, toInt(document.getElementById("sets-input").value, 1));
  wizard.sets = n;

  if (wizard.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#exercise-inputs [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#exercise-inputs [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#exercise-inputs [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#exercise-inputs [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    if (repsL.length !== n || repsR.length !== n || wtsL.length !== n || wtsR.length !== n ||
        repsL.some(v => v <= 0) || repsR.some(v => v <= 0) ||
        wtsL.some(v => v < 0) || wtsR.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right sides.";
      return false;
    }

    wizard.setRepsL = repsL; wizard.setWeightsL = wtsL;
    wizard.setRepsR = repsR; wizard.setWeightsR = wtsR;

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    wizard.maxWeight = Math.max(maxL, maxR);
    wizard.maxWeightSetCount = [...wtsL, ...wtsR].filter(w => w === wizard.maxWeight).length;

    wizard.setReps = []; wizard.setWeights = [];

  } else {
    const reps = [...document.querySelectorAll('#exercise-inputs [data-kind="reps"]')].map(i => toInt(i.value));
    const wts  = [...document.querySelectorAll('#exercise-inputs [data-kind="weight"]')].map(i => toFloat(i.value));

    if (reps.length !== n || wts.length !== n || reps.some(v => v <= 0) || wts.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return false;
    }

    wizard.setReps = reps; wizard.setWeights = wts;
    const maxW = Math.max(...wts);
    wizard.maxWeight = maxW;
    wizard.maxWeightSetCount = wts.filter(w => w === maxW).length;

    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  if (hint) hint.textContent = "";
  return true;
}

/* Add/remove to current session (Step 5) */
function addExerciseToWorkout() {
  if (!validateAndStoreStep5()) return;

  const ex = {
    id: Date.now().toString(),
    date: wizard.datetime,
    name: wizard.exercise,
    category: wizard.category,
    equipment: wizard.equipment,
    muscle: wizard.category === "specific muscle" ? wizard.muscle : null,
    movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(),
    setWeights: wizard.setWeights.slice(),
    setRepsL: wizard.setRepsL.slice(),
    setWeightsL: wizard.setWeightsL.slice(),
    setRepsR: wizard.setRepsR.slice(),
    setWeightsR: wizard.setWeightsR.slice(),
    maxWeight: wizard.maxWeight,
    maxWeightSetCount: wizard.maxWeightSetCount
  };
  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();

  // reset inline inputs (so you can add another)
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  Object.assign(wizard, {
    exercise: "",
    sets: 3,
    movementType: "bilateral",
    setReps: [], setWeights: [],
    setRepsL: [], setWeightsL: [],
    setRepsR: [], setWeightsR: [],
    maxWeight: 0, maxWeightSetCount: 0
  });
  renderSetRows();
  ensureInsightsNode().textContent = "";

  updateReviewButtonState();
}

function renderCurrentWorkoutList() {
  const wrap = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  if (!wrap || !list) return;

  list.innerHTML = "";
  if (!currentWorkoutExercises.length) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";

  currentWorkoutExercises.forEach((ex, idx) => {
    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r,i)=> `${r}x${stripZeros(ex.setWeightsL[i])}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r,i)=> `${r}x${stripZeros(ex.setWeightsR[i])}kg`).join(", ");
      const maxL = ex.setWeightsL.length ? Math.max(...ex.setWeightsL) : 0;
      const maxR = ex.setWeightsR.length ? Math.max(...ex.setWeightsR) : 0;
      const cL = ex.setWeightsL.filter(w => w === maxL).length;
      const cR = ex.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${cL} set(s) • Heaviest Right: ${stripZeros(maxR)}kg × ${cR} set(s)</div>
      `;
    } else {
      const pairs = ex.setReps.map((r,i)=> `${r}x${stripZeros(ex.setWeights[i])}kg`).join(", ");
      details = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${stripZeros(ex.maxWeight)}kg × ${ex.maxWeightSetCount} set(s)</div>
      `;
    }
    const meta = `${cap(ex.category)} • ${cap(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}`:""} • ${cap(ex.movementType)}`;
    const item = document.createElement("div");
    item.className = "workout-item";
    item.innerHTML = `
      <strong>${ex.name}</strong> <small>(${meta})</small><br>
      ${details}
      <button onclick="removeExerciseFromWorkout(${idx})" style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;">Remove</button>
    `;
    list.appendChild(item);
  });
}
function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

/* ---------------- Step 6: Review & Save ---------------- */
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  if (meta) meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${cap(wizard.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocal(wizard.datetime)}</span></div>
  `;

  if (exWrap) exWrap.innerHTML = "";

  (currentWorkoutExercises || []).forEach(ex => {
    const last = getLastHeaviestWithReps(ex.name);
    const best = getBestHeaviestWithReps(ex.name);
    const lastDelta = last ? (ex.maxWeight - last.maxWeight) : null;
    const bestDelta = best ? (ex.maxWeight - best.maxWeight) : null;

    let badge = `<span style="color:#9aa0a6;">— no history</span>`;
    if (last) {
      if (lastDelta > 0) badge = ` <span style="color:#4caf50;">▲ +${stripZeros(lastDelta)}kg</span>`;
      else if (lastDelta < 0) badge = ` <span style="color:#ff5252;">▼ ${stripZeros(Math.abs(lastDelta))}kg</span>`;
      else badge = ` <span style="color:#ffb300;">= 0kg</span>`;
    }

    let details = "";
    if (ex.movementType === "unilateral") {
      const L = ex.setWeightsL || [], R = ex.setWeightsR || [];
      const pairsL = ex.setRepsL.map((r,i)=> `${r}x${stripZeros(L[i])}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r,i)=> `${r}x${stripZeros(R[i])}kg`).join(", ");
      const maxL = L.length ? Math.max(...L) : 0;
      const maxR = R.length ? Math.max(...R) : 0;
      const cL = L.filter(w => w === maxL).length;
      const cR = R.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: <strong>${stripZeros(maxL)}kg</strong> (${cL} sets) • Heaviest Right: <strong>${stripZeros(maxR)}kg</strong> (${cR} sets)</div>
        <div>Overall Heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong>${badge}</div>
        <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
        <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
      `;
    } else {
      const pairs = ex.setReps.map((r,i)=> `${r}x${stripZeros(ex.setWeights[i])}kg`).join(", ");
      details = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong>${badge}</div>
        <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
        <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
      `;
    }

    const metaLine = `${cap(ex.category)} • ${cap(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}`:""} • ${cap(ex.movementType)}`;
    const card = document.createElement("div");
    card.className = "summary-exercise";
    card.innerHTML = `<strong>${ex.name}</strong> <small>(${metaLine})</small><br>${details}`;
    exWrap?.appendChild(card);
  });

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
  if (totals) {
    totals.innerHTML = `
      <div><strong>Total Exercises:</strong> ${currentWorkoutExercises.length}</div>
      <div><strong>Total Sets:</strong> ${totalSets}</div>
      <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
    `;
  }
}

function saveSession() {
  const dt = wizard.datetime;
  if (!dt) { alert("Missing session date/time — go back to Step 2."); return; }
  if (!currentWorkoutExercises.length) { alert("Add at least one exercise before saving."); return; }

  currentWorkoutExercises.forEach(ex => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id,
      date: dt,
      category: ex.category,
      equipment: ex.equipment,
      muscle: ex.muscle,
      movementType: ex.movementType,
      sets: ex.sets,
      setReps: ex.setReps,
      setWeights: ex.setWeights,
      setRepsL: ex.setRepsL,
      setWeightsL: ex.setWeightsL,
      setRepsR: ex.setRepsR,
      setWeightsR: ex.setWeightsR,
      maxWeight: ex.maxWeight,
      maxWeightSetCount: ex.maxWeightSetCount
    });
    if (Number.isFinite(ex.maxWeight) && ex.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  // reset wizard
  Object.assign(wizard, {
    location: "", timing: "now", datetime: nowIsoMinute(),
    category: "", muscle: "", equipment: "", exercise: "",
    movementType: "bilateral",
    sets: 3,
    setReps: [], setWeights: [],
    setRepsL: [], setWeightsL: [],
    setRepsR: [], setWeightsR: [],
    maxWeight: 0, maxWeightSetCount: 0
  });

  // reset UI
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = "";
  const nowRadio = document.querySelector('input[name="timing"][value="now"]'); if (nowRadio) nowRadio.checked = true;
  const dtInput = document.getElementById("workout-datetime"); if (dtInput) { dtInput.setAttribute("disabled","disabled"); dtInput.value = wizard.datetime; }
  const workOn = document.getElementById("work-on-select"); if (workOn) workOn.value = "";
  const musSel = document.getElementById("muscle-select"); if (musSel) musSel.value = "";
  const musGrp = document.getElementById("muscle-select-group"); if (musGrp) musGrp.style.display = "none";
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  const setsInput = document.getElementById("sets-input"); if (setsInput) setsInput.value = "3";
  ensureExerciseInputsContainer().innerHTML = "";

  goToStep(1);
  updateReviewButtonState();
}

/* ---------------- History View ---------------- */
function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history")?.classList.add("active");

  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}
function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger")?.classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
}

function populateHistoryDropdown() {
  const sel = document.getElementById("history-select");
  if (!sel) return;
  const keys = Object.keys(userWorkoutData).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = `<option value="">--Select an Exercise--</option>` + keys.map(k => `<option value="${k}">${k}</option>`).join("");
  const details = document.getElementById("history-details");
  if (details) details.style.display = "none";
}
function displayExerciseHistory() {
  const name = document.getElementById("history-select").value;
  const details = document.getElementById("history-details");
  const bestTitle = document.getElementById("best-weight-title");
  const log = document.getElementById("history-log");

  if (!name || !userWorkoutData[name]?.records?.length) {
    if (details) details.style.display = "none";
    return;
  }

  const hist = userWorkoutData[name];
  if (details) details.style.display = "block";
  if (bestTitle) bestTitle.textContent = `Best Weight: ${stripZeros(hist.bestWeight)}kg`;

  const sorted = hist.records.slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
  const dates = sorted.map(r => new Date(r.date).toLocaleDateString());
  const maxWeights = sorted.map(r => r.maxWeight);

  if (myChart) myChart.destroy();
  const ctx = document.getElementById("history-chart")?.getContext("2d");
  if (ctx) {
    myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [{
          label: "Heaviest Lift (kg)",
          data: maxWeights,
          borderColor: "orange",
          backgroundColor: "rgba(255,165,0,0.2)",
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "Date", color: "white" }, ticks: { color: "white" } },
          y: { title: { display: true, text: "Weight (kg)", color: "white" }, ticks: { color: "white" } }
        },
        plugins: { legend: { labels: { color: "white" } } }
      }
    });
  }

  if (log) {
    log.innerHTML = "";
    sorted.forEach(rec => {
      const dateStr = new Date(rec.date).toLocaleString();
      let inner = "";
      if (rec.movementType === "unilateral" && rec.setWeightsL && rec.setWeightsR) {
        const pairsL = rec.setRepsL.map((r,i)=> `${r}x${stripZeros(rec.setWeightsL[i])}kg`).join(", ");
        const pairsR = rec.setRepsR.map((r,i)=> `${r}x${stripZeros(rec.setWeightsR[i])}kg`).join(", ");
        const maxL = rec.setWeightsL.length ? Math.max(...rec.setWeightsL) : 0;
        const maxR = rec.setWeightsR.length ? Math.max(...rec.setWeightsR) : 0;
        const cL = rec.setWeightsL.filter(w => w === maxL).length;
        const cR = rec.setWeightsR.filter(w => w === maxR).length;
        inner = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${stripZeros(maxL)}kg × ${cL} • Heaviest Right: ${stripZeros(maxR)}kg × ${cR}</div>
        `;
      } else {
        const pairs = rec.setReps?.length
          ? rec.setReps.map((r,i)=> `${r}x${stripZeros(rec.setWeights[i])}kg`).join(", ")
          : `Reps: ${rec.reps || 0} | Weights: ${(rec.setWeights||[]).map(stripZeros).join(", ")}kg`;
        inner = `
          <div>Sets: ${rec.sets} → ${pairs}</div>
          <div>Heaviest: ${stripZeros(rec.maxWeight)}kg${rec.maxWeightSetCount ? ` × ${rec.maxWeightSetCount} set(s)` : ""}</div>
        `;
      }

      const meta = `${cap(rec.category || "n/a")} • ${cap(rec.equipment || "n/a")}${rec.muscle ? ` • ${rec.muscle}`:""} • ${cap(rec.movementType || "bilateral")}`;
      const li = document.createElement("li");
      li.innerHTML = `
        <span>
          <strong>${name}</strong> <small>(${meta})</small><br>
          Date: ${dateStr}<br>
          ${inner}
        </span>
        <div class="history-actions">
          <button class="edit-btn" onclick="editRecord('${name}','${rec.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteRecord('${name}','${rec.id}')">Delete</button>
        </div>
      `;
      log.appendChild(li);
    });
  }
}

function deleteRecord(exName, recordId) {
  if (!confirm("Are you sure you want to delete this record?")) return;
  const hist = userWorkoutData[exName];
  hist.records = hist.records.filter(r => r.id !== recordId);
  if (!hist.records.length) {
    delete userWorkoutData[exName];
  } else {
    const newMax = Math.max(...hist.records.map(r => r.maxWeight));
    hist.bestWeight = Number.isFinite(newMax) ? newMax : 0;
  }
  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();
  const sel = document.getElementById("history-select");
  if (sel && (exName in userWorkoutData)) {
    sel.value = exName;
    displayExerciseHistory();
  } else {
    const details = document.getElementById("history-details");
    if (details) details.style.display = "none";
  }
}

function editRecord(exName, recordId) {
  const hist = userWorkoutData[exName];
  const rec = hist?.records.find(r => r.id === recordId);
  if (!rec) return;

  wizard.location = HOME_EQUIPMENT.includes(rec.equipment) ? "home" : "gym";
  wizard.timing = "past";
  wizard.datetime = rec.date;
  wizard.category = rec.category || "";
  wizard.muscle = rec.muscle || "";
  wizard.equipment = rec.equipment || "";
  wizard.exercise = exName;
  wizard.movementType = rec.movementType || "bilateral";
  wizard.sets = rec.sets || 3;

  if (wizard.movementType === "unilateral" && rec.setWeightsL && rec.setWeightsR) {
    wizard.setRepsL = (rec.setRepsL || []).slice();
    wizard.setWeightsL = (rec.setWeightsL || []).slice();
    wizard.setRepsR = (rec.setRepsR || []).slice();
    wizard.setWeightsR = (rec.setWeightsR || []).slice();
    wizard.setReps = []; wizard.setWeights = [];
  } else {
    wizard.setReps = (rec.setReps || []).slice();
    wizard.setWeights = (rec.setWeights || []).slice();
    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  const { weights } = extractWeightsAndReps(rec);
  wizard.maxWeight = weights.length ? Math.max(...weights) : (rec.maxWeight || 0);
  wizard.maxWeightSetCount = weights.filter(w => w === wizard.maxWeight).length || (rec.maxWeightSetCount || 0);

  editingRecord = rec;

  showLoggerView();

  // reflect UI
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = wizard.location;
  const pastRadio = document.querySelector('input[name="timing"][value="past"]'); if (pastRadio) pastRadio.checked = true;
  const dt = document.getElementById("workout-datetime"); if (dt) { dt.removeAttribute("disabled"); dt.value = wizard.datetime; }
  const catSel = document.getElementById("work-on-select"); if (catSel) catSel.value = wizard.category;

  const muscleGroup = document.getElementById("muscle-select-group");
  const muscleSel = document.getElementById("muscle-select");
  if (wizard.category === "specific muscle") { if (muscleGroup) muscleGroup.style.display = "block"; if (muscleSel) muscleSel.value = wizard.muscle; }
  else { if (muscleGroup) muscleGroup.style.display = "none"; }

  populateEquipment();
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.value = wizard.equipment;
  populateExercises();
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.value = wizard.exercise;

  // Render rows with existing values
  renderSetRows();

  // prefill the inputs with stored values
  if (wizard.movementType === "unilateral") {
    const gridL = document.getElementById("sets-grid-left");
    const gridR = document.getElementById("sets-grid-right");
    if (gridL && gridR) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeightsL[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeightsR[i] ?? "");
    }
  } else {
    const grid = document.getElementById("sets-grid");
    if (grid) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el,i)=> el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el,i)=> el.value = wizard.setWeights[i] ?? "");
    }
  }

  currentWorkoutExercises = [{
    id: rec.id, date: wizard.datetime, name: wizard.exercise, category: wizard.category,
    equipment: wizard.equipment, muscle: wizard.muscle || null, movementType: wizard.movementType,
    sets: wizard.sets,
    setReps: wizard.setReps.slice(), setWeights: wizard.setWeights.slice(),
    setRepsL: wizard.setRepsL.slice(), setWeightsL: wizard.setWeightsL.slice(),
    setRepsR: wizard.setRepsR.slice(), setWeightsR: wizard.setWeightsR.slice(),
    maxWeight: wizard.maxWeight, maxWeightSetCount: wizard.maxWeightSetCount
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();

  goToStep(5);
  const msg = document.getElementById("edit-mode-message"); if (msg) msg.style.display = "block";
}

/* ---------------- Validation dispatcher ---------------- */
function validateAndStore(step) {
  if (step === 1) return validateAndStoreStep1();
  if (step === 2) return validateAndStoreStep2();
  if (step === 3) return validateAndStoreStep3();
  if (step === 4) return validateAndStoreStep4();
  if (step === 5) return validateAndStoreStep5();
  return true;
}

/* ---------------- Debug helpers (optional) ---------------- */
window._dumpData = () => console.log("userWorkoutData:", userWorkoutData);
window._clearData = () => {
  if (confirm("Clear ALL workout data?")) {
    localStorage.removeItem("userWorkoutData");
    userWorkoutData = {};
    currentWorkoutExercises = [];
    renderCurrentWorkoutList();
    alert("All data cleared.");
  }
};

/* Expose for inline HTML handlers */
window.showHistoryView = showHistoryView;
window.showLoggerView = showLoggerView;
window.addExerciseToWorkout = addExerciseToWorkout;
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
