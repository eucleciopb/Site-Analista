import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const userInfo = document.getElementById("userInfo");
const msg = document.getElementById("msg");

const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");
const btnCarregar = document.getElementById("btnCarregar");
const btnLimpar = document.getElementById("btnLimpar");

const inpMes = document.getElementById("inpMes");
const lblPeriodo = document.getElementById("lblPeriodo");
const inpFiltroCD = document.getElementById("inpFiltroCD");

const kpiDias = document.getElementById("kpiDias");
const kpiCds = document.getElementById("kpiCds");
const kpiMaior = document.getElementById("kpiMaior");
const kpiMenor = document.getElementById("kpiMenor");

const tbodyCD = document.getElementById("tbodyCD");
const tbodyDet = document.getElementById("tbodyDet");

let currentUser = null;
let rawAll = [];   // tudo do usuário (sem filtro por mês no Firestore)
let view = [];     // filtrado por mês + filtro CD

function setMsg(text, type="error"){
  msg.textContent = text || "";
  msg.style.color = type === "success" ? "#065f46" : "#b91c1c";
}

function pad2(n){ return String(n).padStart(2, "0"); }

function monthKeyNow(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}

function monthStartEnd(monthKey){
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${y}-${pad2(m)}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${pad2(m)}-${pad2(last)}`;
  return { start, end };
}

function formatBR(iso){
  const [y,m,d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function low(v){ return (v||"").toString().toLowerCase().trim(); }
function safe(v){ return (v||"").toString().trim(); }

// Aceita:
// - dateTs Timestamp (Firestore)
// - date ISO: YYYY-MM-DD
// - date BR: DD/MM/YYYY
function parseToISO(doc){
  // 1) Timestamp
  if(doc?.dateTs && typeof doc.dateTs.toDate === "function"){
    const d = doc.dateTs.toDate();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  // 2) Campo date
  const s = safe(doc?.date);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){
    const [dd,mm,yy] = s.split("/");
    return `${yy}-${mm}-${dd}`;
  }

  // 3) Campo dateBR (se existir)
  const s2 = safe(doc?.dateBR);
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s2)){
    const [dd,mm,yy] = s2.split("/");
    return `${yy}-${mm}-${dd}`;
  }

  return null;
}

function groupBy(list, keyFn){
  const map = new Map();
  for(const it of list){
    const k = keyFn(it) || "—";
    if(!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

btnMenu?.addEventListener("click", ()=> window.location.href="./menu.html");
btnLogout?.addEventListener("click", async ()=>{ await signOut(auth); window.location.href="./index.html"; });

btnLimpar?.addEventListener("click", ()=>{
  inpFiltroCD.value = "";
  render();
});

btnCarregar?.addEventListener("click", ()=>{
  applyMonthFilter();
  render();
});

inpMes?.addEventListener("change", ()=>{
  applyMonthFilter();
  render();
});

function applyMonthFilter(){
  const monthKey = inpMes.value || monthKeyNow();
  inpMes.value = monthKey;

  const { start, end } = monthStartEnd(monthKey);
  lblPeriodo.textContent = `${formatBR(start)} a ${formatBR(end)}`;

  // filtra os docs que caem no mês (com parse robusto)
  view = rawAll
    .map(d => ({ ...d, _iso: parseToISO(d) }))
    .filter(d => d._iso && d._iso >= start && d._iso <= end);
}

function render(){
  const fCD = low(inpFiltroCD.value);

  const filtered = view.filter(x => {
    if(fCD && !low(x.cd).includes(fCD)) return false;
    return true;
  });

  // KPIs
  kpiDias.textContent = String(filtered.length);
  const cdsSet = new Set(filtered.map(x => safe(x.cd)).filter(Boolean));
  kpiCds.textContent = String(cdsSet.size);

  // Resumo por CD
  const byCD = groupBy(filtered, x => safe(x.cd) || "—");
  const cdRows = [];
  for(const [cd, items] of byCD.entries()){
    const dates = items.map(i => i._iso).filter(Boolean).sort((a,b)=>a.localeCompare(b));
    cdRows.push({ cd, dias: items.length, dates });
  }
  cdRows.sort((a,b)=> b.dias - a.dias || a.cd.localeCompare(b.cd));

  const maior = cdRows[0];
  const menor = cdRows.length ? cdRows[cdRows.length - 1] : null;
  kpiMaior.textContent = maior ? `${maior.cd} (${maior.dias})` : "—";
  kpiMenor.textContent = menor ? `${menor.cd} (${menor.dias})` : "—";

  tbodyCD.innerHTML = cdRows.map(r => `
    <tr>
      <td style="font-weight:900;">${r.cd}</td>
      <td style="font-weight:900;">${r.dias}</td>
      <td>${r.dates.map(d => `<span class="chip">${formatBR(d)}</span>`).join(" ")}</td>
    </tr>
  `).join("");

  // Detalhado
  const det = [...filtered].sort((a,b)=> (a._iso||"").localeCompare(b._iso||""));
  tbodyDet.innerHTML = det.map(x => `
    <tr>
      <td style="font-weight:900;">${x._iso ? formatBR(x._iso) : "-"}</td>
      <td>${x.cd || "-"}</td>
      <td>${x.atividade || "-"}</td>
      <td>${x.observacoes || "-"}</td>
    </tr>
  `).join("");

  if(filtered.length === 0){
    setMsg("Nenhum dia encontrado neste mês. (Se você lançou, é porque os docs não estão sendo lidos pelo filtro de usuário.)", "error");
  } else {
    setMsg(`Resumo gerado: ${filtered.length} dia(s) carregado(s).`, "success");
  }
}

async function loadAllUserAgenda(){
  if(!currentUser) return;

  setMsg("");
  rawAll = [];
  tbodyCD.innerHTML = "";
  tbodyDet.innerHTML = "";

  try{
    // ✅ Query 1: pelo uidKey (legado/slug)
    const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();
    const q1 = query(
      collection(db, "agenda_dias"),
      where("uidKey","==", usuarioKey)
    );
    const s1 = await getDocs(q1);
    const a1 = s1.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));

    // ✅ Query 2: por analista (nome exibido)
    const usuario = (localStorage.getItem("usuarioLogado") || "").trim();
    let a2 = [];
    if(usuario){
      const q2 = query(
        collection(db, "agenda_dias"),
        where("analyst","==", usuario)
      );
      const s2 = await getDocs(q2);
      a2 = s2.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
    }

    // ✅ Query 3 (atual): pelo UID
    let a3 = [];
    if(currentUser){
      const q3 = query(
        collection(db, "agenda_dias"),
        where("uid","==", currentUser.uid)
      );
      const s3 = await getDocs(q3);
      a3 = s3.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
    }

    // merge (sem duplicar) + expansão de docs mensais
    const map = new Map();
    [...a1, ...a2, ...a3].forEach(data => {
      if (data.dias && typeof data.dias === "object") {
         // Estrutura Mensal: { dias: { "2026-02-19": { ... } } }
         Object.entries(data.dias).forEach(([dt, val]) => {
           // Cria um objeto "achatado" para cada dia
           const id = `${data.id}_${dt}`;
           map.set(id, { 
             id, 
             date: dt, 
             data: dt, 
             ...val, 
             uidKey: data.uidKey || data.usuarioKey,
             analyst: data.analyst || data.usuarioNome,
             yyyyMM: data.yyyyMM || data.monthKey
           });
         });
      } else {
         // Estrutura Diária
         map.set(data.id, data);
      }
    });
    rawAll = Array.from(map.values());

    applyMonthFilter();
    render();

  }catch(err){
    console.error("[MES] loadAllUserAgenda:", err);
    if(err?.code === "permission-denied"){
      setMsg("Permissão negada. Verifique Rules da coleção agenda_dias.", "error");
    } else {
      setMsg("Falha ao carregar agenda do usuário. Veja o console (F12).", "error");
    }
  }
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="./index.html"; return; }
  currentUser = user;

  const usuario = (localStorage.getItem("usuarioLogado") || "").trim();
  userInfo.textContent = `Logado como: ${usuario || (user.email||"").toLowerCase()}`;

  inpMes.value = monthKeyNow();
  await loadAllUserAgenda();
});