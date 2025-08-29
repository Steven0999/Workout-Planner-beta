/* ============================================================
   wizard.js
   - Stepper logic (Steps 1..6)
   - Equipment & exercise filtering
   - Sets UI with previous per-set "weight × reps"
   - Add to session & review/save
   ============================================================ */

/* ------------- Data view from exercises.js ------------- */
const RAW = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const EXS = RAW.map(e => ({
  name: e.name,
  sections: Array.isArray(e.sections) ? e.sections.map(s => String(s).toLowerCase()) : [],
  equipment: Array.isArray(e.equipment) ? e.equipment.map(s => String(s).toLowerCase()) : [],
  muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
}));

/* ------------- Constants & helpers ------------- */
const HOME_EQUIPMENT = new Set(["body weight","resistance bands","kettlebell"]);
const DEFAULT_CATEGORIES = [
  "upper body","lower body","full body","push","pull","hinge","squat","core","specific muscle"
];

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const setHTML = (el, html) => { if (el) el.innerHTML = html; };
const title = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const uniq = (a) => [...new Set(a)];
const toInt = (v, f=0) => Number.isFinite(parseInt(v,10)) ? parseInt(v,10) : f;
const toFloat = (v, f=0) => Number.isFinite(parseFloat(v)) ? parseFloat(v) : f;
const fmt = (n) => Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : "0";
const nowIso = () => new Date().toISOString().slice(0,16);

/* ------------- Wizard scratch ------------- */
const W = {
  location: "",
  timing: "now",
  datetime: nowIso(),

  category: "",
  muscle: "",
  equipment: "",
  exercise: "",

  movementType: "bilateral", // bilateral | unilateral
  sets: 3,

  // Bilateral
  setReps: [],        // number[]
  setWeights: [],     // number[]

  // Unilateral
  setRepsL: [], setWeightsL: [],
  setRepsR: [], setWeightsR: [],

  maxWeight: 0,
  maxWeightSetCount: 0
};

/* ============================================================
   CATEGORY & MUSCLE
   ============================================================ */
function listCategories() {
  // Any section that matches our known buckets
  const fromData = uniq(
    EXS.flatMap(e => e.sections.filter(s => DEFAULT_CATEGORIES.includes(s)))
  ).sort((a,b)=>a.localeCompare(b));
  return fromData.length ? fromData : DEFAULT_CATEGORIES;
}

function listMuscles() {
  return uniq(EXS.flatMap(e => e.muscles)).sort((a,b)=>a.localeCompare(b));
}

/* ============================================================
   FILTERING HELPERS
   ============================================================ */
function byLocation(items, loc) {
  if (loc === "home") {
    return items.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.has(eq)));
  }
  return items;
}

function byCategoryAndMuscle(items, category, muscle) {
  if (!category) return [];
  const cat = category.toLowerCase();
  if (cat === "specific muscle") {
    if (!muscle) return [];
    return items.filter(e => e.sections.includes("specific muscle") && (e.muscles || []).includes(muscle));
  }
  return items.filter(e => e.sections.includes(cat));
}

/* ============================================================
   PREVIOUS-PER-SET LOOKUPS
   (last session weights & reps per set)
   ============================================================ */
function _lastRecordDesc(name) {
  const recs = (window.userWorkoutData?.[name]?.records || []).slice();
  recs.sort((a,b)=> new Date(b.date)-new Date(a.date));
  return recs[0] || null;
}

/** returns:
 * bilateral → { prevW: number[], prevR: number[] }
 * unilateral → { prevWL: number[], prevWR: number[], prevRL: number[], prevRR: number[] }
 * (missing slots are empty string "" to keep UI clean)
 */
function prevPerSet(exName, movementType, setsCount) {
  const blank = (n) => Array(n).fill("");
  const last = _lastRecordDesc(exName);
  if (!last) {
    if (movementType === "unilateral") {
      return { prevWL: blank(setsCount), prevWR: blank(setsCount), prevRL: blank(setsCount), prevRR: blank(setsCount) };
    }
    return { prevW: blank(setsCount), prevR: blank(setsCount) };
  }

  // Prefer arrays on the record; gracefully fallback
  if (movementType === "unilateral") {
    const WL = Array.isArray(last.setWeightsL) ? last.setWeightsL.slice(0, setsCount) : [];
    const WR = Array.isArray(last.setWeightsR) ? last.setWeightsR.slice(0, setsCount) : [];
    const RL = Array.isArray(last.setRepsL)    ? last.setRepsL.slice(0, setsCount) : (Array.isArray(last.setReps) ? last.setReps.slice(0, setsCount) : []);
    const RR = Array.isArray(last.setRepsR)    ? last.setRepsR.slice(0, setsCount) : (Array.isArray(last.setReps) ? last.setReps.slice(0, setsCount) : []);

    // If last session was bilateral, mirror to both sides
    const Wbil = Array.isArray(last.setWeights) ? last.setWeights.slice(0, setsCount) : [];
    const Rbil = Array.isArray(last.setReps)    ? last.setReps.slice(0, setsCount) : [];

    const pad = (a) => {
      const out = blank(setsCount);
      for (let i=0;i<setsCount;i++) if (a[i] != null) out[i] = a[i];
      return out;
    };

    const prevWL = pad(WL.length ? WL : Wbil);
    const prevWR = pad(WR.length ? WR : Wbil);
    const prevRL = pad(RL.length ? RL : Rbil);
    const prevRR = pad(RR.length ? RR : Rbil);

    return { prevWL, prevWR, prevRL, prevRR };
  }

  // bilateral
  const Wb = Array.isArray(last.setWeights) ? last.setWeights.slice(0, setsCount) : [];
  const Rb = Array.isArray(last.setReps)    ? last.setReps.slice(0, setsCount) : [];

  // If last was unilateral: take max of L/R for weight; reps prefer L then R
  const WL = Array.isArray(last.setWeightsL) ? last.setWeightsL.slice(0, setsCount) : [];
  const WR = Array.isArray(last.setWeightsR) ? last.setWeightsR.slice(0, setsCount) : [];
  const RL = Array.isArray(last.setRepsL)    ? last.setRepsL.slice(0, setsCount) : [];
  const RR = Array.isArray(last.setRepsR)    ? last.setRepsR.slice(0, setsCount) : [];

  const prevW = Array(setsCount).fill("");
  const prevR = Array(setsCount).fill("");

  for (let i=0;i<setsCount;i++) {
    if (Wb[i] != null) prevW[i] = Wb[i];
    else if (WL[i] != null || WR[i] != null) prevW[i] = Math.max(WL[i] ?? -Infinity, WR[i] ?? -Infinity);

    if (Rb[i] != null) prevR[i] = Rb[i];
    else if (RL[i] != null) prevR[i] = RL[i];
    else if (RR[i] != null) prevR[i] = RR[i];
  }
  return { prevW, prevR };
}

/* ============================================================
   STEP 1 — Location
   ============================================================ */
function initStep1() {
  const typeSel = $("#workout-type-select");
  if (!typeSel) return;
  // preserve value if user came back
  if (W.location) typeSel.value = W.location;
  typeSel.addEventListener("change", () => {
    W.location = typeSel.value;
  });
}
function validateStep1() {
  const hint = $("#s1-hint");
  if (!W.location) { hint.textContent = "Please select where you are training."; return false; }
  hint.textContent = ""; return true;
}

/* ============================================================
   STEP 2 — Timing + Date
   ============================================================ */
function initStep2() {
  const radios = $$('input[name="timing"]');
  const dt = $("#workout-datetime");
  if (!radios.length || !dt) return;

  // default to "now"
  if (!W.timing) W.timing = "now";
  if (!W.datetime) W.datetime = nowIso();

  radios.forEach(r => {
    r.checked = (r.value === W.timing);
    r.addEventListener("change", () => {
      W.timing = r.value;
      if (W.timing === "now") {
        dt.value = nowIso();
        dt.setAttribute("disabled", "disabled");
      } else {
        dt.removeAttribute("disabled");
      }
    });
  });

  if (W.timing === "now") {
    dt.value = nowIso();
    dt.setAttribute("disabled", "disabled");
  } else {
    dt.removeAttribute("disabled");
    dt.value = W.datetime || nowIso();
  }
}
function validateStep2() {
  const hint = $("#s2-hint");
  const dt = $("#workout-datetime");
  if (!W.timing) { hint.textContent = "Select session timing."; return false; }
  if (W.timing === "past" && !dt.value) { hint.textContent = "Provide a date & time."; return false; }
  W.datetime = (W.timing === "now") ? nowIso() : dt.value;
  hint.textContent = "";
  return true;
}

/* ============================================================
   STEP 3 — What (category + optional muscle)
   ============================================================ */
function initStep3() {
  const catSel = $("#work-on-select");
  const musGroup = $("#muscle-select-group");
  const musSel = $("#muscle-select");

  if (!catSel || !musSel) return;

  // categories
  const cats = listCategories();
  setHTML(catSel, `<option value="">--Select--</option>${cats.map(c=>`<option value="${c}">${title(c)}</option>`).join("")}`);
  if (W.category) catSel.value = W.category;

  // muscles
  const muscles = listMuscles();
  setHTML(musSel, `<option value="">--Select--</option>${muscles.map(m=>`<option value="${m}">${m}</option>`).join("")}`);
  if (W.muscle) musSel.value = W.muscle;

  // show/hide muscle picker
  musGroup.style.display = (catSel.value === "specific muscle") ? "block" : "none";

  catSel.addEventListener("change", () => {
    W.category = catSel.value;
    musGroup.style.display = (W.category === "specific muscle") ? "block" : "none";
    if (W.category !== "specific muscle") { W.muscle = ""; musSel.value = ""; }
    // Reset downstream
    setHTML($("#equipment-select"), `<option value="">--Select--</option>`);
    setHTML($("#exercise-select"), `<option value="">--Select--</option>`);
  });

  musSel.addEventListener("change", () => {
    W.muscle = musSel.value;
    // Reset downstream
    setHTML($("#equipment-select"), `<option value="">--Select--</option>`);
    setHTML($("#exercise-select"), `<option value="">--Select--</option>`);
  });
}
function validateStep3() {
  const hint = $("#s3-hint");
  if (!W.category) { hint.textContent = "Select what you’re training."; return false; }
  if (W.category === "specific muscle" && !W.muscle) {
    hint.textContent = "Please select a specific muscle.";
    return false;
  }
  hint.textContent = "";
  return true;
}

/* ============================================================
   STEP 4 — Equipment
   ============================================================ */
function initStep4() {
  // populated on entry via populateEquipment()
}
function populateEquipment() {
  const sel = $("#equipment-select");
  if (!sel) return;

  const base = byLocation(EXS, W.location);
  const filtered = byCategoryAndMuscle(base, W.category, W.muscle);
  const eqs = uniq(filtered.flatMap(e => e.equipment)).sort((a,b)=>a.localeCompare(b));

  setHTML(sel, `<option value="">--Select--</option>${eqs.map(eq=>`<option value="${eq}">${title(eq)}</option>`).join("")}`);
  if (W.equipment && eqs.includes(W.equipment)) sel.value = W.equipment;

  sel.onchange = () => {
    W.equipment = sel.value;
    populateExercises();
  };
}
function validateStep4() {
  const hint = $("#s4-hint");
  if (!W.equipment) { hint.textContent = "Select equipment."; return false; }
  hint.textContent = "";
  return true;
}

/* ============================================================
   STEP 5 — Exercise + Sets (+ previous per-set)
   ============================================================ */
function initStep5() {
  const setInput = $("#sets-input");
  const moveSel  = $("#movement-type-select");
  const search   = $("#exercise-search");

  if (setInput) {
    setInput.value = W.sets;
    setInput.addEventListener("change", () => {
      W.sets = Math.max(1, toInt(setInput.value, 1));
      renderSetsUI();
    });
  }
  if (moveSel) {
    moveSel.value = W.movementType;
    moveSel.addEventListener("change", () => {
      W.movementType = moveSel.value;
      renderSetsUI();
    });
  }
  if (search) {
    search.value = "";
    search.oninput = () => populateExercises(search.value.trim().toLowerCase());
  }

  populateExercises();
  renderSetsUI();

  // Buttons
  $("#add-exercise-btn")?.addEventListener("click", addExerciseToSession);
  $("#prev-btn")?.addEventListener("click", prevStep);
  $("#next-btn")?.addEventListener("click", nextStep);
}

function populateExercises(query="") {
  const sel = $("#exercise-select");
  if (!sel) return;

  const base = byLocation(EXS, W.location);
  const pool = byCategoryAndMuscle(base, W.category, W.muscle).filter(e => e.equipment.includes(W.equipment));

  let names = uniq(pool.map(e => e.name)).sort((a,b)=>a.localeCompare(b));
  if (query) {
    const q = query.toLowerCase();
    names = names.filter(n => n.toLowerCase().includes(q));
  }

  setHTML(sel, `<option value="">--Select--</option>${names.map(n=>`<option value="${n}">${n}</option>`).join("")}`);
  if (W.exercise && names.includes(W.exercise)) sel.value = W.exercise;

  // Insights (last & best)
  const insights = $("#exercise-insights");
  function refreshInsights() {
    const ex = sel.value;
    if (!ex) { setHTML(insights, ""); return; }

    // last
    const last = _lastRecordDesc(ex);
    let lastText = "Last: <em>no history</em>";
    if (last) {
      // heaviest in that session (across both sides if unilateral)
      let weights = [];
      if (Array.isArray(last.setWeights)) weights = last.setWeights.slice();
      else {
        if (Array.isArray(last.setWeightsL)) weights = weights.concat(last.setWeightsL);
        if (Array.isArray(last.setWeightsR)) weights = weights.concat(last.setWeightsR);
      }
      const maxW = weights.length ? Math.max(...weights) : (last.maxWeight ?? 0);
      // reps at max (best effort)
      let repsAtMax = null;
      if (weights.length && Array.isArray(last.setReps)) {
        const idx = weights.findIndex(w => w === maxW);
        repsAtMax = idx >= 0 ? (last.setReps[idx] ?? null) : null;
      } else if (Array.isArray(last.setRepsL) || Array.isArray(last.setRepsR)) {
        const wAll = [].concat(last.setWeightsL || [], last.setWeightsR || []);
        const rAll = [].concat(last.setRepsL || [],    last.setRepsR || []);
        const idx = wAll.findIndex(w => w === maxW);
        repsAtMax = idx >= 0 ? (rAll[idx] ?? null) : null;
      }
      lastText = `Last: <strong>${fmt(maxW)}kg</strong>${repsAtMax!=null?` × <strong>${fmt(repsAtMax)}</strong>`:""} (${new Date(last.date).toLocaleDateString()})`;
    }

    // best
    let bestBlock = "Heaviest: <em>no history</em>";
    const bestW = window.userWorkoutData?.[ex]?.bestWeight;
    if (Number.isFinite(bestW)) {
      // find date & reps of best
      const recs = (window.userWorkoutData[ex].records || []).slice().sort((a,b)=> new Date(a.date)-new Date(b.date));
      let found = null;
      for (const r of recs) {
        let weights = [];
        if (Array.isArray(r.setWeights)) weights = r.setWeights;
        else weights = [].concat(r.setWeightsL || [], r.setWeightsR || []);
        const idx = weights.findIndex(w => w === bestW);
        if (idx >= 0) {
          let reps = null;
          if (Array.isArray(r.setReps)) reps = r.setReps[idx] ?? null;
          else {
            const rAll = [].concat(r.setRepsL || [], r.setRepsR || []);
            reps = rAll[idx] ?? null;
          }
          found = { date: r.date, reps };
          break;
        }
      }
      bestBlock = `Heaviest: <strong>${fmt(bestW)}kg</strong>${found && found.reps!=null ? ` × <strong>${fmt(found.reps)}</strong>`:""}${found?` (${new Date(found.date).toLocaleDateString()})`:""}`;
    }

    setHTML(insights, `${lastText} &nbsp;•&nbsp; ${bestBlock}`);
  }

  sel.onchange = () => {
    W.exercise = sel.value;
    refreshInsights();
    renderSetsUI();
  };

  refreshInsights();
}

/* Build the sets area with per-set previous markers */
function renderSetsUI() {
  const area = $("#sets-area");
  if (!area) return;

  const n = Math.max(1, toInt($("#sets-input")?.value, 1));
  W.sets = n;

  if (!W.exercise) {
    setHTML(area, `<div class="hint">Choose an exercise to enter sets.</div>`);
    return;
  }

  // Compute per-set previous
  const prev = prevPerSet(W.exercise, W.movementType, n);

  // Render
  if (W.movementType === "unilateral") {
    const rows = [];
    rows.push(`<div class="form-group"><label>Left Side — Reps & Weight</label><div class="sets-grid" id="sets-grid-left">`);
    for (let i=0;i<n;i++) {
      const prevW = prev.prevWL?.[i] !== "" ? `${fmt(prev.prevWL[i])}kg` : "—";
      const prevR = prev.prevRL?.[i] !== "" ? `${fmt(prev.prevRL[i])}`   : "—";
      rows.push(`
        <div class="set-row">
          <input type="number" min="1" step="1"   class="rep-input"        data-side="L" data-idx="${i}" placeholder="Set ${i+1}: Reps (L)"/>
          <span class="prev-weight">Prev: ${prevW} × ${prevR}</span>
          <input type="number" min="0" step="0.5" class="weight-input"     data-side="L" data-idx="${i}" placeholder="Set ${i+1}: Weight (kg) (L)"/>
        </div>
      `);
    }
    rows.push(`</div></div>`);

    rows.push(`<div class="form-group"><label>Right Side — Reps & Weight</label><div class="sets-grid" id="sets-grid-right">`);
    for (let i=0;i<n;i++) {
      const prevW = prev.prevWR?.[i] !== "" ? `${fmt(prev.prevWR[i])}kg` : "—";
      const prevR = prev.prevRR?.[i] !== "" ? `${fmt(prev.prevRR[i])}`   : "—";
      rows.push(`
        <div class="set-row">
          <input type="number" min="1" step="1"   class="rep-input"        data-side="R" data-idx="${i}" placeholder="Set ${i+1}: Reps (R)"/>
          <span class="prev-weight">Prev: ${prevW} × ${prevR}</span>
          <input type="number" min="0" step="0.5" class="weight-input"     data-side="R" data-idx="${i}" placeholder="Set ${i+1}: Weight (kg) (R)"/>
        </div>
      `);
    }
    rows.push(`</div></div>`);

    setHTML(area, rows.join(""));

    // Prefill if returning
    const gridL = $("#sets-grid-left");
    const gridR = $("#sets-grid-right");
    if (gridL && W.setRepsL.length === n && W.setWeightsL.length === n) {
      $$(".rep-input[data-side='L']", gridL).forEach((el,i)=> el.value = W.setRepsL[i] ?? "");
      $$(".weight-input[data-side='L']", gridL).forEach((el,i)=> el.value = W.setWeightsL[i] ?? "");
    }
    if (gridR && W.setRepsR.length === n && W.setWeightsR.length === n) {
      $$(".rep-input[data-side='R']", gridR).forEach((el,i)=> el.value = W.setRepsR[i] ?? "");
      $$(".weight-input[data-side='R']", gridR).forEach((el,i)=> el.value = W.setWeightsR[i] ?? "");
    }

  } else {
    const rows = [];
    rows.push(`<div class="form-group"><label>Reps & Weight</label><div class="sets-grid" id="sets-grid">`);
    for (let i=0;i<n;i++) {
      const pW = prev.prevW?.[i] !== "" ? `${fmt(prev.prevW[i])}kg` : "—";
      const pR = prev.prevR?.[i] !== "" ? `${fmt(prev.prevR[i])}`   : "—";
      rows.push(`
        <div class="set-row">
          <input type="number" min="1" step="1"   class="rep-input"    data-idx="${i}" placeholder="Set ${i+1}: Reps"/>
          <span class="prev-weight">Prev: ${pW} × ${pR}</span>
          <input type="number" min="0" step="0.5" class="weight-input" data-idx="${i}" placeholder="Set ${i+1}: Weight (kg)"/>
        </div>
      `);
    }
    rows.push(`</div></div>`);
    setHTML(area, rows.join(""));

    // Prefill if returning
    const grid = $("#sets-grid");
    if (grid && W.setReps.length === n && W.setWeights.length === n) {
      $$(".rep-input", grid).forEach((el,i)=> el.value = W.setReps[i] ?? "");
      $$(".weight-input", grid).forEach((el,i)=> el.value = W.setWeights[i] ?? "");
    }
  }
}

function validateStep5Capture() {
  const hint = $("#s5-hint");
  const n = Math.max(1, toInt($("#sets-input")?.value, 1));
  W.sets = n;

  if (!W.exercise) { hint.textContent = "Choose an exercise."; return false; }

  if (W.movementType === "unilateral") {
    const repsL = $$(".rep-input[data-side='L']").map(el=> toInt(el.value, 0));
    const wtsL  = $$(".weight-input[data-side='L']").map(el=> toFloat(el.value, 0));
    const repsR = $$(".rep-input[data-side='R']").map(el=> toInt(el.value, 0));
    const wtsR  = $$(".weight-input[data-side='R']").map(el=> toFloat(el.value, 0));

    if (repsL.length!==n || wtsL.length!==n || repsR.length!==n || wtsR.length!==n ||
        repsL.some(v=>v<=0) || repsR.some(v=>v<=0) || wtsL.some(v=>v<0) || wtsR.some(v=>v<0)) {
      hint.textContent = "Fill reps & weight for every set on both sides.";
      return false;
    }

    W.setRepsL = repsL; W.setWeightsL = wtsL;
    W.setRepsR = repsR; W.setWeightsR = wtsR;
    W.setReps = []; W.setWeights = [];

    const maxL = Math.max(...wtsL);
    const maxR = Math.max(...wtsR);
    W.maxWeight = Math.max(maxL, maxR);
    W.maxWeightSetCount = [...wtsL, ...wtsR].filter(x=>x===W.maxWeight).length;
  } else {
    const reps = $$(".rep-input").map(el=> toInt(el.value, 0));
    const wts  = $$(".weight-input").map(el=> toFloat(el.value, 0));

    if (reps.length!==n || wts.length!==n || reps.some(v=>v<=0) || wts.some(v=>v<0)) {
      hint.textContent = "Fill reps & weight for every set.";
      return false;
    }

    W.setReps = reps; W.setWeights = wts;
    W.setRepsL = []; W.setWeightsL = [];
    W.setRepsR = []; W.setWeightsR = [];

    W.maxWeight = Math.max(...wts);
    W.maxWeightSetCount = wts.filter(x=>x===W.maxWeight).length;
  }

  hint.textContent = "";
  return true;
}

function addExerciseToSession() {
  if (!validateStep5Capture()) return;

  const ex = {
    id: Date.now().toString(),
    date: W.datetime,
    name: W.exercise,
    category: W.category,
    equipment: W.equipment,
    muscle: W.category === "specific muscle" ? W.muscle : null,
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

  window.currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();
  updateReviewButtonState();

  // keep UI for further adds, just clear inputs
  if (W.movementType === "unilateral") {
    $$(".rep-input[data-side='L']").forEach(el=> el.value = "");
    $$(".weight-input[data-side='L']").forEach(el=> el.value = "");
    $$(".rep-input[data-side='R']").forEach(el=> el.value = "");
    $$(".weight-input[data-side='R']").forEach(el=> el.value = "");
  } else {
    $$(".rep-input").forEach(el=> el.value = "");
    $$(".weight-input").forEach(el=> el.value = "");
  }
}

function renderCurrentWorkoutList() {
  const wrap = $("#current-workout-list-container");
  const list = $("#current-workout-list");
  if (!wrap || !list) return;

  if (window.currentWorkoutExercises.length === 0) {
    wrap.style.display = "none";
    setHTML(list, "");
    return;
  }
  wrap.style.display = "block";
  setHTML(list, "");

  window.currentWorkoutExercises.forEach((ex, i) => {
    let body = "";
    if (ex.movementType === "unilateral") {
      const L = ex.setWeightsL || [];
      const R = ex.setWeightsR || [];
      const pairsL = L.map((w,idx)=> `${fmt(ex.setRepsL?.[idx]||0)}x${fmt(w)}kg`).join(", ");
      const pairsR = R.map((w,idx)=> `${fmt(ex.setRepsR?.[idx]||0)}x${fmt(w)}kg`).join(", ");
      const maxL = L.length ? Math.max(...L) : 0;
      const maxR = R.length ? Math.max(...R) : 0;
      const cL = L.filter(x=>x===maxL).length;
      const cR = R.filter(x=>x===maxR).length;
      body = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest L: ${fmt(maxL)}kg × ${cL} • Heaviest R: ${fmt(maxR)}kg × ${cR}</div>
      `;
    } else {
      const pairs = (ex.setWeights || []).map((w,idx)=> `${fmt(ex.setReps?.[idx]||0)}x${fmt(w)}kg`).join(", ");
      const c = (ex.setWeights || []).filter(x=>x===ex.maxWeight).length;
      body = `
        <div>${ex.sets} sets → ${pairs || "—"}</div>
        <div>Heaviest: ${fmt(ex.maxWeight)}kg × ${c}</div>
      `;
    }

    const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle?` • ${ex.muscle}`:""} • ${title(ex.movementType)}`;

    const row = document.createElement("div");
    row.className = "workout-item";
    row.innerHTML = `
      <strong>${ex.name}</strong> <small>(${meta})</small><br/>
      ${body}
      <button style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;"
              onclick="removeExerciseFromWorkout(${i})">Remove</button>
    `;
    list.appendChild(row);
  });
}
function removeExerciseFromWorkout(idx) {
  window.currentWorkoutExercises.splice(idx, 1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

/* ============================================================
   STEP 6 — Review & Save
   ============================================================ */
function buildSessionSummary() {
  const meta   = $("#summary-meta");
  const exWrap = $("#summary-exercises");
  const totals = $("#summary-totals");

  setHTML(meta, `
    <div class="summary-row"><strong>Location</strong><span>${title(W.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${W.timing === "now" ? "Training now" : "Recorded"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${new Date(W.datetime).toLocaleString()}</span></div>
  `);

  setHTML(exWrap, "");
  if (window.currentWorkoutExercises.length === 0) {
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added.</em></div>`;
  } else {
    window.currentWorkoutExercises.forEach(ex => {
      // trend vs last
      const last = _lastRecordDesc(ex.name);
      let lastDelta = null;
      if (last) lastDelta = +(ex.maxWeight - (last.maxWeight ?? 0)).toFixed(2);
      const badge = (lastDelta==null) ? ` <span style="color:#9aa0a6;">— no history</span>`
                 : (lastDelta>0) ? ` <span style="color:#4caf50;">▲ +${fmt(lastDelta)}kg</span>`
                 : (lastDelta<0) ? ` <span style="color:#ff5252;">▼ ${fmt(Math.abs(lastDelta))}kg</span>`
                                 : ` <span style="color:#ffb300;">= 0kg</span>`;

      let body = "";
      if (ex.movementType === "unilateral") {
        const L = ex.setWeightsL || [], R = ex.setWeightsR || [];
        const pairsL = L.map((w,i)=> `${fmt(ex.setRepsL?.[i]||0)}x${fmt(w)}kg`).join(", ");
        const pairsR = R.map((w,i)=> `${fmt(ex.setRepsR?.[i]||0)}x${fmt(w)}kg`).join(", ");
        const maxL = L.length ? Math.max(...L) : 0;
        const maxR = R.length ? Math.max(...R) : 0;
        const cL = L.filter(x=>x===maxL).length;
        const cR = R.filter(x=>x===maxR).length;

        body = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Overall Heaviest: <strong>${fmt(ex.maxWeight)}kg</strong>${badge}</div>
          <div>Heaviest L: ${fmt(maxL)}kg × ${cL} • Heaviest R: ${fmt(maxR)}kg × ${cR}</div>
        `;
      } else {
        const pairs = (ex.setWeights || []).map((w,i)=> `${fmt(ex.setReps?.[i]||0)}x${fmt(w)}kg`).join(", ");
        const c = (ex.setWeights || []).filter(x=>x===ex.maxWeight).length;
        body = `
          <div>${ex.sets} sets → ${pairs || "—"}</div>
          <div>Heaviest: <strong>${fmt(ex.maxWeight)}kg</strong>${badge} (${c} set${c!==1?"s":""})</div>
        `;
      }

      const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle?` • ${ex.muscle}`:""} • ${title(ex.movementType)}`;

      const card = document.createElement("div");
      card.className = "summary-exercise";
      card.innerHTML = `<strong>${ex.name}</strong> <small>(${metaLine})</small><br/>${body}`;
      exWrap.appendChild(card);
    });
  }

  // totals
  let totalSets=0, volume=0;
  window.currentWorkoutExercises.forEach(ex => {
    if (ex.movementType === "unilateral") {
      totalSets += ex.sets*2;
      ex.setWeightsL.forEach((w,i)=> volume += (ex.setRepsL?.[i] || 0) * w);
      ex.setWeightsR.forEach((w,i)=> volume += (ex.setRepsR?.[i] || 0) * w);
    } else {
      totalSets += ex.sets;
      ex.setWeights.forEach((w,i)=> volume += (ex.setReps?.[i] || 0) * w);
    }
  });
  setHTML(totals, `
    <div><strong>Total Exercises:</strong> ${window.currentWorkoutExercises.length}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${fmt(volume)} kg·reps</div>
  `);
}

function saveSession() {
  if (!W.datetime) { alert("Missing date/time (Step 2)."); return; }
  if (window.currentWorkoutExercises.length === 0) { alert("Add at least one exercise first."); return; }

  window.currentWorkoutExercises.forEach(ex => {
    if (!window.userWorkoutData[ex.name]) window.userWorkoutData[ex.name] = { bestWeight: 0, records: [] };
    window.userWorkoutData[ex.name].records.push({
      id: ex.id,
      date: W.datetime,
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
    if (Number.isFinite(ex.maxWeight) && ex.maxWeight > (window.userWorkoutData[ex.name].bestWeight || 0)) {
      window.userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(window.userWorkoutData));
  alert("Workout session saved!");

  window.currentWorkoutExercises = [];
  renderCurrentWorkoutList();
  // back to step 1
  goToStep(1);
  updateReviewButtonState();
}

/* ============================================================
   NAVIGATION (steps)
   ============================================================ */
function goToStep(step) {
  window.currentStep = step;
  $$(".wizard-step").forEach((el, idx)=> el.style.display = (idx === step-1) ? "block" : "none");
  $$(".step-badge").forEach(b => b.classList.toggle("active", Number(b.dataset.step) === step));

  // Step-entry hooks
  if (step === 4) populateEquipment();
  if (step === 5) { populateExercises(); renderSetsUI(); }
  if (step === 6) buildSessionSummary();

  updateReviewButtonState();
}
function prevStep() {
  if (window.currentStep > 1) goToStep(window.currentStep - 1);
}
function nextStep() {
  if (window.currentStep === 1) { if (!validateStep1()) return; goToStep(2); return; }
  if (window.currentStep === 2) { if (!validateStep2()) return; goToStep(3); return; }
  if (window.currentStep === 3) { if (!validateStep3()) return; goToStep(4); return; }
  if (window.currentStep === 4) { if (!validateStep4()) return; goToStep(5); return; }
  if (window.currentStep === 5) {
    if (window.currentWorkoutExercises.length === 0) {
      $("#s5-hint").textContent = "Add at least one exercise before review.";
      return;
    }
    goToStep(6);
    return;
  }
  // Step 6 → Save
  saveSession();
}
function updateReviewButtonState() {
  const next = $("#next-btn");
  if (!next) return;
  if (window.currentStep === 5) {
    next.textContent = "Review";
    const disabled = window.currentWorkoutExercises.length === 0;
    next.disabled = disabled;
    next.classList.toggle("is-disabled", disabled);
  } else if (window.currentStep === 6) {
    next.textContent = "Save";
    next.disabled = false;
    next.classList.remove("is-disabled");
  } else {
    next.textContent = "Next";
    next.disabled = false;
    next.classList.remove("is-disabled");
  }
}

/* ============================================================
   HISTORY → EDIT RECORD (prefill wizard)
   ============================================================ */
function _editRecordFromHistory(exName, recordId) {
  const hist = window.userWorkoutData[exName];
  const rec = hist?.records.find(r => r.id === recordId);
  if (!rec) return;

  // Deduce location from equipment (rough)
  W.location = rec.equipment && HOME_EQUIPMENT.has(rec.equipment) ? "home" : "gym";
  W.timing = "past";
  W.datetime = rec.date;

  W.category = rec.category || "";
  W.muscle = rec.muscle || "";
  W.equipment = rec.equipment || "";
  W.exercise = exName;
  W.movementType = rec.movementType || "bilateral";
  W.sets = rec.sets || 3;

  W.setReps = rec.setReps?.slice() || [];
  W.setWeights = rec.setWeights?.slice() || [];
  W.setRepsL = rec.setRepsL?.slice() || [];
  W.setWeightsL = rec.setWeightsL?.slice() || [];
  W.setRepsR = rec.setRepsR?.slice() || [];
  W.setWeightsR = rec.setWeightsR?.slice() || [];
  W.maxWeight = rec.maxWeight || 0;
  W.maxWeightSetCount = rec.maxWeightSetCount || 0;

  // Switch to logger + steps
  $$(".page").forEach(p => p.classList.remove("active"));
  $("#workout-logger").classList.add("active");

  // Rebuild steps UI
  $("#workout-type-select").value = W.location;
  $$('input[name="timing"]').forEach(r => r.checked = (r.value === "past"));
  const dt = $("#workout-datetime"); dt.removeAttribute("disabled"); dt.value = W.datetime;

  initStep3(); // rebuild category/muscle lists & values
  $("#work-on-select").value = W.category;
  if (W.category === "specific muscle") { $("#muscle-select-group").style.display = "block"; $("#muscle-select").value = W.muscle; }

  populateEquipment();
  $("#equipment-select").value = W.equipment;

  populateExercises();
  $("#exercise-select").value = W.exercise;

  $("#movement-type-select").value = W.movementType;
  $("#sets-input").value = W.sets;

  renderSetsUI();

  // Put into session list for quick review/edit
  window.currentWorkoutExercises = [{
    id: rec.id,
    date: W.datetime,
    name: exName,
    category: W.category,
    equipment: W.equipment,
    muscle: W.muscle,
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
  }];
  renderCurrentWorkoutList();
  goToStep(5);
  updateReviewButtonState();
}
window._editRecordFromHistory = _editRecordFromHistory;

/* ============================================================
   Wire up page & default step
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  // Step init
  initStep1();
  initStep2();
  initStep3();
  initStep4();
  initStep5();
  goToStep(1);

  // Step 6 controls
  $("#prev-btn-6")?.addEventListener("click", prevStep);
  $("#save-session-btn")?.addEventListener("click", saveSession);
});

/* Expose a few for main.js buttons */
window.prevStep = prevStep;
window.nextStep = nextStep;
window.removeExerciseFromWorkout = removeExerciseFromWorkout;
