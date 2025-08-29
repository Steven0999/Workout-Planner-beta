(function () {
  const App = (window.App = window.App || {});
  const { q, stripZeros } = App.utils;

  let myChart = null;

  function populateHistoryDropdown() {
    const sel = q("#history-select");
    const keys = Object.keys(App.state.userWorkoutData || {}).sort((a, b) => a.localeCompare(b));
    sel.innerHTML = `<option value="">--Select an Exercise--</option>` + keys.map((k) => `<option value="${k}">${k}</option>`).join("");
    q("#history-details").style.display = "none";
    sel.onchange = displayExerciseHistory;
  }

  function displayExerciseHistory() {
    const exName = q("#history-select").value;
    const details = q("#history-details");
    if (!exName || !App.state.userWorkoutData[exName]?.records?.length) {
      details.style.display = "none";
      return;
    }

    const history = App.state.userWorkoutData[exName];
    details.style.display = "block";
    q("#best-weight-title").textContent = `Best Weight: ${stripZeros(history.bestWeight)}kg`;

    const sorted = history.records.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const dates = sorted.map((r) => new Date(r.date).toLocaleDateString());
    const maxWeights = sorted.map((r) => r.maxWeight);

    if (myChart) myChart.destroy();
    const ctx = q("#history-chart").getContext("2d");
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

    const ul = q("#history-log");
    ul.innerHTML = "";
    sorted.forEach((rec) => {
      let detailsHtml = "";
      if (rec.movementType === "unilateral" && (rec.setWeightsL || rec.setWeightsR)) {
        const pairsL = (rec.setRepsL || []).map((r, i) => `${stripZeros(r)}x${stripZeros(rec.setWeightsL?.[i] ?? 0)}kg`).join(", ");
        const pairsR = (rec.setRepsR || []).map((r, i) => `${stripZeros(r)}x${stripZeros(rec.setWeightsR?.[i] ?? 0)}kg`).join(", ");
        const maxL = Math.max(...(rec.setWeightsL || [0]));
        const maxR = Math.max(...(rec.setWeightsR || [0]));
        const cL = (rec.setWeightsL || []).filter((w) => w === maxL).length;
        const cR = (rec.setWeightsR || []).filter((w) => w === maxR).length;
        detailsHtml = `
          <div><em>Left:</em> ${pairsL || "—"}</div>
          <div><em>Right:</em> ${pairsR || "—"}</div>
          <div>Heaviest Left: ${stripZeros(maxL)}kg × ${stripZeros(cL)} • Heaviest Right: ${stripZeros(maxR)}kg × ${stripZeros(cR)}</div>
        `;
      } else {
        const pairs = (rec.setReps || []).map((r, i) => `${stripZeros(r)}x${stripZeros(rec.setWeights?.[i] ?? 0)}kg`).join(", ");
        const c = (rec.setWeights || []).filter((w) => w === rec.maxWeight).length;
        detailsHtml = `
          <div>Sets: ${stripZeros(rec.sets)} → ${pairs || "—"}</div>
          <div>Heaviest: ${stripZeros(rec.maxWeight)}kg${c ? ` × ${stripZeros(c)} set(s)` : ""}</div>
        `;
      }

      const li = document.createElement("li");
      li.innerHTML = `
        <span>
          <strong>${exName}</strong><br>
          Date: ${new Date(rec.date).toLocaleString()}<br>
          ${detailsHtml}
        </span>
        <div class="history-actions">
          <button class="delete-btn" onclick="App.history.deleteRecord('${exName}','${rec.id}')">Delete</button>
        </div>
      `;
      ul.appendChild(li);
    });
  }

  function deleteRecord(exName, recordId) {
    const hist = App.state.userWorkoutData[exName];
    if (!hist) return;
    if (!confirm("Delete this record?")) return;

    hist.records = hist.records.filter((r) => r.id !== recordId);
    if (hist.records.length === 0) {
      delete App.state.userWorkoutData[exName];
    } else {
      const newMax = Math.max(...hist.records.map((r) => r.maxWeight));
      hist.bestWeight = Number.isFinite(newMax) ? newMax : 0;
    }
    App.utils.saveData(App.state.userWorkoutData);
    populateHistoryDropdown();
    const sel = q("#history-select");
    if (App.state.userWorkoutData[exName]) { sel.value = exName; displayExerciseHistory(); }
    else { q("#history-details").style.display = "none"; }
  }

  App.history = { populateHistoryDropdown, displayExerciseHistory, deleteRecord };
})();
