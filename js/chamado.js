// js/chamado.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query
} from "firebase/firestore";

const userInfo = document.getElementById("userInfo");
const msg = document.getElementById("msg");

const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const usersList = document.getElementById("usersList");
const inpPara = document.getElementById("inpPara");
const selTipo = document.getElementById("selTipo");
const selPrioridade = document.getElementById("selPrioridade");
const inpCD = document.getElementById("inpCD");
const inpTitulo = document.getElementById("inpTitulo");
const inpDescricao = document.getElementById("inpDescricao");

const btnCriar = document.getElementById("btnCriar");
const btnLimpar = document.getElementById("btnLimpar");

let currentUser = null;
let analystLabel = "";
let usersCache = []; // [{uid,email,tipo,displayName}]

function setMsg(text, type="error"){
  msg.textContent = text || "";
  msg.style.color = type==="success" ? "#065f46" : "#b91c1c";
}

btnMenu.addEventListener("click", ()=> window.location.href = "./menu.html");
btnLogout.addEventListener("click", async ()=> { await signOut(auth); window.location.href="./index.html"; });

btnLimpar.addEventListener("click", ()=>{
  inpPara.value = "";
  selTipo.value = "SUPORTE";
  selPrioridade.value = "MEDIA";
  inpCD.value = "";
  inpTitulo.value = "";
  inpDescricao.value = "";
  setMsg("");
});

async function loadUsuarios(){
  // carrega todos os usuários cadastrados (coleção usuarios)
  const q = query(collection(db, "usuarios"));
  const snap = await getDocs(q);
  usersCache = snap.docs.map(d => ({
    uid: d.id,
    ...(d.data() || {})
  }));

  // datalist com label amigável: "email — tipo"
  usersList.innerHTML = usersCache
    .filter(u => u?.email)
    .sort((a,b)=> String(a.email).localeCompare(String(b.email)))
    .map(u => {
      const label = `${(u.email || "").toLowerCase()} — ${u.tipo || "usuario"}`;
      return `<option value="${label}"></option>`;
    }).join("");
}

function parseSelectedUser(inputValue){
  // Espera "email — tipo"
  const email = String(inputValue || "").split("—")[0].trim().toLowerCase();
  if (!email) return null;

  const found = usersCache.find(u => (u.email || "").toLowerCase() === email);
  return found || null;
}

btnCriar.addEventListener("click", async ()=>{
  if (!currentUser) return;

  setMsg("");
  btnCriar.disabled = true;

  try{
    const target = parseSelectedUser(inpPara.value);

    if (!target) throw new Error("Selecione o usuário destinatário pela lista (campo 'Para').");
    if (target.uid === currentUser.uid) throw new Error("Você não pode abrir chamado para você mesmo.");

    const tipo = selTipo.value;
    const prioridade = selPrioridade.value;
    const cd = inpCD.value.trim();
    const titulo = inpTitulo.value.trim();
    const descricao = inpDescricao.value.trim();

    if (!titulo) throw new Error("Informe o Título.");
    if (!descricao) throw new Error("Informe a Descrição.");

    const payload = {
      createdByUid: currentUser.uid,
      createdByEmail: (currentUser.email || "").toLowerCase(),
      createdByName: (currentUser.displayName || "").trim(),

      assignedToUid: target.uid,
      assignedToEmail: (target.email || "").toLowerCase(),
      assignedToName: (target.displayName || "").trim(),

      tipo,
      prioridade,
      cd,

      titulo,
      descricao,

      status: "ABERTO",

      unreadForAssigned: true,
      unreadForCreator: false,

      lastMessageByUid: currentUser.uid,
      lastMessageAt: serverTimestamp(),

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, "chamados"), payload);

    setMsg("Chamado criado ✅ (o destinatário verá na notificação)", "success");
    inpTitulo.value = "";
    inpDescricao.value = "";
    inpCD.value = "";

  }catch(err){
    console.error("[CHAMADO] erro:", err);
    const code = err?.code || "";
    if (code === "permission-denied") setMsg("Permissão negada. Verifique as Rules (chamados).", "error");
    else setMsg(err?.message || "Falha ao criar chamado. Veja o console (F12).", "error");
  }finally{
    btnCriar.disabled = false;
  }
});

onAuthStateChanged(auth, async (user)=>{
  if (!user) { window.location.href="./index.html"; return; }
  currentUser = user;
  analystLabel = user.displayName?.trim() || (user.email || "").toLowerCase();
  userInfo.textContent = `Logado como: ${analystLabel}`;

  await loadUsuarios();
});
