import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function getFirebaseConfig() {
  try {
    const response = await fetch("/firebase-applet-config.json");
    if (!response.ok) {
      // Fallback relative path if absolute fails
      const fallback = await fetch("../../firebase-applet-config.json");
      return await fallback.json();
    }
    return await response.json();
  } catch (e) {
    console.error("Config fetch failed:", e);
    return null;
  }
}

const firebaseConfig = await getFirebaseConfig();

let app, db, auth;

if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
  console.log("🔥 Firebase conectado:", firebaseConfig.projectId);
} else {
  console.error("❌ Falha crítica: Configuração do Firebase não encontrada.");
}

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app, db, auth };
