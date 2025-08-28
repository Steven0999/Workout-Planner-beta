/* =======================================================================
   Workout Session Logger — script.js (FULL, with per-set Prev WEIGHT+REPS)
   Requires: window.EXERCISES from exercises.js (loaded BEFORE this file)
======================================================================= */

/* ---- Crash guard ---- */
window.addEventListener("error", (e) => console.error("[JS Error]", e.error || e.message));

/* ---- Constants / helpers ---- */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const CATEGORY_WHITELIST = new Set([
  "upper body", "lower body", "push", "pull", "hinge", "squat", "full body", "core", "specific muscle"
]);

const uniq = (a) => [...new Set(a)];
const cap  = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const title = cap;
const toInt = (v, f = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : f;
};
const toFloat = (v, f = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : f;
};
const isFiniteNum = (x) => typeof x === "number" && Number.isFinite(x);
const stripZeros = (n) => {
  if (!isFiniteNum(n)) return n;
  const s = String(n);
  return s.includes(".")
    ? s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
    : s;
};
const nowIsoMinute = () => new Date().toISOString().slice(0, 16);
const isoToLocalString = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const fmtDelta = (d) => {
  if (d == null) return "—";
  const dd = Number(d.toFixed(2));
  if (dd > 0) return `▲ +${stripZeros(dd)}kg`;
  if (dd < 0) return `▼ ${stripZeros(Math.abs(dd))}kg`;
  return `= 0kg`;
};
const normalizeCategory = (c0) => {
  const c = String(c0 || "").toLowerCase().trim();
  if (c === "upper") return "upper body";
  if (c === "lower" || c === "legs") return "lower body";
  return c;
};

/* ---- Data: exercises from exercises.js ---- */
const RAW_EXERCISES = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const EXERCISES_NORM = RAW_EXERCISES.map((e) => ({
  name: e.name,
  sections: Array.isArray(e.sections) ? e.sections.map((s) => String(s).toLowerCase()) : [],
  equipment: Array.isArray(e.equipment) ? e.equipment.map((x) => String(x).toLowerCase()) : [],
  muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
}));

const allCategories = () =>
  uniq(EXERCISES_NORM.flatMap((e) => e.sections.filter((s) => CATEGORY_WHITELIST.has(s))))
    .sort((a,b)=>a.localeCompare(b));

const allMuscles = () => uniq(EXERCISES_NORM.flatMap((e) => e.muscles)).sort((a,b)=>a.localeCompare(b));

const byLocation = (items, loc) =>
  loc === "home" ? items.filter((e) => e.equipment.some((eq) => HOME_EQUIPMENT.includes(eq))) : items;

function byCategoryAndMuscle(items, category, muscle) {
  const cat = normalizeCategory(category);
  if (!cat) return [];
  if (cat === "specific muscle") {
    if (!muscle) return [];
    return items.filter(
      (e) => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle)
    );
  }
  return items.filter((e) => e.sections.includes(cat));
}

/* ======================================================================
   App state
====================================================================== */
let currentStep = 1;
let myChart = null;

let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

const wizard = {
  location: "", timing: "now", datetime: nowIsoMinute(),
  category: "", muscle: "", equipment: "", exercise: "",
  movementType: "bilateral", // 'bilateral' | 'unilateral'
  sets: 3,
  // Bilateral arrays
  setReps: [], setWeights: [],
  // Unilateral arrays (Left / Right)
  setRepsL: [], setWeightsL: [],
  setRepsR: [], setWeightsR: [],
  maxWeight: 0, maxWeightSetCount: 0
};

/* Preserve wizard step + scroll positions when switching pages */
let lastLoggerStep = 1;
const pageScroll = { logger: 0, history: 0 };

/* ======================================================================
   History helpers (last / best) + trend
====================================================================== */
function getExerciseRecordsDesc(exName) {
  const recs = (userWorkoutData[exName]?.records || []).slice();
  recs.sort((a, b) => new Date(b.date) - new Date(a.date));
  return recs;
}

/* Extract arrays for any record, supporting unilateral/bilateral */
function extractWeightsAndReps(record) {
  if (record.setWeightsL && record.setWeightsR) {
    const wAll = [...record.setWeightsL, ...record.setWeightsR];
    const rAll = [
      ...(record.setRepsL || Array(record.setWeightsL.length).fill(null)),
      ...(record.setRepsR || Array(record.setWeightsR.length).fill(null))
    ];
    return { weights: wAll, reps: rAll };
  }
  return {
    weights: Array.isArray(record.setWeights) ? record.setWeights : [],
    reps: Array.isArray(record.setReps) ? record.setReps : []
  };
}

/** Last session’s heaviest set (across both sides if unilateral) */
function getLastHeaviestWithReps(exName) {
  const recs = getExerciseRecordsDesc(exName);
  if (recs.length === 0) return null;

  const r = recs[0];
  const { weights, reps } = extractWeightsAndReps(r);
  if (weights.length === 0) return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };

  const maxW = Math.max(...weights);
  const idx = weights.findIndex((w) => w === maxW);
  const repsAtMax = idx >= 0 ? reps[idx] ?? null : null;

  return { maxWeight: maxW, reps: repsAtMax, date: r.date };
}

/** All-time heaviest and reps (across both sides if unilateral) */
function getBestHeaviestWithReps(exName) {
  const bestW = userWorkoutData[exName]?.bestWeight ?? null;
  if (bestW == null) return null;

  const recs = getExerciseRecordsDesc(exName).slice().reverse(); // oldest -> newest
  for (const r of recs) {
    const { weights, reps } = extractWeightsAndReps(r);
    const i = weights.findIndex((w) => w === bestW);
    if (i >= 0) return { maxWeight: bestW, reps: reps[i] ?? null, date: r.date };
  }
  return { maxWeight: bestW, reps: null, date: null };
}

function getTrendAgainstLast(exName, currentMax) {
  const last = getLastHeaviestWithReps(exName);
  if (!last || last.maxWeight == null) return { dir: "na", delta: null };
  const delta = Number((currentMax - last.maxWeight).toFixed(2));
  if (delta > 0) return { dir: "up", delta };
  if (delta < 0) return { dir: "down", delta };
  return { dir: "same", delta: 0 };
}

/* === Per-set previous WEIGHT+REPS to show beside inputs =============== */
function blank(n) { return Array(n).fill(""); }
function computePrevPerSet(exName, movementType, setsCount) {
  // Returns:
  //  bilateral: { prevW: number[]|""[], prevR: number[]|""[] }
  //  unilateral:{ prevWL:[], prevRL:[], prevWR:[], prevRR:[] }
  const emptyB = { prevW: blank(setsCount), prevR: blank(setsCount) };
  const emptyU = { prevWL: blank(setsCount), prevRL: blank(setsCount), prevWR: blank(setsCount), prevRR: blank(setsCount) };

  if (!exName) return movementType === "unilateral" ? emptyU : emptyB;

  const last = getExerciseRecordsDesc(exName)[0];
  if (!last) return movementType === "unilateral" ? emptyU : emptyB;

  if (movementType === "unilateral") {
    const out = { ...emptyU };

    if (Array.isArray(last.setWeightsL) && Array.isArray(last.setWeightsR)) {
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeightsL.length) out.prevWL[i] = last.setWeightsL[i];
        if (i < (last.setRepsL || []).length) out.prevRL[i] = last.setRepsL[i];
        if (i < last.setWeightsR.length) out.prevWR[i] = last.setWeightsR[i];
        if (i < (last.setRepsR || []).length) out.prevRR[i] = last.setRepsR[i];
      }
    } else if (Array.isArray(last.setWeights)) {
      // Map bilateral last to both sides; reps if available
      for (let i = 0; i < setsCount; i++) {
        if (i < last.setWeights.length) {
          out.prevWL[i] = last.setWeights[i];
          out.prevWR[i] = last.setWeights[i];
        }
        if (Array.isArray(last.setReps) && i < last.setReps.length) {
          out.prevRL[i] = last.setReps[i];
          out.prevRR[i] = last.setReps[i];
        }
      }
    } else if (typeof last.maxWeight === "number") {
      out.prevWL = Array(setsCount).fill(last.maxWeight);
      out.prevWR = Array(setsCount).fill(last.maxWeight);
      // reps unknown -> leave blank
    }
    return out;
  }

  // Bilateral
  const out = { ...emptyB };
  if (Array.isArray(last.setWeights)) {
    for (let i = 0; i < setsCount; i++) {
      if (i < last.setWeights.length) out.prevW[i] = last.setWeights[i];
      if (Array.isArray(last.setReps) && i < last.setReps.length) out.prevR[i] = last.setReps[i];
    }
  } else if (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR)) {
    for (let i = 0; i < setsCount; i++) {
      const lW = Array.isArray(last.setWeightsL) && i < last.setWeightsL.length ? last.setWeightsL[i] : null;
      const rW = Array.isArray(last.setWeightsR) && i < last.setWeightsR.length ? last.setWeightsR[i] : null;
      if (lW != null && rW != null) out.prevW[i] = Math.max(lW, rW);
      else if (lW != null) out.prevW[i] = lW;
      else if (rW != null) out.prevW[i] = rW;

      const lR = Array.isArray(last.setRepsL) && i < last.setRepsL.length ? last.setRepsL[i] : null;
      const rR = Array.isArray(last.setRepsR) && i < last.setRepsR.length ? last.setRepsR[i] : null;
      if (lR != null && rR != null) out.prevR[i] = Math.max(lR, rR);
      else if (lR != null) out.prevR[i] = lR;
      else if (rR != null) out.prevR[i] = rR;
    }
  } else if (typeof last.maxWeight === "number") {
    out.prevW = Array(setsCount).fill(last.maxWeight);
    // reps unknown
  }
  return out;
}

/* ======================================================================
   DOM Ready
====================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // header switches
  document.getElementById("to-history")?.addEventListener("click", showHistoryView);
  document.getElementById("to-logger")?.addEventListener("click", showLoggerView);

  // nav
  document.getElementById("next-btn")?.addEventListener("click", nextStep);
  document.getElementById("prev-btn")?.addEventListener("click", prevStep);

  // step5 actions
  document.getElementById("edit-exercises-btn")?.addEventListener("click", () => goToStep(5));
  document.getElementById("save-session-btn")?.addEventListener("click", saveSession);
  document.getElementById("add-exercise-btn")?.addEventListener("click", addExerciseToWorkout);

  // history
  const historySelect = document.getElementById("history-select");
  if (historySelect) historySelect.addEventListener("change", displayExerciseHistory);

  // init steps
  initStep1(); initStep2(); initStep3(); initStep4(); initStep5();
  goToStep(1);
  updateReviewButtonState();
});

/* ======================================================================
   Step navigation
====================================================================== */
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el, idx) => {
    el.style.display = idx === step - 1 ? "block" : "none";
  });
  document.querySelectorAll(".step-badge").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.step) === step);
  });

  const prev = document.getElementById("prev-btn");
  if (prev) prev.disabled = step === 1;

  if (step === 4) populateEquipment();
  else if (step === 5) populateExercises();
  else if (step === 6) buildSessionSummary();

  updateReviewButtonState();
}
function prevStep() { if (currentStep > 1) goToStep(currentStep - 1); }
function nextStep() {
  if (currentStep < 5) {
    if (!validateAndStore(currentStep)) return;
    goToStep(currentStep + 1);
    return;
  }
  if (currentStep === 5) {
    if (currentWorkoutExercises.length === 0) {
      const s5Hint = document.getElementById("s5-hint");
      if (s5Hint) s5Hint.textContent = "Please add at least one exercise before reviewing your session.";
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
    const noItems = currentWorkoutExercises.length === 0;
    next.disabled = noItems;
    next.classList.toggle("is-disabled", noItems);
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
function validateAndStore(step) {
  if (step === 1) return validateAndStoreStep1();
  if (step === 2) return validateAndStoreStep2();
  if (step === 3) return validateAndStoreStep3();
  if (step === 4) return validateAndStoreStep4();
  if (step === 5) return validateAndStoreStep5();
  return true;
}

/* ======================================================================
   Step 1 — Location
====================================================================== */
function initStep1() {
  const sel = document.getElementById("workout-type-select");
  if (sel) {
    sel.innerHTML = `
      <option value="">--Select Location--</option>
      <option value="gym">Gym</option>
      <option value="home">Home</option>
    `;
    sel.value = wizard.location || "";
  }
}
function validateAndStoreStep1() {
  const hint = document.getElementById("s1-hint");
  const val = document.getElementById("workout-type-select").value;
  if (!val) { if (hint) hint.textContent = "Please select where you are training."; return false; }
  if (hint) hint.textContent = "";
  wizard.location = val; return true;
}

/* ======================================================================
   Step 2 — Timing + Date
====================================================================== */
function initStep2() {
  document.querySelectorAll('input[name="timing"]').forEach((r) => r.addEventListener("change", onTimingChange));
  const nowRadio = document.querySelector('input[name="timing"][value="now"]');
  if (nowRadio) nowRadio.checked = true;
  setDateToNow(true);
  wizard.timing = "now";
}
function onTimingChange(e) {
  wizard.timing = e.target.value;
  if (wizard.timing === "now") {
    setDateToNow(true);
  } else {
    const dt = document.getElementById("workout-datetime");
    dt.removeAttribute("disabled");
    const hint = document.getElementById("date-hint");
    if (hint) hint.textContent = "Pick the date/time for your past session.";
  }
}
function setDateToNow(write) {
  const dt = document.getElementById("workout-datetime");
  const now = nowIsoMinute(); if (write) dt.value = now;
  dt.setAttribute("disabled", "disabled");
  const hint = document.getElementById("date-hint"); if (hint) hint.textContent = "Date/time is locked to now.";
}
function validateAndStoreStep2() {
  const hint = document.getElementById("s2-hint");
  const dt = document.getElementById("workout-datetime").value;
  if (!wizard.timing) { if (hint) hint.textContent = "Select session timing."; return false; }
  if (wizard.timing === "past" && !dt) { if (hint) hint.textContent = "Choose a date/time for your past session."; return false; }
  wizard.datetime = wizard.timing === "now" ? nowIsoMinute() : dt;
  if (hint) hint.textContent = ""; return true;
}

/* ======================================================================
   Step 3 — Category (+ specific muscle)
====================================================================== */
function initStep3() {
  const workOn = document.getElementById("work-on-select");
  const cats = allCategories();
  workOn.innerHTML = `<option value="">--Select--</option>` + cats.map((c) => `<option value="${c}">${title(c)}</option>`).join('');
  workOn.value = wizard.category || "";

  const musclesSel = document.getElementById("muscle-select");
  const muscles = allMuscles();
  musclesSel.innerHTML = `<option value="">--Select--</option>` + muscles.map((m) => `<option value="${m}">${m}</option>`).join('');
  musclesSel.value = wizard.muscle || "";

  const muscleGroup = document.getElementById("muscle-select-group");
  muscleGroup.style.display = (wizard.category === "specific muscle") ? "block" : "none";

  workOn.addEventListener("change", () => {
    const cat = normalizeCategory(workOn.value);
    wizard.category = cat; wizard.equipment = ""; wizard.exercise = "";
    muscleGroup.style.display = (cat === "specific muscle") ? "block" : "none";
    if (cat !== "specific muscle") { wizard.muscle = ""; musclesSel.value = ""; }
  });
  musclesSel.addEventListener("change", () => wizard.muscle = musclesSel.value);
}
function validateAndStoreStep3() {
  const hint = document.getElementById("s3-hint");
  const raw = document.getElementById("work-on-select").value;
  if (!raw) { if (hint) hint.textContent = "Please select what you're training."; return false; }
  const cat = normalizeCategory(raw); wizard.category = cat;
  if (cat === "specific muscle") {
    const mus = document.getElementById("muscle-select").value;
    if (!mus) { if (hint) hint.textContent = "Please choose a specific muscle."; return false; }
    wizard.muscle = mus;
  }
  if (hint) hint.textContent = ""; return true;
}

/* ======================================================================
   Step 4 — Equipment
====================================================================== */
function initStep4() { /* populated on entry */ }

function populateEquipment() {
  const sel = document.getElementById("equipment-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);
  const EQUIPMENT = uniq(filtered.flatMap((e) => e.equipment)).sort((a,b)=>a.localeCompare(b));

  sel.innerHTML += EQUIPMENT.map((eq) => `<option value="${eq}">${title(eq)}</option>`).join("");
  if (EQUIPMENT.includes(wizard.equipment)) sel.value = wizard.equipment;

  const hint = document.getElementById("s4-hint");
  hint && (hint.textContent = EQUIPMENT.length ? "" : "No equipment matches that selection.");

  sel.onchange = () => { wizard.equipment = sel.value; populateExercises(); };
}

function validateAndStoreStep4() {
  const hint = document.getElementById("s4-hint");
  const val = document.getElementById("equipment-select").value;
  if (!val) { if (hint) hint.textContent = "Please select the machine/equipment."; return false; }
  wizard.equipment = val; if (hint) hint.textContent = ""; return true;
}

/* ======================================================================
   Step 5 — Exercise + sets (with insights + unilateral L/R grids)
====================================================================== */
function initStep5() {
  const setsInput = document.getElementById("sets-input");
  if (setsInput) {
    setsInput.value = wizard.sets;
    setsInput.addEventListener("change", () => {
      wizard.sets = Math.max(1, toInt(setsInput.value, 1));
      renderSetRows();
    });
  }
  renderSetRows();
}

function ensureInsightsNode() {
  let node = document.getElementById("exercise-insights");
  if (!node) {
    const grp = document.getElementById("exercise-select").closest(".form-group")
      || document.getElementById("exercise-select-group")
      || document.getElementById("exercise-select").parentElement;
    node = document.createElement("div");
    node.id = "exercise-insights";
    node.className = "hint";
    node.style.marginTop = "8px";
    grp.parentElement.insertBefore(node, grp.nextSibling);
  }
  return node;
}
function ensureMovementTypeControl() {
  let wrap = document.getElementById("movement-type-wrap");
  const insights = ensureInsightsNode();
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
    insights.parentElement.insertBefore(wrap, insights.nextSibling);

    const typeSel = wrap.querySelector("#movement-type-select");
    typeSel.addEventListener("change", () => {
      wizard.movementType = typeSel.value;
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
  const parts = [];
  if (last) {
    parts.push(`Last: <strong>${stripZeros(last.maxWeight ?? 0)} kg</strong>${last.reps != null ? ` × <strong>${stripZeros(last.reps)} reps</strong>` : ""} (${fmtDate(last.date)})`);
  } else {
    parts.push(`Last: <em>no history</em>`);
  }
  if (best) {
    parts.push(`Heaviest: <strong>${stripZeros(best.maxWeight ?? 0)} kg</strong>${best.reps != null ? ` × <strong>${stripZeros(best.reps)} reps</strong>` : ""}${best.date ? ` (${fmtDate(best.date)})` : ""}`);
  } else {
    parts.push(`Heaviest: <em>no history</em>`);
  }
  box.innerHTML = parts.join(" &nbsp;•&nbsp; ");
}

function populateExercises() {
  const select = document.getElementById("exercise-select");
  if (!select) return;
  select.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter((e) => wizard.equipment ? e.equipment.includes(wizard.equipment) : true);

  const names = uniq(filtered.map((e) => e.name)).sort((a,b)=>a.localeCompare(b));
  select.innerHTML += names.map((n) => `<option value="${n}">${n}</option>`).join('');
  if (names.includes(wizard.exercise)) select.value = wizard.exercise;

  showExerciseInsights(select.value || null);
  ensureMovementTypeControl();

  select.onchange = () => {
    wizard.exercise = select.value;
    showExerciseInsights(wizard.exercise);
    ensureMovementTypeControl();
    renderSetRows(); // refresh Prev markers
  };

  renderSetRows();
}

/* ---------- Display helpers for set lines ---------- */
function formatSetPairs(weights = [], reps = []) {
  const n = Math.max(weights.length, reps.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const w = Number.isFinite(weights[i]) ? stripZeros(weights[i]) : "—";
    const r = Number.isFinite(reps[i])    ? stripZeros(reps[i])    : "—";
    out.push(`Set ${i+1}: ${w}kg × ${r}`);
  }
  return out;
}
function joinPairs(pairs) {
  return pairs.length ? pairs.join(", ") : "—";
}

/* Render set inputs with Prev weight+reps labels */
function renderSetRows() {
  const setsInput = document.getElementById("sets-input");
  const n = Math.max(1, toInt(setsInput?.value ?? 1, 1));
  wizard.sets = n;

  // Ensure container exists
  let container = document.getElementById("sets-grids-wrapper");
  if (!container) {
    container = document.createElement("div");
    container.id = "sets-grids-wrapper";
    const anchor = document.getElementById("exercise-inputs");
    if (anchor) anchor.appendChild(container);
  }
  container.innerHTML = "";

  // Prev for labels
  const prev = computePrevPerSet(wizard.exercise, wizard.movementType, n);

  const fmtPrev = (w, r) => {
    const hasW = w !== "" && w != null && isFiniteNum(+w);
    const hasR = r !== "" && r != null && isFiniteNum(+r);
    if (hasW && hasR) return `Prev: ${stripZeros(+w)}kg × ${stripZeros(+r)}`;
    if (hasW) return `Prev: ${stripZeros(+w)}kg`;
    if (hasR) return `Prev: × ${stripZeros(+r)}`; // rare, but possible
    return "Prev: —";
  };

  if (wizard.movementType === "unilateral") {
    const left = document.createElement("div");
    left.className = "form-group";
    left.innerHTML = `<label>Left Side — Reps & Weight</label><div id="sets-grid-left" class="sets-grid"></div>`;
    container.appendChild(left);

    const right = document.createElement("div");
    right.className = "form-group";
    right.innerHTML = `<label>Right Side — Reps & Weight</label><div id="sets-grid-right" class="sets-grid"></div>`;
    container.appendChild(right);

    const gridL = left.querySelector("#sets-grid-left");
    const gridR = right.querySelector("#sets-grid-right");

    gridL.innerHTML = ""; gridR.innerHTML = "";
    for (let i = 1; i <= n; i++) {
      const rowL = document.createElement("div");
      rowL.className = "set-row";
      const wL = prev.prevWL?.[i-1] ?? "";
      const rL = prev.prevRL?.[i-1] ?? "";
      rowL.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (L)" data-side="L" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight" title="Previous for this set (left)">${fmtPrev(wL, rL)}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (L)" data-side="L" data-kind="weight" data-idx="${i - 1}">
      `;
      gridL.appendChild(rowL);

      const rowR = document.createElement("div");
      rowR.className = "set-row";
      const wR = prev.prevWR?.[i-1] ?? "";
      const rR = prev.prevRR?.[i-1] ?? "";
      rowR.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps (R)" data-side="R" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight" title="Previous for this set (right)">${fmtPrev(wR, rR)}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg) (R)" data-side="R" data-kind="weight" data-idx="${i - 1}">
      `;
      gridR.appendChild(rowR);
    }

    // Prefill from wizard if editing
    if (wizard.setRepsL.length === n && wizard.setWeightsL.length === n) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsL[i] ?? "");
    }
    if (wizard.setRepsR.length === n && wizard.setWeightsR.length === n) {
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsR[i] ?? "");
    }

  } else {
    const single = document.createElement("div");
    single.className = "form-group";
    single.innerHTML = `<label>Reps & Weight</label><div id="sets-grid" class="sets-grid"></div>`;
    container.appendChild(single);

    const grid = single.querySelector("#sets-grid");
    grid.innerHTML = "";
    for (let i = 1; i <= n; i++) {
      const row = document.createElement("div");
      row.className = "set-row";
      const w = prev.prevW?.[i-1] ?? "";
      const r = prev.prevR?.[i-1] ?? "";
      row.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i - 1}">
        <span class="prev-weight" title="Previous for this set">${fmtPrev(w, r)}</span>
        <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i - 1}">
      `;
      grid.appendChild(row);
    }
    // Prefill if available
    if (wizard.setReps.length === n && wizard.setWeights.length === n) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");
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
    const repsL = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsL  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="L"][data-kind="weight"]')].map(i => toFloat(i.value));
    const repsR = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="reps"]')].map(i => toInt(i.value));
    const wtsR  = [...document.querySelectorAll('#sets-grids-wrapper [data-side="R"][data-kind="weight"]')].map(i => toFloat(i.value));

    if (repsL.length !== n || wtsL.length !== n || repsR.length !== n || wtsR.length !== n ||
        repsL.some(v => v <= 0) || wtsL.some(v => v < 0) || repsR.some(v => v <= 0) || wtsR.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set on both Left and Right sides.";
      return false;
    }

    wizard.setRepsL = repsL; wizard.setWeightsL = wtsL;
    wizard.setRepsR = repsR; wizard.setWeightsR = wtsR;

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    const overallMax = Math.max(maxL, maxR);
    const countOverall = [...wtsL, ...wtsR].filter(w => w === overallMax).length;

    wizard.maxWeight = overallMax;
    wizard.maxWeightSetCount = countOverall;

    wizard.setReps = []; wizard.setWeights = [];

  } else {
    const reps = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="reps"]')].map(i => toInt(i.value));
    const wts  = [...document.querySelectorAll('#sets-grids-wrapper [data-kind="weight"]')].map(i => toFloat(i.value));

    if (reps.length !== n || wts.length !== n || reps.some(v => v <= 0) || wts.some(v => v < 0)) {
      if (hint) hint.textContent = "Fill reps & weight for every set.";
      return false;
    }

    wizard.setReps = reps; wizard.setWeights = wts;
    const maxW = Math.max(...wts);
    const maxCount = wts.filter(w => w === maxW).length;
    wizard.maxWeight = maxW; wizard.maxWeightSetCount = maxCount;

    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  if (hint) hint.textContent = "";
  return true;
}

/* ---- Current session list ---- */
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

  // Reset inline inputs for next add
  document.getElementById("exercise-select").value = "";
  document.getElementById("sets-input").value = "3";
  wizard.exercise = ""; wizard.sets = 3;
  wizard.movementType = "bilateral";
  wizard.setReps = []; wizard.setWeights = [];
  wizard.setRepsL = []; wizard.setWeightsL = [];
  wizard.setRepsR = []; wizard.setWeightsR = [];
  wizard.maxWeight = 0; wizard.maxWeightSetCount = 0;
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
      const leftPairs  = formatSetPairs(ex.setWeightsL, ex.setRepsL);
      const rightPairs = formatSetPairs(ex.setWeightsR, ex.setRepsR);

      const maxL = ex.setWeightsL.length ? Math.max(...ex.setWeightsL) : 0;
      const maxR = ex.setWeightsR.length ? Math.max(...ex.setWeightsR) : 0;
      const cL = ex.setWeightsL.filter(w => w === maxL).length;
      const cR = ex.setWeightsR.filter(w => w === maxR).length;

      details = `
        <div><em>Left:</em> ${joinPairs(leftPairs)}</div>
        <div><em>Right:</em> ${joinPairs(rightPairs)}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${cL} set(s) • Heaviest Right: ${stripZeros(maxR)}kg × ${cR} set(s)</div>
      `;
    } else {
      const pairs = formatSetPairs(ex.setWeights, ex.setReps);
      details = `
        <div>${ex.sets} sets → ${joinPairs(pairs)}</div>
        <div>Heaviest: ${stripZeros(ex.maxWeight)}kg × ${ex.maxWeightSetCount} set(s)</div>
      `;
    }

    const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}`:""} • ${title(ex.movementType)}`;
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

/* ======================================================================
   Step 6 — Review + Trend + Save
====================================================================== */
function buildSessionSummary() {
  const meta = document.getElementById("summary-meta");
  const exWrap = document.getElementById("summary-exercises");
  const totals = document.getElementById("summary-totals");

  meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${title(wizard.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${wizard.timing === "now" ? "Training now" : "Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocalString(wizard.datetime)}</span></div>
  `;

  exWrap.innerHTML = "";
  if (currentWorkoutExercises.length === 0) {
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added yet. Go back and add some.</em></div>`;
  } else {
    currentWorkoutExercises.forEach((ex) => {
      const trend = getTrendAgainstLast(ex.name, ex.maxWeight);
      let badge = "";
      if (trend.dir === "up")   badge = ` <span style="color:#4caf50;">▲ +${stripZeros(trend.delta)}kg</span>`;
      if (trend.dir === "down") badge = ` <span style="color:#ff5252;">▼ ${stripZeros(Math.abs(trend.delta))}kg</span>`;
      if (trend.dir === "same") badge = ` <span style="color:#ffb300;">= 0kg</span>`;
      if (trend.dir === "na")   badge = ` <span style="color:#9aa0a6;">— no history</span>`;

      const last = getLastHeaviestWithReps(ex.name);
      const best = getBestHeaviestWithReps(ex.name);
      const lastDelta = last ? ex.maxWeight - last.maxWeight : null;
      const bestDelta = best ? ex.maxWeight - best.maxWeight : null;

      let details = "";
      if (ex.movementType === "unilateral") {
        const L = ex.setWeightsL || [], R = ex.setWeightsR || [];
        const pairsL = formatSetPairs(L, ex.setRepsL);
        const pairsR = formatSetPairs(R, ex.setRepsR);
        const maxL = L.length ? Math.max(...L) : 0;
        const maxR = R.length ? Math.max(...R) : 0;
        const cL = L.filter(w => w === maxL).length;
        const cR = R.filter(w => w === maxR).length;

        details = `
          <div><em>Left:</em> ${joinPairs(pairsL)}</div>
          <div><em>Right:</em> ${joinPairs(pairsR)}</div>
          <div>Heaviest Left: <strong>${stripZeros(maxL)}kg</strong> (${cL} sets) • Heaviest Right: <strong>${stripZeros(maxR)}kg</strong> (${cR} sets)</div>
          <div>Overall Heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong>${badge}</div>
          <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
          <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
        `;
      } else {
        const pairs = formatSetPairs(ex.setWeights, ex.setReps);
        details = `
          <div>${ex.sets} sets → ${joinPairs(pairs)}</div>
          <div>Heaviest this session: <strong>${stripZeros(ex.maxWeight)}kg</strong>${badge}</div>
          <div>vs Last (${last ? fmtDate(last.date) : "—"}): <strong>${fmtDelta(lastDelta)}</strong></div>
          <div>vs Best (${best ? fmtDate(best.date) : "—"}): <strong>${fmtDelta(bestDelta)}</strong></div>
        `;
      }

      const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle ? ` • ${ex.muscle}` : ""} • ${title(ex.movementType)}`;
      const card = document.createElement("div");
      card.className = "summary-exercise";
      card.innerHTML = `
        <strong>${ex.name}</strong> <small>(${metaLine})</small><br>
        ${details}
      `;
      exWrap.appendChild(card);
    });
  }

  // Totals
  let totalVolume = 0, totalSets = 0, totalExercises = currentWorkoutExercises.length;
  currentWorkoutExercises.forEach((ex) => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets * 2;
      ex.setRepsL.forEach((r, i) => totalVolume += r * ex.setWeightsL[i]);
      ex.setRepsR.forEach((r, i) => totalVolume += r * ex.setWeightsR[i]);
    } else {
      totalSets += ex.sets;
      ex.setReps.forEach((r, i) => totalVolume += r * ex.setWeights[i]);
    }
  });
  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${totalExercises}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume) ? totalVolume.toFixed(1) : 0} kg·reps</div>
  `;
}

function saveSession() {
  const dt = wizard.datetime;
  if (!dt) { alert("Missing session date/time — go back to Step 2."); return; }
  if (currentWorkoutExercises.length === 0) { alert("Add at least one exercise before saving."); return; }

  currentWorkoutExercises.forEach((ex) => {
    if (!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    userWorkoutData[ex.name].records.push({
      id: ex.id, date: dt,
      category: ex.category, equipment: ex.equipment, muscle: ex.muscle,
      movementType: ex.movementType,
      setReps: ex.setReps, setWeights: ex.setWeights,
      setRepsL: ex.setRepsL, setWeightsL: ex.setWeightsL,
      setRepsR: ex.setRepsR, setWeightsR: ex.setWeightsR,
      sets: ex.sets,
      maxWeight: ex.maxWeight, maxWeightSetCount: ex.maxWeightSetCount
    });
    if (isFiniteNum(ex.maxWeight) && ex.maxWeight > (userWorkoutData[ex.name].bestWeight || 0)) {
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  currentWorkoutExercises = []; renderCurrentWorkoutList();

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

  // Reset UI
  const typeSel = document.getElementById("workout-type-select"); if (typeSel) typeSel.value = "";
  const nowRadio = document.querySelector('input[name="timing"][value="now"]'); if (nowRadio) nowRadio.checked = true;
  const dtInput = document.getElementById("workout-datetime"); if (dtInput) { dtInput.setAttribute("disabled", "disabled"); dtInput.value = wizard.datetime; }
  const workOn = document.getElementById("work-on-select"); if (workOn) workOn.value = "";
  const musSel = document.getElementById("muscle-select"); if (musSel) musSel.value = "";
  const musGrp = document.getElementById("muscle-select-group"); if (musGrp) musGrp.style.display = "none";
  const eqSel = document.getElementById("equipment-select"); if (eqSel) eqSel.innerHTML = `<option value="">--Select--</option>`;
  const exSel = document.getElementById("exercise-select"); if (exSel) exSel.innerHTML = `<option value="">--Select--</option>`;
  const setsInput2 = document.getElementById("sets-input"); if (setsInput2) setsInput2.value = "3";
  renderSetRows();

  goToStep(1);
}

/* ======================================================================
   History view + chart + edit/delete
====================================================================== */
function showHistoryView() {
  lastLoggerStep = currentStep || lastLoggerStep;
  pageScroll.logger = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-history").classList.add("active");

  populateHistoryDropdown();

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.history || 0;
  });
}
function showLoggerView() {
  pageScroll.history = document.scrollingElement.scrollTop;

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("workout-logger").classList.add("active");

  goToStep(lastLoggerStep);

  requestAnimationFrame(() => {
    document.scrollingElement.scrollTop = pageScroll.logger || 0;
  });

  updateReviewButtonState();
}

function populateHistoryDropdown() {
  const historySelect = document.getElementById("history-select");
  const recordedExercises = Object.keys(userWorkoutData).sort((a,b)=>a.localeCompare(b));
  historySelect.innerHTML =
    `<option value="">--Select an Exercise--</option>` +
    recordedExercises.map((ex) => `<option value="${ex}">${ex}</option>`).join("");
  document.getElementById("history-details").style.display = "none";
}

function displayExerciseHistory() {
  const selectedExercise = document.getElementById("history-select").value;
  const historyDetails = document.getElementById("history-details");
  const bestWeightTitle = document.getElementById("best-weight-title");
  const historyLog = document.getElementById("history-log");
  if (!selectedExercise) { historyDetails.style.display = "none"; return; }

  historyDetails.style.display = "block";
  const history = userWorkoutData[selectedExercise];

  bestWeightTitle.textContent = `Best Weight: ${stripZeros(history.bestWeight)}kg`;

  const sortedRecords = history.records.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const dates = sortedRecords.map((r) => new Date(r.date).toLocaleDateString());
  const maxWeights = sortedRecords.map((r) => r.maxWeight);

  if (myChart) myChart.destroy();
  const ctx = document.getElementById("history-chart").getContext("2d");
  myChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "Heaviest Lift (kg)",
        data: maxWeights,
        borderColor: "orange",
        backgroundColor: "rgba(255, 165, 0, 0.2)",
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Date", color: "white" }, ticks: { color: "white" } },
        y: { title: { display: true, text: "Weight (kg)", color: "white" }, ticks: { color: "white" } }
      },
      plugins: { legend: { labels: { color: "white" } } }
    }
  });

  historyLog.innerHTML = "";
  sortedRecords.forEach((rec) => {
    const dateString = new Date(rec.date).toLocaleString();

    let details = "";
    if (rec.movementType === "unilateral" && rec.setWeightsL && rec.setWeightsR) {
      const pairsL = formatSetPairs(rec.setWeightsL, rec.setRepsL);
      const pairsR = formatSetPairs(rec.setWeightsR, rec.setRepsR);
      const maxL = rec.setWeightsL.length ? Math.max(...rec.setWeightsL) : 0;
      const maxR = rec.setWeightsR.length ? Math.max(...rec.setWeightsR) : 0;
      const cL = rec.setWeightsL.filter(w => w === maxL).length;
      const cR = rec.setWeightsR.filter(w => w === maxR).length;
      details = `
        <div><em>Left:</em> ${joinPairs(pairsL)}</div>
        <div><em>Right:</em> ${joinPairs(pairsR)}</div>
        <div>Heaviest Left: ${stripZeros(maxL)}kg × ${cL} • Heaviest Right: ${stripZeros(maxR)}kg × ${cR}</div>
      `;
    } else {
      const pairs = formatSetPairs(rec.setWeights || [], rec.setReps || []);
      details = `
        <div>Sets: ${rec.sets} → ${joinPairs(pairs)}</div>
        <div>Heaviest: ${stripZeros(rec.maxWeight)}kg${rec.maxWeightSetCount ? ` × ${rec.maxWeightSetCount} set(s)` : ""}</div>
      `;
    }

    const meta = `${title(rec.category || "n/a")} • ${title(rec.equipment || "n/a")}${rec.muscle ? ` • ${rec.muscle}` : ""} • ${title(rec.movementType || "bilateral")}`;

    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        <strong>${selectedExercise}</strong> <small>(${meta})</small><br>
        Date: ${dateString}<br>
        ${details}
      </span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${selectedExercise}', '${rec.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${selectedExercise}', '${rec.id}')">Delete</button>
      </div>
    `;
    historyLog.appendChild(li);
  });
}

function deleteRecord(exerciseName, recordId) {
  if (!confirm("Are you sure you want to delete this record?")) return;
  const history = userWorkoutData[exerciseName];
  history.records = history.records.filter((r) => r.id !== recordId);
  if (history.records.length === 0) {
    delete userWorkoutData[exerciseName];
  } else {
    const newMax = Math.max(...history.records.map((r) => r.maxWeight));
    history.bestWeight = Number.isFinite(newMax) ? newMax : 0;
  }
  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();
  const historySelect = document.getElementById("history-select");
  if (historySelect && (exerciseName in userWorkoutData)) {
    historySelect.value = exerciseName;
    displayExerciseHistory();
  } else {
    document.getElementById("history-details").style.display = "none";
  }
}

function editRecord(exerciseName, recordId) {
  const history = userWorkoutData[exerciseName];
  const record = history.records.find((r) => r.id === recordId);
  if (!record) return;

  wizard.location = HOME_EQUIPMENT.includes(record.equipment) ? "home" : "gym";
  wizard.timing = "past";
  wizard.datetime = record.date;
  wizard.category = record.category || "";
  wizard.muscle = record.muscle || "";
  wizard.equipment = record.equipment || "";
  wizard.exercise = exerciseName;
  wizard.movementType = record.movementType || "bilateral";

  wizard.sets = record.sets || 3;

  if (wizard.movementType === "unilateral" && record.setWeightsL && record.setWeightsR) {
    wizard.setRepsL = (record.setRepsL || []).slice();
    wizard.setWeightsL = (record.setWeightsL || []).slice();
    wizard.setRepsR = (record.setRepsR || []).slice();
    wizard.setWeightsR = (record.setWeightsR || []).slice();
    wizard.setReps = []; wizard.setWeights = [];
  } else {
    wizard.setReps = (record.setReps || []).slice();
    wizard.setWeights = (record.setWeights || []).slice();
    wizard.setRepsL = []; wizard.setWeightsL = [];
    wizard.setRepsR = []; wizard.setWeightsR = [];
  }

  const { weights } = extractWeightsAndReps(record);
  const maxW = weights.length ? Math.max(...weights) : (record.maxWeight || 0);
  wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
  wizard.maxWeightSetCount = weights.filter(w => w === wizard.maxWeight).length || (record.maxWeightSetCount || 0);

  editingRecord = record;

  showLoggerView();

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

  // Render rows with existing values (Prev markers auto-render)
  renderSetRows();
  if (wizard.movementType === "unilateral") {
    const gridL = document.getElementById("sets-grid-left");
    const gridR = document.getElementById("sets-grid-right");
    if (gridL && gridR) {
      [...gridL.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsL[i] ?? "");
      [...gridL.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsL[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setRepsR[i] ?? "");
      [...gridR.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeightsR[i] ?? "");
    }
  } else {
    const grid = document.getElementById("sets-grid");
    if (grid) {
      [...grid.querySelectorAll('[data-kind="reps"]')].forEach((el, i) => el.value = wizard.setReps[i] ?? "");
      [...grid.querySelectorAll('[data-kind="weight"]')].forEach((el, i) => el.value = wizard.setWeights[i] ?? "");
    }
  }

  currentWorkoutExercises = [{
    id: record.id, date: wizard.datetime, name: wizard.exercise, category: wizard.category,
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
  const editMsg = document.getElementById("edit-mode-message"); if (editMsg) editMsg.style.display = "block";
}

/* ======================================================================
   Debug helpers
====================================================================== */
window._wipeAllWorkoutData = function () {
  if (confirm("Delete ALL saved workout history? This cannot be undone.")) {
    userWorkoutData = {}; localStorage.removeItem("userWorkoutData");
    currentWorkoutExercises = []; renderCurrentWorkoutList(); populateHistoryDropdown();
    alert("All saved workout history cleared.");
  }
};
window.showHistoryView = showHistoryView;
window.showLoggerView = showLoggerView;
window.addExerciseToWorkout = addExerciseToWorkout;
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
