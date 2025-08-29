(function () {
  const App = (window.App = window.App || {});

  // Shortcuts
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Formatting & numbers
  const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const toInt = (v, f = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : f;
  };
  const toFloat = (v, f = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : f;
  };
  const nowIsoMinute = () => new Date().toISOString().slice(0, 16);
  const isoToLocalString = (iso) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
  };
  const stripZeros = (n) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return n;
    const s = String(n);
    return s.includes(".")
      ? s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
      : s;
  };

  // DOM
  function setOptions(selectEl, arr, mapFn) {
    const el = typeof selectEl === "string" ? q(selectEl) : selectEl;
    if (!el) return;
    const html = (arr || [])
      .map((v) => {
        let value = v, text = v;
        if (mapFn) ({ value, text } = mapFn(v));
        return `<option value="${String(value).replace(/"/g, "&quot;")}">${String(text).replace(/</g,"&lt;")}</option>`;
      })
      .join("");
    el.innerHTML = html;
  }

  // Storage
  function loadData() {
    try {
      return JSON.parse(localStorage.getItem("userWorkoutData")) || {};
    } catch {
      return {};
    }
  }
  function saveData(obj) {
    localStorage.setItem("userWorkoutData", JSON.stringify(obj || {}));
  }

  // Expose
  App.utils = {
    q, qa, setOptions, title, toInt, toFloat, nowIsoMinute, isoToLocalString, stripZeros,
    loadData, saveData
  };
})();
