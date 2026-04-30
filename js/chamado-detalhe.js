// js/chamado-detalhe.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  getDocs,
  query
} from "firebase/firestore";

const userInfo = document.getElementById("userInfo");
const msg = document.getElementById("msg");

const btnLogout = document.getElementById("btnLogout");
const btnBack = document.getElementById("btnBack");

const title = document.getElementById("title");
const meta = document.getElementById("meta");
const fromEl = document.getElementById("from");
const toEl = document.getElementById("to");
const prioEl = document.getElementById("prio");
const descEl = document.getElementById("desc");

const selStatus = document.getElementById("selStatus");
const msgsEl = document.getElementById("msgs");
const inpMsg = document.getElementById("inpMsg");

const btnSend = document.getElementById("btnSend");
const btnSave = document.getElementById("btnSave");

let currentUser = null;
let called = null;
let calledId = null;

function setMsg(text, type="error"){
  msg.textContent = text || "";
  msg.style.color = type==="success" ? "#065f46" : "#b91c1c";
}

btnLogout.addEventListener("click", async ()=>{ await signOut(auth); window.location.href="./index.html"; });
btnBack.addEventListener("click", ()=> window.location.href="./notificacoes.html");

function getIdFromUrl(){
  const p = new URLSearchParams(window.location.search);
  return p.get("id");
}

function isAssigned(){
  return called?.assignedToUid === currentUser?.uid;
}
function isCreator(){
  return called?.createdByUid === currentUser?.uid;
}

async function loadMensagens(){
  msgsEl.innerHTML = "";
  const q = query(collection(db, "chamados", calledId, "mensagens"));
  const snap = await getDocs(q);

  const list = snap.docs.map(d => d.data());
  list.sort((a,b)=> (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));

  msgsEl.innerHTML = list.map(m => {
    const who = (m.email || "").toLowerCase();
    const text = (m.texto || "");
    return `<div class="msg-item"><div class="msg-who">${who}</div><div class="msg-text">${text}</div></div>`;
  }).join("");
}

async function markAsReadIfNeeded(){
  const ref = doc(db, "chamados", calledId);

  // se eu sou o assigned -> marca unreadForAssigned false
  if (isAssigned() && called.unreadForAssigned === true) {
    await updateDoc(ref, { unreadForAssigned: false, updatedAt: serverTimestamp() });
  }

  // se eu sou o creator -> marca unreadForCreator false
  if (isCreator() && called.unreadForCreator === true) {
    await updateDoc(ref, { unreadForCreator: false, updatedAt: serverTimestamp() });
  }
}

btnSave.addEventListener("click", async ()=>{
  if (!calledId) return;
  setMsg("");
  btnSave.disabled = true;

  try{
    const ref = doc(db, "chamados", calledId);
    const newStatus = selStatus.value;

    // regra de negócio simples:
    // - assigned pode mudar status
    // - creator pode mudar para "CONCLUIDO" apenas se quiser fechar (opcional)
    await updateDoc(ref, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });

    setMsg("Status atualizado ✅", "success");
  }catch(err){
    console.error("[DETALHE] save status:", err);
    if (err?.code === "permission-denied") setMsg("Permissão negada ao atualizar status. Verifique Rules.", "error");
    else setMsg("Falha ao salvar status. Veja o console (F12).", "error");
  }finally{
    btnSave.disabled = false;
  }
});

btnSend.addEventListener("click", async ()=>{
  if (!calledId) return;

  setMsg("");
  btnSend.disabled = true;

  try{
    const texto = inpMsg.value.trim();
    if (!texto) throw new Error("Digite uma resposta.");

    // grava mensagem
    await addDoc(collection(db, "chamados", calledId, "mensagens"), {
      uid: currentUser.uid,
      email: (currentUser.email || "").toLowerCase(),
      texto,
      createdAt: serverTimestamp()
    });

    // atualiza chamado: quem deve receber notificação agora?
    const ref = doc(db, "chamados", calledId);

    const patch = {
      lastMessageByUid: currentUser.uid,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // se quem respondeu foi o assigned, notifica o criador
    if (isAssigned()) {
      patch.unreadForCreator = true;
      patch.unreadForAssigned = false;
      patch.status = selStatus.value || "EM_ANDAMENTO";
    }

    // se quem respondeu foi o criador, notifica o assigned
    if (isCreator()) {
      patch.unreadForAssigned = true;
      patch.unreadForCreator = false;
      // criador normalmente coloca como aguardando execução:
      if (patch.status !== "CONCLUIDO") patch.status = "ABERTO";
    }

    await updateDoc(ref, patch);

    inpMsg.value = "";
    await loadMensagens();

    setMsg("Resposta enviada ✅", "success");
  }catch(err){
    console.error("[DETALHE] send:", err);
    if (err?.code === "permission-denied") setMsg("Permissão negada ao responder. Verifique Rules.", "error");
    else setMsg(err?.message || "Falha ao enviar.", "error");
  }finally{
    btnSend.disabled = false;
  }
});

async function loadChamado(){
  const ref = doc(db, "chamados", calledId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Chamado não encontrado.");

  called = snap.data();

  title.textContent = called.titulo || "Chamado";
  meta.textContent = `${called.tipo || "-"} • ${called.cd || "Sem CD"} • ${called.status || "ABERTO"}`;

  fromEl.textContent = called.createdByEmail || "-";
  toEl.textContent = called.assignedToEmail || "-";
  prioEl.textContent = called.prioridade || "-";
  descEl.textContent = called.descricao || "-";

  selStatus.value = called.status || "ABERTO";

  // marca como lido se necessário
  await markAsReadIfNeeded();

  // mensagens
  await loadMensagens();
}

onAuthStateChanged(auth, async (user)=>{
  if (!user) { window.location.href="./index.html"; return; }
  currentUser = user;
  userInfo.textContent = `Logado como: ${(user.email || "").toLowerCase()}`;

  calledId = getIdFromUrl();
  if (!calledId) {
    setMsg("ID do chamado não informado.", "error");
    return;
  }

  try{
    await loadChamado();
  }catch(err){
    console.error("[DETALHE] load:", err);
    setMsg(err?.message || "Falha ao carregar chamado.", "error");
  }
});
