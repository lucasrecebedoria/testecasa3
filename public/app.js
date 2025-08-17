import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// ===== Firebase config =====
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
const storage = getStorage(app);

// ===== Helpers =====
const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const adminsFixos = ["6266","4144","70029"];
const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>document.querySelectorAll(sel);
const byId = (id)=>document.getElementById(id);

function matriculaToEmail(m){ return `${m}@movebuss.local`; }
function formatDateBR(d){
  if(!d) return "";
  const dt = new Date(d);
  return dt.toLocaleString('pt-BR');
}
function toFloat(v){ const n = parseFloat(v); return isNaN(n)?0:n; }

// ===== UI refs =====
const authSection = byId('authSection');
const appSection = byId('appSection');
const logoutBtn = byId('logoutBtn');
const loginBtn = byId('loginBtn');
const showRegister = byId('showRegister');
const cancelRegister = byId('cancelRegister');
const registerBtn = byId('registerBtn');
const toggleCreateForm = byId('toggleCreateForm');
const createForm = byId('createForm');
const adminControls = byId('adminControls');
const userInfo = byId('userInfo');
const roleBadge = byId('roleBadge');
const listaRelatorios = byId('listaRelatorios');
const resumoPanel = byId('resumoPanel');
const closeResumo = byId('closeResumo');
const btnResumo = byId('btnResumo');

// Modal Pós Conferência
const posModal = byId('posModal');
const posTexto = byId('posTexto');
const modalSalvar = byId('modalSalvar');
const modalFechar = byId('modalFechar');
const btnAnexar = byId('btnAnexar');
const btnVerAnexo = byId('btnVerAnexo');
const btnExcluirAnexo = byId('btnExcluirAnexo');
const fileInput = byId('fileInput');
const previewArea = byId('previewArea');

// Campos formulário relatório
const dataCaixa = byId('dataCaixa');
const matRel = byId('matRel');
const valorFolha = byId('valorFolha');
const valorDinheiro = byId('valorDinheiro');
const sobraFalta = byId('sobraFalta');
const observacao = byId('observacao');

// ===== Auth State =====
let CURRENT = { user:null, perfil:null, admin:false };

onAuthStateChanged(auth, async (user)=>{
  if(user){
    CURRENT.user = user;
    // Buscar perfil (doc id = auth.uid) com matricula e isAdmin
    const perfilRef = doc(db, 'usuarios', user.uid);
    let snap = await getDoc(perfilRef);

    // Se não existir, criamos com base na matrícula do e-mail
    const mat = user.email.split('@')[0];
    const isAdminSeed = adminsFixos.includes(mat);
    if(!snap.exists()){
      await setDoc(perfilRef, { matricula: mat, nome: 'Usuário', isAdmin: isAdminSeed });
      snap = await getDoc(perfilRef);
    } else {
      // Se pertence à lista fixa, garante isAdmin true
      if(isAdminSeed && snap.data().isAdmin !== true){
        await updateDoc(perfilRef, { isAdmin: true });
        snap = await getDoc(perfilRef);
      }
    }
    CURRENT.perfil = { id: snap.id, ...snap.data() };
    CURRENT.admin = !!CURRENT.perfil.isAdmin;

    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    userInfo.textContent = `Matrícula: ${CURRENT.perfil.matricula}`;
    roleBadge.textContent = CURRENT.admin ? 'ADMIN' : 'USUÁRIO';
    adminControls.classList.toggle('hidden', !CURRENT.admin);

    if(CURRENT.admin){
      // Mostrar últimos 20 relatórios (sem filtro)
      loadRelatoriosAdmin();
    }else{
      // Usuário: carregar últimos 15, demais minimizados
      loadRelatoriosUser(CURRENT.perfil.matricula);
    }
  } else {
    CURRENT = { user:null, perfil:null, admin:false };
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
});

// ===== Login / Cadastro =====
loginBtn?.addEventListener('click', async ()=>{
  const m = byId('loginMatricula').value.trim();
  const s = byId('loginSenha').value.trim();
  if(!m || !s) return alert('Informe matrícula e senha.');
  try{
    await signInWithEmailAndPassword(auth, matriculaToEmail(m), s);
  }catch(e){ alert('Erro no login: '+e.message); }
});

showRegister?.addEventListener('click', ()=>{
  byId('registerCard').classList.toggle('hidden');
});

cancelRegister?.addEventListener('click', ()=>{
  byId('registerCard').classList.add('hidden');
});

registerBtn?.addEventListener('click', async ()=>{
  const m = byId('regMatricula').value.trim();
  const n = byId('regNome').value.trim();
  const s = byId('regSenha').value.trim();
  if(!m || !n || !s) return alert('Preencha todos os campos.');
  try{
    const cred = await createUserWithEmailAndPassword(auth, matriculaToEmail(m), s);
    // salva perfil com doc id = uid
    const isAdm = adminsFixos.includes(m);
    await setDoc(doc(db,'usuarios', cred.user.uid), { matricula:m, nome:n, isAdmin:isAdm });
    alert('Usuário cadastrado!');
    byId('registerCard').classList.add('hidden');
  }catch(e){ alert('Erro no cadastro: '+e.message); }
});

logoutBtn?.addEventListener('click', ()=>signOut(auth));

// ===== Relatórios (CRUD limitado por role) =====
toggleCreateForm?.addEventListener('click', ()=> createForm.classList.toggle('hidden'));
[valorFolha, valorDinheiro].forEach(inp=> inp?.addEventListener('input', ()=>{
  const sf = toFloat(valorDinheiro.value) - toFloat(valorFolha.value);
  sobraFalta.value = sf.toFixed(2);
}));

byId('saveRelatorio')?.addEventListener('click', async ()=>{
  if(!CURRENT.admin) return alert('Apenas admins podem criar relatórios.');
  const dataStr = dataCaixa.value;
  const mat = matRel.value.trim();
  const vf = toFloat(valorFolha.value);
  const vd = toFloat(valorDinheiro.value);
  const sf = vd - vf;
  const obs = observacao.value.trim();
  if(!dataStr || !mat) return alert('Informe data e matrícula.');
  try{
    const payload = {
      data: dataStr,
      criadoEm: new Date().toLocaleString('pt-BR'),
      timestamp: serverTimestamp(),
      matricula: mat,
      valorFolha: vf,
      valorDinheiro: vd,
      sobraFalta: sf,
      observacao: obs || '',
      posTexto: '',
      posImgUrl: '',
      posEditado: false
    };
    await addDoc(collection(db,'relatorios'), payload);
    alert('Relatório salvo!');
    createForm.classList.add('hidden');
    // recarrega lista
    if(CURRENT.admin) loadRelatoriosAdmin(); else loadRelatoriosUser(CURRENT.perfil.matricula);
  }catch(e){ alert('Erro ao salvar: '+e.message); }
});

async function loadRelatoriosUser(matricula){
  listaRelatorios.innerHTML = '';
  const q = query(collection(db,'relatorios'), where('matricula','==', matricula), orderBy('timestamp','desc'));
  const snap = await getDocs(q);
  let count=0;
  snap.forEach(docSnap=>{
    const d = docSnap.data();
    const item = renderRelatorio(docSnap.id, d, false);
    if(count<15){
      // exibido
    }else{
      item.querySelector('.kv').classList.add('hidden');
    }
    listaRelatorios.appendChild(item);
    count++;
  });
  if(!snap.size) listaRelatorios.innerHTML = '<div class="card">Nenhum relatório encontrado.</div>';
}

async function loadRelatoriosAdmin(filterMat=null){
  listaRelatorios.innerHTML = '';
  let qBase = collection(db,'relatorios');
  if(filterMat){
    qBase = query(qBase, where('matricula','==', filterMat), orderBy('timestamp','desc'));
  }else{
    qBase = query(qBase, orderBy('timestamp','desc'), limit(20));
  }
  const snap = await getDocs(qBase);
  snap.forEach(docSnap=>{
    const d = docSnap.data();
    const item = renderRelatorio(docSnap.id, d, true);
    listaRelatorios.appendChild(item);
  });
  if(!snap.size) listaRelatorios.innerHTML = '<div class="card">Nenhum relatório encontrado.</div>';
}

// Filtro e Resumo
byId('adminFilterMat')?.addEventListener('change', (e)=>{
  if(CURRENT.admin){
    const v = e.target.value.trim();
    loadRelatoriosAdmin(v || null);
    byId('resumoContent').innerHTML = 'Carregue para ver o resumo.';
  }
});
btnResumo?.addEventListener('click', async ()=>{
  if(!CURRENT.admin) return;
  const m = byId('adminFilterMat').value.trim();
  if(!m) return alert('Informe uma matrícula no filtro.');
  resumoPanel.classList.remove('hidden');
  const qBase = query(collection(db,'relatorios'), where('matricula','==', m));
  const snap = await getDocs(qBase);
  let totalFolha = 0, sobras=[], faltas=[];
  snap.forEach(s=>{
    const d = s.data();
    totalFolha += (d.valorFolha||0);
    const sf = d.sobraFalta||0;
    if(sf >= 0) sobras.push({id:s.id, data:d.data, valor:sf}); else faltas.push({id:s.id, data:d.data, valor:sf});
  });
  const sobrasHtml = sobras.map(x=>`<li>${x.data}: ${BRL.format(x.valor)}</li>`).join('') || '<li>Sem sobras</li>';
  const faltasHtml = faltas.map(x=>`<li>${x.data}: ${BRL.format(x.valor)}</li>`).join('') || '<li>Sem faltas</li>';
  byId('resumoContent').innerHTML = `
    <div class="kv">
      <div><b>Total do mês (folha):</b></div><div>${BRL.format(totalFolha)}</div>
      <div><b>Dias com sobra:</b></div><div><ul>${sobrasHtml}</ul></div>
      <div><b>Dias com falta:</b></div><div><ul>${faltasHtml}</ul></div>
    </div>
  `;
});
closeResumo?.addEventListener('click', ()=> resumoPanel.classList.add('hidden'));

// Render de cada relatório
function renderRelatorio(id, d, isAdmin){
  const wrap = document.createElement('div');
  wrap.className = 'relatorio';

  const header = document.createElement('div');
  header.className = 'min-header';
  header.innerHTML = `
    <div><b>${d.data}</b> ${d.posEditado ? '<span class="tag-warning">verificar pós conferência</span>':''}</div>
    <div class="row gap">
      <button class="btn btn-ghost toggle">Esconder/Exibir</button>
      ${isAdmin ? `<button class="btn btn-ghost" data-edit>${'Editar relatório'}</button>
      <button class="btn btn-ghost danger" data-del>Excluir relatório</button>`:''}
      <button class="btn btn-metal" data-pos>Pós conferência</button>
    </div>
  `;
  const kv = document.createElement('div');
  kv.className = 'kv';
  kv.innerHTML = `
    <div>Data/Hora criação:</div><div>${d.criadoEm || '-'}</div>
    <div>Matrícula:</div><div>${d.matricula}</div>
    <div>Valor folha:</div><div>${BRL.format(d.valorFolha||0)}</div>
    <div>Valor dinheiro:</div><div>${BRL.format(d.valorDinheiro||0)}</div>
    <div>Sobra/Falta:</div><div>${BRL.format(d.sobraFalta||0)}</div>
    <div>Observação:</div><div>${d.observacao||'-'}</div>
  `;
  wrap.appendChild(header);
  wrap.appendChild(kv);

  header.querySelector('.toggle').addEventListener('click', ()=> kv.classList.toggle('hidden'));
  header.querySelector('[data-pos]').addEventListener('click', ()=> openPosModal(id, d, isAdmin));
  if(isAdmin){
    header.querySelector('[data-edit]')?.addEventListener('click', ()=> editRelatorio(id, d));
    header.querySelector('[data-del]')?.addEventListener('click', ()=> delRelatorio(id));
  }
  return wrap;
}

async function editRelatorio(id, d){
  if(!CURRENT.admin) return;
  // preenche form para edição rápida
  createForm.classList.remove('hidden');
  dataCaixa.value = d.data || '';
  matRel.value = d.matricula || '';
  valorFolha.value = d.valorFolha || 0;
  valorDinheiro.value = d.valorDinheiro || 0;
  sobraFalta.value = (d.sobraFalta || (toFloat(valorDinheiro.value)-toFloat(valorFolha.value))).toFixed(2);
  observacao.value = d.observacao || '';
  byId('saveRelatorio').onclick = async ()=>{
    try{
      await updateDoc(doc(db,'relatorios', id), {
        data: dataCaixa.value,
        matricula: matRel.value.trim(),
        valorFolha: toFloat(valorFolha.value),
        valorDinheiro: toFloat(valorDinheiro.value),
        sobraFalta: toFloat(sobraFalta.value),
        observacao: observacao.value.trim()
      });
      alert('Relatório atualizado!');
      createForm.classList.add('hidden');
      loadRelatoriosAdmin();
    }catch(e){ alert('Erro ao atualizar: '+e.message); }
  };
}

async function delRelatorio(id){
  if(!CURRENT.admin) return;
  if(!confirm('Excluir este relatório?')) return;
  try{
    await updateDoc(doc(db,'relatorios', id), { deleted:true }); // soft delete (mantém histórico)
    alert('Relatório marcado como excluído.');
    loadRelatoriosAdmin();
  }catch(e){ alert('Erro ao excluir: '+e.message); }
}

// ===== Pós Conferência =====
let POS_CTX = { id:null, data:null, isAdmin:false };
async function openPosModal(id, d, isAdmin){
  POS_CTX = { id, data:d, isAdmin };
  posModal.classList.remove('hidden');
  posTexto.value = d.posTexto || '';
  modalSalvar.classList.toggle('hidden', !isAdmin);
  btnAnexar.classList.toggle('hidden', !isAdmin);
  btnExcluirAnexo.classList.toggle('hidden', !isAdmin);
  previewArea.innerHTML = '';
  if(d.posImgUrl){
    const img = document.createElement('img');
    img.src = d.posImgUrl;
    img.alt = 'Anexo';
    previewArea.appendChild(img);
  }
}

modalFechar.addEventListener('click', ()=> posModal.classList.add('hidden'));
modalSalvar.addEventListener('click', async ()=>{
  if(!POS_CTX.isAdmin) return;
  try{
    await updateDoc(doc(db,'relatorios', POS_CTX.id), { posTexto: posTexto.value, posEditado:true });
    alert('Pós conferência salva!');
    posModal.classList.add('hidden');
    if(CURRENT.admin) loadRelatoriosAdmin(); else loadRelatoriosUser(CURRENT.perfil.matricula);
  }catch(e){ alert('Erro ao salvar pós conferência: '+e.message); }
});

btnAnexar.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', async (e)=>{
  if(!POS_CTX.isAdmin) return;
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const r = ref(storage, `post_conferencia/${POS_CTX.id}/${file.name}`);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    await updateDoc(doc(db,'relatorios', POS_CTX.id), { posImgUrl: url, posEditado:true });
    openPosModal(POS_CTX.id, { ...POS_CTX.data, posImgUrl:url, posTexto:posTexto.value, posEditado:true }, true);
  }catch(e){ alert('Erro ao anexar: '+e.message); }
});

btnVerAnexo.addEventListener('click', ()=>{
  const url = POS_CTX.data?.posImgUrl || byId('previewArea')?.querySelector('img')?.src;
  if(!url) return alert('Sem imagem anexada.');
  window.open(url, '_blank');
});

btnExcluirAnexo.addEventListener('click', async ()=>{
  if(!POS_CTX.isAdmin) return;
  if(!POS_CTX.data?.posImgUrl) return alert('Sem imagem para excluir.');
  try{
    const path = POS_CTX.data.posImgUrl.split('/o/')[1].split('?')[0]; // encoded path
    const storagePath = decodeURIComponent(path);
    const r = ref(storage, storagePath);
    await deleteObject(r);
    await updateDoc(doc(db,'relatorios', POS_CTX.id), { posImgUrl:'', posEditado:true });
    alert('Imagem excluída.');
    posModal.classList.add('hidden');
    if(CURRENT.admin) loadRelatoriosAdmin(); else loadRelatoriosUser(CURRENT.perfil.matricula);
  }catch(e){ alert('Erro ao excluir imagem: '+e.message); }
});

