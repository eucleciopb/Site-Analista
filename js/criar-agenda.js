// ../js/criar-agenda.js
import { db } from "./firebase.js";
import {
  collection, getDocs, query, where,
  doc, writeBatch, serverTimestamp
} from "firebase/firestore";

/* =========================
   CDs (lista completa) - FALLBACK GARANTIDO
========================= */
const CDS_RAW = [
  "CD - Alagoinhas","CD - Andradina","CD - Angra dos Reis","CD - Aparecida de Goiânia","CD - Araçatuba","CD - Arapiraca","CD - Araraquara",
  "CD - Balsas","CD - Barbalha","CD - Barra do Garca","CD - Barreiras","CD - Barretos","CD - Barueri","CD - Bauru","CD - Belém","CD - Boituva",
  "CD - Bom Jesus da Lapa","CD - Brumado","CD - Cachoeiro de Itapemirim","CD - Camaçari","CD - Campina Grande","CD - Campinas","CD - Campo Grande MS",
  "CD - Campo Grande RJ","CD - Campos dos Goytacazes","CD - Caraguatatuba","CD - Cariacica","CD - Carpina","CD - Caruaru","CD - Cascavel","CD - Catanduva",
  "CD - Caucaia","CD - Caxias","CD - Coimbra","CD - Conde","CD - Conselheiro Lafaiete","CD - Conselheiro Lafaiete","CD - Contagem","CD - Coxim","CD - Cuiabá",
  "CD - Divinópolis","CD - Dourados","CD - Duque de Caxias","CD - Eunápolis","CD - Eusebio","CD - Feira de Santana","CD - Feira de Santana",
  "CD - Fernandópolis","CD - Fernandópolis","CD - Fernandópolis","CD - Fernandópolis","CD - Floriano","CD - Garanhuns","CD - Governador Valadares","CD - Guarujá",
  "CD - Guarulhos Taboão","CD - Iguatu","CD - Imperatriz","CD - Interlagos","CD - Iporá","CD - Irece","CD - Itabaiana","CD - Itaberaba","CD - Itabuna",
  "CD - Itapeva","CD - Itapissuma","CD - Itumbiara","CD - Jaboatão dos Guararapes","CD - Jacobina","CD - Jaguaré","CD - Jequié","CD - Juazeiro","CD - Juiz de Fora",
  "CD - Jundiaí","CD - Londrina","CD - Macaiba","CD - Maceió","CD - Marília","CD - Mogi-Mirim","CD - Montes Claros","CD - Mossoró","CD - Muriaé",
  "CD - Nossa Senhora do Socorro","CD - Nova Friburgo","CD - Palhoça","CD - Paranaíba","CD - Parnaiba","CD - Parnaiba","CD - Passos","CD - Passos","CD - Patos",
  "CD - Paulo Afonso","CD - Petrolina","CD - Petrópolis","CD - Picos","CD - Piracicaba","CD - Poços de Caldas","CD - Poços de Caldas","CD - Porto Velho",
  "CD - Pouso Alegre","CD - Presidente Prudente","CD - Recife","CD - Registro","CD - Ribeirão Preto","CD - Rio Branco","CD - Rio das Ostras","CD - Rio Verde",
  "CD - Rondonópolis","CD - Salto","CD - Salvador","CD - Salvador Leste","CD - Santa Inês","CD - Santo Antonio de Jesus","CD - São Bernardo","CD - São Cristovão",
  "CD - São Gonçalo","CD - São João de Meriti","CD - São José do Rio Preto","CD - São José dos Campos","CD - São José dos Pinhais","CD - São Luis","CD - São Mateus",
  "CD - São Pedro da Aldeia","CD - Sapucaia do Sul","CD - Serra Talhada","CD - Serrinha","CD - Sete Lagoas","CD - Sete Lagoas","CD - Sinop","CD - Sobral","CD - Sousa",
  "CD - Taboão da Serra","CD - Taguatinga","CD - Taubaté","CD - Teixeira de Freitas","CD - Teresina","CD - Três Lagoas","CD - Uberaba","CD - Varginha",
  "CD - Vila Guilherme","CD - Vitória da Conquista","CD - Volta Redonda","Home Office","Férias","Corporativo"
];

/* =========================
   CONFIG DO BANCO
========================= */
const AGENDA_COLLECTION = "agenda_dias";
const CDS_COLLECTION = "cds";

/* =========================
   UI
========================= */
const tbody = document.getElementById("tbodyAgenda");
const monthPicker = document.getElementById("monthPicker");
const btnSalvar = document.getElementById("btnSalvar");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");
const msg = document.getElementById("msg");
const userInfo = document.getElementById("userInfo");
const errBox = document.getElementById("errBox");
const cdList = document.getElementById("cdList");
const statusPill = document.getElementById("statusPill");

// Modal Observações
const obsModal = document.getElementById("obsModal");
const obsModalText = document.getElementById("obsModalText");
const obsOk = document.getElementById("obsOk");
const obsCancel = document.getElementById("obsCancel");
const obsClose = document.getElementById("obsClose");
const obsTitle = document.getElementById("obsTitle");

let obsTargetTextarea = null;

/* =========================
   PATHS
========================= */
const PATH_INDEX = "../index.html";
const PATH_MENU  = "../html_menus/menu.html";

/* =========================
   HELPERS
========================= */
function safeParse(raw){
  try { return JSON.parse(raw); } catch { return null; }
}

function slug(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* =========================
   LOGIN
========================= */
function getCurrentUserName(){
  const rawSession = localStorage.getItem("user_session");
  if (rawSession) {
    const s = safeParse(rawSession);
    if (s?.nome) return String(s.nome).trim();
  }
  return (localStorage.getItem("usuarioLogado") || "").trim();
}

const usuarioNome = getCurrentUserName();
if (!usuarioNome) window.location.href = PATH_INDEX;

const usuarioKey = slug(usuarioNome);
if (userInfo) userInfo.textContent = `Usuário: ${usuarioNome}`;

/* =========================
   ATIVIDADES
========================= */
const ATIVIDADES = [
  "Analise Interna",
  "Deslocamento",
  "Aplicação de Treinamento",
  "Rota",
  "Plano de Ação com os Gestores",
  "Reunião GRC ou Diretor",
  "Alinhamento com outras áreas",
  "Feriado / Ponto Facultativo",
  "Atestado/ASO",
  "Banco de Horas"
];

/* =========================
   FERIADOS 2026
   - pré-preenche, mas deixa editar
========================= */
const FERIADOS_2026 = {
  "2026-01-01": { nome: "Confraternização Universal", tipo: "Feriado Nacional" },
  "2026-02-16": { nome: "Carnaval", tipo: "Ponto Facultativo" },
  "2026-02-17": { nome: "Carnaval", tipo: "Ponto Facultativo" },
  "2026-04-03": { nome: "Sexta-Feira Santa (Paixão de Cristo)", tipo: "Feriado Nacional" },
  "2026-04-21": { nome: "Tiradentes", tipo: "Feriado Nacional" },
  "2026-05-01": { nome: "Dia do Trabalho", tipo: "Feriado Nacional" },
  "2026-06-04": { nome: "Corpus Christi", tipo: "Ponto Facultativo" },
  "2026-09-07": { nome: "Independência do Brasil", tipo: "Feriado Nacional" },
  "2026-10-12": { nome: "Nossa Senhora Aparecida", tipo: "Feriado Nacional" },
  "2026-11-02": { nome: "Finados", tipo: "Feriado Nacional" },
  "2026-11-15": { nome: "Proclamação da República", tipo: "Feriado Nacional" },
  "2026-11-20": { nome: "Dia da Consciência Negra", tipo: "Feriado Nacional" },
  "2026-12-25": { nome: "Natal", tipo: "Feriado Nacional" }
};

function getFeriadoInfo(dateISO){
  return FERIADOS_2026[dateISO] || null;
}

function buildFeriadoObs(dateISO){
  const f = getFeriadoInfo(dateISO);
  if (!f) return "";
  return `${f.nome} - ${f.tipo}`;
}

/* =========================
   HELPERS UI
========================= */
function showErr(text) {
  if (!errBox) return;
  errBox.style.display = text ? "block" : "none";
  errBox.textContent = text || "";
}

function setMsg(text, type = "info") {
  if (!msg) return;
  msg.textContent = text || "";
  msg.style.color =
    type === "success" ? "#22c55e" :
    type === "error" ? "#ef4444" :
    "#e5e7eb";
}

function setStatus(text) {
  if (!statusPill) return;
  statusPill.textContent = `Status: ${text}`;
}

function pad2(n) { return String(n).padStart(2, "0"); }
function toMonthKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
function weekdayPt(d) { return ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]; }
function isoDate(y, m1, d) { return `${y}-${pad2(m1)}-${pad2(d)}`; }
function brDate(y, m1, d) { return `${pad2(d)}/${pad2(m1)}/${y}`; }

function atividadeOptions(selected = "") {
  const opts = [`<option value="">-- selecione --</option>`];
  for (const a of ATIVIDADES) {
    opts.push(`<option value="${a}" ${a === selected ? "selected" : ""}>${a}</option>`);
  }
  return opts.join("");
}

function normalizeCDList(arr) {
  return [...new Set((arr || []).map(s => (s || "").trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, "pt-BR"));
}

/* =========================
   MODAL OBSERVAÇÕES
========================= */
function openObsModal(targetTextarea){
  obsTargetTextarea = targetTextarea;

  const tr = targetTextarea.closest("tr");
  const br = tr?.querySelector("td")?.textContent || "";
  const dia = tr?.querySelectorAll("td")?.[1]?.textContent || "";

  if (obsTitle) {
    obsTitle.textContent = br && dia ? `Observações — ${br} (${dia})` : "Editar observações";
  }

  obsModalText.value = targetTextarea.value || "";

  obsModal?.classList.add("is-open");
  document.body.classList.add("modal-open");
  obsModal?.setAttribute("aria-hidden", "false");

  setTimeout(() => obsModalText?.focus(), 0);
}

function closeObsModal({ apply = false } = {}){
  if (apply && obsTargetTextarea){
    obsTargetTextarea.value = obsModalText?.value || "";
  }

  obsModal?.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  obsModal?.setAttribute("aria-hidden", "true");

  if (obsTargetTextarea) obsTargetTextarea.focus();
  obsTargetTextarea = null;
}

function initObsModalEvents(){
  if (!obsModal) return;

  obsModal.addEventListener("click", (e) => {
    const el = e.target;
    if (el?.dataset?.close === "1") closeObsModal({ apply: false });
  });

  obsOk?.addEventListener("click", () => closeObsModal({ apply: true }));
  obsCancel?.addEventListener("click", () => closeObsModal({ apply: false }));
  obsClose?.addEventListener("click", () => closeObsModal({ apply: false }));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && obsModal.classList.contains("is-open")) {
      closeObsModal({ apply: false });
    }
  });

  if (tbody){
    tbody.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.matches("textarea.field[data-field='obs']")) {
        e.preventDefault();
        openObsModal(t);
      }
    });

    tbody.addEventListener("focusin", (e) => {
      const t = e.target;
      if (t && t.matches("textarea.field[data-field='obs']")) {
        e.preventDefault();
        openObsModal(t);
      }
    });
  }
}

/* =========================
   1) RENDERIZA O MÊS
   ✅ Feriados 2026 já vêm preenchidos
   ✅ Continua editável
========================= */
function renderMonthSkeleton(yyyyMM) {
  if (!tbody) return;

  tbody.innerHTML = "";
  showErr("");
  setMsg("");
  setStatus("carregado (tabela)");

  const [yStr, mStr] = (yyyyMM || "").split("-");
  const y = Number(yStr);
  const m1 = Number(mStr);
  const m0 = m1 - 1;

  if (!y || !m1) return;

  const total = daysInMonth(y, m0);

  for (let day = 1; day <= total; day++) {
    const dt = new Date(y, m0, day);
    const sunday = dt.getDay() === 0;

    const iso = isoDate(y, m1, day);
    const br = brDate(y, m1, day);
    const dia = weekdayPt(dt);
    const feriado = getFeriadoInfo(iso);

    const tr = document.createElement("tr");
    tr.dataset.date = iso;
    tr.dataset.sunday = sunday ? "1" : "0";
    tr.dataset.feriado = feriado ? "1" : "0";

    if (sunday) {
      tr.className = "bg-white/[0.01] opacity-40 grayscale pointer-events-none border-b border-white/5";
      tr.innerHTML = `
        <td class="p-5 font-mono text-[10px] text-white/40">${br}</td>
        <td class="p-5 font-black uppercase text-[10px] tracking-widest text-[#ff3b3b] italic">${dia}</td>
        <td colspan="3" class="p-5 text-[10px] uppercase tracking-[0.2em] text-white/10 italic">Ciclo de Repouso / Bloqueado</td>
      `;
    } else {
      const atividadeDefault = feriado ? "Feriado / Ponto Facultativo" : "";
      const obsDefault = feriado ? buildFeriadoObs(iso) : "";

      if (feriado) {
        tr.className = "bg-[#fab005]/5 border-b border-[#fab005]/10 group";
      } else {
        tr.className = "hover:bg-white/[0.02] transition-colors border-b border-white/5 group";
      }

      tr.innerHTML = `
        <td class="p-5 font-mono text-[10px] text-white/50">${br}</td>
        <td class="p-5 font-black uppercase text-[10px] tracking-widest ${feriado ? 'text-[#fab005]' : 'text-white/30 group-hover:text-white/70'} italic transition-colors">${dia}</td>
        <td class="p-5">
          <input
            class="input-cyber w-full !h-11 !px-4 !text-[11px] !bg-black/20"
            data-field="cd"
            list="cdList"
            placeholder="PROCURAR CD..."
            value=""
          >
        </td>
        <td class="p-5">
          <select class="input-cyber w-full !h-11 !px-4 !text-[11px] !bg-black/20" data-field="atividade">
            ${atividadeOptions(atividadeDefault)}
          </select>
        </td>
        <td class="p-5">
          <div class="relative group/obs">
            <textarea
              class="input-cyber w-full !h-11 !py-3 !px-4 !text-[11px] overflow-hidden truncate italic !bg-black/20 cursor-pointer"
              data-field="obs"
              placeholder="DETALHES..."
              readonly
            >${obsDefault}</textarea>
            <div class="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/obs:opacity-100 transition-opacity pointer-events-none">
              <span class="text-[8px] text-[#ff3b3b]">EDITAR</span>
            </div>
          </div>
        </td>
      `;
    }

    tbody.appendChild(tr);
  }
}

/* =========================
   2) CDs
========================= */
async function loadCDsToDatalist() {
  if (!cdList) return;

  setStatus("carregando CDs…");

  let cdsFromFirestore = [];
  try {
    const snap = await getDocs(query(collection(db, CDS_COLLECTION), where("ativo", "==", true)));
    snap.forEach(d => {
      const data = d.data();
      const nome = (data?.nome || data?.cd || "").trim();
      if (nome) cdsFromFirestore.push(nome);
    });

    if (cdsFromFirestore.length === 0) {
      const snapAll = await getDocs(collection(db, CDS_COLLECTION));
      snapAll.forEach(d => {
        const data = d.data();
        const nome = (data?.nome || data?.cd || "").trim();
        if (nome) cdsFromFirestore.push(nome);
      });
    }
  } catch (e) {
    // fallback
  }

  const cdsFinal = normalizeCDList(
    cdsFromFirestore.length > 0 ? cdsFromFirestore : CDS_RAW
  );

  cdList.innerHTML = cdsFinal.map(cd => `<option value="${cd}"></option>`).join("");
  setStatus(`CDs carregados: ${cdsFinal.length}`);
}

/* =========================
   3) CARREGA FIRESTORE
   ✅ se tiver salvo, sobrepõe o padrão do feriado
========================= */
async function loadMonthFromFirestore(yyyyMM) {
  setStatus("carregando do Firebase…");

  // 1) Por uidKey (slug)
  const q1 = query(
    collection(db, AGENDA_COLLECTION),
    where("uidKey", "==", usuarioKey),
    where("yyyyMM", "==", yyyyMM)
  );

  // 2) Fallback por analyst / usuarioNome
  const q2 = query(
    collection(db, AGENDA_COLLECTION),
    where("analyst", "==", usuarioNome),
    where("yyyyMM", "==", yyyyMM)
  );

  // 3) Fallback por usuarioNome
  const q3 = query(
    collection(db, AGENDA_COLLECTION),
    where("usuarioNome", "==", usuarioNome),
    where("yyyyMM", "==", yyyyMM)
  );

  const [s1, s2, s3] = await Promise.all([
    getDocs(q1),
    getDocs(q2),
    getDocs(q3)
  ]);

  const rawItems = [];
  [...s1.docs, ...s2.docs, ...s3.docs].forEach(d => {
    const data = d.data();
    if (data.dias && typeof data.dias === "object") {
       Object.entries(data.dias).forEach(([dt, val]) => {
         rawItems.push({ data: dt, ...val });
       });
    } else {
       rawItems.push(data);
    }
  });

  const map = {};
  rawItems.forEach(it => {
    if (it.data) map[it.data] = it;
  });

  const rows = [...tbody.querySelectorAll("tr[data-date]")];
  for (const tr of rows) {
    if (tr.dataset.sunday === "1") continue;

    const dateISO = tr.dataset.date;
    const saved = map[dateISO];
    if (!saved) continue;

    tr.querySelector("[data-field='cd']").value = saved.cd || "";
    tr.querySelector("[data-field='atividade']").value = saved.atividade || "";
    tr.querySelector("[data-field='obs']").value = saved.obs || "";
  }

  setStatus("Firebase carregado");
}

/* =========================
   4) SALVA FIRESTORE
========================= */
async function saveMonthToFirestore(yyyyMM) {
  setStatus("salvando no Firebase…");
  const batch = writeBatch(db);

  const rows = [...tbody.querySelectorAll("tr[data-date]")];
  for (const tr of rows) {
    if (tr.dataset.sunday === "1") continue;

    const dataISO = tr.dataset.date;
    const cd = tr.querySelector("[data-field='cd']").value.trim();
    const atividade = tr.querySelector("[data-field='atividade']").value;
    const obs = tr.querySelector("[data-field='obs']").value.trim();

    const ref = doc(db, AGENDA_COLLECTION, `${usuarioKey}_${dataISO}`);

    if (!cd && !atividade && !obs) {
      batch.delete(ref);
      continue;
    }

    batch.set(ref, {
      uidKey: usuarioKey,
      usuarioNome,
      data: dataISO,
      yyyyMM,
      cd,
      atividade,
      obs,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
  setStatus("salvo");
}

/* =========================
   EVENTOS
========================= */
if (btnMenu) {
  btnMenu.addEventListener("click", () => {
    window.location.href = PATH_MENU;
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("user_session");
    localStorage.removeItem("usuarioLogado");
    window.location.href = PATH_INDEX;
  });
}

if (btnSalvar) {
  btnSalvar.addEventListener("click", async () => {
    try {
      showErr("");
      setMsg("Salvando…");
      await saveMonthToFirestore(monthPicker.value);
      setMsg("Salvo ✅ no Firebase", "success");
    } catch (err) {
      console.error(err);
      setMsg("Erro ao salvar.", "error");
      showErr(err?.message || String(err));
      setStatus("erro");
    }
  });
}

if (monthPicker) {
  monthPicker.addEventListener("change", async () => {
    try {
      showErr("");
      renderMonthSkeleton(monthPicker.value);
      await loadMonthFromFirestore(monthPicker.value);
      setMsg("");
    } catch (err) {
      console.error(err);
      setMsg("Não consegui carregar do Firebase, mas você pode preencher e tentar salvar.", "error");
      showErr(err?.message || String(err));
      setStatus("erro Firebase");
    }
  });
}

/* =========================
   INIT
========================= */
(async function init(){
  try {
    showErr("");

    initObsModalEvents();

    const now = new Date();
    if (monthPicker) monthPicker.value = toMonthKey(now);

    renderMonthSkeleton(monthPicker.value);

    await loadCDsToDatalist();
    await loadMonthFromFirestore(monthPicker.value);

    setMsg("Pronto. Preencha e clique em Salvar alterações.", "success");
  } catch (err) {
    console.error(err);
    setMsg("Não consegui carregar do Firebase, mas o mês já está disponível para preencher.", "error");
    showErr(err?.message || String(err));
    setStatus("erro Firebase");
  }
})();