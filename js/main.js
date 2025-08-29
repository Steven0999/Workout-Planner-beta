/* ============================================================
   main.js
   - App-wide state, page switching, history view & charts
   - Works with wizard.js for the stepper flow
   ============================================================ */

/* ---------- Global state (shared with wizard.js) ---------- */
window.userWorkoutData = JSON.parse(localStorage.getItem("userWorkoutData") || "{}"); // { [exerciseName]: { bestWeight:number, records:[...] } }
window.currentWorkoutExercises = []; // session buffer
window.currentStep = 1; // 1..6
window.myChart = null; // Chart.js instance

/* ---------- Helpers ---------- */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const setHTML = (el, html) => { if (el) el.innerHTML = html; };
const fmt = (n) => Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : "0";
const toLocal = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || "—"; } };
const title = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const uniq = (arr) => [...new Set(arr)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ---------- Navigation: Logger ↔ History ---------- */
function showHistoryView() {
  $$(".page").forEach(p => p.classList.remove("active"));
  $("#workout-history").classList.add("active");
  populateHistoryDropdown();
}
function showLoggerView() {
  $$(".page").forEach(p => p.classList.remove("active"));
  $("#workout-logger").classList.add("active");
  // wizard.js will keep current step; just ensure buttons reflect
  if (window.updateReviewButtonState) window.updateReviewButtonState();
}

/* ---------- History ---------- */
function populateHistoryDropdown() {
  const sel = $("#history-select");
  if (!sel) return;

  const keys = Object.keys(window.userWorkoutData).sort((a,b)=>a.localeCompare(b));
  setHTML(sel, `<option value="">--Select an Exercise--</option>${keys.map(k=>`<option value="${k}">${k}</option>`).join("")}`);

  const details = $("#history-details");
  if (details) details.style.display = "none";

  sel.onchange = displayExerciseHistory;
}

function displayExerciseHistory() {
  const name = $("#history-select").value;
  const details = $("#history-details");
  const bestTitle = $("#best-weight-title");
  const log = $("#history-log");
  const canvas = $("#history-chart");

  if (!name || !window.userWorkoutData[name] || window.userWorkoutData[name].records.length === 0) {
    if (details) details.style.display = "none";
    return;
  }

  details.style.display = "block";
  const hist = window.userWorkoutData[name];
  bestTitle.textContent = `Best Weight: ${fmt(hist.bestWeight)}kg`;

  // Chart: date vs maxWeight
  const sorted = hist.records.slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
  const labels = sorted.map(r => new Date(r.date).toLocaleDateString());
  const data = sorted.map(r => r.maxWeight);

  if (window.myChart) { window.myChart.destroy(); window.myChart = null; }
  if (canvas) {
    const ctx = canvas.getContext("2d");
    window.myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Heaviest Lift (kg)",
          data,
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

  // Log list
  setHTML(log, "");
  sorted.forEach(rec => {
    const when = toLocal(rec.date);

    let detailsHtml = "";
    if (rec.movementType === "unilateral" && Array.isArray(rec.setWeightsL) && Array.isArray(rec.setWeightsR)) {
      const pairsL = rec.setWeightsL.map((w,i)=>`${fmt(rec.setRepsL?.[i]||rec.reps||0)}x${fmt(w)}kg`).join(", ");
      const pairsR = rec.setWeightsR.map((w,i)=>`${fmt(rec.setRepsR?.[i]||rec.reps||0)}x${fmt(w)}kg`).join(", ");
      const maxL = rec.setWeightsL.length ? Math.max(...rec.setWeightsL) : 0;
      const maxR = rec.setWeightsR.length ? Math.max(...rec.setWeightsR) : 0;
      const cL = rec.setWeightsL.filter(x=>x===maxL).length;
      const cR = rec.setWeightsR.filter(x=>x===maxR).length;
      detailsHtml = `
        <div><em>Left:</em> ${pairsL || "—"}</div>
        <div><em>Right:</em> ${pairsR || "—"}</div>
        <div>Heaviest L: ${fmt(maxL)}kg × ${cL} • Heaviest R: ${fmt(maxR)}kg × ${cR}</div>
      `;
    } else {
      const pairs = (rec.setWeights || []).map((w,i)=>`${fmt(rec.setReps?.[i] || rec.reps || 0)}x${fmt(w)}kg`).join(", ");
      const c = (rec.setWeights || []).filter(x=>x===rec.maxWeight).length;
      detailsHtml = `
        <div>Sets: ${rec.sets} → ${pairs || "—"}</div>
        <div>Heaviest: ${fmt(rec.maxWeight)}kg${c ? ` × ${c}`:""}</div>
      `;
    }

    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        <strong>${name}</strong><br/>
        Date: ${when}<br/>
        ${detailsHtml}
      </span>
      <div class="history-actions">
        <button class="edit-btn" onclick="editRecord('${name}','${rec.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteRecord('${name}','${rec.id}')">Delete</button>
      </div>
    `;
    log.appendChild(li);
  });
}

function deleteRecord(exerciseName, recordId) {
  if (!confirm("Delete this record?")) return;

  const hist = window.userWorkoutData[exerciseName];
  if (!hist) return;

  hist.records = hist.records.filter(r => r.id !== recordId);
  if (hist.records.length === 0) {
    delete window.userWorkoutData[exerciseName];
  } else {
    const newBest = Math.max(...hist.records.map(r => r.maxWeight));
    hist.bestWeight = Number.isFinite(newBest) ? newBest : 0;
  }
  localStorage.setItem("userWorkoutData", JSON.stringify(window.userWorkoutData));
  populateHistoryDropdown();

  const sel = $("#history-select");
  if (window.userWorkoutData[exerciseName]) {
    sel.value = exerciseName;
    displayExerciseHistory();
  } else {
    $("#history-details").style.display = "none";
  }
}

function editRecord(exName, recordId) {
  // Defer to wizard.js
  if (window._editRecordFromHistory) {
    window._editRecordFromHistory(exName, recordId);
  } else {
    alert("Edit is not available yet.");
  }
}

/* ---------- Wire up nav buttons ---------- */
document.addEventListener("DOMContentLoaded", () => {
  $("#to-logger")?.addEventListener("click", showLoggerView);
  $("#to-history")?.addEventListener("click", showHistoryView);
  // wizard events are bound in wizard.js
});
