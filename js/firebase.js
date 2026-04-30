import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function getFirebaseConfig() {
  try {
    // Tentar múltiplos caminhos para garantir que encontre o JSON
    const paths = ["/firebase-applet-config.json", "../../firebase-applet-config.json", "./firebase-applet-config.json"];
    for (const path of paths) {
      try {
        console.log(`[FIREBASE] Tentando carregar config de: ${path}`);
        const response = await fetch(path);
        if (response.ok) {
          const config = await response.json();
          console.log(`[FIREBASE] Configuração carregada com sucesso de ${path}`);
          return config;
        }
      } catch (e) {}
    }
    return null;
  } catch (e) {
    console.error("[FIREBASE] Erro ao buscar configuração:", e);
    return null;
  }
}

const firebaseConfig = await getFirebaseConfig();

let app, db, auth;

if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  // Se firestoreDatabaseId for nulo ou vazio, usa a padrão
  const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "" 
               ? firebaseConfig.firestoreDatabaseId 
               : "(default)";
  db = getFirestore(app, dbId);
  auth = getAuth(app);
  console.log("🔥 Firebase conectado:", firebaseConfig.projectId, "| DB:", dbId);
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
