/* =======================================================================
   Workout Session Logger — script.js (FULL, with Last/Best + Trend)
======================================================================= */

/* ---- Crash guard ---- */
window.addEventListener("error", (e) => console.error("[JS Error]", e.error || e.message));

/* ---- Constants / helpers ---- */
const HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
const CATEGORY_WHITELIST = new Set(["upper body","lower body","push","pull","hinge","squat","full body","core","specific muscle"]);
const uniq = (a) => [...new Set(a)];
const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const toInt = (v, f=0) => Number.isFinite(parseInt(v,10)) ? parseInt(v,10) : f;
const toFloat = (v, f=0) => Number.isFinite(parseFloat(v)) ? parseFloat(v) : f;
const nowIsoMinute = () => new Date().toISOString().slice(0,16);
const isoToLocalString = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
const normalizeCategory = (c0) => { const c=String(c0||"").toLowerCase().trim(); if(c==="upper")return"upper body"; if(c==="lower"||c==="legs")return"lower body"; return c; };

/* ---- Data: exercises from exercises.js ---- */
const RAW_EXERCISES = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const EXERCISES_NORM = RAW_EXERCISES.map(e=>({
  name:e.name,
  sections:(e.sections||[]).map(s=>String(s).toLowerCase()),
  equipment:(e.equipment||[]).map(eq=>String(eq).toLowerCase()),
  muscles:Array.isArray(e.muscles)?e.muscles.slice():[]
}));

const allCategories = () => uniq(EXERCISES_NORM.flatMap(e=>e.sections.filter(s=>CATEGORY_WHITELIST.has(s)))).sort();
const allMuscles = () => uniq(EXERCISES_NORM.flatMap(e=>e.muscles)).sort();
const byLocation = (items, loc) => loc==="home" ? items.filter(e=>e.equipment.some(eq=>HOME_EQUIPMENT.includes(eq))) : items;
function byCategoryAndMuscle(items, category, muscle){
  const cat = normalizeCategory(category);
  if(!cat) return [];
  if(cat==="specific muscle"){
    if(!muscle) return [];
    return items.filter(e=>e.sections.includes("specific muscle") && (e.muscles||[]).includes(muscle));
  }
  return items.filter(e=>e.sections.includes(cat));
}

/* ---- App state ---- */
let currentStep = 1;
let myChart = null;
let userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData")) || {};
let currentWorkoutExercises = [];
let editingRecord = null;

const wizard = {
  location:"", timing:"", datetime:"",
  category:"", muscle:"", equipment:"", exercise:"",
  sets:3, setReps:[], setWeights:[],
  maxWeight:0, maxWeightSetCount:0
};

/* ======================================================================
   NEW: History helpers (last / best) + trend
====================================================================== */

/** Return all records for an exercise, newest first */
function getExerciseRecordsDesc(exName){
  const recs = (userWorkoutData[exName]?.records || []).slice();
  recs.sort((a,b)=>new Date(b.date)-new Date(a.date));
  return recs;
}

/** Get last session’s heaviest set weight and its reps */
function getLastHeaviestWithReps(exName){
  const recs = getExerciseRecordsDesc(exName);
  if(recs.length === 0) return null;

  const r = recs[0];
  const weights = Array.isArray(r.setWeights) ? r.setWeights : [];
  const reps    = Array.isArray(r.setReps) ? r.setReps : [];
  if(weights.length === 0) return { maxWeight: r.maxWeight ?? 0, reps: null, date: r.date };

  const maxW = Math.max(...weights);
  const idx  = weights.findIndex(w=>w===maxW);
  const repsAtMax = idx>=0 ? (reps[idx] ?? null) : null;

  return { maxWeight: maxW, reps: repsAtMax, date: r.date };
}

/** Get all-time heaviest weight and reps (from the set where it occurred) */
function getBestHeaviestWithReps(exName){
  const bestW = userWorkoutData[exName]?.bestWeight ?? null;
  if(bestW==null) return null;

  const recs = getExerciseRecordsDesc(exName).slice().reverse(); // oldest -> newest to prefer earliest or latest; choice arbitrary
  for(const r of recs){
    const weights = Array.isArray(r.setWeights) ? r.setWeights : [];
    const reps    = Array.isArray(r.setReps) ? r.setReps : [];
    const i = weights.findIndex(w=>w===bestW);
    if(i>=0){
      return { maxWeight: bestW, reps: reps[i] ?? null, date: r.date };
    }
  }
  // fallback if we somehow didn't find the set
  return { maxWeight: bestW, reps: null, date: null };
}

/** Compare a current entry’s max to the last recorded for that exercise */
function getTrendAgainstLast(exName, currentMax){
  const last = getLastHeaviestWithReps(exName);
  if(!last || last.maxWeight==null) return { dir:"na", delta: null }; // no history
  const delta = Number((currentMax - last.maxWeight).toFixed(2));
  if (delta > 0)  return { dir:"up",   delta };
  if (delta < 0)  return { dir:"down", delta };
  return { dir:"same", delta: 0 };
}

/* ======================================================================
   DOM Ready
====================================================================== */
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

/* ======================================================================
   Step navigation
====================================================================== */
function goToStep(step){
  currentStep = step;
  document.querySelectorAll(".wizard-step").forEach((el,idx)=>el.style.display = (idx===step-1 ? "block" : "none"));
  document.querySelectorAll(".step-badge").forEach(b=>b.classList.toggle("active", Number(b.dataset.step)===step));
  const prev = document.getElementById("prev-btn"); if(prev) prev.disabled = (step===1);

  if (step===4)      populateEquipment();
  else if (step===5) populateExercises();
  else if (step===6) buildSessionSummary();

  updateReviewButtonState();
}
function prevStep(){ if(currentStep>1) goToStep(currentStep-1); }
function nextStep(){
  if(currentStep<5){
    if(!validateAndStore(currentStep)) return;
    goToStep(currentStep+1); return;
  }
  if(currentStep===5){
    if(currentWorkoutExercises.length===0){
      const s5Hint=document.getElementById("s5-hint");
      if(s5Hint) s5Hint.textContent="Please add at least one exercise before reviewing your session.";
      return;
    }
    goToStep(6); return;
  }
  saveSession();
}
function updateReviewButtonState(){
  const next = document.getElementById("next-btn"); if(!next) return;
  if(currentStep===5){
    next.textContent="Review";
    const noItems=currentWorkoutExercises.length===0;
    next.disabled=noItems;
    next.classList.toggle("is-disabled",noItems);
  } else if(currentStep===6){
    next.textContent="Save"; next.disabled=false; next.classList.remove("is-disabled");
  } else {
    next.textContent="Next"; next.disabled=false; next.classList.remove("is-disabled");
  }
}

/* ======================================================================
   Step 1 — Location
====================================================================== */
function initStep1(){ const sel=document.getElementById("workout-type-select"); if(sel) sel.value=wizard.location||""; }
function validateAndStoreStep1(){
  const hint=document.getElementById("s1-hint");
  const val=document.getElementById("workout-type-select").value;
  if(!val){ if(hint) hint.textContent="Please select where you are training."; return false; }
  if(hint) hint.textContent="";
  wizard.location=val; return true;
}

/* ======================================================================
   Step 2 — Timing + Date
====================================================================== */
function initStep2(){
  document.querySelectorAll('input[name="timing"]').forEach(r=>r.addEventListener("change", onTimingChange));
  if(!wizard.timing){
    const nowRadio=document.querySelector('input[name="timing"][value="now"]');
    if(nowRadio) nowRadio.checked = true;
    wizard.timing="now"; setDateToNow(true);
  } else {
    const chosen=document.querySelector(`input[name="timing"][value="${wizard.timing}"]`);
    if(chosen) chosen.checked=true;
    if(wizard.timing==="now") setDateToNow(true);
  }
}
function onTimingChange(e){
  wizard.timing=e.target.value;
  if(wizard.timing==="now"){ setDateToNow(true); }
  else{
    const dt=document.getElementById("workout-datetime");
    dt.removeAttribute("disabled");
    const hint=document.getElementById("date-hint");
    if(hint) hint.textContent="Pick the date/time for your past session.";
  }
}
function setDateToNow(write){
  const dt=document.getElementById("workout-datetime");
  const now=nowIsoMinute(); if(write) dt.value=now;
  dt.setAttribute("disabled","disabled");
  const hint=document.getElementById("date-hint"); if(hint) hint.textContent="Date/time is locked to now.";
}
function validateAndStoreStep2(){
  const hint=document.getElementById("s2-hint");
  const dt=document.getElementById("workout-datetime").value;
  if(!wizard.timing){ if(hint) hint.textContent="Select session timing."; return false; }
  if(wizard.timing==="past" && !dt){ if(hint) hint.textContent="Choose a date/time for your past session."; return false; }
  wizard.datetime = wizard.timing==="now" ? nowIsoMinute() : dt;
  if(hint) hint.textContent=""; return true;
}

/* ======================================================================
   Step 3 — Category (+ specific muscle)
====================================================================== */
function initStep3(){
  const workOn=document.getElementById("work-on-select");
  const cats=allCategories();
  workOn.innerHTML = `<option value="">--Select--</option>` + cats.map(c=>`<option value="${c}">${title(c)}</option>`).join('');
  workOn.value = wizard.category || "";

  const musclesSel=document.getElementById("muscle-select");
  const muscles = allMuscles();
  musclesSel.innerHTML = `<option value="">--Select--</option>` + muscles.map(m=>`<option value="${m}">${m}</option>`).join('');
  musclesSel.value = wizard.muscle || "";

  workOn.addEventListener("change",()=>{
    const cat=normalizeCategory(workOn.value);
    wizard.category=cat; wizard.equipment=""; wizard.exercise="";
    const group=document.getElementById("muscle-select-group");
    if(cat==="specific muscle"){ group.style.display="block"; }
    else { group.style.display="none"; wizard.muscle=""; musclesSel.value=""; }
  });
  musclesSel.addEventListener("change",()=> wizard.muscle=musclesSel.value);
}
function validateAndStoreStep3(){
  const hint=document.getElementById("s3-hint");
  const raw=document.getElementById("work-on-select").value;
  if(!raw){ if(hint) hint.textContent="Please select what you're training."; return false; }
  const cat=normalizeCategory(raw); wizard.category=cat;
  if(cat==="specific muscle"){
    const mus=document.getElementById("muscle-select").value;
    if(!mus){ if(hint) hint.textContent="Please choose a specific muscle."; return false; }
    wizard.muscle=mus;
  }
  if(hint) hint.textContent=""; return true;
}

/* ======================================================================
   Step 4 — Equipment
====================================================================== */
function initStep4(){}
function populateEquipment(){
  const sel=document.getElementById("equipment-select");
  sel.innerHTML = `<option value="">--Select--</option>`;
  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle);
  const eqs = uniq(filtered.flatMap(e=>e.equipment));
  sel.innerHTML += eqs.map(eq=>`<option value="${eq}">${title(eq)}</option>`).join('');
  if(eqs.includes(wizard.equipment)) sel.value=wizard.equipment;
  sel.onchange = () => { wizard.equipment = sel.value; populateExercises(); };
}
function validateAndStoreStep4(){
  const hint=document.getElementById("s4-hint");
  const val=document.getElementById("equipment-select").value;
  if(!val){ if(hint) hint.textContent="Please select the machine/equipment."; return false; }
  wizard.equipment=val; if(hint) hint.textContent=""; return true;
}

/* ======================================================================
   Step 5 — Exercise + sets
   (Now includes "Last" & "Heaviest" insights under the selector)
====================================================================== */
function initStep5(){
  const setsInput=document.getElementById("sets-input");
  setsInput.value=wizard.sets;
  setsInput.addEventListener("change",()=>{ wizard.sets=Math.max(1,toInt(setsInput.value,1)); renderSetRows(wizard.sets); });
  renderSetRows(wizard.sets);
}
function ensureInsightsNode(){
  // Create insights area if missing (no HTML changes required)
  let node = document.getElementById("exercise-insights");
  if(!node){
    const grp = document.getElementById("exercise-select").closest(".form-group") || document.getElementById("exercise-select-group") || document.getElementById("exercise-select").parentElement;
    node = document.createElement("div");
    node.id = "exercise-insights";
    node.className = "hint";
    node.style.marginTop = "8px";
    grp.parentElement.insertBefore(node, grp.nextSibling);
  }
  return node;
}
function showExerciseInsights(name){
  const box = ensureInsightsNode();
  if(!name){ box.textContent = ""; return; }

  const last = getLastHeaviestWithReps(name);
  const best = getBestHeaviestWithReps(name);
  const parts = [];

  if(last){
    parts.push(`Last: <strong>${last.maxWeight ?? 0} kg</strong>${last.reps!=null?` × <strong>${last.reps} reps</strong>`:""} (${new Date(last.date).toLocaleDateString()})`);
  }else{
    parts.push(`Last: <em>no history</em>`);
  }

  if(best){
    parts.push(`Heaviest: <strong>${best.maxWeight ?? 0} kg</strong>${best.reps!=null?` × <strong>${best.reps} reps</strong>`:""}${best.date?` (${new Date(best.date).toLocaleDateString()})`:""}`);
  }else{
    parts.push(`Heaviest: <em>no history</em>`);
  }

  box.innerHTML = parts.join(" &nbsp;•&nbsp; ");
}
function populateExercises(){
  const select=document.getElementById("exercise-select");
  select.innerHTML = `<option value="">--Select--</option>`;

  const pool = byLocation(EXERCISES_NORM, wizard.location);
  const filtered = byCategoryAndMuscle(pool, wizard.category, wizard.muscle)
    .filter(e => wizard.equipment ? e.equipment.includes(wizard.equipment) : true);

  const names = uniq(filtered.map(e=>e.name)).sort();
  select.innerHTML += names.map(n=>`<option value="${n}">${n}</option>`).join('');
  if(names.includes(wizard.exercise)) select.value = wizard.exercise;

  // Show insights for preselected exercise (when editing)
  showExerciseInsights(select.value || null);

  select.onchange = () => {
    wizard.exercise = select.value;
    showExerciseInsights(wizard.exercise);
  };
}
function renderSetRows(n){
  const grid=document.getElementById("sets-grid");
  grid.innerHTML="";
  for(let i=1;i<=n;i++){
    const row=document.createElement("div");
    row.className="set-row";
    row.innerHTML=`
      <input type="number" min="1" step="1" placeholder="Set ${i}: Reps" data-kind="reps" data-idx="${i-1}">
      <input type="number" min="0" step="0.5" placeholder="Set ${i}: Weight (kg)" data-kind="weight" data-idx="${i-1}">
    `;
    grid.appendChild(row);
  }
}
function validateAndStoreStep5(){
  const hint=document.getElementById("s5-hint");
  const exercise=document.getElementById("exercise-select").value;
  if(!exercise){ if(hint) hint.textContent="Choose an exercise."; return false; }
  wizard.exercise=exercise;

  const n=Math.max(1,toInt(document.getElementById("sets-input").value,1));
  wizard.sets=n;

  const repsInputs=[...document.querySelectorAll('#sets-grid input[data-kind="reps"]')];
  const wtInputs  =[...document.querySelectorAll('#sets-grid input[data-kind="weight"]')];

  const setReps=repsInputs.map(i=>toInt(i.value)).filter(v=>v>0);
  const setWeights=wtInputs.map(i=>toFloat(i.value)).filter(v=>v>=0);

  if(setReps.length!==n || setWeights.length!==n){
    if(hint) hint.textContent="Fill reps and weight for every set."; return false;
  }

  wizard.setReps=setReps; wizard.setWeights=setWeights;
  const maxW=Math.max(...setWeights);
  const maxCount=setWeights.filter(w=>w===maxW).length;
  wizard.maxWeight=maxW; wizard.maxWeightSetCount=maxCount;

  if(hint) hint.textContent=""; return true;
}

/* ---- Current session list ---- */
function addExerciseToWorkout(){
  if(!validateAndStoreStep5()) return;

  const ex = {
    id:Date.now().toString(),
    date:wizard.datetime,
    name:wizard.exercise,
    category:wizard.category,
    equipment:wizard.equipment,
    muscle:wizard.category==="specific muscle" ? wizard.muscle : null,
    sets:wizard.sets,
    setReps:wizard.setReps.slice(),
    setWeights:wizard.setWeights.slice(),
    maxWeight:wizard.maxWeight,
    maxWeightSetCount:wizard.maxWeightSetCount
  };
  currentWorkoutExercises.push(ex);
  renderCurrentWorkoutList();

  // reset inline inputs for next add
  document.getElementById("exercise-select").value="";
  document.getElementById("sets-input").value="3";
  wizard.exercise=""; wizard.sets=3; renderSetRows(3);
  ensureInsightsNode().textContent="";

  updateReviewButtonState();
}
function renderCurrentWorkoutList(){
  const wrap=document.getElementById("current-workout-list-container");
  const list=document.getElementById("current-workout-list");
  list.innerHTML="";
  if(currentWorkoutExercises.length>0){
    wrap.style.display="block";
    currentWorkoutExercises.forEach((ex,idx)=>{
      const pairs = ex.setReps.map((r,i)=>`${r}x${ex.setWeights[i]}kg`).join(", ");
      const meta = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle?` • ${ex.muscle}`:""}`;
      const div=document.createElement("div");
      div.className="workout-item";
      div.innerHTML = `
        <strong>${ex.name}</strong> <small>(${meta})</small><br>
        ${ex.sets} sets → ${pairs}<br>
        Heaviest: ${ex.maxWeight}kg for ${ex.maxWeightSetCount} set(s)
        <button onclick="removeExerciseFromWorkout(${idx})" style="float:right; padding:6px 10px; font-size:12px; margin-top:-5px; background:#a55; color:#fff; border-radius:8px;">Remove</button>
      `;
      list.appendChild(div);
    });
  } else {
    wrap.style.display="none";
  }
}
function removeExerciseFromWorkout(index){
  currentWorkoutExercises.splice(index,1);
  renderCurrentWorkoutList();
  updateReviewButtonState();
}

/* ======================================================================
   Step 6 — Review + Trend + Save
====================================================================== */
function buildSessionSummary(){
  const meta=document.getElementById("summary-meta");
  const exWrap=document.getElementById("summary-exercises");
  const totals=document.getElementById("summary-totals");

  meta.innerHTML = `
    <div class="summary-row"><strong>Location</strong><span>${title(wizard.location)}</span></div>
    <div class="summary-row"><strong>When</strong><span>${wizard.timing==="now"?"Training now":"Recorded session"}</span></div>
    <div class="summary-row"><strong>Date & Time</strong><span>${isoToLocalString(wizard.datetime)}</span></div>
  `;

  exWrap.innerHTML="";
  if(currentWorkoutExercises.length===0){
    exWrap.innerHTML = `<div class="summary-exercise"><em>No exercises added yet. Go back and add some.</em></div>`;
  } else {
    currentWorkoutExercises.forEach(ex=>{
      // NEW: trend vs last
      const trend = getTrendAgainstLast(ex.name, ex.maxWeight);
      let badge = "";
      if(trend.dir==="up")   badge = ` <span style="color:#4caf50;">▲ +${Math.abs(trend.delta)}kg</span>`;
      if(trend.dir==="down") badge = ` <span style="color:#ff5252;">▼ ${trend.delta}kg</span>`;
      if(trend.dir==="same") badge = ` <span style="color:#ffb300;">= ${trend.delta}kg</span>`;
      if(trend.dir==="na")   badge = ` <span style="color:#9aa0a6;">— no history</span>`;

      const pairs = ex.setReps.map((r,i)=>`${r}x${ex.setWeights[i]}kg`).join(", ");
      const metaLine = `${title(ex.category)} • ${title(ex.equipment)}${ex.muscle?` • ${ex.muscle}`:""}`;

      const card=document.createElement("div");
      card.className="summary-exercise";
      card.innerHTML = `
        <strong>${ex.name}</strong> <small>(${metaLine})</small>${badge}<br>
        ${ex.sets} sets → ${pairs}<br>
        Heaviest this session: <strong>${ex.maxWeight}kg</strong>
      `;
      exWrap.appendChild(card);
    });
  }

  // Totals
  let totalVolume=0, totalSets=0, totalExercises=currentWorkoutExercises.length;
  currentWorkoutExercises.forEach(ex=>{
    totalSets+=ex.sets;
    ex.setReps.forEach((r,i)=> totalVolume += r * ex.setWeights[i]);
  });
  totals.innerHTML = `
    <div><strong>Total Exercises:</strong> ${totalExercises}</div>
    <div><strong>Total Sets:</strong> ${totalSets}</div>
    <div><strong>Estimated Volume:</strong> ${Number.isFinite(totalVolume)?totalVolume.toFixed(1):0} kg·reps</div>
  `;
}

function saveSession(){
  const dt=wizard.datetime;
  if(!dt){ alert("Missing session date/time — go back to Step 2."); return; }
  if(currentWorkoutExercises.length===0){ alert("Add at least one exercise before saving."); return; }

  currentWorkoutExercises.forEach(ex=>{
    if(!userWorkoutData[ex.name]) userWorkoutData[ex.name] = { bestWeight:0, records:[] };
    userWorkoutData[ex.name].records.push({
      id:ex.id, date:dt,
      category:ex.category, equipment:ex.equipment, muscle:ex.muscle,
      sets:ex.sets, setReps:ex.setReps, setWeights:ex.setWeights,
      maxWeight:ex.maxWeight, maxWeightSetCount:ex.maxWeightSetCount
    });
    if(ex.maxWeight > userWorkoutData[ex.name].bestWeight){
      userWorkoutData[ex.name].bestWeight = ex.maxWeight;
    }
  });

  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  alert("Workout session saved successfully!");

  currentWorkoutExercises=[]; renderCurrentWorkoutList();

  Object.assign(wizard, {
    location:"", timing:"now", datetime:nowIsoMinute(),
    category:"", muscle:"", equipment:"", exercise:"",
    sets:3, setReps:[], setWeights:[], maxWeight:0, maxWeightSetCount:0
  });

  const typeSel=document.getElementById("workout-type-select"); if(typeSel) typeSel.value="";
  const nowRadio=document.querySelector('input[name="timing"][value="now"]'); if(nowRadio) nowRadio.checked=true;
  const dtInput=document.getElementById("workout-datetime"); if(dtInput){ dtInput.setAttribute("disabled","disabled"); dtInput.value=wizard.datetime; }
  const workOn=document.getElementById("work-on-select"); if(workOn) workOn.value="";
  const musSel=document.getElementById("muscle-select"); if(musSel) musSel.value="";
  const musGrp=document.getElementById("muscle-select-group"); if(musGrp) musGrp.style.display="none";
  const eqSel=document.getElementById("equipment-select"); if(eqSel) eqSel.innerHTML=`<option value="">--Select--</option>`;
  const exSel=document.getElementById("exercise-select"); if(exSel) exSel.innerHTML=`<option value="">--Select--</option>`;
  const setsInput=document.getElementById("sets-input"); if(setsInput) setsInput.value="3";
  renderSetRows(3);

  goToStep(1);
}

/* ======================================================================
   History view (unchanged, still supports edit/delete)
====================================================================== */
function showHistoryView(){ document.querySelectorAll(".page").forEach(p=>p.classList.remove("active")); document.getElementById("workout-history").classList.add("active"); populateHistoryDropdown(); }
function showLoggerView(){ document.querySelectorAll(".page").forEach(p=>p.classList.remove("active")); document.getElementById("workout-logger").classList.add("active"); goToStep(1); updateReviewButtonState(); }

function populateHistoryDropdown(){
  const sel=document.getElementById("history-select");
  const recorded=Object.keys(userWorkoutData);
  sel.innerHTML = `<option value="">--Select an Exercise--</option>` + recorded.map(x=>`<option value="${x}">${x}</option>`).join('');
  document.getElementById("history-details").style.display="none";
}
function displayExerciseHistory(){
  const sel=document.getElementById("history-select").value;
  const details=document.getElementById("history-details");
  const bestTitle=document.getElementById("best-weight-title");
  const log=document.getElementById("history-log");
  if(!sel){ details.style.display="none"; return; }

  details.style.display="block";
  const hist=userWorkoutData[sel];
  bestTitle.textContent = `Best Weight: ${hist.bestWeight}kg`;

  const recs = hist.records.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const dates = recs.map(r=>new Date(r.date).toLocaleDateString());
  const maxWs = recs.map(r=>r.maxWeight);

  if(myChart) myChart.destroy();
  const ctx=document.getElementById("history-chart").getContext("2d");
  myChart = new Chart(ctx,{
    type:"line",
    data:{ labels:dates, datasets:[{ label:"Heaviest Lift (kg)", data:maxWs, borderColor:"orange", backgroundColor:"rgba(255,165,0,.2)", fill:true, tension:.1 }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{ x:{ title:{display:true,text:"Date",color:"white"}, ticks:{color:"white"}}, y:{ title:{display:true,text:"Weight (kg)",color:"white"}, ticks:{color:"white"}}},
      plugins:{ legend:{ labels:{ color:"white" } } }
    }
  });

  log.innerHTML="";
  recs.forEach(r=>{
    const dateStr=new Date(r.date).toLocaleString();
    const pairs = r.setReps ? r.setReps.map((rep,i)=>`${rep}x${r.setWeights[i]}kg`).join(", ") : `Reps: ${r.reps} | Weights: ${r.setWeights.join(", ")}kg`;
    const meta = `${title(r.category||"n/a")} • ${title(r.equipment||"n/a")}${r.muscle?` • ${r.muscle}`:""}`;
    const li=document.createElement("li");
    li.innerHTML = `
      <span>
        <strong>${sel}</strong> <small>(${meta})</small><br>
        Date: ${dateStr} | Sets: ${r.sets} | ${pairs}<br>
        Heaviest: ${r.maxWeight}kg${r.maxWeightSetCount?` for ${r.maxWeightSetCount} set(s)`:""}
      </span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${sel}','${r.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${sel}','${r.id}')">Delete</button>
      </div>
    `;
    log.appendChild(li);
  });
}
function deleteRecord(exerciseName, recordId){
  if(!confirm("Are you sure you want to delete this record?")) return;
  const hist=userWorkoutData[exerciseName];
  hist.records = hist.records.filter(r=>r.id!==recordId);
  if(hist.records.length===0){ delete userWorkoutData[exerciseName]; }
  else {
    const newMax=Math.max(...hist.records.map(r=>r.maxWeight));
    hist.bestWeight = Number.isFinite(newMax) ? newMax : 0;
  }
  localStorage.setItem("userWorkoutData", JSON.stringify(userWorkoutData));
  populateHistoryDropdown();
  const sel=document.getElementById("history-select");
  if(sel && (exerciseName in userWorkoutData)){ sel.value=exerciseName; displayExerciseHistory(); }
  else { document.getElementById("history-details").style.display="none"; }
}
function editRecord(exerciseName, recordId){
  const hist=userWorkoutData[exerciseName];
  const rec=hist.records.find(r=>r.id===recordId);
  if(!rec) return;

  wizard.location = HOME_EQUIPMENT.includes(rec.equipment) ? "home" : "gym";
  wizard.timing   = "past";
  wizard.datetime = rec.date;
  wizard.category = rec.category||"";
  wizard.muscle   = rec.muscle||"";
  wizard.equipment= rec.equipment||"";
  wizard.exercise = exerciseName;
  wizard.sets     = rec.sets || (rec.setWeights ? rec.setWeights.length : 3);
  wizard.setReps  = rec.setReps ? rec.setReps.slice() : Array(wizard.sets).fill(rec.reps||10);
  wizard.setWeights = rec.setWeights ? rec.setWeights.slice() : Array(wizard.sets).fill(0);
  const maxW=Math.max(...wizard.setWeights);
  wizard.maxWeight = Number.isFinite(maxW) ? maxW : 0;
  wizard.maxWeightSetCount = wizard.setWeights.filter(w=>w===wizard.maxWeight).length;

  editingRecord = rec;

  showLoggerView();
  const typeSel=document.getElementById("workout-type-select"); if(typeSel) typeSel.value=wizard.location;
  const pastRadio=document.querySelector('input[name="timing"][value="past"]'); if(pastRadio) pastRadio.checked=true;
  const dt=document.getElementById("workout-datetime"); if(dt){ dt.removeAttribute("disabled"); dt.value=wizard.datetime; }
  const catSel=document.getElementById("work-on-select"); if(catSel) catSel.value=wizard.category;

  const muscleGroup=document.getElementById("muscle-select-group");
  const muscleSel=document.getElementById("muscle-select");
  if(wizard.category==="specific muscle"){ if(muscleGroup) muscleGroup.style.display="block"; if(muscleSel) muscleSel.value=wizard.muscle; }
  else { if(muscleGroup) muscleGroup.style.display="none"; }

  populateEquipment();
  const eqSel=document.getElementById("equipment-select"); if(eqSel) eqSel.value=wizard.equipment;
  populateExercises();
  const exSel=document.getElementById("exercise-select"); if(exSel) exSel.value=wizard.exercise;

  const setsInput=document.getElementById("sets-input"); if(setsInput) setsInput.value=wizard.sets;
  renderSetRows(wizard.sets);
  const repInputs=[...document.querySelectorAll('#sets-grid input[data-kind="reps"]')];
  const wtInputs =[...document.querySelectorAll('#sets-grid input[data-kind="weight"]')];
  repInputs.forEach((el,i)=> el.value = wizard.setReps[i] ?? "");
  wtInputs.forEach((el,i)=> el.value = wizard.setWeights[i] ?? "");

  currentWorkoutExercises = [{
    id:rec.id, date:wizard.datetime, name:wizard.exercise, category:wizard.category,
    equipment:wizard.equipment, muscle:wizard.muscle||null, sets:wizard.sets,
    setReps:wizard.setReps.slice(), setWeights:wizard.setWeights.slice(),
    maxWeight:wizard.maxWeight, maxWeightSetCount:wizard.maxWeightSetCount
  }];
  renderCurrentWorkoutList();
  updateReviewButtonState();

  goToStep(5);
  const editMsg=document.getElementById("edit-mode-message"); if(editMsg) editMsg.style.display="block";
}

/* ======================================================================
   Validation dispatcher + debug helpers
====================================================================== */
function validateAndStore(step){
  if(step===1) return validateAndStoreStep1();
  if(step===2) return validateAndStoreStep2();
  if(step===3) return validateAndStoreStep3();
  if(step===4) return validateAndStoreStep4();
  if(step===5) return validateAndStoreStep5();
  return true;
}

window._wipeAllWorkoutData = function(){
  if(confirm("Delete ALL saved workout history? This cannot be undone.")){
    userWorkoutData={}; localStorage.removeItem("userWorkoutData");
    currentWorkoutExercises=[]; renderCurrentWorkoutList(); populateHistoryDropdown();
    alert("All saved workout history cleared.");
  }
};
window.showHistoryView=showHistoryView;
window.showLoggerView=showLoggerView;
window.addExerciseToWorkout=addExerciseToWorkout;
window.removeExerciseFromWorkout=removeExerciseFromWorkout;
window.editRecord=editRecord;
window.deleteRecord=deleteRecord;
