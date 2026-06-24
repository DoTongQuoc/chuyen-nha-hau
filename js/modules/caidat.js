import { subscribeSettings, updateSettings } from "../db.js";
import { esc, parseNum, toast } from "../utils.js";
import { auth } from "../firebase-config.js";
import { updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider }
  from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

export function renderCaiDat(container) {
  // Ẩn nút xuất PNG ở module cài đặt
  document.getElementById("export-png-btn").style.display="none";
  window._exportFn=null;
  window._exportName=null;

  container.innerHTML = `<p style="color:var(--ink-2)">Đang tải...</p>`;
  const unsub = subscribeSettings(s => buildUI(s));

  function shiftRow(key, s) {
    const c=s.caConfig[key]; const w=s.wageConfig[key];
    return `
      <div style="display:grid;grid-template-columns:1.1fr 0.8fr 0.8fr 0.7fr 1fr;gap:8px;align-items:end;margin-bottom:10px">
        <div class="form-group" style="margin:0"><label>Tên ca</label><input id="s-${key}-name" value="${esc(c.name)}"/></div>
        <div class="form-group" style="margin:0"><label>Bắt đầu</label><input type="time" id="s-${key}-start" value="${c.start}"/></div>
        <div class="form-group" style="margin:0"><label>Kết thúc</label><input type="time" id="s-${key}-end" value="${c.end}"/></div>
        <div class="form-group" style="margin:0"><label>Tối thiểu</label><input type="number" min="0" id="s-${key}-min" value="${c.minStaff}"/></div>
        <div class="form-group" style="margin:0"><label>Giá/giờ (đ)</label><input type="text" inputmode="numeric" id="s-${key}-wage" value="${w}"/></div>
      </div>`;
  }

  function buildUI(s) {
    container.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <h3 class="card-title">🏪 Thông tin quán</h3>
        <div class="form-row">
          <div class="form-group"><label>Tên quán</label><input id="s-shopname" value="${esc(s.shopInfo.name)}"/></div>
          <div class="form-group"><label>SĐT</label><input id="s-phone" value="${esc(s.shopInfo.phone)}"/></div>
        </div>
        <div class="form-group"><label>Địa chỉ</label><input id="s-address" value="${esc(s.shopInfo.address)}"/></div>
        <div class="form-group">
          <label>Logo quán</label>
          <input type="file" id="s-logo" accept="image/*"/>
          <div id="logo-preview" style="margin-top:8px">${s.shopInfo.logo?`<img src="${s.shopInfo.logo}" style="height:48px;border-radius:6px"/>`:"Chưa có logo"}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <h3 class="card-title">⏰ Ca làm việc &amp; Đơn giá</h3>
        ${shiftRow("sang",s)}
        ${shiftRow("chieu",s)}
        ${shiftRow("toi",s)}
        <p class="form-hint">Đơn giá chỉ áp dụng cho nhân viên theo giờ (phục vụ).</p>
      </div>

      <div class="card" style="margin-bottom:14px">
        <h3 class="card-title">🖼 Tuỳ chọn xuất phiếu lương</h3>
        <label class="check-label"><input type="checkbox" id="s-showlogo" ${s.exportConfig.showLogo?"checked":""}/> Hiện logo trên phiếu lương</label>
        <label class="check-label"><input type="checkbox" id="s-showbank" ${s.exportConfig.showBankInfo?"checked":""}/> Hiện số TK &amp; QR chuyển khoản trên phiếu lương</label>
      </div>

      <button class="btn-primary" style="width:auto;padding:11px 28px;margin-bottom:24px" id="save-btn">💾 Lưu cài đặt</button>

      <div class="card">
        <h3 class="card-title">🔒 Tài khoản</h3>
        <p style="color:var(--ink-2);font-size:13px;margin-bottom:16px">Email: <strong>${esc(auth.currentUser?.email||"")}</strong></p>

        <details style="margin-bottom:12px">
          <summary style="cursor:pointer;font-weight:600;font-size:13.5px;padding:4px 0">Đổi mật khẩu</summary>
          <div style="padding-top:12px;max-width:300px">
            <div class="form-group"><label>Mật khẩu hiện tại</label><input type="password" id="pw-cur"/></div>
            <div class="form-group"><label>Mật khẩu mới (≥6 ký tự)</label><input type="password" id="pw-new"/></div>
            <button class="btn-secondary" id="change-pw">Đổi mật khẩu</button>
          </div>
        </details>

        <details>
          <summary style="cursor:pointer;font-weight:600;font-size:13.5px;padding:4px 0">Đổi email</summary>
          <div style="padding-top:12px;max-width:300px">
            <div class="form-group"><label>Mật khẩu hiện tại</label><input type="password" id="em-cur"/></div>
            <div class="form-group"><label>Email mới</label><input type="email" id="em-new"/></div>
            <button class="btn-secondary" id="change-em">Đổi email</button>
          </div>
        </details>
      </div>
    `;

    // Logo preview
    document.getElementById("s-logo").onchange = e => {
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const p = document.getElementById("logo-preview");
        p.innerHTML = `<img src="${reader.result}" style="height:48px;border-radius:6px"/>`;
        p.dataset.v = reader.result;
      };
      reader.readAsDataURL(file);
    };

    // Lưu
    document.getElementById("save-btn").onclick = async () => {
      const g = id => document.getElementById(id).value.trim();
      const data = {
        shopInfo: {
          name:    g("s-shopname"),
          phone:   g("s-phone"),
          address: g("s-address"),
          logo:    document.getElementById("logo-preview").dataset.v || s.shopInfo.logo || ""
        },
        caConfig: {
          sang:  {name:g("s-sang-name"),  start:g("s-sang-start"),  end:g("s-sang-end"),  minStaff:Number(g("s-sang-min"))||0},
          chieu: {name:g("s-chieu-name"), start:g("s-chieu-start"), end:g("s-chieu-end"), minStaff:Number(g("s-chieu-min"))||0},
          toi:   {name:g("s-toi-name"),   start:g("s-toi-start"),   end:g("s-toi-end"),   minStaff:Number(g("s-toi-min"))||0}
        },
        wageConfig: {
          sang:  parseNum(g("s-sang-wage")),
          chieu: parseNum(g("s-chieu-wage")),
          toi:   parseNum(g("s-toi-wage"))
        },
        exportConfig: {
          showLogo:     document.getElementById("s-showlogo").checked,
          showBankInfo: document.getElementById("s-showbank").checked
        }
      };
      try { await updateSettings(data); toast("Đã lưu cài đặt","success"); }
      catch(err) { toast(err.message,"error"); }
    };

    // Đổi mật khẩu
    document.getElementById("change-pw").onclick = async () => {
      const cur = document.getElementById("pw-cur").value;
      const nxt = document.getElementById("pw-new").value;
      if(!cur||!nxt){ toast("Nhập đủ thông tin","error"); return; }
      if(nxt.length<6){ toast("Mật khẩu mới cần ≥ 6 ký tự","error"); return; }
      try {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, cur);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updatePassword(auth.currentUser, nxt);
        toast("Đã đổi mật khẩu","success");
        document.getElementById("pw-cur").value="";
        document.getElementById("pw-new").value="";
      } catch { toast("Sai mật khẩu hiện tại","error"); }
    };

    // Đổi email
    document.getElementById("change-em").onclick = async () => {
      const cur = document.getElementById("em-cur").value;
      const nem = document.getElementById("em-new").value.trim();
      if(!cur||!nem){ toast("Nhập đủ thông tin","error"); return; }
      try {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, cur);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updateEmail(auth.currentUser, nem);
        toast("Đã đổi email","success");
        document.getElementById("em-cur").value="";
        document.getElementById("em-new").value="";
      } catch { toast("Sai mật khẩu hoặc email không hợp lệ","error"); }
    };
  }

  return () => unsub();
}
