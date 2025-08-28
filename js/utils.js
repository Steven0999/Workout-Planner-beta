/* ======================================
   utils.js — small helpers & guards
====================================== */
window.addEventListener("error", (e) => console.error("[JS Error]", e.error || e.message));

window.HOME_EQUIPMENT = ["body weight", "resistance bands", "kettlebell"];
window.CATEGORY_WHITELIST = new Set([
  "upper body", "lower body", "push", "pull", "hinge", "squat", "full body", "core", "specific muscle"
]);

window.uniq = (a) => [...new Set(a)];
window.title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
window.toInt = (v, f = 0) => Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : f;
window.toFloat = (v, f = 0) => Number.isFinite(parseFloat(v)) ? parseFloat(v) : f;
window.nowIsoMinute = () => new Date().toISOString().slice(0, 16);
window.isoToLocalString = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
window.normalizeCategory = (c0) => {
  const c = String(c0 || "").toLowerCase().trim();
  if (c === "upper") return "upper body";
  if (c === "lower" || c === "legs") return "lower body";
  return c;
};
window.fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
window.fmtDelta = (d) => {
  if (d == null) return "—";
  const dd = Number(d.toFixed(2));
  if (dd > 0) return `▲ +${dd}kg`;
  if (dd < 0) return `▼ ${Math.abs(dd)}kg`;
  return `= 0kg`;
};
