import "./auth.js";
import "./router.js";

// Xuất PNG
async function exportPNG(elId, filename) {
  const el = document.getElementById(elId);
  if (!el) return;
  const canvas = await html2canvas(el, { backgroundColor:"#EDEAE3", useCORS:true });
  const blob   = await new Promise(r => canvas.toBlob(r));
  const file   = new File([blob], filename, {type:"image/png"});
  const mob    = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (mob && navigator.canShare?.({files:[file]})) {
    await navigator.share({files:[file]});
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
}

document.getElementById("export-png-btn").addEventListener("click", async () => {
  const key  = (location.hash||"#lich").replace("#","").split("?")[0];
  const name = window._exportName || `${key}-${new Date().toLocaleDateString("vi-VN").replace(/\//g,"-")}.png`;

  // Phiếu lương: module tự tạo layout riêng để xuất
  if (typeof window._exportFn === "function") {
    await window._exportFn();
    return;
  }
  // Các trang khác: xuất element cụ thể hoặc fallback page-content
  exportPNG(window._exportEl || "page-content", name);
});

document.getElementById("menu-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// Đóng sidebar khi bấm ngoài (mobile)
document.addEventListener("click", e => {
  const sb = document.getElementById("sidebar");
  if (sb.classList.contains("open") && !sb.contains(e.target) && e.target.id!=="menu-toggle") {
    sb.classList.remove("open");
  }
});
