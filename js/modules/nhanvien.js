import { subscribeStaff, getStaff, addStaff, updateStaff, deleteStaff, getSchedules, getAdj, getAdv, getSettings } from "../db.js";
import { esc, formatVND, parseNum, avatarColor, initials, openModal, closeModal, confirm, toast, BANKS, bankName, monthKey, monthRange, monthLabel, calcHours } from "../utils.js";

export function renderNhanVien(container, params) {
  let subs = [];
  const unsub = () => { subs.forEach(u=>u&&u()); subs=[]; };

  // Ẩn nút xuất PNG toàn bộ module nhân viên
  document.getElementById("export-png-btn").style.display="none";
  window._exportFn=null;
  window._exportName=null;

  const initialId = params.get("id");
  if (initialId) showDetail(initialId);
  else showList();

  function showList() {
    unsub();
    container.innerHTML = `
      <div class="subbar">
        <div></div>
        <button class="btn-primary" style="width:auto" id="add-btn">+ Thêm nhân viên</button>
      </div>
      <div class="staff-grid" id="grid"><p style="color:var(--ink-2)">Đang tải...</p></div>
    `;
    document.getElementById("add-btn").onclick = () => openForm();
    subs.push(subscribeStaff(list => renderGrid(list)));
  }

  function renderGrid(list) {
    const grid = document.getElementById("grid");
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = `<p style="color:var(--ink-2)">Chưa có nhân viên. Bấm "+ Thêm nhân viên" để bắt đầu.</p>`;
      return;
    }
    grid.innerHTML = list.map(s => `
      <div class="staff-card" data-id="${s.id}">
        <div class="card-top">
          <div class="avatar" style="background:${avatarColor(s.name)}">${initials(s.name)}</div>
          <div>
            <div class="card-name">${esc(s.name)}</div>
            <div class="card-role">${esc(s.role||"Chưa rõ")}</div>
          </div>
        </div>
        <span class="type-badge ${s.salaryType}">${s.salaryType==="fixed"?"Cố định":"Theo giờ"}</span>
        <div class="card-footer">
          <span>${s.bank?.bankName ? esc(s.bank.bankName)+" ••"+String(s.bank.accountNumber||"").slice(-4) : "Chưa có TK"}</span>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" data-act="edit" data-id="${s.id}">✏️</button>
            <button class="icon-btn" data-act="del"  data-id="${s.id}">🗑️</button>
          </div>
        </div>
      </div>
    `).join("");

    grid.onclick = e => {
      const actBtn = e.target.closest("[data-act]");
      if (actBtn) {
        e.stopPropagation();
        const s = list.find(x=>x.id===actBtn.dataset.id);
        if (actBtn.dataset.act==="edit") openForm(s);
        if (actBtn.dataset.act==="del") {
          confirm(`Xoá nhân viên "${s.name}"?`).then(ok => {
            if (ok) { deleteStaff(s.id); toast("Đã xoá"); }
          });
        }
        return;
      }
      const card = e.target.closest(".staff-card");
      if (card) showDetail(card.dataset.id);
    };
  }

  async function showDetail(id) {
    unsub();
    container.innerHTML = `<p style="color:var(--ink-2)">Đang tải...</p>`;
    const s   = await getStaff(id);
    if (!s) { showList(); return; }
    const cfg = await getSettings();
    const mk  = monthKey(new Date());
    const {start,end} = monthRange(mk);

    let statsHtml = "";
    if (s.salaryType==="hourly") {
      const scheds = await getSchedules(start, end, s.id);
      const hrs   = scheds.reduce((a,sc)=>a+calcHours(sc.startTime,sc.endTime),0);
      const broken= scheds.filter(sc=>sc.isBroken).length;
      const exp   = scheds.reduce((a,sc)=>a+calcHours(sc.startTime,sc.endTime)*(cfg.wageConfig[sc.shiftKey]||0),0);
      statsHtml = `
        <div class="stat-row">
          <div class="stat-card"><span class="stat-label">Giờ làm tháng này</span><span class="stat-value">${hrs.toFixed(1)}h</span></div>
          <div class="stat-card"><span class="stat-label">Lương dự kiến</span><span class="stat-value">${formatVND(exp)}</span></div>
          <div class="stat-card"><span class="stat-label">Ca gãy</span><span class="stat-value ${broken?"stat-warn":""}">${broken}</span></div>
        </div>`;
    } else {
      const adjs = (await getAdj(mk)).filter(a=>a.staffId===s.id);
      const advs = (await getAdv(mk)).filter(a=>a.staffId===s.id);
      const bonus   = adjs.filter(a=>a.type==="bonus").reduce((x,a)=>x+a.amount,0);
      const penalty = adjs.filter(a=>a.type==="penalty").reduce((x,a)=>x+a.amount,0);
      const advance = advs.reduce((x,a)=>x+a.amount,0);
      statsHtml = `
        <div class="stat-row">
          <div class="stat-card"><span class="stat-label">Lương cố định</span><span class="stat-value">${formatVND(s.fixedSalary)}</span></div>
          <div class="stat-card"><span class="stat-label">Thưởng - Phạt</span><span class="stat-value">${formatVND(bonus-penalty)}</span></div>
          <div class="stat-card"><span class="stat-label">Thực lĩnh dự kiến</span><span class="stat-value stat-green">${formatVND((s.fixedSalary||0)+bonus-penalty-advance)}</span></div>
        </div>`;
    }

    container.innerHTML = `
      <button class="back-btn" id="back">← Danh sách</button>
      <div class="card" style="margin-bottom:14px">
        <div class="card-top" style="margin-bottom:14px">
          <div class="avatar" style="width:52px;height:52px;font-size:18px;background:${avatarColor(s.name)}">${initials(s.name)}</div>
          <div>
            <h3 style="font-family:var(--font-mono);font-size:17px;margin-bottom:4px">${esc(s.name)}</h3>
            <span class="type-badge ${s.salaryType}">${s.salaryType==="fixed"?"Lương cố định":"Lương theo giờ"}</span>
          </div>
        </div>
        ${statsHtml}
        <div class="info-grid">
          <div>
            <div class="info-row"><span class="k">Vai trò</span><span class="v">${esc(s.role||"--")}</span></div>
            <div class="info-row"><span class="k">SĐT</span><span class="v">${esc(s.phone||"--")}</span></div>
            <div class="info-row"><span class="k">Ngày vào làm</span><span class="v">${s.startDate||"--"}</span></div>
            ${s.salaryType==="fixed"?`<div class="info-row"><span class="k">Lương/tháng</span><span class="v">${formatVND(s.fixedSalary)}</span></div>`:""}
          </div>
          <div>
            <div class="info-row"><span class="k">Ngân hàng</span><span class="v">${esc(s.bank?.bankName||"--")}</span></div>
            <div class="info-row"><span class="k">Số TK</span><span class="v">${esc(s.bank?.accountNumber||"--")}</span></div>
            <div class="info-row"><span class="k">Chủ TK</span><span class="v">${esc(s.bank?.accountName||"--")}</span></div>
          </div>
        </div>
        ${s.note?`<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:6px;font-size:13.5px">${esc(s.note)}</div>`:""}
        <div class="btn-row" style="margin-top:16px">
          <button class="btn-secondary" id="go-luong">💵 Xem lương tháng này</button>
          <button class="btn-secondary" id="edit-btn">✏️ Chỉnh sửa</button>
        </div>
      </div>
    `;
    document.getElementById("back").onclick  = showList;
    document.getElementById("go-luong").onclick = () => window.go("luong",{staff:s.id});
    document.getElementById("edit-btn").onclick  = () => openForm(s, ()=>showDetail(s.id));
  }

  function openForm(s, onSaved) {
    const editing = !!s;
    const bankOpts = BANKS.map(b=>`<option value="${b.id}" ${s?.bank?.bankId===b.id?"selected":""}>${b.name}</option>`).join("");
    openModal(`
      <button class="modal-close">✕</button>
      <h3 class="modal-title">${editing?"Sửa thông tin":"Thêm nhân viên"}</h3>
      <form id="nv-form">
        <div class="form-group"><label>Họ tên *</label><input id="f-name" value="${esc(s?.name||"")}" required/></div>
        <div class="form-row">
          <div class="form-group"><label>SĐT</label><input id="f-phone" value="${esc(s?.phone||"")}"/></div>
          <div class="form-group"><label>Ngày vào làm</label><input type="date" id="f-date" value="${s?.startDate||""}"/></div>
        </div>
        <div class="form-group"><label>Vai trò</label>
          <input id="f-role" list="roles" value="${esc(s?.role||"")}" placeholder="Phục vụ / Đầu bếp / Tạp vụ..."/>
          <datalist id="roles"><option value="Phục vụ"/><option value="Đầu bếp"/><option value="Tạp vụ"/><option value="Bếp trưởng"/><option value="Phụ bếp"/></datalist>
        </div>
        <div class="form-group"><label>Loại lương *</label>
          <div class="radio-group">
            <label class="radio-label"><input type="radio" name="stype" value="hourly" ${!s||s.salaryType==="hourly"?"checked":""}/> Theo giờ (xếp lịch)</label>
            <label class="radio-label"><input type="radio" name="stype" value="fixed"  ${s?.salaryType==="fixed"?"checked":""}/> Cố định (bếp/tạp vụ)</label>
          </div>
        </div>
        <div class="form-group" id="fixed-wrap" style="${s?.salaryType==="fixed"?"":"display:none"}">
          <label>Lương cố định / tháng</label>
          <input type="text" inputmode="numeric" id="f-fixed" value="${s?.fixedSalary||""}" placeholder="vd: 6000000"/>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Ngân hàng</label>
            <select id="f-bank"><option value="">-- Chọn --</option>${bankOpts}</select>
          </div>
          <div class="form-group"><label>Số tài khoản</label><input id="f-accnum" value="${esc(s?.bank?.accountNumber||"")}"/></div>
        </div>
        <div class="form-group"><label>Tên chủ TK (in hoa)</label>
          <input id="f-accname" value="${esc(s?.bank?.accountName||"")}" placeholder="NGUYEN VAN A"/>
        </div>
        <div class="form-group"><label>Ghi chú</label><textarea id="f-note">${esc(s?.note||"")}</textarea></div>
        <div class="btn-row end">
          <button type="button" class="btn-secondary" id="cancel">Huỷ</button>
          <button type="submit" class="btn-primary" style="width:auto">${editing?"Lưu":"Thêm"}</button>
        </div>
      </form>
    `);
    document.getElementById("cancel").onclick = closeModal;
    document.querySelectorAll("input[name=stype]").forEach(r => {
      r.onchange = () => { document.getElementById("fixed-wrap").style.display = r.value==="fixed"?"":"none"; };
    });
    document.getElementById("nv-form").onsubmit = async e => {
      e.preventDefault();
      const stype   = document.querySelector("input[name=stype]:checked").value;
      const bankId  = document.getElementById("f-bank").value;
      const name    = document.getElementById("f-name").value.trim();
      if (!name) { toast("Nhập họ tên","error"); return; }
      const data = {
        name, phone:document.getElementById("f-phone").value.trim(),
        role:document.getElementById("f-role").value.trim(),
        startDate:document.getElementById("f-date").value||null,
        note:document.getElementById("f-note").value.trim(),
        salaryType:stype,
        fixedSalary:stype==="fixed"?parseNum(document.getElementById("f-fixed").value):0,
        bank:{ bankId, bankName:bankName(bankId),
          accountNumber:document.getElementById("f-accnum").value.trim(),
          accountName:document.getElementById("f-accname").value.trim().toUpperCase() }
      };
      try {
        if (editing) { await updateStaff(s.id,data); toast("Đã lưu"); }
        else         { await addStaff(data);          toast("Đã thêm"); }
        closeModal();
        if (onSaved) onSaved();
      } catch(err) { toast(err.message,"error"); }
    };
  }

  return unsub;
}
