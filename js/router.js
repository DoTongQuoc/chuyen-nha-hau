import { renderNhanVien } from "./modules/nhanvien.js";
import { renderLich }     from "./modules/lich.js";
import { renderLuong }    from "./modules/luong.js";
import { renderCaiDat }   from "./modules/caidat.js";

const ROUTES = {
  lich:      { title:"Xếp Lịch",   render:renderLich },
  luong:     { title:"Tính Lương",  render:renderLuong },
  nhanvien:  { title:"Nhân Viên",   render:renderNhanVien },
  caidat:    { title:"Cài Đặt",     render:renderCaiDat }
};

const content   = document.getElementById("page-content");
const titleEl   = document.getElementById("page-title");
const navLinks  = document.querySelectorAll(".nav-link");
const exportBtn = document.getElementById("export-png-btn");

let cleanup = null;

function routeKey() {
  const key = (location.hash||"#lich").replace("#","").split("?")[0];
  return ROUTES[key] ? key : "lich";
}
function routeParams() {
  const [,q] = location.hash.split("?");
  return new URLSearchParams(q||"");
}

export function go(route, params={}) {
  const qs = new URLSearchParams(params).toString();
  location.hash = qs ? `#${route}?${qs}` : `#${route}`;
}

function render() {
  if (typeof cleanup==="function") { try { cleanup(); } catch{} }
  cleanup = null;

  const key    = routeKey();
  const route  = ROUTES[key];
  const params = routeParams();

  titleEl.textContent = route.title;
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.route===key));
  document.getElementById("sidebar").classList.remove("open");

  // Reset export button — mỗi module tự ẩn nếu cần
  exportBtn.style.display = "";
  window._exportName = null;
  window._exportFn   = null;
  window._exportEl   = null;

  content.classList.remove("fade-in");
  void content.offsetWidth;
  content.classList.add("fade-in");

  const result = route.render(content, params);
  if (typeof result==="function") cleanup = result;
}

window.addEventListener("hashchange", render);
window.addEventListener("app:ready", render);
window.go = go;
