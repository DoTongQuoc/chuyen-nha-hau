import { subscribeSettings, subscribeStaff, subscribeSchedules, addSchedule, updateSchedule, deleteSchedule } from "../db.js";
import { esc, toast, openModal, closeModal, confirm, weekDays, mondayOf, addDays, dayLabel, pad2, weekNum, calcHours, toISO } from "../utils.js";

const SHIFTS = ["sang","chieu","toi"];

export function renderLich(container, params) {
  let subs = [], schedSub = null;
  const unsub = () => { subs.forEach(u=>u&&u()); subs=[]; schedSub&&schedSub(); };

  let settings = null, staffList = [], schedules = [];
  let anchor = params.get("date") ? new Date(params.get("date")) : new Date();
  let staffFilter = params.get("staff") || null;
  let highlight = null;

  const mon  = () => mondayOf(anchor);
  const days = () => weekDays(anchor);
  const range= () => ({ start:toISO(days()[0]), end:toISO(days()[6]) });

  // ── Shell ──
  container.innerHTML = `
    ${staffFilter?`<div class="filter-pill" style="margin-bottom:12px">Đang lọc 1 nhân viên <button id="clear-filter">✕</button></div>`:""}
    <div class="stat-row" id="stats"></div>
    <div id="warns"></div>
    <div class="subbar">
      <div class="nav-ctrl">
        <button id="prev">←</button>
        <span class="nav-label" id="wlabel"></span>
        <button id="next">→</button>
      </div>
      <button class="btn-secondary btn-sm" id="today-btn">Tuần này</button>
    </div>
    <div class="card" id="sched-card" style="padding:12px">
      <div class="schedule-wrap"><div class="schedule-grid" id="sgrid"></div></div>
    </div>
  `;

  document.getElementById("prev").onclick  = () => { anchor=addDays(mon(),-7); highlight=null; resubSched(); };
  document.getElementById("next").onclick  = () => { anchor=addDays(mon(),7);  highlight=null; resubSched(); };
  document.getElementById("today-btn").onclick = () => { anchor=new Date(); highlight=null; resubSched(); };
  document.getElementById("clear-filter")?.addEventListener("click", ()=>window.go("lich"));

  // ── Subscriptions ──
  subs.push(subscribeSettings(s=>{settings=s; renderAll();}));
  subs.push(subscribeStaff(list=>{staffList=list.filter(s=>s.salaryType==="hourly"); renderAll();}));
  resubSched();

  function resubSched() {
    schedSub && schedSub();
    const {start,end} = range();
    schedSub = subscribeSchedules(start, end, list=>{schedules=list; renderAll();});
  }

  function renderAll() { renderStats(); renderGrid(); }

  function renderStats() {
    const el = document.getElementById("stats");
    const wl = document.getElementById("wlabel");
    if (!el || !settings) return;
    const ds = days();
    let totalH=0, warns=[];
    SHIFTS.forEach(k=>{
      const conf=settings.caConfig[k];
      ds.forEach(d=>{
        const dateStr=toISO(d);
        const cells=schedules.filter(s=>s.date===dateStr&&s.shiftKey===k);
        cells.forEach(s=>totalH+=calcHours(s.startTime,s.endTime));
        if (cells.length<(conf.minStaff||0)) warns.push({dateStr,k,
          label:`${conf.name} ${dayLabel(d)} ${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`,
          miss:(conf.minStaff||0)-cells.length});
      });
    });
    const m=mon(), s=addDays(m,6);
    window._exportName=`lich-tuan-${weekNum(m)}-thang-${m.getMonth()+1}.png`;
    window._exportEl="sched-card";
    window._exportFn=null;
    if(wl) wl.textContent=`${pad2(m.getDate())}/${pad2(m.getMonth()+1)} – ${pad2(s.getDate())}/${pad2(s.getMonth()+1)}`;
    el.innerHTML=`
      <div class="stat-card"><span class="stat-label">Tuần này</span><span class="stat-value" style="font-size:17px">Tuần ${weekNum(m)} · Th.${m.getMonth()+1}</span></div>
      <div class="stat-card"><span class="stat-label">Ca thiếu người</span><span class="stat-value ${warns.length?"stat-warn":""}">${warns.length}</span></div>
      <div class="stat-card"><span class="stat-label">Tổng giờ phục vụ</span><span class="stat-value">${totalH.toFixed(1)}h</span></div>
    `;
    const wb=document.getElementById("warns");
    if(wb) wb.innerHTML = warns.length ? `
      <div class="warn-box">⚠️ ${warns.length} ca thiếu người:
        <ul>${warns.map(w=>`<li data-d="${w.dateStr}" data-k="${w.k}">${w.label} — thiếu ${w.miss} người</li>`).join("")}</ul>
      </div>` : "";
    wb?.querySelectorAll("li").forEach(li=>{
      li.onclick=()=>{
        highlight={d:li.dataset.d,k:li.dataset.k};
        renderGrid();
        document.getElementById(`c-${li.dataset.d}-${li.dataset.k}`)?.scrollIntoView({behavior:"smooth",block:"center"});
        setTimeout(()=>{highlight=null;renderGrid();},1800);
      };
    });
  }

  function renderGrid() {
    const grid=document.getElementById("sgrid");
    if(!grid||!settings) return;
    const ds=days();
    let html=`<div class="sg-head"></div>`;
    ds.forEach(d=>{ html+=`<div class="sg-head">${dayLabel(d)} / ${pad2(d.getDate())}/${pad2(d.getMonth()+1)}</div>`; });

    SHIFTS.forEach(k=>{
      const conf=settings.caConfig[k];
      html+=`<div class="sg-shift" style="background:var(--ca-${k})">${esc(conf.name)}<span>${conf.start}–${conf.end}</span></div>`;
      ds.forEach(d=>{
        const dateStr=toISO(d);
        const cells=schedules.filter(s=>s.date===dateStr&&s.shiftKey===k);
        const short=staffFilter?cells.filter(s=>s.staffId===staffFilter):cells;
        const isWarn=cells.length<(conf.minStaff||0);
        const isHl=highlight&&highlight.d===dateStr&&highlight.k===k;
        html+=`<div class="sg-cell ${isWarn?"warn":""} ${isHl?"highlight":""}" id="c-${dateStr}-${k}">`;
        short.forEach(s=>{
          const st=staffList.find(x=>x.id===s.staffId);
          const h=calcHours(s.startTime,s.endTime);
          html+=`<div class="chip ${k} ${s.isBroken?"broken":""}" data-id="${s.id}" title="${s.startTime}–${s.endTime}"><span class="chip-name">${esc(st?.name||"?")} · ${h.toFixed(1)}h</span><span>✎</span></div>`;
        });
        html+=`<button class="add-btn" data-date="${dateStr}" data-shift="${k}">+</button>`;
        html+=`</div>`;
      });
    });

    grid.innerHTML=html;
    grid.querySelectorAll(".chip").forEach(chip=>{
      chip.onclick=()=>{ const s=schedules.find(x=>x.id===chip.dataset.id); if(s) openEdit(s); };
    });
    grid.querySelectorAll(".add-btn").forEach(btn=>{
      btn.onclick=()=>openAdd(btn.dataset.date,btn.dataset.shift);
    });
  }

  function openAdd(dateStr, shiftKey) {
    if(!settings) return;
    const conf=settings.caConfig[shiftKey];
    const taken=schedules.filter(s=>s.date===dateStr&&s.shiftKey===shiftKey).map(s=>s.staffId);
    const avail=staffList.filter(s=>!taken.includes(s.id));
    if(!avail.length){ toast("Tất cả NV theo giờ đã xếp ca này","error"); return; }
    openModal(`
      <button class="modal-close">✕</button>
      <h3 class="modal-title">Thêm vào ca ${esc(conf.name)} · ${dateStr.split("-").reverse().join("/")}</h3>
      <form id="add-form">
        <div class="form-group"><label>Nhân viên</label>
          <select id="f-staff" required>${avail.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Giờ vào</label><input type="time" id="f-start" value="${conf.start}" required/></div>
          <div class="form-group"><label>Giờ ra</label> <input type="time" id="f-end"   value="${conf.end}"   required/></div>
        </div>
        <p class="form-hint">Giờ khác giờ chuẩn của ca → tự đánh dấu <b>ca gãy</b> (viền đứt).</p>
        <div class="btn-row end">
          <button type="button" class="btn-secondary" id="cancel">Huỷ</button>
          <button type="submit" class="btn-primary" style="width:auto">Thêm</button>
        </div>
      </form>
    `);
    document.getElementById("cancel").onclick=closeModal;
    document.getElementById("add-form").onsubmit=async e=>{
      e.preventDefault();
      const staffId=document.getElementById("f-staff").value;
      const startTime=document.getElementById("f-start").value;
      const endTime=document.getElementById("f-end").value;
      const isBroken=startTime!==conf.start||endTime!==conf.end;
      try{ await addSchedule({staffId,date:dateStr,shiftKey,startTime,endTime,isBroken}); toast("Đã thêm ca"); closeModal(); }
      catch(err){ toast(err.message,"error"); }
    };
  }

  function openEdit(sched) {
    const st=staffList.find(s=>s.id===sched.staffId)||{name:"?"};
    const conf=settings?.caConfig[sched.shiftKey];
    openModal(`
      <button class="modal-close">✕</button>
      <h3 class="modal-title">${esc(st.name)} · ${esc(conf?.name||sched.shiftKey)}</h3>
      <form id="edit-form">
        <div class="form-row">
          <div class="form-group"><label>Giờ vào</label><input type="time" id="f-start" value="${sched.startTime}" required/></div>
          <div class="form-group"><label>Giờ ra</label> <input type="time" id="f-end"   value="${sched.endTime}"   required/></div>
        </div>
        <div class="btn-row between">
          <button type="button" class="btn-danger" id="del-btn">🗑 Xoá khỏi ca</button>
          <div class="btn-row" style="margin:0">
            <button type="button" class="btn-secondary" id="go-staff">👤 Hồ sơ</button>
            <button type="submit" class="btn-primary" style="width:auto">Lưu</button>
          </div>
        </div>
      </form>
    `);
    document.getElementById("go-staff").onclick=()=>{ closeModal(); window.go("nhanvien",{id:sched.staffId}); };
    document.getElementById("del-btn").onclick=async()=>{
      if(await confirm("Xoá nhân viên này khỏi ca?")){ await deleteSchedule(sched.id); toast("Đã xoá"); closeModal(); }
    };
    document.getElementById("edit-form").onsubmit=async e=>{
      e.preventDefault();
      const startTime=document.getElementById("f-start").value;
      const endTime=document.getElementById("f-end").value;
      const isBroken=conf?(startTime!==conf.start||endTime!==conf.end):false;
      try{ await updateSchedule(sched.id,{startTime,endTime,isBroken}); toast("Đã cập nhật"); closeModal(); }
      catch(err){ toast(err.message,"error"); }
    };
  }

  return unsub;
}
