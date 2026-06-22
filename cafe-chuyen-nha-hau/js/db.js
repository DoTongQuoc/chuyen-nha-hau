import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ── SETTINGS ──
export const DEFAULT_SETTINGS = {
  shopInfo:   { name:"Chuyện nhà Hàu", address:"", phone:"", logo:"" },
  caConfig:   {
    sang:  { name:"Sáng",  start:"06:00", end:"13:00", minStaff:2 },
    chieu: { name:"Chiều", start:"13:00", end:"18:00", minStaff:2 },
    toi:   { name:"Tối",   start:"18:00", end:"23:00", minStaff:2 }
  },
  wageConfig:   { sang:20000, chieu:20000, toi:25000 },
  exportConfig: { showLogo:true, showBankInfo:true }
};

const settingsRef = doc(db, "settings", "main");

export async function getSettings() {
  const snap = await getDoc(settingsRef);
  return snap.exists() ? deepMerge(DEFAULT_SETTINGS, snap.data()) : DEFAULT_SETTINGS;
}
export function subscribeSettings(cb) {
  return onSnapshot(settingsRef,
    snap => cb(snap.exists() ? deepMerge(DEFAULT_SETTINGS, snap.data()) : DEFAULT_SETTINGS),
    err  => { console.error("Firestore settings error:", err); cb(DEFAULT_SETTINGS); }
  );
}
export function updateSettings(data) { return setDoc(settingsRef, data, { merge:true }); }

function deepMerge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = (over[k] && typeof over[k]==="object" && !Array.isArray(over[k]))
      ? deepMerge(base[k]||{}, over[k]) : over[k];
  }
  return out;
}

// ── STAFF ──
const staffCol = collection(db, "staff");

export function subscribeStaff(cb) {
  return onSnapshot(query(staffCol, where("isDeleted","==",false)),
    snap => { const list = snap.docs.map(d=>({id:d.id,...d.data()})); list.sort((a,b)=>(a.name||"").localeCompare(b.name||"","vi")); cb(list); },
    err  => { console.error("Firestore staff error:", err); cb([]); }
  );
}
export async function getStaff(id) {
  const snap = await getDoc(doc(db,"staff",id));
  return snap.exists() ? {id:snap.id,...snap.data()} : null;
}
export function addStaff(data) {
  return addDoc(staffCol, {...data, isDeleted:false, createdAt:serverTimestamp()});
}
export function updateStaff(id, data) { return updateDoc(doc(db,"staff",id), data); }
export function deleteStaff(id)       { return updateDoc(doc(db,"staff",id), {isDeleted:true}); }

// ── SCHEDULES ──
const schedCol = collection(db, "schedules");

export function subscribeSchedules(startDate, endDate, cb) {
  const q = query(schedCol, where("date",">=",startDate), where("date","<=",endDate));
  return onSnapshot(q, snap => cb(snap.docs.map(d=>({id:d.id,...d.data()}))));
}
export async function getSchedules(startDate, endDate, staffId=null) {
  const q = query(schedCol, where("date",">=",startDate), where("date","<=",endDate));
  const snap = await getDocs(q);
  let list = snap.docs.map(d=>({id:d.id,...d.data()}));
  if (staffId) list = list.filter(s=>s.staffId===staffId);
  return list;
}
export function addSchedule(data)         { return addDoc(schedCol, data); }
export function updateSchedule(id, data)  { return updateDoc(doc(db,"schedules",id), data); }
export function deleteSchedule(id)        { return deleteDoc(doc(db,"schedules",id)); }

// ── ADJUSTMENTS (thưởng/phạt) ──
const adjCol = collection(db, "adjustments");

export function subscribeAdj(staffId, month, cb) {
  const q = query(adjCol, where("staffId","==",staffId), where("month","==",month), where("isDeleted","==",false));
  return onSnapshot(q, snap => cb(snap.docs.map(d=>({id:d.id,...d.data()}))));
}
export async function getAdj(month) {
  const q = query(adjCol, where("month","==",month), where("isDeleted","==",false));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
export function addAdj(data)    { return addDoc(adjCol, {...data, isDeleted:false, createdAt:serverTimestamp()}); }
export function deleteAdj(id)   { return updateDoc(doc(db,"adjustments",id), {isDeleted:true}); }

// ── ADVANCES (tạm ứng) ──
const advCol = collection(db, "advances");

export function subscribeAdv(staffId, month, cb) {
  const q = query(advCol, where("staffId","==",staffId), where("month","==",month));
  return onSnapshot(q, snap => cb(snap.docs.map(d=>({id:d.id,...d.data()}))));
}
export async function getAdv(month) {
  const q = query(advCol, where("month","==",month));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
export function addAdv(data)    { return addDoc(advCol, data); }
export function deleteAdv(id)   { return deleteDoc(doc(db,"advances",id)); }

// ── SALARY STATUS ──
const statusCol = collection(db, "salaryStatus");
function statusId(staffId, month) { return `${staffId}_${month}`; }

export function subscribeStatus(month, cb) {
  const q = query(statusCol, where("month","==",month));
  return onSnapshot(q, snap => {
    const map = {};
    snap.docs.forEach(d => { map[d.data().staffId] = d.data(); });
    cb(map);
  });
}
export function setStatus(staffId, month, status, extra={}) {
  return setDoc(doc(db,"salaryStatus",statusId(staffId,month)),
    {staffId, month, status, ...extra}, {merge:true});
}
