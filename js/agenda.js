// js/agenda.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
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
   CDs – EXATAMENTE OS SEUS (COM TRATAMENTO)
========================= */
const CDS_RAW = [
  "CD - Alagoinhas",
  "CD - Andradina",
  "CD - Angra dos Reis",
  "CD - Aparecida de Goiânia",
  "CD - Araçatuba",
  "CD - Arapiraca",
  "CD - Araraquara",
  "CD - Balsas",
  "CD - Barbalha",
  "CD - Barra do Garca",
  "CD - Barreiras",
  "CD - Barretos",
  "CD - Barueri",
  "CD - Bauru",
  "CD - Belém",
  "CD - Boituva",
  "CD - Bom Jesus da Lapa",
  "CD - Brumado",
  "CD - Cachoeiro de Itapemirim",
  "CD - Camaçari",
  "CD - Campina Grande",
  "CD - Campinas",
  "CD - Campo Grande MS",
  "CD - Campo Grande RJ",
  "CD - Campos dos Goytacazes",
  "CD - Caraguatatuba",
  "CD - Cariacica",
  "CD - Carpina",
  "CD - Caruaru",
  "CD - Cascavel",
  "CD - Catanduva",
  "CD - Caucaia",
  "CD - Caxias",
  "CD - Coimbra",
  "CD - Conde",
  "CD - Conselheiro Lafaiete",
  "CD - Conselheiro Lafaiete",
  "CD - Contagem",
  "CD - Coxim",
  "CD - Cuiabá",
  "CD - Divinópolis",
  "CD - Dourados",
  "CD - Duque de Caxias",
  "CD - Eunápolis",
  "CD - Eusebio",
  "CD - Feira de Santana",
  "CD - Feira de Santana",
  "CD - Fernandópolis",
  "CD - Fernandópolis",
  "CD - Fernandópolis",
  "CD - Fernandópolis",
  "CD - Floriano",
  "CD - Garanhuns",
  "CD - Governador Valadares",
  "CD - Guarujá",
  "CD - Guarulhos Taboão",
  "CD - Iguatu",
  "CD - Imperatriz",
  "CD - Interlagos",
  "CD - Iporá",
  "CD - Irece",
  "CD - Itabaiana",
  "CD - Itaberaba",
  "CD - Itabuna",
  "CD - Itapeva",
  "CD - Itapissuma",
  "CD - Itumbiara",
  "CD - Jaboatão dos Guararapes",
  "CD - Jacobina",
  "CD - Jaguaré",
  "CD - Jequié",
  "CD - Juazeiro",
  "CD - Juiz de Fora",
  "CD - Jundiaí",
  "CD - Londrina",
  "CD - Macaiba",
  "CD - Maceió",
  "CD - Marília",
  "CD - Mogi-Mirim",
  "CD - Montes Claros",
  "CD - Mossoró",
  "CD - Muriaé",
  "CD - Nossa Senhora do Socorro",
  "CD - Nova Friburgo",
  "CD - Palhoça",
  "CD - Paranaíba",
  "CD - Parnaiba",
  "CD - Parnaiba",
  "CD - Passos",
  "CD - Passos",
  "CD - Patos",
  "CD - Paulo Afonso",
  "CD - Petrolina",
  "CD - Petrópolis",
  "CD - Picos",
  "CD - Piracicaba",
  "CD - Poços de Caldas",
  "CD - Poços de Caldas",
  "CD - Porto Velho",
  "CD - Pouso Alegre",
  "CD - Presidente Prudente",
  "CD - Recife",
  "CD - Registro",
  "CD - Ribeirão Preto",
  "CD - Rio Branco",
  "CD - Rio das Ostras",
  "CD - Rio Verde",
  "CD - Rondonópolis",
  "CD - Salto",
  "CD - Salvador",
  "CD - Salvador Leste",
  "CD - Santa Inês",
  "CD - Santo Antonio de Jesus",
  "CD - São Bernardo",
  "CD - São Cristovão",
  "CD - São Gonçalo",
  "CD - São João de Meriti",
  "CD - São José do Rio Preto",
  "CD - São José dos Campos",
  "CD - São José dos Pinhais",
  "CD - São Luis",
  "CD - São Mateus",
  "CD - São Pedro da Aldeia",
  "CD - Sapucaia do Sul",
  "CD - Serra Talhada",
  "CD - Serrinha",
  "CD - Sete Lagoas",
  "CD - Sete Lagoas",
  "CD - Sinop",
  "CD - Sobral",
  "CD - Sousa",
  "CD - Taboão da Serra",
  "CD - Taguatinga",
  "CD - Taubaté",
  "CD - Teixeira de Freitas",
  "CD - Teresina",
  "CD - Três Lagoas",
  "CD - Uberaba",
  "CD - Varginha",
  "CD - Vila Guilherme",
  "CD - Vitória da Conquista",
  "CD - Volta Redonda"
];

// normaliza e remove duplicados
const normalize = (s) => String(s || "")
  .replace(/\s+/g, " ")
  .trim();

const CDS = Array.from(new Set(CDS_RAW.map(normalize)))
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

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
   STATE
========================= */
let currentUser = null;
let currentMonthKey = "";
let analystLabel = "";

/* =========================
   UTILS
========================= */
function setMsg(text, type = "error") {
  msg.textContent = text || "";
  msg.style.color = type === "success" ? "#065f46" : "#b91c1c";
}

function toMonthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBRDate(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function weekdayPt(d) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()];
}

function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}

function isSunday(d) {
  return d.getDay() === 0;
}

function buildAtividadeOptions(selected = "") {
  return [
    `<option value="">-- selecione --</option>`,
    ...ATIVIDADES.map((a) => `<option value="${a}" ${a === selected ? "selected" : ""}>${a}</option>`)
  ].join("");
}

/* =========================
   STATUS VISUAL (verde claro)
========================= */
function updateRowStatus(tr) {
  if (!tr || tr.dataset.sunday === "1") return;

  const cd = tr.querySelector("[data-field='cd']")?.value?.trim() || "";
  const atividade = tr.querySelector("[data-field='atividade']")?.value || "";

  if (cd && atividade) tr.classList.add("agenda-ok");
  else tr.classList.remove("agenda-ok");
}

/* =========================
   NAV
========================= */
btnMenu?.addEventListener("click", () => {
  window.location.href = "./menu.html";
});

btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

monthPicker?.addEventListener("change", async () => {
  const val = monthPicker.value;
  if (!val) return;
  currentMonthKey = val;
  await renderMonth(currentMonthKey);
});

/* =========================
   AUTH
========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  currentUser = user;
 analystLabel = (localStorage.getItem("usuarioLogado") || "").trim() || `uid:${user.uid.slice(0,6)}`;


  userInfo.textContent = `Logado como: ${analystLabel}`;

  if (!cdList) {
    setMsg("ERRO: faltou <datalist id='cdList'></datalist> no criar-agenda.html", "error");
    return;
  }

  // ✅ carrega TODOS os CDs no datalist
  cdList.innerHTML = CDS.map((cd) => `<option value="${cd}"></option>`).join("");

  const now = new Date();
  currentMonthKey = toMonthKey(now);
  monthPicker.value = currentMonthKey;

  await renderMonth(currentMonthKey);
});

/* =========================
   SAVE
========================= */
btnSalvar?.addEventListener("click", async () => {
  if (!currentUser) return;

  setMsg("");
  btnSalvar.disabled = true;

  try {
    const rows = [...tbody.querySelectorAll("tr[data-date]")];
    let saved = 0;

    for (const tr of rows) {
      if (tr.dataset.sunday === "1") continue;

      const dateISO = tr.dataset.date;
      const cd = tr.querySelector("input[data-field='cd']")?.value?.trim() || "";
      const atividade = tr.querySelector("select[data-field='atividade']")?.value || "";
      const obs = tr.querySelector("input[data-field='obs']")?.value?.trim() || "";

      // pula linha vazia
      if (!cd && !atividade && !obs) continue;

      // valida CD/Atividade
      if (cd && !CDS.includes(cd)) {
        throw new Error(`CD inválido no dia ${dateISO}. Use a pesquisa e selecione um CD da lista.`);
      }
      if (atividade && !ATIVIDADES.includes(atividade)) {
        throw new Error(`Atividade inválida no dia ${dateISO}.`);
      }

      const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();

      await setDoc(
        doc(db, "agenda_dias", `${usuarioKey}_${dateISO}`),
        {
          uid: currentUser.uid,
          uidKey: usuarioKey, // Compatibilidade com o visualizador
          email: (currentUser.email || "").toLowerCase(),
          analyst: analystLabel,
          monthKey: currentMonthKey,
          yyyyMM: currentMonthKey, // Compatibilidade com o visualizador
          date: dateISO,
          data: dateISO, // Compatibilidade
          weekday: weekdayPt(new Date(dateISO + "T00:00:00")),
          cd,
          atividade,
          observacoes: obs,
          obs, // Compatibilidade
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        },
        { merge: true }
      );

      saved++;
    }

    setMsg(`Salvo ✅ (${saved} dia(s))`, "success");
    await renderMonth(currentMonthKey);
  } catch (err) {
    console.error("[AGENDA] erro salvar:", err);
    const code = err?.code || "";
    if (code === "permission-denied") {
      setMsg("Permissão negada ao SALVAR. Verifique as Rules (agenda_dias).", "error");
    } else {
      setMsg(err?.message || "Falha ao salvar. Veja o console (F12).", "error");
    }
  } finally {
    btnSalvar.disabled = false;
  }
});

/* =========================
   LOAD (SEM orderBy, SEM índice composto)
========================= */
async function loadAgendaDocsNoIndex(monthKey) {
  const usuarioKey = String(localStorage.getItem("usuarioKey") || "").trim();
  const usuario = (localStorage.getItem("usuarioLogado") || "").trim();

  // 1) Query by uidKey
  const q1 = query(collection(db, "agenda_dias"), where("uidKey", "==", usuarioKey));
  const s1 = await getDocs(q1);
  const a1 = s1.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2) Query by analyst (fallback)
  let a2 = [];
  if (usuario) {
    const q2 = query(collection(db, "agenda_dias"), where("analyst", "==", usuario));
    const s2 = await getDocs(q2);
    a2 = s2.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // Merge
  const map = new Map();
  [...a1, ...a2].forEach(x => map.set(x.id, x));
  const rawAll = Array.from(map.values());

  const items = [];
  rawAll.forEach(data => {
    if (data.dias && typeof data.dias === "object") {
       Object.entries(data.dias).forEach(([dt, val]) => {
         items.push({ date: dt, data: dt, ...val });
       });
    } else {
       items.push({ date: data.date || data.data, ...data });
    }
  });

  return items
    .filter((x) => (x.yyyyMM === monthKey || x.monthKey === monthKey || (x.date && x.date.startsWith(monthKey))))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/* =========================
   RENDER
========================= */
async function renderMonth(monthKey) {
  tbody.innerHTML = "";

  const [yStr, mStr] = monthKey.split("-");
  const year = Number(yStr);
  const monthIndex0 = Number(mStr) - 1;

  const totalDays = daysInMonth(year, monthIndex0);
  const rowsByDate = new Map();
  const todayISO = formatISODate(new Date());

  for (let day = 1; day <= totalDays; day++) {
    const dt = new Date(year, monthIndex0, day);
    const iso = formatISODate(dt);
    const br = formatBRDate(dt);
    const dia = weekdayPt(dt);
    const sunday = isSunday(dt);

    const tr = document.createElement("tr");
    tr.dataset.date = iso;
    tr.dataset.sunday = sunday ? "1" : "0";
    tr.classList.add("agenda-row");
    if (iso === todayISO) tr.classList.add("is-today");
    if (sunday) tr.classList.add("is-sunday");

    if (sunday) {
      tr.innerHTML = `
        <td>${br}</td>
        <td>${dia}</td>
        <td><span class="pill pill-analyst">${analystLabel}</span></td>
        <td colspan="3"><span class="sunday-note">Domingo (sem agenda) — dia bloqueado</span></td>
      `;
    } else {
      tr.innerHTML = `
        <td>${br}</td>
        <td>${dia}</td>
        <td><span class="pill pill-analyst">${analystLabel}</span></td>
        <td><input data-field="cd" list="cdList" placeholder="Pesquisar CD..." /></td>
        <td><select data-field="atividade">${buildAtividadeOptions("")}</select></td>
        <td><input data-field="obs" type="text" placeholder="Observações do dia..." style="width:100%;" /></td>
      `;

      // listeners para pintar verde em tempo real
      const cdInput = tr.querySelector("[data-field='cd']");
      const atSel = tr.querySelector("[data-field='atividade']");
      cdInput.addEventListener("input", () => updateRowStatus(tr));
      atSel.addEventListener("change", () => updateRowStatus(tr));
    }

    tbody.appendChild(tr);
    rowsByDate.set(iso, tr);
  }

  try {
    const docs = await loadAgendaDocsNoIndex(monthKey);

    docs.forEach((data) => {
      const tr = rowsByDate.get(data.date);
      if (!tr || tr.dataset.sunday === "1") return;

      tr.querySelector("[data-field='cd']").value = data.cd || "";
      tr.querySelector("[data-field='atividade']").value = data.atividade || "";
      tr.querySelector("[data-field='obs']").value = data.observacoes || "";

      // pinta verde ao carregar
      updateRowStatus(tr);
    });

    setMsg("");
  } catch (err) {
    console.error("[AGENDA] erro carregar:", err);
    const code = err?.code || "";
    if (code === "permission-denied") {
      setMsg("Permissão negada ao CARREGAR. Verifique as Rules (agenda_dias).", "error");
    } else {
      setMsg("Falha ao carregar agenda. Veja o console (F12).", "error");
    }
  }
}
