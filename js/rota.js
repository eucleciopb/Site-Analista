import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection, addDoc, getDocs, query, where,
  serverTimestamp
} from "firebase/firestore";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentMode = localStorage.getItem("rota_mode") || "site";

function pad2(n){ return String(n).padStart(2,"0"); }
function safe(v){ return (v ?? "").toString().trim(); }

function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function setMsg(text, type="error"){
  const el = $("msg");
  if(!el) return;
  el.textContent = text || "";
  el.style.color = type === "success" ? "#065f46" : "#b91c1c";
}

function calcDuracaoMin(hIni, hFim){
  if(!hIni || !hFim) return "";
  const [h1,m1] = hIni.split(":").map(Number);
  const [h2,m2] = hFim.split(":").map(Number);
  const a = h1*60 + m1;
  const b = h2*60 + m2;
  const diff = b - a;
  return diff >= 0 ? String(diff) : "";
}

/* =========================
   Modo (Site/Mobile)
========================= */
function applyMode(mode){
  currentMode = mode;
  localStorage.setItem("rota_mode", mode);

  document.body.classList.toggle("rota-mobile", mode === "mobile");

  const bSite = $("btnModeSite");
  const bMobile = $("btnModeMobile");

  if(bSite && bMobile){
    bSite.classList.toggle("btn-primary", mode === "site");
    bSite.classList.toggle("btn-secondary", mode !== "site");

    bMobile.classList.toggle("btn-primary", mode === "mobile");
    bMobile.classList.toggle("btn-secondary", mode !== "mobile");
  }
}

/* =========================
   CD automático via agenda
========================= */
async function loadCDFromAgenda(uid, dateISO){
  const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();

  try{
    // 1) uidKey + date
    const q1 = query(
      collection(db, "agenda_dias"),
      where("uidKey", "==", usuarioKey),
      where("date", "==", dateISO)
    );
    const s1 = await getDocs(q1);
    if(!s1.empty){
      return safe((s1.docs[0].data() || {}).cd);
    }

    // 2) fallback: usuario + date
    const usuario = (localStorage.getItem("usuarioLogado") || "").trim();
    if(usuario){
      const q2 = query(
        collection(db, "agenda_dias"),
        where("analyst", "==", usuario),
        where("date", "==", dateISO)
      );
      const s2 = await getDocs(q2);
      if(!s2.empty){
        return safe((s2.docs[0].data() || {}).cd);
      }
    }
  }catch(err){
    console.error("[ROTA] loadCDFromAgenda:", err);
  }

  return "";
}

/* =========================
   Lista do dia (tabela)
========================= */
function renderTabela(visitas){
  const tbody = $("tbodyDia");
  if(!tbody) return;

  if(visitas.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:14px; color:#6b7280; font-weight:700;">
          Nenhuma visita lançada para este dia.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = visitas.map(v => `
    <tr>
      <td>${safe(v.horaInicio) || "-"}</td>
      <td>${safe(v.horaFim) || "-"}</td>
      <td>${(v.duracaoMin ?? "") !== "" ? `${v.duracaoMin} min` : "-"}</td>
      <td style="font-weight:900;">${safe(v.pdvNome) || "-"}</td>
      <td>${safe(v.cd) || "-"}</td>
      <td><span class="chip">${safe(v.plataforma || currentMode)}</span></td>
    </tr>
  `).join("");
}

async function loadVisitasDia(){
  if(!currentUser) return;

  const dateISO = safe($("inpData")?.value) || todayISO();
  const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();

  try{
    const q1 = query(
      collection(db, "rota_visitas"),
      where("uidKey", "==", usuarioKey),
      where("date", "==", dateISO)
    );

    const snap = await getDocs(q1);
    const visitas = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    visitas.sort((a,b)=> safe(a.horaInicio).localeCompare(safe(b.horaInicio)));

    renderTabela(visitas);
  }catch(err){
    console.error("[ROTA] loadVisitasDia:", err);
    setMsg("Falha ao carregar visitas do dia. Veja o console (F12).", "error");
  }
}

/* =========================
   Limpar
========================= */
function clearForm(){
  $("inpPdvNome").value = "";
  $("inpPdvCnpj").value = "";
  $("inpPdvCidade").value = "";

  $("inpInicio").value = "";
  $("inpFim").value = "";
  $("inpDuracao").value = "";

  $("txtForcas").value = "";
  $("txtFraquezas").value = "";
  $("txtOportunidades").value = "";
  $("txtAmeacas").value = "";

  $("txtFeedbackVendedor").value = "";
  $("txtFeedbackSupervisor").value = "";

  $("txtPontosTime").value = "";
  $("txtResumoOpp").value = "";
  $("txtProximos").value = "";

  setMsg("");
}

/* =========================
   Salvar
========================= */
async function saveVisita(){
  if(!currentUser) return;

  const dateISO = safe($("inpData").value);
  const cd = safe($("inpCD").value);
  const tipoDia = safe($("selTipoDia").value) || "ROTA";

  const pdvNome = safe($("inpPdvNome").value);
  const pdvCnpj = safe($("inpPdvCnpj").value);
  const pdvCidade = safe($("inpPdvCidade").value);

  const horaInicio = safe($("inpInicio").value);
  const horaFim = safe($("inpFim").value);
  const duracaoMin = calcDuracaoMin(horaInicio, horaFim);

  if(!dateISO) return setMsg("Informe a data da visita.", "error");
  if(!pdvNome) return setMsg("Informe o nome do PDV.", "error");
  if(!cd) return setMsg("CD não preenchido (agenda do dia não encontrada). Preencha manualmente.", "error");

  const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();
  const usuarioLogado = (localStorage.getItem("usuarioLogado") || "").trim();

  const doc = {
    uid: currentUser.uid,
    uidKey: usuarioKey,
    analista: usuarioLogado,
    analistaEmail: (currentUser.email || "").toLowerCase(),

    plataforma: currentMode,

    date: dateISO,
    monthKey: dateISO.slice(0,7),

    cd,
    tipoDia,

    pdvNome,
    pdvCnpj,
    pdvCidade,

    horaInicio,
    horaFim,
    duracaoMin: duracaoMin === "" ? "" : Number(duracaoMin),

    swot: {
      forcas: safe($("txtForcas").value),
      fraquezas: safe($("txtFraquezas").value),
      oportunidades: safe($("txtOportunidades").value),
      ameacas: safe($("txtAmeacas").value),
    },

    feedback: {
      vendedor: safe($("txtFeedbackVendedor").value),
      supervisor: safe($("txtFeedbackSupervisor").value),
      pontosTime: safe($("txtPontosTime").value),
    },

    resumo: {
      oportunidades: safe($("txtResumoOpp").value),
      proximosPassos: safe($("txtProximos").value),
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try{
    await addDoc(collection(db, "rota_visitas"), doc);
    setMsg("Visita salva com sucesso!", "success");
    clearForm();
    await loadVisitasDia();
  }catch(err){
    console.error("[ROTA] saveVisita:", err);
    if(err?.code === "permission-denied"){
      setMsg("Permissão negada. Verifique Rules de rota_visitas.", "error");
    }else{
      setMsg("Falha ao salvar visita. Veja o console (F12).", "error");
    }
  }
}

/* =========================
   Bind events
========================= */
function bindEvents(){
  $("btnLogout")?.addEventListener("click", async ()=>{
    await signOut(auth);
    window.location.href = "./index.html";
  });

  $("btnMenu")?.addEventListener("click", ()=>{
    window.location.href = "./menu.html";
  });

  $("btnModeSite")?.addEventListener("click", ()=> applyMode("site"));
  $("btnModeMobile")?.addEventListener("click", ()=> applyMode("mobile"));

  $("btnLimpar")?.addEventListener("click", clearForm);

  $("btnSalvar")?.addEventListener("click", saveVisita);

  // duração
  $("inpInicio")?.addEventListener("change", ()=>{
    $("inpDuracao").value = calcDuracaoMin($("inpInicio").value, $("inpFim").value);
  });
  $("inpFim")?.addEventListener("change", ()=>{
    $("inpDuracao").value = calcDuracaoMin($("inpInicio").value, $("inpFim").value);
  });

  // troca data => busca CD + recarrega lista
  $("inpData")?.addEventListener("change", async ()=>{
    const dateISO = $("inpData").value;
    const cd = await loadCDFromAgenda(currentUser.uid, dateISO);
    if(cd) $("inpCD").value = cd;
    await loadVisitasDia();
  });
}

/* =========================
   Init
========================= */
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = "./index.html";
    return;
  }

  currentUser = user;
  const usuarioLogado = (localStorage.getItem("usuarioLogado") || "").trim();
  $("userInfo").textContent = `Logado como: ${usuarioLogado || (user.email || "").toLowerCase()}`;

  // defaults
  $("inpData").value = todayISO();

  applyMode(currentMode);
  bindEvents();

  // CD automático
  const cd = await loadCDFromAgenda(user.uid, $("inpData").value);
  if(cd) $("inpCD").value = cd;

  // lista do dia
  await loadVisitasDia();
});
