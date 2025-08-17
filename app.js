import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtYzKI4ta7gzeqWxSQ6FMEu8A427islUQ",
  authDomain: "caixasv1.firebaseapp.com",
  projectId: "caixasv1",
  storageBucket: "caixasv1.firebasestorage.app",
  messagingSenderId: "545325374379",
  appId: "1:545325374379:web:6d422f3e9af5f195df10ee",
  measurementId: "G-8K54YESCGD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");

loginBtn.addEventListener("click", async () => {
  const matricula = document.getElementById("loginMatricula").value;
  const senha = document.getElementById("loginSenha").value;
  try {
    const email = matricula + "@movebuss.local";
    await signInWithEmailAndPassword(auth, email, senha);
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("relatoriosSection").classList.remove("hidden");
    loadRelatorios(matricula);
  } catch (e) {
    alert("Erro no login: " + e.message);
  }
});

registerBtn.addEventListener("click", async () => {
  const matricula = document.getElementById("regMatricula").value;
  const nome = document.getElementById("regNome").value;
  const senha = document.getElementById("regSenha").value;
  try {
    const email = matricula + "@movebuss.local";
    await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(doc(db, "usuarios", matricula), { matricula, nome });
    alert("Usuário cadastrado!");
    document.querySelector(".register-box").classList.add("hidden");
    document.querySelector(".login-box").classList.remove("hidden");
  } catch (e) {
    alert("Erro no cadastro: " + e.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  document.getElementById("authSection").classList.remove("hidden");
  document.getElementById("relatoriosSection").classList.add("hidden");
});

async function loadRelatorios(matricula) {
  const container = document.getElementById("relatoriosContainer");
  container.innerHTML = "";
  const snapshot = await getDocs(collection(db, "relatorios"));
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.matricula === matricula || isAdmin(matricula)) {
      const div = document.createElement("div");
      div.classList.add("relatorio");
      div.innerHTML = `<b>Data:</b> ${data.data} <br>
                       <b>Valor Folha:</b> R$${data.valorFolha} <br>
                       <b>Valor Dinheiro:</b> R$${data.valorDinheiro} <br>
                       <b>Sobra/Falta:</b> R$${data.sobraFalta}`;
      container.appendChild(div);
    }
  });
}

function isAdmin(mat) {
  return ["6266", "4144", "70029"].includes(mat);
}
