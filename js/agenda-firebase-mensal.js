import { db } from "./firebase.js";
import {
  collection, getDocs, query, where,
  doc, writeBatch
} from "firebase/firestore";

/* =========================
   CONFIG
========================= */
const AGENDA_COLLECTION = "agenda_dias";
const CDS_COLLECTION = "cds"; // se existir

/* =========================
   FALLBACK CDs (se não tiver cds no Firestore)
   -> você pode colar aqui a lista completa depois
========================= */
const CDS_FALLBACK = [
  "CD - Aparecida de Goiânia",
  "CD - Boituva",
  "CD - Jaguaré",
  "CD - Salvador",
  "CD - Fernandópolis"
].sort((a, b) => a.localeCompare(b, "pt-BR"));

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
const errBox = document.getElementById("errBox");
const cdList = document.getElementById("cdList");

/* =========================
   Sessão (localStorage)
   -> você usa NOME, sem auth
   -> vamos criar uma chave estável "usuarioKey"
========================= */
const usuarioNome = (localStorage.getItem("usuarioLogado") || "").trim();
if (!usuarioNome) window.location.href = "index.html";

// Se você quiser, no login salve também: localStorage.setItem("usuarioKey","euclecio")
const usuarioKey = (localStorage.getItem("usuarioKey") || slug(usuarioNome)).trim();

userInfo.textContent = `Usuário: ${usuarioNome} (${usuarioKey})`;

/* =========================
   NAV
========================= */
btnMenu.addEventListener("click", () => window.location.href = "menu.html");
btnLogout.addEventListener("click", () => {
  localStorage.removeItem("usuarioLogado");
  localStorage.removeItem("usuarioKey");
  window.location.href = "index.html";
});

/* =========================
   Helpers
========================= */
function showErr(text) {
  errBox.style.display = text ? "block" : "none";
  errBox.textContent = text || "";
}

function setMsg(text, type = "info") {
  msg.textContent = text || "";
  msg.style.color = (type === "success") ? "#22c55e" : (type === "error" ? "#ef4444" : "#d1d5db");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function toMonthKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }

function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }

function weekdayPt(d) { return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()]; }

function formatISODate(y, m1, d) { return `${y}-${pad2(m1)}-${pad2(d)}`; }

function formatBRDate(y, m1, d) { return `${pad2(d)}/${pad2(m1)}/${y}`; }

function slug(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildAtividadeOptions(selected = "") {
  const opts = [`<option value="">-- selecione --</option>`];
  for (const a of ATIVIDADES) {
    opts.push(`<option value="${a}" ${a === selected ? "selected" : ""}>${a}</option>`);
  }
  return opts.join("");
}

/* =========================
   1) Render do mês (SEM FIREBASE)
   -> sempre desenha as linhas, sem depender de nada
========================= */
function renderMonthSkeleton(yyyyMM) {
  tbody.innerHTML = "";
  setMsg("");
  showErr("");

  const [yStr, mStr] = yyyyMM.split("-");
  const y = Number(yStr);
  const m1 = Number(mStr);
  const m0 = m1 - 1;
  const total = daysInMonth(y, m0);

  for (let day = 1; day <= total; day++) {
    const dt = new Date(y, m0, day);
    const sunday = dt.getDay() === 0;

    const iso = formatISODate(y, m1, day);
    const br = formatBRDate(y, m1, day);
    const dia = weekdayPt(dt);

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
        <td><input data-field="cd" list="cdList" placeholder="Pesquisar CD..." value=""></td>
        <td><select data-field="atividade">${buildAtividadeOptions("")}</select></td>
        <td><input data-field="obs" placeholder="Observações..." value=""></td>
      `;
    }

    tbody.appendChild(tr);
  }
}

/* =========================
   2) CDs: Firestore -> datalist (se falhar, fallback)
========================= */
async function loadCDs() {
  let cds = [];

  try {
    const snapAtivos = await getDocs(query(collection(db, CDS_COLLECTION), where("ativo", "==", true)));
    snapAtivos.forEach(d => {
      const data = d.data();
      const nome = (data?.nome || data?.cd || "").trim();
      if (nome) cds.push(nome);
    });
  } catch (e) {
    // ignora e tenta all
  }

  if (cds.length === 0) {
    try {
      const snapAll = await getDocs(collection(db, CDS_COLLECTION));
      snapAll.forEach(d => {
        const data = d.data();
        const nome = (data?.nome || data?.cd || "").trim();
        if (nome) cds.push(nome);
      });
    } catch (e) {
      // ignora e usa fallback
    }
  }

  if (cds.length === 0) cds = CDS_FALLBACK;

  cds = [...new Set(cds)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  cdList.innerHTML = cds.map(cd => `<option value="${cd}"></option>`).join("");
}

/* =========================
   3) Carregar mês do Firestore
   -> pega docs: uidKey == usuarioKey AND yyyyMM == mes
   -> aplica nos inputs já renderizados
========================= */
async function loadMonthFromFirestore(yyyyMM) {
  // query por usuarioKey + yyyyMM
  const snap = await getDocs(
    query(
      collection(db, AGENDA_COLLECTION),
      where("uidKey", "==", usuarioKey),
      where("yyyyMM", "==", yyyyMM)
    )
  );

  const map = {};
  snap.forEach(d => {
    const a = d.data();
    if (a?.data) {
      map[a.data] = {
        cd: a.cd || "",
        atividade: a.atividade || "",
        obs: a.obs || ""
      };
    }
  });

  // aplica na tabela
  const rows = [...tbody.querySelectorAll("tr[data-date]")];
  for (const tr of rows) {
    if (tr.dataset.sunday === "1") continue;
    const dateISO = tr.dataset.date;
    const saved = map[dateISO];

    if (saved) {
      tr.querySelector("[data-field='cd']").value = saved.cd || "";
      tr.querySelector("[data-field='atividade']").value = saved.atividade || "";
      tr.querySelector("[data-field='obs']").value = saved.obs || "";
    }
  }
}

/* =========================
   4) Salvar mês no Firestore
   -> docId: {usuarioKey}_{YYYY-MM-DD}
   -> salva só linhas preenchidas, e apaga as vazias
========================= */
async function saveMonthToFirestore(yyyyMM) {
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
      data: dataISO,     // ✅ sempre ISO (facilita Admin)
      yyyyMM,
      cd,
      atividade,
      obs,
      updatedAt: Date.now()
    }, { merge: true });
  }

  await batch.commit();
}

/* =========================
   Eventos
========================= */
btnSalvar.addEventListener("click", async () => {
  try {
    showErr("");
    const yyyyMM = monthPicker.value;
    if (!yyyyMM) return setMsg("Selecione um mês.", "error");

    setMsg("Salvando no Firebase…");
    await saveMonthToFirestore(yyyyMM);
    setMsg("Salvo ✅ (Firebase)", "success");
  } catch (err) {
    console.error(err);
    setMsg("Erro ao salvar.", "error");
    showErr(err?.message || String(err));
  }
});

monthPicker.addEventListener("change", async () => {
  try {
    showErr("");
    if (!monthPicker.value) return;

    // 1) sempre renderiza
    renderMonthSkeleton(monthPicker.value);

    // 2) tenta carregar do firebase
    setMsg("Carregando do Firebase…");
    await loadMonthFromFirestore(monthPicker.value);
    setMsg("");
  } catch (err) {
    console.error(err);
    setMsg("Não consegui carregar do Firebase, mas você pode preencher e salvar.", "error");
    showErr(err?.message || String(err));
  }
});

/* =========================
   INIT (sempre aparece mês)
========================= */
(async function init() {
  try {
    showErr("");
    const now = new Date();
    monthPicker.value = toMonthKey(now);

    // 1) desenha o mês SEMPRE
    renderMonthSkeleton(monthPicker.value);

    // 2) CDs (autocomplete)
    await loadCDs();

    // 3) tenta carregar do Firebase (se falhar, não trava)
    setMsg("Carregando do Firebase…");
    await loadMonthFromFirestore(monthPicker.value);
    setMsg("");
  } catch (err) {
    console.error(err);
    setMsg("Não consegui carregar do Firebase, mas você pode preencher e salvar.", "error");
    showErr(err?.message || String(err));
  }
})();