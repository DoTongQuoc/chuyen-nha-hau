import { subscribeStaff, getStaff, getSchedules, subscribeAdj, getAdj, addAdj, deleteAdj, subscribeAdv, getAdv, addAdv, deleteAdv, subscribeStatus, setStatus, getSettings } from "../db.js";
import { esc, formatVND, parseNum, avatarColor, initials, openModal, closeModal, confirm, toast, monthKey, monthLabel, shiftMonth, monthRange, calcHours } from "../utils.js";

const STATUS_LABEL = { draft:"Chưa chốt", locked:"Đã chốt", paid:"Đã thanh toán" };

export function renderLuong(container, params) {
  let subs=[], month=params.get("month")||monthKey(new Date());
  const unsub=()=>{ subs.forEach(u=>u&&u()); subs=[]; };

  const initialStaff=params.get("staff");
  if(initialStaff) showDetail(initialStaff);
  else showList();

  // ── BẢNG TỔNG HỢP ──
  async function showList() {
    unsub();
    window._exportName=`bang-luong-${month}.png`;
    container.innerHTML=`
      <div class="stat-row" id="stats"></div>
      <div class="subbar">
        <div class="nav-ctrl">
          <button id="prev">←</button>
          <span class="nav-label" id="mlabel"></span>
          <button id="next">→</button>
        </div>
      </div>
      <div class="card"><div class="table-wrap"><table id="tbl">
        <thead><tr><th>Nhân viên</th><th>Loại</th><th class="right">Lương cơ bản</th><th class="right">Thưởng</th><th class="right">Phạt</th><th class="right">Tạm ứng</th><th class="right">Thực lĩnh</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody id="tbody"><tr><td colspan="9" style="color:var(--ink-2)">Đang tính...</td></tr></tbody>
      </table></div></div>
    `;
    wireNav(showList);
    const cfg=await getSettings();
    subs.push(subscribeStaff(async list=>{ await renderTable(list,cfg); }));
    subs.push(subscribeStatus(month, ()=>{ /* re-trigger via staff sub */ }));
  }

  async function renderTable(list, cfg) {
    const tbody=document.getElementById("tbody");
    const stats=document.getElementById("stats");
    if(!tbody||!stats) return;
    document.getElementById("mlabel").textContent=monthLabel(month);
    const {start,end}=monthRange(month);
    const [allScheds,allAdj,allAdv,statusSnap]=await Promise.all([
      getSchedules(start,end), getAdj(month), getAdv(month),
      new Promise(res=>{ const u=subscribeStatus(month,m=>{u();res(m);}); })
    ]);
    let totalNet=0, totalPaid=0, draftCnt=0;
    const rows=list.map(s=>{
      const scheds=allScheds.filter(x=>x.staffId===s.id);
      const adjs  =allAdj.filter(x=>x.staffId===s.id);
      const advs  =allAdv.filter(x=>x.staffId===s.id);
      const base  =s.salaryType==="fixed"?(s.fixedSalary||0):scheds.reduce((a,sc)=>a+calcHours(sc.startTime,sc.endTime)*(cfg.wageConfig[sc.shiftKey]||0),0);
      const bonus  =adjs.filter(a=>a.type==="bonus").reduce((a,x)=>a+x.amount,0);
      const penalty=adjs.filter(a=>a.type==="penalty").reduce((a,x)=>a+x.amount,0);
      const advance=advs.reduce((a,x)=>a+x.amount,0);
      const net=base+bonus-penalty-advance;
      const status=(statusSnap[s.id]||{}).status||"draft";
      totalNet+=net; if(status==="paid")totalPaid+=net; if(status==="draft")draftCnt++;
      return {s,base,bonus,penalty,advance,net,status};
    });
    stats.innerHTML=`
      <div class="stat-card"><span class="stat-label">Tổng quỹ lương</span><span class="stat-value">${formatVND(totalNet)}</span></div>
      <div class="stat-card"><span class="stat-label">Đã thanh toán</span><span class="stat-value stat-green">${formatVND(totalPaid)}</span></div>
      <div class="stat-card"><span class="stat-label">Chưa chốt</span><span class="stat-value ${draftCnt?"stat-warn":""}">${draftCnt} NV</span></div>
    `;
    if(!rows.length){tbody.innerHTML=`<tr><td colspan="9" style="color:var(--ink-2)">Chưa có nhân viên</td></tr>`;return;}
    tbody.innerHTML=rows.map(r=>`
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="width:26px;height:26px;font-size:10px;background:${avatarColor(r.s.name)}">${initials(r.s.name)}</div>
          ${esc(r.s.name)}</div></td>
        <td><span class="type-badge ${r.s.salaryType}">${r.s.salaryType==="fixed"?"Cố định":"Theo giờ"}</span></td>
        <td class="num right">${formatVND(r.base)}</td>
        <td class="num right" style="color:var(--green)">${r.bonus?formatVND(r.bonus):"--"}</td>
        <td class="num right" style="color:var(--red)">${r.penalty?formatVND(r.penalty):"--"}</td>
        <td class="num right">${r.advance?formatVND(r.advance):"--"}</td>
        <td class="num right" style="font-weight:700">${formatVND(r.net)}</td>
        <td><span class="badge ${r.status}">${STATUS_LABEL[r.status]}</span></td>
        <td><button class="btn-secondary btn-sm" data-id="${r.s.id}">Chi tiết</button></td>
      </tr>
    `).join("");
    tbody.querySelectorAll("button[data-id]").forEach(btn=>{btn.onclick=()=>showDetail(btn.dataset.id);});
  }

  // ── CHI TIẾT ──
  async function showDetail(staffId) {
    unsub();
    container.innerHTML=`<p style="color:var(--ink-2)">Đang tải...</p>`;
    const [s,cfg]=await Promise.all([getStaff(staffId),getSettings()]);
    if(!s){showList();return;}
    await buildDetail(s,cfg);
  }

  async function buildDetail(s, cfg) {
    const {start,end}=monthRange(month);
    const scheds=s.salaryType==="hourly"?await getSchedules(start,end,s.id):[];
    const base=s.salaryType==="fixed"?(s.fixedSalary||0):scheds.reduce((a,sc)=>a+calcHours(sc.startTime,sc.endTime)*(cfg.wageConfig[sc.shiftKey]||0),0);
    const totalH=scheds.reduce((a,sc)=>a+calcHours(sc.startTime,sc.endTime),0);
    window._exportName=`phieu-luong-${s.name.replace(/\s+/g,"-")}-${month}.png`;

    container.innerHTML=`
      <button class="back-btn" id="back">← Bảng lương</button>
      <div class="subbar" style="margin-bottom:14px">
        <div class="nav-ctrl"><button id="prev">←</button><span class="nav-label" id="mlabel">${monthLabel(month)}</span><button id="next">→</button></div>
      </div>
      <div class="card" id="detail-card">
        <div class="card-top" style="margin-bottom:14px">
          <div class="avatar" style="width:48px;height:48px;font-size:17px;background:${avatarColor(s.name)}">${initials(s.name)}</div>
          <div>
            <h3 style="font-family:var(--font-mono);font-size:16px;margin-bottom:4px">${esc(s.name)}</h3>
            <span class="type-badge ${s.salaryType}">${s.salaryType==="fixed"?"Lương cố định":"Lương theo giờ"}</span>
            <span class="badge draft" id="status-badge" style="margin-left:8px"></span>
          </div>
        </div>
        <div class="salary-wrap">
          <div class="salary-item"><span class="k">Lương cơ bản</span><span class="v">${formatVND(base)}</span></div>
          ${s.salaryType==="hourly"?`<div class="salary-item"><span class="k">Tổng giờ làm</span><span class="v">${totalH.toFixed(1)}h</span></div>`:""}
          <div class="salary-item"><span class="k">Thưởng</span><span class="v" id="sum-bonus" style="color:var(--green)">--</span></div>
          <div class="salary-item"><span class="k">Phạt</span><span class="v" id="sum-penalty" style="color:var(--red)">--</span></div>
          <div class="salary-item"><span class="k">Tạm ứng</span><span class="v" id="sum-adv">--</span></div>
          <div class="salary-item"><span class="k">✦ Thực lĩnh</span><span class="v" id="sum-net" style="font-size:20px">--</span></div>
        </div>
        ${s.salaryType==="hourly"?`<button class="btn-secondary btn-sm" id="view-sched" style="margin-top:8px">📅 Xem giờ làm chi tiết</button>`:""}
        <div class="btn-row" id="status-actions" style="margin-top:14px"></div>
      </div>

      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h4 class="card-title" style="margin:0">🎁 Thưởng / Phạt</h4>
          <button class="btn-secondary btn-sm" id="add-adj">+ Thêm</button>
        </div>
        <div id="adj-list"><p style="color:var(--ink-2);font-size:13px">Chưa có</p></div>
      </div>

      <div class="card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h4 class="card-title" style="margin:0">💵 Tạm ứng</h4>
          <button class="btn-secondary btn-sm" id="add-adv">+ Thêm</button>
        </div>
        <div id="adv-list"><p style="color:var(--ink-2);font-size:13px">Chưa có</p></div>
      </div>

      <div class="card" style="margin-top:12px" id="qr-card"></div>
    `;

    document.getElementById("back").onclick=showList;
    document.getElementById("view-sched")?.addEventListener("click",()=>window.go("lich",{staff:s.id,date:start}));
    wireNav(()=>buildDetail(s,cfg));

    let curAdj=[], curAdv=[], curStatus="draft", curStatusDoc={};

    function renderStatusUI(net) {
      const badge=document.getElementById("status-badge");
      const actions=document.getElementById("status-actions");
      if(!badge||!actions) return;
      badge.className=`badge ${curStatus}`;
      badge.textContent=STATUS_LABEL[curStatus];
      const locked=curStatus!=="draft";
      document.getElementById("add-adj").disabled=locked;
      document.getElementById("add-adv").disabled=locked;
      if(curStatus==="draft") {
        actions.innerHTML=`<button class="btn-primary" style="width:auto" id="lock-btn">🔒 Chốt lương</button>`;
        document.getElementById("lock-btn").onclick=async()=>{
          if(await confirm("Chốt lương tháng này? Không thể sửa thêm sau khi chốt.",{btnText:"Chốt lương",danger:false})){
            await setStatus(s.id,month,"locked"); toast("Đã chốt lương");
          }
        };
      } else if(curStatus==="locked") {
        actions.innerHTML=`
          <button class="btn-secondary" id="reopen-btn">↩ Mở lại</button>
          <button class="btn-green" id="paid-btn">✅ Đã thanh toán</button>
        `;
        document.getElementById("reopen-btn").onclick=async()=>{ await setStatus(s.id,month,"draft"); toast("Đã mở lại"); };
        document.getElementById("paid-btn").onclick=async()=>{ await setStatus(s.id,month,"paid",{paidAt:new Date().toISOString()}); toast("Đã đánh dấu thanh toán"); };
      } else {
        const d=curStatusDoc.paidAt?new Date(curStatusDoc.paidAt).toLocaleDateString("vi-VN"):"--";
        actions.innerHTML=`
          <span style="color:var(--green);font-size:13px">✅ Đã thanh toán ngày ${d}</span>
          <button class="btn-secondary btn-sm" id="reopen-paid-btn">↩ Mở lại</button>
        `;
        document.getElementById("reopen-paid-btn").onclick=async()=>{
          if(await confirm("Mở lại phiếu lương? Trạng thái sẽ về Đã chốt.",{btnText:"Mở lại",danger:false})){
            await setStatus(s.id,month,"locked"); toast("Đã mở lại");
          }
        };
      }
    }

    function renderQR(net) {
      const qr=document.getElementById("qr-card");
      if(!qr) return;
      if(!s.bank?.bankId||!s.bank?.accountNumber) {
        qr.innerHTML=`<h4 class="card-title">💳 Chuyển khoản</h4><p style="color:var(--ink-2);font-size:13px">Chưa có thông tin ngân hàng.</p>`;
        return;
      }
      const [y,m_]=month.split("-");
      const info=encodeURIComponent(`Luong thang ${m_}/${y} ${s.name}`);
      const aname=encodeURIComponent(s.bank.accountName||"");
      const amount=Math.max(0,Math.round(net));
      const url=`https://img.vietqr.io/image/${s.bank.bankId}-${s.bank.accountNumber}-compact.png?amount=${amount}&addInfo=${info}&accountName=${aname}`;
      qr.innerHTML=`
        <h4 class="card-title">💳 Chuyển khoản</h4>
        <div class="qr-wrap">
          <img src="${url}" alt="QR" crossorigin="anonymous"/>
          <div class="qr-info"><strong>${esc(s.bank.bankName)}</strong> — ${esc(s.bank.accountNumber)}</div>
          <div style="font-size:12px;color:var(--ink-2)">${esc(s.bank.accountName)}</div>
          <div class="qr-amount">${formatVND(net)}</div>
          <div class="copy-row">
            <button class="btn-secondary btn-sm" id="cp-stk">📋 Copy STK</button>
            <button class="btn-secondary btn-sm" id="cp-amt">📋 Copy số tiền</button>
          </div>
        </div>
      `;
      document.getElementById("cp-stk").onclick=()=>{ navigator.clipboard.writeText(s.bank.accountNumber); toast("Đã copy STK"); };
      document.getElementById("cp-amt").onclick=()=>{ navigator.clipboard.writeText(String(amount)); toast("Đã copy số tiền"); };
    }

    function renderAdjList() {
      const el=document.getElementById("adj-list");
      if(!el) return;
      if(!curAdj.length){el.innerHTML=`<p style="color:var(--ink-2);font-size:13px">Chưa có thưởng/phạt</p>`;return;}
      const locked=curStatus!=="draft";
      el.innerHTML=curAdj.map(a=>`
        <div class="adj-row">
          <div>
            <span class="adj-amt ${a.type}">${a.type==="bonus"?"+":"-"}${formatVND(a.amount)}</span>
            <div class="reason">${esc(a.reason||"")}</div>
          </div>
          ${locked?"":`<button class="icon-btn" data-id="${a.id}">🗑️</button>`}
        </div>
      `).join("");
      el.querySelectorAll("button[data-id]").forEach(btn=>{
        btn.onclick=async()=>{ if(await confirm("Xoá khoản này?")){ await deleteAdj(btn.dataset.id); toast("Đã xoá"); } };
      });
    }

    function renderAdvList() {
      const el=document.getElementById("adv-list");
      if(!el) return;
      if(!curAdv.length){el.innerHTML=`<p style="color:var(--ink-2);font-size:13px">Chưa có tạm ứng</p>`;return;}
      const locked=curStatus!=="draft";
      el.innerHTML=curAdv.map(a=>`
        <div class="adj-row">
          <div>
            <span class="adj-amt penalty">-${formatVND(a.amount)}</span>
            <div class="reason">${a.date||""} ${a.note?`· ${esc(a.note)}`:""}</div>
          </div>
          ${locked?"":`<button class="icon-btn" data-id="${a.id}">🗑️</button>`}
        </div>
      `).join("");
      el.querySelectorAll("button[data-id]").forEach(btn=>{
        btn.onclick=async()=>{ if(await confirm("Xoá tạm ứng này?")){ await deleteAdv(btn.dataset.id); toast("Đã xoá"); } };
      });
    }

    document.getElementById("add-adj").onclick=()=>{
      if(curStatus!=="draft"){toast("Lương đã chốt","error");return;}
      openModal(`
        <button class="modal-close">✕</button>
        <h3 class="modal-title">Thêm thưởng / phạt</h3>
        <form id="adj-form">
          <div class="form-group"><label>Loại</label>
            <div class="radio-group">
              <label class="radio-label"><input type="radio" name="atype" value="bonus" checked/> Thưởng / Tip</label>
              <label class="radio-label"><input type="radio" name="atype" value="penalty"/> Phạt</label>
            </div>
          </div>
          <div class="form-group"><label>Số tiền</label><input type="text" inputmode="numeric" id="f-amt" required placeholder="vd: 100000"/></div>
          <div class="form-group"><label>Lý do</label><input type="text" id="f-reason" placeholder="vd: thưởng chuyên cần, tip bàn 5..."/></div>
          <div class="btn-row end">
            <button type="button" class="btn-secondary" id="cancel">Huỷ</button>
            <button type="submit" class="btn-primary" style="width:auto">Thêm</button>
          </div>
        </form>
      `);
      document.getElementById("cancel").onclick=closeModal;
      document.getElementById("adj-form").onsubmit=async e=>{
        e.preventDefault();
        const type=document.querySelector("input[name=atype]:checked").value;
        const amount=parseNum(document.getElementById("f-amt").value);
        const reason=document.getElementById("f-reason").value.trim();
        if(!amount){toast("Nhập số tiền","error");return;}
        try{await addAdj({staffId:s.id,month,type,amount,reason});toast("Đã thêm");closeModal();}
        catch(err){toast(err.message,"error");}
      };
    };

    document.getElementById("add-adv").onclick=()=>{
      if(curStatus!=="draft"){toast("Lương đã chốt","error");return;}
      openModal(`
        <button class="modal-close">✕</button>
        <h3 class="modal-title">Thêm tạm ứng</h3>
        <form id="adv-form">
          <div class="form-group"><label>Số tiền</label><input type="text" inputmode="numeric" id="f-amt" required/></div>
          <div class="form-group"><label>Ngày ứng</label><input type="date" id="f-date" value="${new Date().toISOString().slice(0,10)}"/></div>
          <div class="form-group"><label>Ghi chú</label><input type="text" id="f-note"/></div>
          <div class="btn-row end">
            <button type="button" class="btn-secondary" id="cancel">Huỷ</button>
            <button type="submit" class="btn-primary" style="width:auto">Thêm</button>
          </div>
        </form>
      `);
      document.getElementById("cancel").onclick=closeModal;
      document.getElementById("adv-form").onsubmit=async e=>{
        e.preventDefault();
        const amount=parseNum(document.getElementById("f-amt").value);
        if(!amount){toast("Nhập số tiền","error");return;}
        try{await addAdv({staffId:s.id,month,amount,date:document.getElementById("f-date").value,note:document.getElementById("f-note").value.trim()});toast("Đã thêm tạm ứng");closeModal();}
        catch(err){toast(err.message,"error");}
      };
    };

    // ── Xuất phiếu lương riêng ──
    function setupExport(getNet) {
      window._exportFn = async () => {
        const net = getNet();
        const [y,m_]=month.split("-");
        const adjs = curAdj;
        const advs = curAdv;
        const bonus   = adjs.filter(a=>a.type==="bonus").reduce((x,a)=>x+a.amount,0);
        const penalty = adjs.filter(a=>a.type==="penalty").reduce((x,a)=>x+a.amount,0);
        const advance = advs.reduce((x,a)=>x+a.amount,0);

        // Tạo QR url
        let qrHtml = "";
        if (s.bank?.bankId && s.bank?.accountNumber) {
          const info=encodeURIComponent(`Luong thang ${m_}/${y} ${s.name}`);
          const aname=encodeURIComponent(s.bank.accountName||"");
          const amount=Math.max(0,Math.round(net));
          const url=`https://img.vietqr.io/image/${s.bank.bankId}-${s.bank.accountNumber}-compact.png?amount=${amount}&addInfo=${info}&accountName=${aname}`;
          qrHtml=`<img src="${url}" crossorigin="anonymous" style="width:140px;height:140px;display:block;margin:10px auto 0"/>`;
        }

        const adjRows = adjs.map(a=>`
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #ddd;font-size:12px">
            <span>${esc(a.reason||a.type)}</span>
            <span style="color:${a.type==="bonus"?"#3C7A5C":"#B23A2E"}">${a.type==="bonus"?"+":"-"}${formatVND(a.amount)}</span>
          </div>`).join("");

        const advRows = advs.map(a=>`
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #ddd;font-size:12px">
            <span>${a.date||""} ${esc(a.note||"")}</span>
            <span style="color:#B23A2E">-${formatVND(a.amount)}</span>
          </div>`).join("");

        // Tạo div ẩn để chụp
        const el = document.createElement("div");
        el.style.cssText="position:fixed;left:-9999px;top:0;background:#fff;width:420px;padding:28px;font-family:Inter,sans-serif;color:#1F1B16;";
        el.innerHTML=`
          <div style="border-bottom:2px solid #1F1B16;padding-bottom:10px;margin-bottom:14px">
            <div style="font-size:11px;letter-spacing:.08em;color:#6B6258;margin-bottom:4px">CHUYỆN NHÀ HÀU · PHIẾU LƯƠNG</div>
            <div style="font-size:18px;font-weight:700;font-family:'Space Mono',monospace">${esc(s.name)}</div>
            <div style="font-size:12px;color:#6B6258;margin-top:2px">${monthLabel(month)} · ${s.salaryType==="fixed"?"Lương cố định":"Lương theo giờ"}</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:#F7F5F0;border-radius:8px;padding:10px">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6B6258;margin-bottom:4px">Lương cơ bản</div>
              <div style="font-size:16px;font-weight:700;font-family:'Space Mono',monospace">${formatVND(base)}</div>
            </div>
            <div style="background:#F7F5F0;border-radius:8px;padding:10px">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6B6258;margin-bottom:4px">Thực lĩnh</div>
              <div style="font-size:16px;font-weight:700;font-family:'Space Mono',monospace;color:#3C7A5C">${formatVND(net)}</div>
            </div>
          </div>

          ${adjs.length?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Thưởng / Phạt</div>${adjRows}</div>`:""}
          ${advs.length?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Tạm ứng</div>${advRows}</div>`:""}

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;padding:10px 0;border-top:1px dashed #ddd;border-bottom:1px dashed #ddd;margin-bottom:14px">
            <div><div style="color:#6B6258">Thưởng</div><div style="color:#3C7A5C;font-weight:600">${formatVND(bonus)}</div></div>
            <div><div style="color:#6B6258">Phạt</div><div style="color:#B23A2E;font-weight:600">${formatVND(penalty)}</div></div>
            <div><div style="color:#6B6258">Tạm ứng</div><div style="font-weight:600">${formatVND(advance)}</div></div>
          </div>

          ${s.bank?.accountNumber?`
          <div style="font-size:12px;margin-bottom:6px">
            <strong>${esc(s.bank.bankName)}</strong> · ${esc(s.bank.accountNumber)}<br/>
            <span style="color:#6B6258">${esc(s.bank.accountName)}</span>
          </div>`:""}
          ${qrHtml}

          <div style="margin-top:14px;font-size:10px;color:#A39B8C;text-align:center">
            Xuất ngày ${new Date().toLocaleDateString("vi-VN")}
          </div>
        `;
        document.body.appendChild(el);

        // Đợi QR load
        const img = el.querySelector("img");
        if (img) await new Promise(res=>{ img.onload=res; img.onerror=res; setTimeout(res,3000); });

        const canvas = await html2canvas(el, {backgroundColor:"#fff",useCORS:true,scale:2});
        document.body.removeChild(el);
        const blob = await new Promise(r=>canvas.toBlob(r));
        const file = new File([blob], window._exportName||"phieu-luong.png", {type:"image/png"});
        const mob  = /iPhone|iPad|Android/i.test(navigator.userAgent);
        if (mob && navigator.canShare?.({files:[file]})) { await navigator.share({files:[file]}); }
        else { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=file.name; a.click(); }
      };
    }

    // Gọi setupExport, truyền getter để lấy net mới nhất
    let _lastNet = base;
    setupExport(() => _lastNet);

    // Hàm recompute chính
    function recompute() {
      const bonus  =curAdj.filter(a=>a.type==="bonus").reduce((x,a)=>x+a.amount,0);
      const penalty=curAdj.filter(a=>a.type==="penalty").reduce((x,a)=>x+a.amount,0);
      const advance=curAdv.reduce((x,a)=>x+a.amount,0);
      const net=base+bonus-penalty-advance;
      _lastNet = net;
      const el=id=>document.getElementById(id);
      if(el("sum-bonus"))   el("sum-bonus").textContent  =formatVND(bonus);
      if(el("sum-penalty")) el("sum-penalty").textContent=formatVND(penalty);
      if(el("sum-adv"))     el("sum-adv").textContent    =formatVND(advance);
      if(el("sum-net"))     el("sum-net").textContent    =formatVND(net);
      renderStatusUI(net);
      renderQR(net);
    }
    subs.push(subscribeAdj(s.id,month,list=>{curAdj=list;renderAdjList();recompute();}));
    subs.push(subscribeAdv(s.id,month,list=>{curAdv=list;renderAdvList();recompute();}));
    subs.push(subscribeStatus(month,map=>{
      curStatusDoc=map[s.id]||{};curStatus=curStatusDoc.status||"draft";recompute();
    }));
  }

  function wireNav(refreshFn) {
    const lbl=document.getElementById("mlabel");
    if(lbl) lbl.textContent=monthLabel(month);
    document.getElementById("prev")?.addEventListener("click",()=>{month=shiftMonth(month,-1);refreshFn();});
    document.getElementById("next")?.addEventListener("click",()=>{month=shiftMonth(month,1);refreshFn();});
  }

  return unsub;
}
