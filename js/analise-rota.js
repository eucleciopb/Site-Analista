import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const userInfo = document.getElementById("userInfo");
const msg = document.getElementById("msg");

const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const inpMes = document.getElementById("inpMes");
const selCD = document.getElementById("selCD");
const selVendedor = document.getElementById("selVendedor");
const inpBuscaPDV = document.getElementById("inpBuscaPDV");

const btnAplicar = document.getElementById("btnAplicar");
const btnLimpar = document.getElementById("btnLimpar");

const kpiVisitas = document.getElementById("kpiVisitas");
const kpiTempoMedio = document.getElementById("kpiTempoMedio");
const kpiTempoTotal = document.getElementById("kpiTempoTotal");
const kpiPdvUnicos = document.getElementById("kpiPdvUnicos");

const tbodyCD = document.getElementById("tbodyCD");
const tbodyVend = document.getElementById("tbodyVend");
const tbodyDet = document.getElementById("tbodyDet");

let currentUser = null;
let allData = [];   // dados do mês (filtrados no Firestore)
let viewData = [];  // dados após filtros

function setMsg(text, type="error"){
  msg.textContent = text || "";
  msg.style.color = type==="success" ? "#065f46" : "#b91c1c";
}

function pad2(n){ return String(n).padStart(2,"0"); }
function currentMonthKey(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}
function safeStr(v){ return (v||"").toString().trim(); }
function low(v){ return safeStr(v).toLowerCase(); }

btnMenu.addEventListener("click", ()=> window.location.href="./menu.html");
btnLogout.addEventListener("click", async ()=>{ await signOut(auth); window.location.href="./index.html"; });

btnAplicar.addEventListener("click", ()=> applyFilters());
btnLimpar.addEventListener("click", ()=>{
  selCD.value = "";
  selVendedor.value = "";
  inpBuscaPDV.value = "";
  applyFilters();
});

inpMes.addEventListener("change", async ()=>{
  await loadMonth();
  buildFilterOptions();
  applyFilters();
});

function fmtMin(v){
  const n = Number(v);
  if(!Number.isFinite(n) || n < 0) return "0 min";
  return `${Math.round(n)} min`;
}

function computeKPIs(list){
  const tempos = list.map(x => Number(x.duracaoMin)).filter(n => Number.isFinite(n));
  const total = tempos.reduce((a,b)=>a+b,0);
  const avg = tempos.length ? (total/tempos.length) : 0;

  const pdvSet = new Set(list.map(x => low(x.pdvNome)).filter(Boolean));

  kpiVisitas.textContent = String(list.length);
  kpiTempoTotal.textContent = fmtMin(total);
  kpiTempoMedio.textContent = fmtMin(avg);
  kpiPdvUnicos.textContent = String(pdvSet.size);
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

function renderResumo(tbody, grouped){
  const rows = [];
  for(const [k, items] of grouped.entries()){
    const tempos = items.map(x => Number(x.duracaoMin)).filter(n => Number.isFinite(n));
    const total = tempos.reduce((a,b)=>a+b,0);
    const avg = tempos.length ? total/tempos.length : 0;

    rows.push({ k, visitas: items.length, avg });
  }

  rows.sort((a,b)=> b.visitas - a.visitas);

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="font-weight:800;">${r.k}</td>
      <td>${r.visitas}</td>
      <td>${fmtMin(r.avg)}</td>
    </tr>
  `).join("");
}

function renderDetalhado(list){
  const rows = [...list];
  rows.sort((a,b)=>{
    const da = safeStr(a.date);
    const db = safeStr(b.date);
    if(db !== da) return db.localeCompare(da);
    return low(a.pdvNome).localeCompare(low(b.pdvNome));
  });

  tbodyDet.innerHTML = rows.map(x => `
    <tr>
      <td>${x.dateBR || "-"}</td>
      <td>${x.cd || "-"}</td>
      <td>${x.vendedorNome || "-"}</td>
      <td style="font-weight:800;">${x.pdvNome || "-"}</td>
      <td>${x.duracaoMin != null ? (x.duracaoMin + " min") : "-"}</td>
    </tr>
  `).join("");
}

function buildFilterOptions(){
  const cds = Array.from(new Set(allData.map(x => safeStr(x.cd)).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const vends = Array.from(new Set(allData.map(x => safeStr(x.vendedorNome)).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

  selCD.innerHTML = `<option value="">Todos</option>` + cds.map(c=>`<option value="${c}">${c}</option>`).join("");
  selVendedor.innerHTML = `<option value="">Todos</option>` + vends.map(v=>`<option value="${v}">${v}</option>`).join("");
}

function applyFilters(){
  const cd = safeStr(selCD.value);
  const vend = safeStr(selVendedor.value);
  const busca = low(inpBuscaPDV.value);

  viewData = allData.filter(x => {
    if(cd && safeStr(x.cd) !== cd) return false;
    if(vend && safeStr(x.vendedorNome) !== vend) return false;
    if(busca && !low(x.pdvNome).includes(busca)) return false;
    return true;
  });

  computeKPIs(viewData);

  renderResumo(tbodyCD, groupBy(viewData, x => safeStr(x.cd) || "—"));
  renderResumo(tbodyVend, groupBy(viewData, x => safeStr(x.vendedorNome) || "—"));
  renderDetalhado(viewData);

  setMsg(`Carregado: ${viewData.length} visita(s)`, "success");
}

async function loadMonth(){
  if(!currentUser) return;

  setMsg("");
  allData = [];
  tbodyCD.innerHTML = "";
  tbodyVend.innerHTML = "";
  tbodyDet.innerHTML = "";

  try{
    const monthKey = inpMes.value || currentMonthKey();
    inpMes.value = monthKey;

    // Busca do mês direto no Firestore (melhor que puxar tudo)
    // Requer que os documentos novos tenham monthKey (já adicionamos).
    const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();

    const q = query(
      collection(db,"rota_visitas"),
      where("uidKey","==", usuarioKey),
      where("monthKey","==", monthKey)
    );

    const snap = await getDocs(q);
    allData = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));

    // fallback: se for mês sem monthKey (dados antigos), não tem como filtrar por mês no Firestore.
    // Nesse caso, mantém o retorno atual (que será vazio para os antigos).
    // Solução definitiva: a gente faz um “script de migração” depois (eu te passo quando você quiser).

    buildFilterOptions();
    applyFilters();

  }catch(err){
    console.error("[ANALISE] loadMonth:", err);
    if(err?.code === "failed-precondition"){
      setMsg("Faltou índice no Firestore para consulta do mês. Me mande o link do erro que eu te passo o clique certo.", "error");
    } else if(err?.code === "permission-denied"){
      setMsg("Permissão negada. Verifique Rules (rota_visitas).", "error");
    } else {
      setMsg("Falha ao carregar análise. Veja o console (F12).", "error");
    }
  }
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="./index.html"; return; }
  currentUser = user;
  const usuarioLogado = (localStorage.getItem("usuarioLogado") || "").trim();
  userInfo.textContent = `Logado como: ${usuarioLogado || (user.email||"").toLowerCase()}`;

  inpMes.value = currentMonthKey();
  await loadMonth();
});