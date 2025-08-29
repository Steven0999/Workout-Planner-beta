/* ==========================================================
   WIZARD: Steps 1-6 logic, dropdown population, sets UI,
           per-set Prev markers (weight × reps), review & save
   Expects a global `window.EXERCISES` array from exercises.js
   ========================================================== */

(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* ---------- Data normalisation ---------- */
  const RAW = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];

  // whitelist of "sections" to show in Category dropdown
  const CATEGORY_WHITELIST = new Set([
    "upper body", "lower body", "legs", "push", "pull",
    "hinge", "squat", "full body", "core", "specific muscle"
  ]);

  // Home-eligible equipment list
  const HOME_EQUIPMENT = new Set(["body weight","resistance bands","kettlebell"]);

  // Normalized exercises
  const EXS = RAW.map(e => ({
    name: String(e.name),
    sections: (e.sections || []).map(s => String(s).toLowerCase().trim()),
    equipment: (e.equipment || []).map(eq => String(eq).toLowerCase().trim()),
    muscles: Array.isArray(e.muscles) ? e.muscles.slice() : []
  }));

  function normalizeCategory(c) {
    if (!c) return "";
    const x = String(c).toLowerCase();
    if (x === "upper") return "upper body";
    if (x === "lower" || x === "legs") return "lower body";
    return x;
  }

  function uniq(arr) { return [...new Set(arr)]; }
  function title(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }
  function nowIsoMinute(){ return new Date().toISOString().slice(0,16); }
  function isoLocal(iso){ try { return new Date(iso).toLocaleString(); } catch { return iso; } }
  function toInt(v, f=0){ const n = parseInt(v,10); return Number.isFinite(n) ? n : f; }
  function toFloat(v, f=0){ const n = parseFloat(v); return Number.isFinite(n) ? n : f; }

  /* ---------- App state ---------- */
  let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData") || "{}") || {};
  let currentSessionItems = [];

  const state = {
    step: 1,
    location: "",
    timing: "now",
    datetime: nowIsoMinute(),

    category: "",
    muscle: "",
    equipment: "",
    exercise: "",

    movementType: "bilateral",  // bilateral | unilateral
    sets: 3
  };

  /* ---------- Step helpers ---------- */
  function categoriesFromExercises() {
    const cats = new Set();
    EXS.forEach(e => e.sections.forEach(s => {
      if (CATEGORY_WHITELIST.has(s)) cats.add(s);
    }));
    // stable order
    const pref = ["upper body","lower body","push","pull","hinge","squat","full body","core","specific muscle"];
    const rest = [...cats].filter(c => !pref.includes(c)).sort();
    return [...pref.filter(c => cats.has(c)), ...rest];
  }
  function allMuscles() {
    return uniq(EXS.flatMap(e => e.muscles)).sort((a,b)=>a.localeCompare(b));
  }
  function filterByLocation(items, loc) {
    if (loc !== "home") return items;
    return items.filter(e => e.equipment.some(eq => HOME_EQUIPMENT.has(eq)));
  }
  function filterByCategory(items, category, muscle) {
    const cat = normalizeCategory(category);
    if (!cat) return [];
    if (cat === "specific muscle") {
      if (!muscle) return [];
      return items.filter(e => e.sections.includes("specific muscle") && e.muscles?.includes(muscle));
    }
    return items.filter(e => e.sections.includes(cat));
  }

  /* ---------- Populate dropdowns ---------- */
  function populateStep1() {
    $("#workout-type-select").value = state.location || "";
  }

  function populateStep2() {
    const nowRadio  = document.querySelector('input[name="timing"][value="now"]');
    const pastRadio = document.querySelector('input[name="timing"][value="past"]');
    const dt        = $("#workout-datetime");

    if (state.timing === "now") {
      if (nowRadio) nowRadio.checked = true;
      dt.value = state.datetime;
      dt.setAttribute("disabled","disabled");
    } else {
      if (pastRadio) pastRadio.checked = true;
      dt.value = state.datetime || nowIsoMinute();
      dt.removeAttribute("disabled");
    }
  }

  function populateStep3() {
    const catSel = $("#work-on-select");
    const musSel = $("#muscle-select");
    const musGroup = $("#muscle-select-group");

    // categories
    const cats = categoriesFromExercises();
    catSel.innerHTML = `<option value="">-- Select --</option>` + cats.map(c => `<option value="${c}">${title(c)}</option>`).join("");
    catSel.value = state.category || "";

    // muscles
    const muscles = allMuscles();
    musSel.innerHTML = `<option value="">-- Select --</option>` + muscles.map(m => `<option value="${m}">${m}</option>`).join("");
    musSel.value = state.muscle || "";

    musGroup.style.display = (state.category === "specific muscle") ? "grid" : "none";
  }

  function populateStep4() {
    const sel = $("#equipment-select");
    sel.innerHTML = `<option value="">-- Select --</option>`;

    const pool = filterByLocation(EXS, state.location);
    const filtered = filterByCategory(pool, state.category, state.muscle);
    const eqs = uniq(filtered.flatMap(e => e.equipment)).sort((a,b)=>a.localeCompare(b));

    sel.innerHTML += eqs.map(eq => `<option value="${eq}">${title(eq)}</option>`).join("");
    sel.value = state.equipment || "";
  }

  function populateStep5Exercises() {
    const search = $("#exercise-search");
    const sel    = $("#exercise-select");
    sel.innerHTML = `<option value="">-- Select --</option>`;

    const pool = filterByLocation(EXS, state.location);
    const filtered = filterByCategory(pool, state.category, state.muscle)
      .filter(e => state.equipment ? e.equipment.includes(state.equipment) : true);

    // Search filter
    const q = String(search?.value || "").trim().toLowerCase();
    let names = uniq(filtered.map(e => e.name)).sort((a,b)=>a.localeCompare(b));
    if (q) names = names.filter(n => n.toLowerCase().includes(q));

    sel.innerHTML += names.map(n => `<option value="${n}">${n}</option>`).join("");
    sel.value = state.exercise || "";

    updateExerciseInsights(sel.value || "");
  }

  /* ---------- Per-set previous markers ---------- */
  function getRecordsDesc(exName) {
    const r = userWorkoutData?.[exName]?.records || [];
    return r.slice().sort((a,b)=> new Date(b.date) - new Date(a.date));
    // record shape:
    // {
    //   id, date, category, equipment, muscle, movementType,
    //   sets,
    //   setReps:[] / setRepsL:[] / setRepsR:[],
    //   setWeights:[] / setWeightsL:[] / setWeightsR:[],
    //   maxWeight, maxWeightSetCount
    // }
  }

  function computePrevArrays(exName, movementType, setsCount) {
    const blankN = Array(setsCount).fill({w:"", r:""});
    if (!exName) return movementType === "unilateral"
      ? { left: blankN.map(x=>({...x})), right: blankN.map(x=>({...x})) }
      : { both: blankN.map(x=>({...x})) };

    const last = getRecordsDesc(exName)[0];
    if (!last) return movementType === "unilateral"
      ? { left: blankN.map(x=>({...x})), right: blankN.map(x=>({...x})) }
      : { both: blankN.map(x=>({...x})) };

    if (movementType === "unilateral") {
      const Lw = Array.isArray(last.setWeightsL) ? last.setWeightsL : (Array.isArray(last.setWeights) ? last.setWeights : []);
      const Rw = Array.isArray(last.setWeightsR) ? last.setWeightsR : (Array.isArray(last.setWeights) ? last.setWeights : []);
      const Lr = Array.isArray(last.setRepsL)    ? last.setRepsL    : (Array.isArray(last.setReps)    ? last.setReps    : []);
      const Rr = Array.isArray(last.setRepsR)    ? last.setRepsR    : (Array.isArray(last.setReps)    ? last.setReps    : []);
      const left  = Array.from({length:setsCount}, (_,i)=> ({ w: (Lw[i] ?? ""), r: (Lr[i] ?? "") }));
      const right = Array.from({length:setsCount}, (_,i)=> ({ w: (Rw[i] ?? ""), r: (Rr[i] ?? "") }));
      return { left, right };
    } else {
      const W = Array.isArray(last.setWeights) ? last.setWeights :
                (Array.isArray(last.setWeightsL) || Array.isArray(last.setWeightsR))
                  ? mergeSidesMax(last.setWeightsL || [], last.setWeightsR || [])
                  : [];
      const R = Array.isArray(last.setReps) ? last.setReps :
                (Array.isArray(last.setRepsL) || Array.isArray(last.setRepsR))
                  ? mergeSidesMax(last.setRepsL || [], last.setRepsR || [])
                  : [];
      const both = Array.from({length:setsCount}, (_,i)=> ({ w: (W[i] ?? ""), r: (R[i] ?? "") }));
      return { both };
    }
  }
  function mergeSidesMax(arrL, arrR) {
    const n = Math.max(arrL.length, arrR.length);
    const out = [];
    for (let i=0;i<n;i++){
      const l = arrL[i]; const r = arrR[i];
      out[i] = (l != null && r != null) ? Math.max(l, r) : (l ?? r ?? "");
    }
    return out;
  }

  /* ---------- UI: Step 5 sets renderer ---------- */
  function renderSetsArea() {
    const container = $("#sets-area");
    container.innerHTML = "";

    const n = Math.max(1, toInt($("#sets-input").value, 1));
    state.sets = n;

    const exName = state.exercise || "";
    const prev = computePrevArrays(exName, state.movementType, n);

    if (state.movementType === "unilateral") {
      // Left
      const leftBox = document.createElement("div");
      leftBox.className = "panel";
      leftBox.style.background = "#141414";
      leftBox.innerHTML = `<h3 style="margin-top:0">Left Side</h3><div class="sets-grid" id="sets-grid-left"></div>`;
      container.appendChild(leftBox);

      const gL = $("#sets-grid-left", leftBox);
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevStr = formatPrev(prev.left[i]);
        row.innerHTML = `
          <input class="rep-input" type="number" min="1" step="1" placeholder="Set ${i+1}: Reps (L)" data-side="L" data-idx="${i}">
          <div class="prev-cell">${prevStr}</div>
          <input class="weight-input" type="number" min="0" step="0.5" placeholder="Set ${i+1}: Weight (kg) (L)" data-side="L" data-idx="${i}">
        `;
        gL.appendChild(row);
      }

      // Right
      const rightBox = document.createElement("div");
      rightBox.className = "panel";
      rightBox.style.background = "#141414";
      rightBox.innerHTML = `<h3 style="margin-top:0">Right Side</h3><div class="sets-grid" id="sets-grid-right"></div>`;
      container.appendChild(rightBox);

      const gR = $("#sets-grid-right", rightBox);
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevStr = formatPrev(prev.right[i]);
        row.innerHTML = `
          <input class="rep-input" type="number" min="1" step="1" placeholder="Set ${i+1}: Reps (R)" data-side="R" data-idx="${i}">
          <div class="prev-cell">${prevStr}</div>
          <input class="weight-input" type="number" min="0" step="0.5" placeholder="Set ${i+1}: Weight (kg) (R)" data-side="R" data-idx="${i}">
        `;
        gR.appendChild(row);
      }
    } else {
      const box = document.createElement("div");
      box.className = "panel";
      box.style.background = "#141414";
      box.innerHTML = `<h3 style="margin-top:0">Reps & Weight</h3><div class="sets-grid" id="sets-grid"></div>`;
      container.appendChild(box);

      const g = $("#sets-grid", box);
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "set-row";
        const prevStr = formatPrev(prev.both[i]);
        row.innerHTML = `
          <input class="rep-input" type="number" min="1" step="1" placeholder="Set ${i+1}: Reps" data-idx="${i}">
          <div class="prev-cell">${prevStr}</div>
          <input class="weight-input" type="number" min="0" step="0.5" placeholder="Set ${i+1}: Weight (kg)" data-idx="${i}">
        `;
        g.appendChild(row);
      }
    }
  }
  function formatPrev(obj){ // {w, r}
    const w = obj?.w; const r = obj?.r;
    if (w === "" && r === "") return `<span class="muted">Prev: —</span>`;
    if (w !== "" && r !== "") return `Prev: <strong>${w}kg × ${r}</strong>`;
    if (w !== "") return `Prev: <strong>${w}kg</strong>`;
    return `Prev: <strong>${r}</strong>`;
  }

  function updateExerciseInsights(exName) {
    const box = $("#exercise-insights");
    if (!exName) { box.textContent = ""; return; }

    const recs = getRecordsDesc(exName);
    const last = recs[0];
    let lastStr = "no history";
    if (last) {
      const { weight, reps } = heaviestWithReps(last);
      lastStr = `${weight}kg${reps != null ? ` × ${reps}` : ""} (${new Date(last.date).toLocaleDateString()})`;
    }

    // best from userWorkoutData
    let best = null, bestDate = null, bestReps = null;
    const hist = userWorkoutData[exName];
    if (hist?.bestWeight != null) {
      best = hist.bestWeight;
      // find earliest record with best
      const asc = recs.slice().reverse();
      for (const r of asc) {
        const hw = heaviestWithReps(r);
        if (hw.weight === best) { bestDate = r.date; bestReps = hw.reps; break; }
      }
    }
    const bestStr = (best != null)
      ? `${best}kg${bestReps != null ? ` × ${bestReps}` : ""}${bestDate ? ` (${new Date(bestDate).toLocaleDateString()})` : ""}`
      : "no history";

    box.innerHTML = `Last: <strong>${lastStr}</strong> &nbsp;•&nbsp; Heaviest: <strong>${bestStr}</strong>`;
  }

  function heaviestWithReps(record) {
    // Pull arrays (bilateral or unilateral)
    let weights = [];
    let reps    = [];
    if (Array.isArray(record.setWeights)) {
      weights = record.setWeights;
      reps    = Array.isArray(record.setReps) ? record.setReps : new Array(weights.length).fill(null);
    } else if (Array.isArray(record.setWeightsL) || Array.isArray(record.setWeightsR)) {
      const Lw = record.setWeightsL || [];
      const Rw = record.setWeightsR || [];
      const Lr = record.setRepsL || new Array(Lw.length).fill(null);
      const Rr = record.setRepsR || new Array(Rw.length).fill(null);
      weights = [...Lw, ...Rw];
      reps    = [...Lr, ...Rr];
    }
    if (!weights.length) return { weight: record.maxWeight ?? 0, reps: null };
    const maxW = Math.max(...weights);
    const idx  = weights.findIndex(w => w === maxW);
    return { weight: maxW, reps: idx >= 0 ? reps[idx] ?? null : null };
  }

  /* ---------- Review & Save ---------- */
  function buildSummary() {
    // Meta
    $("#summary-meta").innerHTML = `
      <div class="row"><strong>Location</strong><div>${state.location ? title(state.location) : "—"}</div></div>
      <div class="row"><strong>When</strong><div>${state.timing === "now" ? "Training now" : "Recorded session"}</div></div>
      <div class="row"><strong>Date & Time</strong><div>${isoLocal(state.datetime)}</div></div>
    `;

    // Exercises cards
    const c = $("#summary-exercises");
    c.innerHTML = "";
    currentSessionItems.forEach(item => {
      const recs = getRecordsDesc(item.name);
      const last = recs[0];
      const best = userWorkoutData[item.name]?.bestWeight ?? null;

      const lastW = last ? heaviestWithReps(last).weight : null;
      const deltaLast = (lastW != null) ? (item.maxWeight - lastW) : null;
      const deltaBest = (best != null) ? (item.maxWeight - best) : null;

      const pairs = item.movementType === "unilateral"
        ? [
            `<em>Left</em>: ${item.setRepsL.map((r,i)=>`${r}x${item.setWeightsL[i]}kg`).join(", ")}`,
            `<em>Right</em>: ${item.setRepsR.map((r,i)=>`${r}x${item.setWeightsR[i]}kg`).join(", ")}`
          ].join("<br>")
        : item.setReps.map((r,i)=>`${r}x${item.setWeights[i]}kg`).join(", ");

      const card = document.createElement("div");
      card.className = "panel";
      card.innerHTML = `
        <strong>${item.name}</strong> <small>(${title(item.category)} • ${title(item.equipment)}${item.muscle ? ` • ${item.muscle}` : ""} • ${title(item.movementType)})</small>
        <div style="margin-top:8px;">${pairs || "—"}</div>
        <div style="margin-top:6px;">Heaviest this session: <strong>${item.maxWeight}kg</strong></div>
        <div class="muted" style="margin-top:4px;">
          vs Last: <strong>${formatDelta(deltaLast)}</strong>
          &nbsp;•&nbsp;
          vs Best: <strong>${formatDelta(deltaBest)}</strong>
        </div>
      `;
      c.appendChild(card);
    });

    // Totals
    let totalSets = 0, totalVolume = 0;
    currentSessionItems.forEach(it => {
      if (it.movementType === "unilateral") {
        totalSets += it.sets * 2;
        it.setRepsL.forEach((r,i)=> totalVolume += r * (it.setWeightsL[i] || 0));
        it.setRepsR.forEach((r,i)=> totalVolume += r * (it.setWeightsR[i] || 0));
      } else {
        totalSets += it.sets;
        it.setReps.forEach((r,i)=> totalVolume += r * (it.setWeights[i] || 0));
      }
    });
    $("#summary-totals").innerHTML = `
      <div class="row"><strong>Total Exercises</strong><div>${currentSessionItems.length}</div></div>
      <div class="row"><strong>Total Sets</strong><div>${totalSets}</div></div>
      <div class="row"><strong>Estimated Volume</strong><div>${totalVolume.toFixed(1)} kg·reps</div></div>
    `;
  }
  function formatDelta(d){
    if (d == null) return "—";
    if (d > 0) return `▲ +${d.toFixed(1)}kg`;
    if (d < 0) return `▼ ${Math.abs(d).toFixed(1)}kg`;
    return "= 0kg";
  }

  function saveSession() {
    if (!state.datetime) { alert("Missing session date/time."); return; }
    if (currentSessionItems.length === 0) { alert("Add at least one exercise."); return; }

    currentSessionItems.forEach(it => {
      if (!userWorkoutData[it.name]) userWorkoutData[it.name] = { bestWeight: 0, records: [] };
      userWorkoutData[it.name].records.push({
        id: it.id,
        date: state.datetime,
        category: it.category,
        equipment: it.equipment,
        muscle: it.muscle || null,
        movementType: it.movementType,
        sets: it.sets,
        setReps: it.setReps || [],
        setWeights: it.setWeights || [],
        setRepsL: it.setRepsL || [],
        setWeightsL: it.setWeightsL || [],
        setRepsR: it.setRepsR || [],
        setWeightsR: it.setWeightsR || [],
        maxWeight: it.maxWeight,
        maxWeightSetCount: it.maxWeightSetCount || 0
      });
      if (it.maxWeight > (userWorkoutData[it.name].bestWeight || 0)) {
        userWorkoutData[it.name].bestWeight = it.maxWeight;
      }
    });

    localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
    alert("Workout session saved!");

    // reset session list
    currentSessionItems = [];
    renderSessionList();

    // reset to step 1, keep defaults
    state.step = 1;
    state.category = "";
    state.muscle = "";
    state.equipment = "";
    state.exercise = "";
    state.movementType = "bilateral";
    state.sets = 3;
    state.timing = "now";
    state.datetime = nowIsoMinute();

    $("#workout-datetime").value = state.datetime;
    $("#workout-datetime").setAttribute("disabled","disabled");
    document.querySelector('input[name="timing"][value="now"]').checked = true;

    // re-populate
    populateStep1(); populateStep2(); populateStep3();
    $("#equipment-select").innerHTML = `<option value="">-- Select --</option>`;
    $("#exercise-select").innerHTML  = `<option value="">-- Select --</option>`;
    $("#sets-input").value = "3";
    $("#sets-area").innerHTML = "";
  }

  /* ---------- Session list UI ---------- */
  function renderSessionList() {
    const wrap = $("#current-workout-list-container");
    const list = $("#current-workout-list");
    if (!wrap || !list) return;
    list.innerHTML = "";

    if (currentSessionItems.length === 0) {
      wrap.style.display = "none";
      return;
    }
    wrap.style.display = "block";

    currentSessionItems.forEach((it, idx) => {
      const meta = `${title(it.category)} • ${title(it.equipment)}${it.muscle ? ` • ${it.muscle}` : ""} • ${title(it.movementType)}`;
      const pairs = it.movementType === "unilateral"
        ? [
            `<em>Left</em>: ${it.setRepsL.map((r,i)=>`${r}x${it.setWeightsL[i]}kg`).join(", ")}`,
            `<em>Right</em>: ${it.setRepsR.map((r,i)=>`${r}x${it.setWeightsR[i]}kg`).join(", ")}`
          ].join("<br>")
        : it.setReps.map((r,i)=>`${r}x${it.setWeights[i]}kg`).join(", ");

      const div = document.createElement("div");
      div.className = "workout-item";
      div.innerHTML = `
        <strong>${it.name}</strong> <small>(${meta})</small><br>
        ${pairs || "—"}<br>
        <span class="muted">Heaviest: ${it.maxWeight}kg</span>
        <button class="btn icon" style="float:right;" onclick="(_=>{window._wiz_removeItem(${idx})})()">Remove</button>
      `;
      list.appendChild(div);
    });
  }

  // expose removal
  window._wiz_removeItem = (i) => {
    currentSessionItems.splice(i,1);
    renderSessionList();
  };

  /* ---------- Step lifecycle ---------- */
  function onEnterStep(n) {
    state.step = n;
    if (n === 1) populateStep1();
    if (n === 2) populateStep2();
    if (n === 3) populateStep3();
    if (n === 4) populateStep4();
    if (n === 5) {
      populateStep5Exercises();
      renderSetsArea();
    }
    if (n === 6) buildSummary();
  }

  /* ---------- Validation per step ---------- */
  function validateStep(n) {
    if (n === 1) {
      const v = $("#workout-type-select").value;
      if (!v) { $("#s1-hint").textContent = "Please select where you are training."; return false; }
      $("#s1-hint").textContent = "";
      state.location = v;
      return true;
    }
    if (n === 2) {
      const choice = document.querySelector('input[name="timing"]:checked');
      if (!choice) { $("#s2-hint").textContent = "Select session timing."; return false; }
      state.timing = choice.value;
      if (state.timing === "now") {
        state.datetime = nowIsoMinute();
        $("#workout-datetime").value = state.datetime;
        $("#workout-datetime").setAttribute("disabled","disabled");
      } else {
        const dt = $("#workout-datetime").value;
        if (!dt) { $("#s2-hint").textContent = "Choose a date/time for your past session."; return false; }
        state.datetime = dt;
        $("#workout-datetime").removeAttribute("disabled");
      }
      $("#s2-hint").textContent = "";
      return true;
    }
    if (n === 3) {
      const cat = $("#work-on-select").value;
      if (!cat) { $("#s3-hint").textContent = "Please select what you're training."; return false; }
      state.category = normalizeCategory(cat);
      if (state.category === "specific muscle") {
        const mus = $("#muscle-select").value;
        if (!mus) { $("#s3-hint").textContent = "Please choose a specific muscle."; return false; }
        state.muscle = mus;
      } else {
        state.muscle = "";
      }
      $("#s3-hint").textContent = "";
      return true;
    }
    if (n === 4) {
      const eq = $("#equipment-select").value;
      if (!eq) { $("#s4-hint").textContent = "Please select the equipment."; return false; }
      $("#s4-hint").textContent = "";
      state.equipment = eq;
      return true;
    }
    if (n === 5) {
      // Must have exercise
      const ex = $("#exercise-select").value;
      if (!ex) { $("#s5-hint").textContent = "Please choose an exercise."; return false; }

      const reps = $$('#sets-area .rep-input');
      const wts  = $$('#sets-area .weight-input');
      if (reps.length === 0 || wts.length === 0) {
        $("#s5-hint").textContent = "Please enter reps & weight for each set.";
        renderSetsArea();
        return false;
      }

      // Collect inputs
      const movementType = $("#movement-type-select").value || "bilateral";
      const nSets = Math.max(1, toInt($("#sets-input").value, 1));

      let setReps = [], setWeights = [], setRepsL = [], setWeightsL = [], setRepsR = [], setWeightsR = [];
      if (movementType === "unilateral") {
        for (let i=0;i<nSets;i++){
          const rL = toInt($(`#sets-grid-left  [data-side="L"][data-idx="${i}"].rep-input`)?.value, 0);
          const wL = toFloat($(`#sets-grid-left [data-side="L"][data-idx="${i}"].weight-input`)?.value, 0);
          const rR = toInt($(`#sets-grid-right [data-side="R"][data-idx="${i}"].rep-input`)?.value, 0);
          const wR = toFloat($(`#sets-grid-right [data-side="R"][data-idx="${i}"].weight-input`)?.value, 0);
          if (rL <= 0 || rR <= 0) { $("#s5-hint").textContent = "All reps must be ≥ 1."; return false; }
          if (wL < 0 || wR < 0)    { $("#s5-hint").textContent = "Weights cannot be negative."; return false; }
          setRepsL.push(rL); setWeightsL.push(wL);
          setRepsR.push(rR); setWeightsR.push(wR);
        }
      } else {
        for (let i=0;i<nSets;i++){
          const r = toInt($(`#sets-grid  [data-idx="${i}"].rep-input`)?.value, 0);
          const w = toFloat($(`#sets-grid [data-idx="${i}"].weight-input`)?.value, 0);
          if (r <= 0) { $("#s5-hint").textContent = "All reps must be ≥ 1."; return false; }
          if (w < 0)  { $("#s5-hint").textContent = "Weights cannot be negative."; return false; }
          setReps.push(r); setWeights.push(w);
        }
      }

      // Build session item
      const item = {
        id: String(Date.now()),
        name: ex,
        category: state.category,
        muscle: state.category === "specific muscle" ? state.muscle : null,
        equipment: state.equipment,
        movementType,
        sets: nSets,
        setReps, setWeights,
        setRepsL, setWeightsL,
        setRepsR, setWeightsR,
      };
      // compute heaviest
      if (movementType === "unilateral") {
        const maxL = Math.max(...setWeightsL);
        const maxR = Math.max(...setWeightsR);
        item.maxWeight = Math.max(maxL, maxR);
        item.maxWeightSetCount = [...setWeightsL, ...setWeightsR].filter(w => w === item.maxWeight).length;
      } else {
        item.maxWeight = Math.max(...setWeights);
        item.maxWeightSetCount = setWeights.filter(w => w === item.maxWeight).length;
      }

      // Append & reset inline inputs
      currentSessionItems.push(item);
      renderSessionList();

      // reset fields for convenience (stay on step 5 to add more)
      $("#exercise-select").value = "";
      $("#exercise-search").value = "";
      $("#movement-type-select").value = "bilateral";
      $("#sets-input").value = "3";
      state.exercise = ""; state.movementType = "bilateral"; state.sets = 3;
      $("#s5-hint").textContent = "";
      renderSetsArea();
      updateExerciseInsights("");
      return false; // stay on step 5 unless user clicks Next
    }
    return true;
  }

  /* ---------- Events ---------- */
  function wireEvents() {
    // Step 2
    $$('input[name="timing"]').forEach(r => r.addEventListener("change", e => {
      state.timing = e.target.value;
      const dt = $("#workout-datetime");
      if (state.timing === "now") {
        state.datetime = nowIsoMinute();
        dt.value = state.datetime;
        dt.setAttribute("disabled","disabled");
      } else {
        dt.removeAttribute("disabled");
      }
    }));
    $("#workout-datetime")?.addEventListener("change", e => {
      if (state.timing === "past") state.datetime = e.target.value;
    });

    // Step 3
    $("#work-on-select")?.addEventListener("change", e => {
      state.category = normalizeCategory(e.target.value);
      if (state.category === "specific muscle") {
        $("#muscle-select-group").style.display = "grid";
      } else {
        $("#muscle-select-group").style.display = "none";
        state.muscle = "";
        $("#muscle-select").value = "";
      }
      // Clear downstream
      state.equipment = ""; $("#equipment-select").innerHTML = `<option value="">-- Select --</option>`;
      state.exercise  = ""; $("#exercise-select").innerHTML  = `<option value="">-- Select --</option>`;
    });
    $("#muscle-select")?.addEventListener("change", e => {
      state.muscle = e.target.value;
      // Clear downstream
      state.equipment = ""; $("#equipment-select").innerHTML = `<option value="">-- Select --</option>`;
      state.exercise  = ""; $("#exercise-select").innerHTML  = `<option value="">-- Select --</option>`;
    });

    // Step 4
    $("#equipment-select")?.addEventListener("change", e => {
      state.equipment = e.target.value;
    });

    // Step 5
    $("#exercise-search")?.addEventListener("input", () => populateStep5Exercises());
    $("#exercise-select")?.addEventListener("change", e => {
      state.exercise = e.target.value;
      updateExerciseInsights(state.exercise);
      renderSetsArea();
    });
    $("#movement-type-select")?.addEventListener("change", e => {
      state.movementType = e.target.value;
      renderSetsArea();
    });
    $("#sets-input")?.addEventListener("change", () => renderSetsArea());

    $("#add-exercise-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      // Reuse validation branch for step 5 (adds item & stays)
      validateStep(5);
    });

    // History nav and save are handled in main.js calling our exposed methods
    $("#history-select")?.addEventListener("change", displayHistoryFor);
  }

  /* ---------- History (basic) ---------- */
  let chart;
  function populateHistoryDropdown() {
    const sel = $("#history-select");
    const keys = Object.keys(userWorkoutData).sort((a,b)=>a.localeCompare(b));
    sel.innerHTML = `<option value="">-- Select an Exercise --</option>` + keys.map(k => `<option value="${k}">${k}</option>`).join("");
    $("#history-details").style.display = "none";
  }
  function displayHistoryFor() {
    const name = $("#history-select").value;
    if (!name) { $("#history-details").style.display = "none"; return; }
    const hist = userWorkoutData[name];
    if (!hist) { $("#history-details").style.display = "none"; return; }

    $("#history-details").style.display = "block";
    $("#best-weight-title").textContent = `Best Weight: ${hist.bestWeight ?? 0}kg`;

    const sorted = hist.records.slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
    const labels = sorted.map(r => new Date(r.date).toLocaleDateString());
    const data   = sorted.map(r => r.maxWeight);

    if (chart) chart.destroy();
    const ctx = document.getElementById("history-chart").getContext("2d");
    chart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: "Heaviest Lift (kg)", data, borderColor: "orange", backgroundColor: "rgba(255,165,0,0.2)", fill: true, tension: 0.1 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "Date", color: "#fff" }, ticks: { color: "#fff" } },
          y: { title: { display: true, text: "Weight (kg)", color: "#fff" }, ticks: { color: "#fff" } }
        },
        plugins: { legend: { labels: { color: "#fff" } } }
      }
    });

    const log = $("#history-log");
    log.innerHTML = "";
    sorted.forEach(r => {
      const pairs = r.movementType === "unilateral"
        ? [
            `<em>Left</em>: ${r.setRepsL.map((reps,i)=>`${reps}x${r.setWeightsL[i]}kg`).join(", ")}`,
            `<em>Right</em>: ${r.setRepsR.map((reps,i)=>`${reps}x${r.setWeightsR[i]}kg`).join(", ")}`
          ].join("<br>")
        : r.setReps.map((reps,i)=>`${reps}x${r.setWeights[i]}kg`).join(", ");

      const li = document.createElement("li");
      li.style.padding = "8px 0";
      li.style.borderBottom = "1px dashed #333";
      li.innerHTML = `
        <div><strong>${name}</strong> <small>(${title(r.category)} • ${title(r.equipment)}${r.muscle?` • ${r.muscle}`:""} • ${title(r.movementType)})</small></div>
        <div class="muted">${new Date(r.date).toLocaleString()}</div>
        <div>${pairs || "—"}</div>
        <div class="muted">Heaviest: ${r.maxWeight}kg</div>
      `;
      log.appendChild(li);
    });
  }

  /* ---------- Expose to main.js ---------- */
  window._wizard_init = function () {
    // defaults
    $("#workout-datetime").value = state.datetime;
    $("#workout-datetime").setAttribute("disabled","disabled");
    document.querySelector('input[name="timing"][value="now"]').checked = true;

    populateStep1();
    populateStep2();
    populateStep3();

    wireEvents();
  };

  window._wizard_onEnterStep = onEnterStep;
  window._wizard_validateStep  = validateStep;
  window._wizard_saveSession   = saveSession;
  window._wizard_populateHistory = populateHistoryDropdown;

})();
