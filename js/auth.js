// js/auth.js
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";

const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

// Se já estiver logado, manda direto pro menu
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "menu.html";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "menu.html";
  } catch (err) {
    msg.textContent = "Email ou senha inválidos.";
    console.error(err);
  }
});
