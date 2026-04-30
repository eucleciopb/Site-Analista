// js/agenda-firebase.js
import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";

/* =========================
   ATIVIDADES
========================= */
const ATIVIDADES = [
  "Analise Interna",
  "Dia Interno",
  "Rota",
  "Plano de Ação com os Gestores",
  "Reunião GRC ou Diretor",
  "Alinhamento com outras áreas"
];

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
const cdList = document.getElementById("cdList");

/* =========================
   Sessão (localStorage)
   Você está usando o NOME como login:
   localStorage.setItem("usuarioLogado", "Euclecio")
========================= */
const usuarioNome = (localStorage.getItem("usuarioLogado") || "").trim();
if (!usuarioNome) window.location.href = "index.html";
userInfo.textContent = `Usuário: ${usuarioNome}`;

/* =========================
   NAV
========================= */
btnMenu.addEventListener("click", () => window.location.href = "menu.html");
btnLogout.addEventListener("click", () => {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
});

/* =========================
   Helpers UI
========================= */
function setMsg(text, type="info") {
  msg.textContent = text || "";
  msg.style.color = (type === "success") ? "#16a34a" : (type === "error" ? "#dc2626" : "#6b7280");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function toMonthKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}

function weekdayPt(d) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()];
}

function formatISODate(y, m1, d) {
  return `${y}-${pad2(m1)}-${pad2(d)}`;
}

function formatBRDate(y, m1, d) {
  return `${pad2(d)}/${pad2(m1)}/${y}`;
}

function buildAtividadeOptions(selected = "") {
  const opts = [`<option value="">-- selecione --</option>`];
  for (const a of ATIVIDADES) {
    opts.push(`<option value="${a}" ${a === selected ? "selected" : ""}>${a}</option>`);
  }
  return opts.join("");
}

/* =========================
   🔥 100% CDs vindo do Firestore
   Coleção: cds
   Documento: { nome: "CD - Boituva", ativo: true }
========================= */
async function loadCDsFromFirestore() {
  let arr = [];

  // tenta filtrar ativos
  try {
    const snapAtivos = await getDocs(query(collection(db, "cds"), where("ativo", "==", true)));
    snapAtivos.forEach(docu => {
      const d = docu.data();
      const nome = (d?.nome || d?.cd || "").trim();
      if (nome) arr.push(nome);
    });
  } catch (e) {
    console.warn("Falha lendo cds ativos:", e);
  }

  // fallback: pega tudo
  if (arr.length === 0) {
    try {
      const snapAll = await getDocs(collection(db, "cds"));
      snapAll.forEach(docu => {
        const d = docu.data();
        const nome = (d?.nome || d?.cd || "").trim();
        if (nome) arr.push(nome);
      });
    } catch (e) {
      console.warn("Falha lendo cds (all):", e);
    }
  }

  // remove duplicados + ordena
  arr = [...new Set(arr)].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // se não existir coleção cds ainda, mostra aviso
  if (arr.length === 0) {
    setMsg("⚠️ Nenhum CD encontrado no Firestore (coleção 'cds'). Cadastre os CDs para aparecerem na lista.", "error");
  }

  return arr;
}

async function fillCdDatalist() {
  const cds = await loadCDsFromFirestore();
  cdList.innerHTML = cds.map(cd => `<option value="${cd}"></option>`).join("");
}

/* =========================
   Usuários
   Coleção: usuarios
   Precisa ter docs com campo: nome
   (docId pode ser qualquer, mas o mais correto é ser UID)
========================= */
async function getUidByName(nome) {
  try {
    const snap = await getDocs(query(collection(db, "usuarios"), where("nome", "==", nome)));
    let uid = null;
    snap.forEach(d => { uid = d.id; });
    
    if (!uid) {
       // Tenta busca insensitiva ou slug
       const slugged = (nome || "").toLowerCase().trim();
       const snap2 = await getDocs(collection(db, "usuarios"));
       snap2.forEach(d => {
         const data = d.data();
         if (data.nome?.toLowerCase().trim() === slugged) uid = d.id;
       });
    }

    return uid;
  } catch (e) {
    console.warn("Erro ao buscar UID:", e);
    return null;
  }
}

/* =========================
   Modelo Firestore agenda_dias (um doc por usuário+mês)
   Coleção: agenda_dias
   docId: agenda_{uid}_{yyyyMM}

   {
     uid: "...",
     usuarioNome: "...",
     yyyyMM: "2026-02",
     dias: {
       "2026-02-19": { cd:"CD - Boituva", atividade:"Dia Interno", obs:"..." }
     },
     updatedAt: number
   }
========================= */
function agendaDocId(uid, yyyyMM) {
  return `agenda_${uid}_${yyyyMM}`;
}

async function loadMonthFromFirestore(uid, yyyyMM) {
  const ref = doc(db, "agenda_dias", agendaDocId(uid, yyyyMM));
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  return data?.dias || {};
}

async function saveMonthToFirestore(uid, yyyyMM, diasObj) {
  const ref = doc(db, "agenda_dias", agendaDocId(uid, yyyyMM));
  await setDoc(ref, {
    uid,
    usuarioNome,
    yyyyMM,
    dias: diasObj,
    updatedAt: Date.now()
  }, { merge: true });
}

/* =========================
   Render mês
========================= */
async function renderMonth(uid, yyyyMM) {
  tbody.innerHTML = "";
  setMsg("");

  const [yStr, mStr] = yyyyMM.split("-");
  const y = Number(yStr);
  const m1 = Number(mStr);
  const m0 = m1 - 1;

  const savedDias = await loadMonthFromFirestore(uid, yyyyMM);
  const total = daysInMonth(y, m0);

  for (let day = 1; day <= total; day++) {
    const dt = new Date(y, m0, day);
    const sunday = dt.getDay() === 0;

    const iso = formatISODate(y, m1, day); // ✅ chave ISO
    const br = formatBRDate(y, m1, day);
    const dia = weekdayPt(dt);

    const row = savedDias[iso] || { cd: "", atividade: "", obs: "" };

    const tr = document.createElement("tr");
    tr.dataset.date = iso;
    tr.dataset.sunday = sunday ? "1" : "0";

    if (sunday) {
      tr.innerHTML = `
        <td>${br}</td>
        <td>${dia}</td>
        <td>${usuarioNome}</td>
        <td colspan="3" style="opacity:.7;">Domingo bloqueado</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${br}</td>
        <td>${dia}</td>
        <td>${usuarioNome}</td>
        <td><input data-field="cd" list="cdList" placeholder="Pesquisar CD..." value="${row.cd || ""}"></td>
        <td><select data-field="atividade">${buildAtividadeOptions(row.atividade || "")}</select></td>
        <td><input data-field="obs" placeholder="Observações..." value="${row.obs || ""}"></td>
      `;
    }

    tbody.appendChild(tr);
  }
}

/* =========================
   Salvar
========================= */
btnSalvar.addEventListener("click", async () => {
  try {
    const yyyyMM = monthPicker.value;
    if (!yyyyMM) return setMsg("Selecione um mês.", "error");

    setMsg("Salvando…");

    const uid = await getUidByName(usuarioNome);
    if (!uid) {
      return setMsg(
        "Usuário não encontrado em 'usuarios'. Cadastre um doc em /usuarios com campo nome exatamente igual ao login.",
        "error"
      );
    }

    const dias = await loadMonthFromFirestore(uid, yyyyMM);

    const rows = [...tbody.querySelectorAll("tr[data-date]")];
    for (const tr of rows) {
      if (tr.dataset.sunday === "1") continue;

      const date = tr.dataset.date; // ISO
      const cd = tr.querySelector("[data-field='cd']").value.trim();
      const atividade = tr.querySelector("[data-field='atividade']").value;
      const obs = tr.querySelector("[data-field='obs']").value.trim();

      // se vazio, remove pra não poluir
      if (!cd && !atividade && !obs) {
        delete dias[date];
        continue;
      }

      dias[date] = { cd, atividade, obs };
    }

    await saveMonthToFirestore(uid, yyyyMM, dias);
    setMsg("Salvo ✅ (Firestore)", "success");

  } catch (err) {
    console.error(err);
    setMsg(`Erro ao salvar: ${err?.message || err}`, "error");
  }
});

/* =========================
   Init
========================= */
(async function init(){
  try {
    const now = new Date();
    monthPicker.value = toMonthKey(now);

    // carrega CDs do Firestore (100%)
    await fillCdDatalist();

    // carrega uid do usuário
    const uid = await getUidByName(usuarioNome);
    if (!uid) {
      setMsg("Usuário não encontrado em 'usuarios'. Cadastre o usuário para liberar salvar no Firestore.", "error");
      tbody.innerHTML = `<tr><td colspan="6">Cadastre o usuário na coleção <b>usuarios</b> (campo <b>nome</b>).</td></tr>`;
      return;
    }

    await renderMonth(uid, monthPicker.value);

    monthPicker.addEventListener("change", async () => {
      if (!monthPicker.value) return;
      await renderMonth(uid, monthPicker.value);
    });

  } catch (err) {
    console.error(err);
    setMsg(`Erro ao iniciar: ${err?.message || err}`, "error");
  }
})();
