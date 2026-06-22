// ── Format ──
export function formatVND(n) {
  return (Number(n) || 0).toLocaleString("vi-VN") + " đ";
}
export function parseNum(str) {
  return Number(String(str).replace(/[^\d]/g, "")) || 0;
}
export function pad2(n) { return String(n).padStart(2, "0"); }
export function toISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}
export function formatDMY(iso) {
  if (!iso) return "--";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
export function monthKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}`;
}
export function monthLabel(key) {
  const [y,m] = key.split("-");
  return `Tháng ${Number(m)}/${y}`;
}
export function shiftMonth(key, delta) {
  const [y,m] = key.split("-").map(Number);
  const d = new Date(y, m-1+delta, 1);
  return monthKey(d);
}
export function monthRange(key) {
  const [y,m] = key.split("-").map(Number);
  const last  = new Date(y, m, 0).getDate();
  return { start:`${key}-01`, end:`${key}-${pad2(last)}` };
}

// ── Ngày / Tuần ──
const DAY_LABELS = ["CN","T2","T3","T4","T5","T6","T7"];
export function dayLabel(date) { return DAY_LABELS[date.getDay()]; }
export function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate()+n); return d;
}
export function mondayOf(date) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate()+diff); d.setHours(0,0,0,0);
  return d;
}
export function weekDays(anchor) {
  const mon = mondayOf(anchor);
  return Array.from({length:7}, (_,i) => addDays(mon,i));
}
export function weekNum(mon) { return Math.ceil(mon.getDate()/7); }
export function calcHours(start, end) {
  const [sh,sm] = start.split(":").map(Number);
  const [eh,em] = end.split(":").map(Number);
  let h = (eh + em/60) - (sh + sm/60);
  if (h < 0) h += 24;
  return Math.round(h*100)/100;
}

// ── Avatar ──
const AV_COLORS = ["#D98E2B","#3E6E96","#6B4FA0","#3C7A5C","#B23A2E","#8A6B4F","#2B8A7A"];
export function avatarColor(name="") {
  let h = 0;
  for (const c of name) h = (h*31 + c.charCodeAt(0)) % AV_COLORS.length;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
export function initials(name="") {
  const p = name.trim().split(/\s+/);
  return (p.length > 1 ? p[0][0]+p[p.length-1][0] : (p[0]||"?")[0]).toUpperCase();
}

// ── Escape ──
export function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Modal ──
export function openModal(html) {
  const box = document.getElementById("modal-box");
  const bd  = document.getElementById("modal-backdrop");
  box.innerHTML = html;
  bd.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  box.querySelector(".modal-close")?.addEventListener("click", closeModal);
}
export function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("modal-box").innerHTML = "";
  document.body.style.overflow = "";
}
document.getElementById("modal-backdrop")?.addEventListener("click", e => {
  if (e.target === document.getElementById("modal-backdrop")) closeModal();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ── Confirm ──
export function confirm(msg, { btnText="Xoá", danger=true } = {}) {
  return new Promise(resolve => {
    openModal(`
      <p style="font-size:14px;line-height:1.6;margin-bottom:18px;">${esc(msg)}</p>
      <div class="btn-row end">
        <button class="btn-secondary" id="c-no">Huỷ</button>
        <button class="${danger?"btn-danger":"btn-primary"}" id="c-yes" style="${danger?"":"width:auto;"}">${esc(btnText)}</button>
      </div>
    `);
    document.getElementById("c-yes").onclick = () => { closeModal(); resolve(true); };
    document.getElementById("c-no").onclick  = () => { closeModal(); resolve(false); };
  });
}

// ── Toast ──
export function toast(msg, type="info") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(()=>el.remove(), 250); }, 2800);
}

// ── Ngân hàng ──
export const BANKS = [
  {id:"970436",name:"Vietcombank"},{id:"970415",name:"VietinBank"},{id:"970418",name:"BIDV"},
  {id:"970405",name:"Agribank"},{id:"970407",name:"Techcombank"},{id:"970422",name:"MB Bank"},
  {id:"970416",name:"ACB"},{id:"970432",name:"VPBank"},{id:"970403",name:"Sacombank"},
  {id:"970423",name:"TPBank"},{id:"970437",name:"HDBank"},{id:"970443",name:"SHB"},
  {id:"970441",name:"VIB"},{id:"970431",name:"Eximbank"},{id:"970426",name:"MSB"},
  {id:"970429",name:"SCB"},{id:"970440",name:"SeABank"},{id:"970448",name:"OCB"},
  {id:"970449",name:"LPBank"},{id:"970452",name:"KienlongBank"},{id:"970427",name:"VietABank"}
];
export function bankName(id) { return BANKS.find(b=>b.id===id)?.name||""; }
