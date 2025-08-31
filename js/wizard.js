/* =========================================================
   wizard.js  — Full file with robust Equipment population
   (keeps your step flow & features intact)
   ========================================================= */

/* Crash guard */
window.addEventListener("error", (e) => {
  console.error("[JS Error]", e.error || e.message);
});

/* --------------------------
   Utilities
--------------------------- */
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const uniq = arr => [...new Set(arr)];
const toInt = (v, f = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : f;
};
const toFloat = (v, f = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : f;
};

/* Local (not UTC) datetime for <input type="datetime-local"> */
const nowIsoMinute = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
};

const isoToLocal = iso => { try { return new Date(iso).toLocaleString(); } catch { return iso || ""; } };

/* Keep original home-safe set (you can add more if you actually have them at home) */
const HOME_EQUIPMENT = new Set(["body weight", "resistance bands", "kettlebell"]);

/* Normalize small spelling differences in equipment strings */
const eqAlias = (s) => {
  const t = String(s).trim().toLowerCase();
  if (t === "bodyweight") return "body weight"; // unify with the rest of your data
  return t;
};

const CATEGORY_WHITELIST = new Set([
  "upper body", "lower body", "push", "pull", "hinge", "squat",
  "full body", "core", "specific muscle", "legs" // keep your aliases
]);

function normalizeCategory(raw) {
  const c = String(raw || "").trim().toLowerCase();
  if (c === "upper") return "upper body";
  if (c === "lower" || c === "legs") return "lower body";
  return c;
}

/* --------------------------
   Data normalization
--------------------------- */
const RAW = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const EXES = RAW.map(e => ({
  name: e.name,
  // sections/categories (lowercased)
  sections: (Array.isArray(e.sections) ? e.sections : (Array.isArray(e.categories) ? e.categories : (e.category ? [e.category] : [])))
    .map(s => String(s).trim().toLowerCase()),
  // normalize equipment strings (e.g., "bodyweight" -> "body weight")
  equipment: (Array.isArray(e.equipment) ? e.equipment : (e.equipment ? [e.equipment] : []))
    .map(eqAlias),
  muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
}));

function allCategoriesFromLib() {
  const cats = uniq(EXES.flatMap(e => e.sections)).filter(c => CATEGORY_WHITELIST.has(c));
  const preferred = ["upper body","lower body","push","pull","hinge","squat","full body","core","specific muscle"];
  const remain = cats.filter(c => !preferred.includes(c)).sort((a,b)=>a.localeCompare(b));
  return uniq([...preferred, ...remain]);
}

function allMusclesFromLib() {
  return uniq(EXES.flatMap(e => e.muscles || [])).sort((a,b)=>a.localeCompare(b));
}

/* --------------------------
   Global wizard state
--------------------------- */
const W = {
  location: "",        // "gym" | "home"
  timing: "now",       // "now" | "past"
  datetime: nowIsoMinute(),  // local time string

  section: "",         // normalized category/section
  muscle: "",          // when section === "specific muscle"
  equipment: "",       // selected equipment string
  exercise: "",        // selected exercise name

  movementType: "bilateral", // "bilateral" | "unilateral"
  sets: 3,
  setReps: [], setWeights: [],
  setRepsL: [], setWeightsL: [],
  setRepsR: [], setWeightsR: []
};

let currentStep = 1;
let currentWorkoutExercises = [];
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let myChart = null;

let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

/* --------------------------
   Init
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);

  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);

  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);
  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);

  initStep1();
  initStep2();
  initStep3();
  goToStep(1);
  updateNextButton();
});

/* =========================================================
   Step navigation
========================================================= */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = idx === (step - 1) ? "block" : "none";
  });

  document.querySelectorAll(".step-badge").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });

  document.getElementById("prev-btn").disabled = (step === 1);

  if (step === 4) populateEquipment();
  if (step === 5) { populateExercises(); renderSetsUI(); }
  if (step === 6) buildSessionSummary();

  updateNextButton();
}

function prevStep() { if (currentStep > 1) goToStep(currentStep - 1); }

function nextStep() {
  if (!validateAndStore(currentStep)) return;
  if (currentStep < 5) { goToStep(currentStep + 1); return; }
  if (currentStep === 5) {
    if (currentWorkoutExercises.length === 0) {
      const hint = document.getElementById("s5-hint");
      if (hint) hint.textContent = "Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6); return;
  }
  saveSession();
}

function updateNextButton() {
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

/* =========================================================
   Step 1 — Location
========================================================= */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (sel) {
    sel.innerHTML = `<option value="">--Select Location--</option>
                     <option value="gym">Gym</option>
                     <option value="home">Home</option>`;
    sel.value = W.location || "";
    sel.onchange = () => { W.location = sel.value || ""; };
  }
}
function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  if (!W.location) { if (hint) hint.textContent = "Please select where you are training."; return false; }
  if (hint) hint.textContent = ""; return true;
}

/* =========================================================
   Step 2 — Timing & Date
========================================================= */
function initStep2() {
  const dt = document.getElementById("workout-datetime");
  if (dt) {
    dt.value = W.datetime;
    if (W.timing === "now") dt.setAttribute("disabled", "disabled");
  }
  document.querySelectorAll('input[name="timing"]').forEach(r => {
    if (r.value === W.timing) r.checked = true;
    r.addEventListener("change", e => {
      W.timing = e.target.value;
      const dtI = document.getElementById("workout-datetime");
      const hint = document.getElementById("date-hint");
      if (W.timing === "now") {
        W.datetime = nowIsoMinute();
        if (dtI) { dtI.value = W.datetime; dtI.setAttribute("disabled", "disabled"); }
        if (hint) hint.textContent = "Date/time is locked to now.";
      } else {
        if (dtI) dtI.removeAttribute("disabled");
        if (hint) hint.textContent = "Pick the date/time for your past session.";
      }
    });
  });
}
function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  const dt = document.getElementById("workout-datetime");
  if (W.timing === "past") {
    if (!dt.value) { if (hint) hint.textContent = "Choose a date/time for your past session."; return false; }
    W.datetime = dt.value;
  } else {
    W.datetime = nowIsoMinute();
  }
  if (hint) hint.textContent = ""; return true;
}

/* =========================================================
   Step 3 — What you’re training (+ muscle for specific)
========================================================= */
function initStep3() {
  const sectionSel = document.getElementById("work-on-select");
  const muscleSel  = document.getElementById("muscle-select");
  const muscleGroup = document.getElementById("muscle-select-group");

  const categories = allCategoriesFromLib();
  sectionSel.innerHTML = `<option value="">--Select--</option>` +
    categories.map(c => `<option value="${c}">${c}</option>`).join("");
  sectionSel.value = W.section || "";

  const muscles = allMusclesFromLib();
  muscleSel.innerHTML = `<option value="">--Select--</option>` +
    muscles.map(m => `<option value="${m}">${m}</option>`).join("");
  muscleSel.value = W.muscle || "";

  muscleGroup.style.display = (W.section === "specific muscle") ? "block" : "none";

  sectionSel.addEventListener("change", () => {
    W.section = normalizeCategory(sectionSel.value || "");
    muscleGroup.style.display = (W.section === "specific muscle") ? "block" : "none";
    if (W.section !== "specific muscle") { W.muscle = ""; muscleSel.value = ""; }

    W.equipment = ""; W.exercise = "";
    const eqSel = document.getElementById("equipment-select");
    if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
    const exSel = document.getElementById("exercise-select");
    if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;

    populateEquipment();
  });

  muscleSel.addEventListener("change", () => {
    W.muscle = muscleSel.value || "";
    W.equipment = ""; W.exercise = "";
    const eqSel = document.getElementById("equipment-select");
    if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
    const exSel = document.getElementById("exercise-select");
    if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
    populateEquipment();
  });
}

function validateAndStoreStep3() {
  const hint = document.getElementById("s3-hint");
  if (!W.section) { if (hint) hint.textContent = "Please select what you're training."; return false; }
  if (W.section === "specific muscle" && !W.muscle) { if (hint) hint.textContent = "Please choose a specific muscle."; return false; }
  if (hint) hint.textContent = ""; return true;
}

/* =========================================================
   Step 4 — Equipment  (with selection guards)
========================================================= */
function populateEquipment() {
  const eqSel = document.getElementById("equipment-select");
  if (!eqSel) return;

  // Make sure it’s clickable/enabled in case CSS/other scripts messed with it
  eqSel.disabled = false;
  eqSel.style.pointerEvents = "auto";

  // Always reset to placeholder
  eqSel.innerHTML = `<option value="">--Select--</option>`;

  // 1) Start from normalized library
  let pool = EXES.slice();

  // 2) Filter by section (+ muscle if specific)
  if (W.section) {
    if (W.section === "specific muscle") {
      if (W.muscle) {
        pool = pool.filter(e => e.sections.includes("specific muscle") && (e.muscles || []).includes(W.muscle));
      } else {
        pool = pool.filter(e => e.sections.includes("specific muscle"));
      }
    } else {
      pool = pool.filter(e => e.sections.includes(W.section));
    }
  }

  // 3) Soft Home restriction (only if it leaves results)
  if (W.location === "home") {
    const homePool = pool.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.has(eq)));
    if (homePool.length) pool = homePool;
  }

  // 4) Equipments from pool
  let eqs = [...new Set(pool.flatMap(e => e.equipment))].sort((a,b)=>a.localeCompare(b));

  // 5) Fallbacks so user never gets stuck
  if (eqs.length === 0) {
    let fallback = EXES.slice();
    if (W.location === "home") {
      const homeFallback = fallback.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.has(eq)));
      if (homeFallback.length) fallback = homeFallback;
    }
    eqs = [...new Set(fallback.flatMap(e => e.equipment))].sort((a,b)=>a.localeCompare(b));
  }
  if (eqs.length === 0) {
    eqs = [...new Set(EXES.flatMap(e => e.equipment))].sort((a,b)=>a.localeCompare(b));
  }

  // 6) Render
  eqSel.innerHTML += eqs.map(eq => `<option value="${eq}">${cap(eq)}</option>`).join("");

  // 7) Restore selection if still valid (don’t trigger change here)
  if (W.equipment && eqs.includes(W.equipment)) {
    eqSel.value = W.equipment;
  } else {
    W.equipment = "";
  }

  // 8) Guard against immediate re-render during native select interaction
  let suppressOnce = false;
  eqSel.addEventListener("mousedown", () => { suppressOnce = true; }, { passive: true });

  // 9) Bind change: update exercises & sets
  eqSel.onchange = () => {
    const chosen = eqSel.value || "";
    W.equipment = chosen;
    console.debug("[equipment-select] changed →", chosen);

    const run = () => { populateExercises(); renderSetsUI(); };
    if (suppressOnce) { suppressOnce = false; setTimeout(run, 0); } else { run(); }
  };
}

function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  if (!W.equipment) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  if (hint) hint.textContent = ""; return true;
}

/* =========================================================
   Step 5 — Exercise + Sets & Reps (with Prev markers)
========================================================= */
function populateExercises() {
  const exSel = document.getElementById("exercise-select");
  if (!exSel) return;
  exSel.innerHTML = `<option value="">--Select--</option>`;

  let pool = EXES.slice();

  // Section (+ muscle)
  if (W.section) {
    if (W.section === "specific muscle") {
      if (W.muscle) {
        pool = pool.filter(e => e.sections.includes("specific muscle") && (e.muscles || []).includes(W.muscle));
      } else {
        pool = pool.filter(e => e.sections.includes("specific muscle"));
      }
    } else {
      pool = pool.filter(e => e.sections.includes(W.section));
    }
  }

  // If user already picked equipment, honor it. Otherwise, soft-home.
  if (W.equipment) {
    pool = pool.filter(e => e.equipment.includes(W.equipment));
  } else if (W.location === "home") {
    const homePool = pool.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.has(eq)));
    if (homePool.length) pool = homePool;
  }

  const names = uniq(pool.map(e => e.name)).sort((a,b)=>a.localeCompare(b));
  exSel.innerHTML += names.map(n => `<option value="${n}">${n}</option>`).join("");

  if (W.exercise && names.includes(W.exercise)) {
    exSel.value = W.exercise;
  } else {
    W.exercise = "";
  }

  ensureMovementTypeControl();

  exSel.onchange = () => {
    W.exercise = exSel.value || "";
    showExerciseInsights(W.exercise);
    renderSetsUI();
  };

  showExerciseInsights(exSel.value || "");
}

function ensureMovementTypeControl() {
  let wrap = document.getElementById("movement-type-wrap");
  if (!wrap) {
    const anchor = document.getElementById("exercise-select");
    if (anchor?.parentElement) {
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
      anchor.parentElement.appendChild(wrap);
    }
  }
  const sel = document.getElementById("movement-type-select");
  if (sel) {
    sel.value = W.movementType || "bilateral";
    sel.onchange = () => { W.movementType = sel.value; renderSetsUI(); };
  }
}

/* Small insights line showing last & best (with reps) */
function showExerciseInsights(name) {
  let node = document.getElementById("exercise-insights");
  if (!node) {
    const anchor = document.getElementById("exercise-select");
    if (anchor?.parentElement) {
      node = document.createElement("div");
      node.id = "exercise-insights";
      node.className = "hint";
      anchor.parentElement.appendChild(node);
    }
  }
  if (!node) return;

  if (!name || !userWorkoutData[name]?.records?.length) {
    node.innerHTML = "";
    return;
  }

  const recs = userWorkoutData[name].records.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const last = recs[0];

  const bestW = userWorkoutData[name].bestWeight;
  let bestDate = null, bestReps = null;
  for (const r of recs.slice().reverse()) {
    const ws = (r.setWeightsL && r.setWeightsR) ? [...(r.setWeightsL||[]), ...(r.setWeightsR||[])]
                                                : (r.setWeights || []);
    const rs = (r.setRepsL && r.setRepsR) ? [...(r.setRepsL||[]), ...(r.setRepsR||[])]
                                          : (r.setReps || (r.reps != null ? Array(ws.length).fill(r.reps) : []));
    const i = ws.findIndex(w => w === bestW);
    if (i >= 0) { bestDate = r.date; bestReps = rs[i] ?? null; break; }
  }

  const lastWs = (last.setWeightsL && last.setWeightsR) ? [...(last.setWeightsL||[]), ...(last.setWeightsR||[])]
                                                        : (last.setWeights || []);
  const lastRs = (last.setRepsL && last.setRepsR) ? [...(last.setRepsL||[]), ...(last.setRepsR||[])]
                                                  : (last.setReps || (last.reps != null ? Array(lastWs.length).fill(last.reps) : []));
  let lastMax = 0, lastReps = null;
  if (lastWs.length) {
    lastMax = Math.max(...lastWs);
    const idx = lastWs.findIndex(w => w === lastMax);
    lastReps = idx >= 0 ? lastRs[idx] ?? null : null;
  }

  const lastTxt = lastMax ? `${lastMax}kg${lastReps!=null?` × ${lastReps}`:""} (${isoToLocal(last.date)})` : "no history";
  const bestTxt = (bestW && bestW>0) ? `${bestW}kg${bestReps!=null?` × ${bestReps}`:""}${bestDate?` (${isoToLocal(bestDate)})`:""}`
                                     : "no history";

  node.innerHTML = `Last: <strong>${lastTxt}</strong> &nbsp;•&nbsp; Heaviest: <strong>${bestTxt}</strong>`;
}

/* Build sets rows with per-set “Prev: weight × reps” markers */
function renderSetsUI() {
  const setsInput = document.getElementById("sets-input");
  if (!setsInput) return;
  W.sets = Math.max(1, toInt(setsInput.value || 3, 3));
  setsInput.value = W.sets;
  setsInput.onchange = () => { W.sets = Math.max(1, toInt(setsInput.value || 3, 3)); renderSetsUI(); };

  let wrap = document.getElementById("sets-grids-wrapper");
  if (!wrap) {
    const anchor = document.getElementById("exercise-inputs");
    if (anchor) {
      wrap = document.createElement("div");
      wrap.id = "sets-grids-wrapper";
      anchor.appendChild(wrap);
    }
  }
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!W.exercise) return;

  const prev = computePrevPerSet(W.exercise, W.movementType, W.sets);

  if (W.movementType === "unilateral") {
    const leftBlock = document.createElement("div");
    leftBlock.className = "form-group";
    leftBlock.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    wrap.appendChild(leftBlock);

    const rightBlock = document.createElement("div");
    rightBlock.className = "form-group";
    rightBlock.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    wrap.appendChild(rightBlock);

    const gridL = leftBlock.querySelector("#sets-grid-left");
    const gridR = rightBlock.querySelector("#sets-grid-right");

    for (let i = 1; i <= W.sets; i++) {
      const prevL = (prev.prevL && prev.prevL[i-1]) ? prev.prevL[i-1] : "";
      const prevR = (prev.prevR && prev.prevR[i-1]) ? prev.prevR[i-1] : "";

      const rowL = document.createElement("div");
      rowL.className = "set-row";
      rowL.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)" data-side="L" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${prevL ? `${prevL.w}kg${prevL.r!=null?` × ${prevL.r}`:""}` : "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (L)" data-side="L" data-kind="weight" data-idx="${i-1}">
      `;
      gridL.appendChild(rowL);

      const rowR = document.createElement("div");
      rowR.className = "set-row";
      rowR.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)" data-side="R" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${prevR ? `${prevR.w}kg${prevR.r!=null?` × ${prevR.r}`:""}` : "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)" data-side="R" data-kind="weight" data-idx="${i-1}">
      `;
      gridR.appendChild(rowR);
    }
  } else {
    const block = document.createElement("div");
    block.className = "form-group";
    block.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    wrap.appendChild(block);

    const grid = block.querySelector("#sets-grid");
    for (let i = 1; i <= W.sets; i++) {
      const prevB = (prev.prev && prev.prev[i-1]) ? prev.prev[i-1] : "";
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i-1}">
        <span class="prev-weight">Prev: ${prevB ? `${prevB.w}kg${prevB.r!=null?` × ${prevB.r}`:""}` : "—"}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i-1}">
      `;
      grid.appendChild(row);
    }
  }
}

/* Build per-set “previous” values (weight & reps) */
function computePrevPerSet(exName, movementType, setsCount) {
  const blankN = Array(setsCount).fill("");
  const fmt = (w, r) => ({ w, r });

  const records = (userWorkoutData[exName]?.records || []).slice()
    .sort((a,b)=>new Date(b.date)-new Date(a.date));
  const last = records[0];
  if (!last) {
    return movementType === "unilateral"
      ? { prevL: blankN.slice(), prevR: blankN.slice() }
      : { prev: blankN.slice() };
  }

  if (movementType === "unilateral") {
    const outL = blankN.slice(), outR = blankN.slice();

    const Lw = Array.isArray(last.setWeightsL) ? last.setWeightsL : (Array.isArray(last.setWeights) ? last.setWeights : []);
    const Rw = Array.isArray(last.setWeightsR) ? last.setWeightsR : (Array.isArray(last.setWeights) ? last.setWeights : []);
    const Lr = Array.isArray(last.setRepsL) ? last.setRepsL :
               (Array.isArray(last.setReps) ? last.setReps :
               (last.reps != null ? Array(Lw.length).fill(last.reps) : []));
    const Rr = Array.isArray(last.setRepsR) ? last.setRepsR :
               (Array.isArray(last.setReps) ? last.setReps :
               (last.reps != null ? Array(Rw.length).fill(last.reps) : []));

    for (let i = 0; i < setsCount; i++) {
      if (i < Lw.length) outL[i] = fmt(Lw[i], Lr[i] ?? null);
      if (i < Rw.length) outR[i] = fmt(Rw[i], Rr[i] ?? null);
    }
    if (!Array.isArray(last.setWeightsL) && !Array.isArray(last.setWeightsR) && Array.isArray(last.setWeights)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeights.length) {
          const w = last.setWeights[i];
          const r = (Array.isArray(last.setReps) ? last.setReps[i] : (last.reps != null ? last.reps : null));
          outL[i] = fmt(w, r);
          outR[i] = fmt(w, r);
        }
      }
    }
    return { prevL: outL, prevR: outR };
  }

  const out = blankN.slice();
  const Bw = Array.isArray(last.setWeights) ? last.setWeights :
             (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)
                ? mergeLRMax(last.setWeightsL, last.setWeightsR)
                : (last.maxWeight != null ? Array(setsCount).fill(last.maxWeight) : []));
  const Br = Array.isArray(last.setReps) ? last.setReps :
             (last.reps != null ? Array(Bw.length).fill(last.reps) : []);

  for (let i = 0; i < setsCount; i++) {
    if (i < Bw.length) out[i] = fmt(Bw[i], Br[i] ?? null);
  }
  return { prev: out };
}

function mergeLRMax(L, R) {
  const l = Array.isArray(L) ? L : [];
  const r = Array.isArray(R) ? R : [];
  const n = Math.max(l.length, r.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const lv = (i < l.length) ? l[i] : null;
    const rv = (i < r.length) ? r[i] : null;
    if (lv != null && rv != null) out[i] = Math.max(lv, rv);
    else if (lv != null) out[i] = lv;
    else if (rv != null) out[i] = rv;
  }
  return out;
}

/* Add exercise to current session */
function addExerciseToWorkout() {
  const hint = document.getElementById("s5-hint");
  if (!W.exercise) { if (hint) hint.textContent = "Choose an exercise."; return; }

  const n = Math.max(1, W.sets);
  if (W.movementType === "unilateral") {
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
        repsL.some(v=>v<=0) || wtsL.some(v=>v<0) || repsR.some(v=>v<=0) || wtsR.some(v=>v<0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right sides.";
      return;
    }

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    const overallMax = Math.max(maxL, maxR);

    currentWorkoutExercises.push({
      id: Date.now().toString(),
      date: W.datetime,
      name: W.exercise,
      category: W.section,
      equipment: W.equipment,
      muscle: (W.section === "specific muscle" ? W.muscle : null),
      movementType: "unilateral",
      sets: n,
      setRepsL: repsL, setWeightsL: wtsL,
      setRepsR: repsR, setWeightsR: wtsR,
      maxWeight: overallMax
    });

  } else {
    const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i => toInt(i.value));
    const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i => toFloat(i.value));

    if (reps.length !== n || wts.length !== n || reps.some(v=>v<=0) || wts.some(v=>v<0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return;
    }
    const maxW = Math.max(...wts);

    currentWorkoutExercises.push({
      id: Date.now().toString(),
      date: W.datetime,
      name: W.exercise,
      category: W.section,
      equipment: W.equipment,
      muscle: (W.section === "specific muscle" ? W.muscle : null),
      movementType: "bilateral",
      sets: n,
      setReps: reps, setWeights: wts,
      maxWeight: maxW
    });
  }

  renderCurrentWorkoutList();
  updateNextButton();

  document.getElementById("exercise-select").value = "";
  W.exercise = "";
  document.getElementById("sets-input").value = "3";
  W.sets = 3;
  W.movementType = "bilateral";
  renderSetsUI();

  if (hint) hint.textContent = "";
}

/* Show current-session list */
function renderCurrentWorkoutList() {
  const wrap = document.getElementById("current-workout-list-container");
  const list = document.getElementById("current-workout-list");
  list.innerHTML = "";
  if (currentWorkoutExercises.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";

  currentWorkoutExercises.forEach((ex, idx) => {
    let details = "";
    if (ex.movementType === "unilateral") {
      const pairsL = ex.setRepsL.map((r, i) => `${r}x${ex.setWeightsL[i]}kg`).join(", ");
      const pairsR = ex.setRepsR.map((r, i) => `${r}x${ex.setWeightsR[i]}kg`).join(", ");
      const maxL = Math.max(...ex.setWeightsL);
      const maxR = Math.max(...ex.setWeightsR);
      const cL = ex.setWeightsL.filter(w => w === maxL).length;
      const cR = ex.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest Left: ${maxL || 0}kg × ${cL || 0} • Heaviest Right: ${maxR || 0}kg × ${cR || 0}</div>
      `;
    } else {
      const pairs = ex.setReps.map((r, i) => `${r}x${ex.setWeights[i]}kg`).join(", ");
      const c = ex.setWeights.filter(w => w === ex.maxWeight).length;
      details = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${ex.maxWeight || 0}kg × ${c || 0}</div>
      `;
    }

    const meta = `${cap(ex.category || "")} • ${cap(ex.equipment || "")}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${cap(ex.movementType)}`;
    const item = document.createElement("div");
    item.className = "workout-item";
    item.innerHTML = `
      <strong>${ex.name}</strong> <small>(${meta})</small><br>
      ${details}
      <button style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;"
              onclick="removeExerciseFromWorkout(${idx})">Remove</button>
    `;
    list.appendChild(item);
  });
}

function removeExerciseFromWorkout(index) {
  currentWorkoutExercises.splice(index, 1);
  renderCurrentWorkoutList();
  updateNextButton();
}

/* =========================================================
   Step 6 — Review & Save
========================================================= */
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${cap(W.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${W.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocal(W.datetime)}</span></div>
  `;

  exWrap.innerHTML = "";
  if (currentWorkoutExercises.length === 0) {
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added.</em></div>`;
  } else {
    currentWorkoutExercises.forEach(ex => {
      let details = "";
      if (ex.movementType === "unilateral") {
        const pairsL = ex.setRepsL.map((r, i)=>`${r}x${ex.setWeightsL[i]}kg`).join(", ");
        const pairsR = ex.setRepsR.map((r, i)=>`${r}x${ex.setWeightsR[i]}kg`).join(", ");
        const maxL = Math.max(...ex.setWeightsL);
        const maxR = Math.max(...ex.setWeightsR);
        const cL = ex.setWeightsL.filter(w => w === maxL).length;
        const cR = ex.setWeightsR.filter(w => w === maxR).length;
        details = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${maxL || 0}kg × ${cL || 0} • Heaviest Right: ${maxR || 0}kg × ${cR || 0}</div>
        `;
      } else {
        const pairs = ex.setReps.map((r, i)=>`${r}x${ex.setWeights[i]}kg`).join(", ");
        details = `
          <div>${ex.sets} sets → ${pairs || "—"}</div>
          <div>Heaviest this session: <strong>${ex.maxWeight || 0}kg</strong></div>
        `;
      }

      const metaLine = `${cap(ex.category || "")} • ${cap(ex.equipment || "")}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${cap(ex.movementType)}`;
      const card = document.createElement("div");
      card.className = "summary-exercise";
      card.innerHTML = `<strong>${ex.name}</strong> <small>(${metaLine})</small><br>${details}`;
      exWrap.appendChild(card);
    });
  }

  let totalSets = 0, totalVolume = 0;
  currentWorkoutExercises.forEach(ex => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets * 2;
      ex.setRepsL.forEach((r, i) => totalVolume += (r || 0) * (ex.setWeightsL[i] || 0));
      ex.setRepsR.forEach((r, i) => totalVolume += (r || 0) * (ex.setWeightsR[i] || 0));
    } else {
      totalSets += ex.sets;
      ex.setReps.forEach((r, i) => totalVolume += (r || 0) * (ex.setWeights[i] || 0));
    }
  });

  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${currentWorkoutExercises.length}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
  `;
}

function saveSession() {
  if (!W.datetime) { alert("Missing session date/time."); return; }
  if (currentWorkoutExercises.length === 0) { alert("Add at least one exercise before saving."); return; }

  currentWorkoutExercises.forEach(ex => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id, date: W.datetime,
      category: ex.category, equipment: ex.equipment, muscle: ex.muscle,
      movementType: ex.movementType,
      sets: ex.sets,
      setReps: ex.setReps, setWeights: ex.setWeights,
      setRepsL: ex.setRepsL, setWeightsL: ex.setWeightsL,
      setRepsR: ex.setRepsR, setWeightsR: ex.setWeightsR,
      maxWeight: ex.maxWeight
    });

    if (Number.isFinite(ex.maxWeight) && ex.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  currentWorkoutExercises = [];
  renderCurrentWorkoutList();

  W.exercise = ""; W.sets = 3; W.movementType = "bilateral";
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  renderSetsUI();

  goToStep(1);
}

/* =========================================================
   History view toggles
========================================================= */
function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");

  if (typeof populateHistoryDropdown === "function") populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}
function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateNextButton();
}

/* =========================================================
   Validation dispatcher
========================================================= */
function validateAndStore(step) {
  if (step === 1) return validateAndStoreStep1();
  if (step === 2) return validateAndStoreStep2();
  if (step === 3) return validateAndStoreStep3();
  if (step === 4) return validateAndStoreStep4();
  return true; // step 5 validated when adding exercise
}

/* Expose helper */
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
