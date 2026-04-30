// js/page.js
import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

// Protege páginas internas
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "index.html";
});

// Voltar ao menu
const btnMenu = document.getElementById("btnMenu");
if (btnMenu) {
  btnMenu.addEventListener("click", () => {
    window.location.href = "menu.html";
  });
}

// Logout
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}
