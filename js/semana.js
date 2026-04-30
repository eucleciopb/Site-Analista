// js/semana.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

/* =========================
   UI
========================= */
const weekGrid = document.getElementById("weekGrid");
const msg = document.getElementById("msg");
const userInfo = document.getElementById("userInfo");
const weekLabel = document.getElementById("weekLabel");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnHoje = document.getElementById("btnHoje");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

/* =========================
   STATE
========================= */
let currentUser = null;
let analystLabel = "";
let weekStart = null; // Monday

/* =========================
   UTILS
========================= */
function setMsg(text, type="error"){
  msg.textContent = text || "";
  msg.style.color = type==="success" ? "#065f46" : "#b91c1c";
}
function pad2(n){ return String(n).padStart(2,"0"); }
function formatISODate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function formatBRDate(d){ return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }
function weekdayPt(d){ return ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

function getMonday(date){
  const d = new Date(date);
  const day = d.getDay(); // 0..6
  const diff = (day === 0) ? -6 : (1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function clipText(s, max=120){
  const t = (s || "").trim();
  if (!t) return "—";
  return t.length > max ? t.slice(0, max-1) + "…" : t;
}

function cardHTML({dt, cd, atividade, observacoes, ok}){
  const day = weekdayPt(dt);
  const dateBR = formatBRDate(dt);

  const cdTxt = cd ? cd : "Não lançado";
  const atTxt = atividade ? atividade : "Não lançado";
  const noteTxt = clipText(observacoes || "", 140);

  return `
    <article class="wk-card ${ok ? "ok" : ""}">
      <div class="wk-hdr">
        <div>
          <div class="wk-day">${day}</div>
          <div class="wk-status">${ok ? "OK LANÇADO" : "PENDENTE"}</div>
        </div>
        <div class="wk-date">${dateBR}</div>
      </div>

      <div class="wk-body">
        <div class="wk-chips">
          <div class="wk-chip" title="${cdTxt}">
            <span class="dot"></span>
            <span class="txt">${cdTxt}</span>
          </div>
          <div class="wk-chip" title="${atTxt}">
            <span class="dot"></span>
            <span class="txt">${atTxt}</span>
          </div>
        </div>

        <div class="wk-note" title="${(observacoes || "").trim()}">${noteTxt}</div>
      </div>
    </article>
  `;
}

/* =========================
   NAV
========================= */
btnMenu.addEventListener("click", ()=> window.location.href="./menu.html");
btnLogout.addEventListener("click", async ()=>{ await signOut(auth); window.location.href="./index.html"; });

btnPrev.addEventListener("click", async ()=>{ weekStart = addDays(weekStart, -7); await renderWeek(); });
btnNext.addEventListener("click", async ()=>{ weekStart = addDays(weekStart, 7); await renderWeek(); });
btnHoje.addEventListener("click", async ()=>{ weekStart = getMonday(new Date()); await renderWeek(); });

/* =========================
   LOAD (sem índice composto)
========================= */
async function loadUserAgendaDocs(){
  const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();
  const q = query(collection(db,"agenda_dias"), where("uidKey","==", usuarioKey));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

/* =========================
   RENDER
========================= */
async function renderWeek(){
  setMsg("");
  weekGrid.innerHTML = "";

  const start = new Date(weekStart);
  const end = addDays(start, 4); // Seg..Sex
  weekLabel.textContent = `${formatBRDate(start)} a ${formatBRDate(end)}`;

  let docs = [];
  try{
    docs = await loadUserAgendaDocs();
  }catch(err){
    console.error("[SEMANA] erro:", err);
    if (err?.code === "permission-denied") setMsg("Permissão negada. Verifique Rules (agenda_dias).", "error");
    else setMsg("Falha ao carregar. Veja o console (F12).", "error");
    return;
  }

  const map = new Map();
  for(const d of docs){
    if(d?.date) map.set(d.date, d);
  }

  for(let i=0; i<5; i++){
    const dt = addDays(start, i);
    const iso = formatISODate(dt);
    const data = map.get(iso);

    const cd = data?.cd || "";
    const atividade = data?.atividade || "";
    const observacoes = data?.observacoes || "";
    const ok = !!(cd && atividade);

    weekGrid.insertAdjacentHTML("beforeend", cardHTML({ dt, cd, atividade, observacoes, ok }));
  }
}

/* =========================
   AUTH
========================= */
onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="./index.html"; return; }

  currentUser = user;
  analystLabel = (localStorage.getItem("usuarioLogado") || "").trim() || (user.email || "").toLowerCase();
  userInfo.textContent = `Logado como: ${analystLabel}`;

  weekStart = getMonday(new Date());
  await renderWeek();
});
