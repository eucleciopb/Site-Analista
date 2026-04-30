// js/minhas-solicitacoes.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const userInfo = document.getElementById("userInfo");
const msg = document.getElementById("msg");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const selFiltro = document.getElementById("selFiltro");
const tbody = document.getElementById("tbody");
const countLabel = document.getElementById("countLabel");

let currentUser = null;

function setMsg(text, type="error"){
  msg.textContent = text || "";
  msg.style.color = type==="success" ? "#065f46" : "#b91c1c";
}

btnMenu.addEventListener("click", ()=> window.location.href="./menu.html");
btnLogout.addEventListener("click", async ()=>{ await signOut(auth); window.location.href="./index.html"; });

selFiltro.addEventListener("change", ()=> loadList());

function badgeStatus(s){
  const map = {
    ABERTO: "badge badge-red",
    EM_ANDAMENTO: "badge badge-blue",
    AGUARDANDO_SOLICITANTE: "badge badge-amber",
    CONCLUIDO: "badge badge-green"
  };
  return map[s] || "badge";
}

function retornoBadge(unreadForCreator){
  return unreadForCreator
    ? `<span class="badge badge-blue">NOVO</span>`
    : `<span class="badge">—</span>`;
}

function rowHTML(c){
  const status = c.status || "ABERTO";
  const tipo = c.tipo || "-";
  const prio = c.prioridade || "-";
  const para = (c.assignedToEmail || "-").toLowerCase();
  const titulo = c.titulo || "-";
  const cd = c.cd || "-";

  const temRetorno = c.unreadForCreator === true;

  return `
    <tr class="${temRetorno ? "row-unread" : ""}">
      <td><span class="${badgeStatus(status)}">${status}</span></td>
      <td>${tipo}</td>
      <td>${prio}</td>
      <td>${para}</td>
      <td style="font-weight:${temRetorno ? 900 : 700};">${titulo}</td>
      <td>${cd}</td>
      <td>${retornoBadge(temRetorno)}</td>
      <td><button class="btn-mini" data-open="${c._id}">Abrir</button></td>
    </tr>
  `;
}

async function loadList(){
  if (!currentUser) return;

  setMsg("");
  tbody.innerHTML = "";

  try{
    // Sem índice composto: só where createdByUid e ordena no JS
    const q = query(
      collection(db,"chamados"),
      where("createdByUid","==", currentUser.uid)
    );

    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ _id: d.id, ...(d.data()||{}) }));

    const filtro = selFiltro.value;

    if (filtro === "EM_ABERTO") {
      list = list.filter(x => x.status !== "CONCLUIDO");
    } else if (filtro === "CONCLUIDOS") {
      list = list.filter(x => x.status === "CONCLUIDO");
    }

    list.sort((a,b)=>{
      const ta = a.updatedAt?.seconds || a.lastMessageAt?.seconds || a.createdAt?.seconds || 0;
      const tb = b.updatedAt?.seconds || b.lastMessageAt?.seconds || b.createdAt?.seconds || 0;
      return tb - ta;
    });

    countLabel.textContent = String(list.length);
    tbody.innerHTML = list.map(rowHTML).join("");

    tbody.querySelectorAll("[data-open]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-open");
        window.location.href = `./chamado-detalhe.html?id=${encodeURIComponent(id)}`;
      });
    });

  }catch(err){
    console.error("[MINHAS] erro:", err);
    if (err?.code === "permission-denied") setMsg("Permissão negada. Verifique Rules (chamados).", "error");
    else setMsg("Falha ao carregar. Veja o console (F12).", "error");
  }
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="./index.html"; return; }
  currentUser = user;
  userInfo.textContent = `Logado como: ${(user.email||"").toLowerCase()}`;
  await loadList();
});
