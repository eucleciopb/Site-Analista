// js/app.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";

const btnLogout = document.getElementById("btnLogout");
const pEmail = document.getElementById("pEmail");
const pTipo = document.getElementById("pTipo");

const addForm = document.getElementById("addForm");
const status = document.getElementById("status");
const tbody = document.getElementById("tbody");

const clientesRef = collection(db, "clientes");

// ✅ Guard: se não estiver logado, volta pro login
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // ✅ Carrega perfil (tipo) na “tabela” usuarios/{uid}
  const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));
  const perfil = perfilSnap.exists() ? perfilSnap.data() : {};

  pEmail.textContent = user.email || "-";
  pTipo.textContent = perfil.tipo || "(sem tipo)";
});

// Logout
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// Listagem em tempo real
const q = query(clientesRef, orderBy("createdAt", "desc"));
onSnapshot(q, (snap) => {
  tbody.innerHTML = "";
  snap.forEach((d) => {
    const data = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(data.nome ?? "")}</td>
      <td>${escapeHtml(data.telefone ?? "")}</td>
      <td>${formatDate(data.createdAt?.toDate?.() ?? null)}</td>
    `;
    tbody.appendChild(tr);
  });
});

// Adicionar registro
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  status.textContent = "";

  const nome = document.getElementById("nome").value.trim();
  const telefone = document.getElementById("telefone").value.trim();

  if (nome.length < 2) {
    status.textContent = "Nome muito curto.";
    return;
  }

  try {
    await addDoc(clientesRef, {
      nome,
      telefone,
      createdAt: serverTimestamp(),
      ownerUid: auth.currentUser.uid
    });
    addForm.reset();
  } catch (err) {
    status.textContent = "Falha ao salvar no Firestore (veja o console).";
    console.error(err);
  }
});

function formatDate(dt) {
  if (!dt) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(dt);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
