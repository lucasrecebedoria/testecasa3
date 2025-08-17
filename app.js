// App logic
import {
  auth, db, storage,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  doc, setDoc, getDoc, addDoc, getDocs, collection, query, where, orderBy, limit, serverTimestamp, updateDoc, deleteDoc, Timestamp,
  storageRef, uploadBytes, getDownloadURL, deleteObject
} from './firebase-config.js';

// ======= Helpers =======
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];
const isAdminMatriculas = new Set(['6266','4144','70029']);

function matriculaToEmail(m) {
  // usamos email sintético só para autenticação do Firebase
  return `${m}@matriculas.local`;
}

function fmtDateInput(d) {
  const pad = (n)=> String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtDateBR(ts) {
  const d = ts instanceof Date ? ts : ts.toDate();
  return d.toLocaleDateString('pt-BR');
}

// calcula sobr/falta automaticamente
function calcSobraFalta() {
  const folha = parseFloat(qs('#valorFolha').value || '0');
  const dinheiro = parseFloat(qs('#valorDinheiro').value || '0');
  const diff = (dinheiro - folha);
  qs('#sobraFalta').value = diff.toFixed(2);
}

// ======= UI wire =======
const authView = qs('#authView');
const appView = qs('#appView');
const logoutBtn = qs('#logoutBtn');
const userBadge = qs('#userBadge');

// tabs
qsa('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    qsa('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    qsa('.tab-pane').forEach(p=>p.classList.remove('active'));
    qs(btn.dataset.target).classList.add('active');
  });
});

// login
qs('#loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const matricula = qs('#loginMatricula').value.trim();
  const senha = qs('#loginSenha').value;
  const email = matriculaToEmail(matricula);
  try{
    await signInWithEmailAndPassword(auth, email, senha);
  }catch(err){
    qs('#authMsg').textContent = 'Erro no login: ' + (err?.message || err);
  }
});

// register
qs('#registerForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const matricula = qs('#regMatricula').value.trim();
  const nome = qs('#regNome').value.trim();
  const senha = qs('#regSenha').value;
  const email = matriculaToEmail(matricula);
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    // cria/atualiza documento do usuário
    const role = isAdminMatriculas.has(matricula) ? 'admin' : 'user';
    await setDoc(doc(db, 'usuarios', matricula), {
      uid: cred.user.uid, matricula, nome, role, createdAt: serverTimestamp()
    });
    qs('#authMsg').textContent = 'Usuário cadastrado com sucesso. Você já pode fazer login.';
  }catch(err){
    qs('#authMsg').textContent = 'Erro no cadastro: ' + (err?.message || err);
  }
});

logoutBtn.addEventListener('click', ()=>signOut(auth));

// ======= State =======
let currentUser = null;
let currentUserDoc = null;
let isAdmin = false;
let selectedMatriculaForAdmin = null;
let editReportId = null; // when editing

// pós conferência modal state
let modalReportId = null;
let modalCurrentImageURL = null;

onAuthStateChanged(auth, async (user)=>{
  currentUser = user;
  if(!user){
    // show auth
    authView.style.display = '';
    appView.style.display = 'none';
    logoutBtn.style.display = 'none';
    userBadge.textContent = '';
    return;
  }

  logoutBtn.style.display = '';
  // pega doc do usuário pela matrícula (derivada do email sintético)
  const matricula = user.email.split('@')[0];
  const docSnap = await getDoc(doc(db, 'usuarios', matricula));
  currentUserDoc = docSnap.exists() ? docSnap.data() : { matricula, nome: user.displayName || '', role: isAdminMatriculas.has(matricula) ? 'admin':'user' };
  isAdmin = currentUserDoc.role === 'admin';
  userBadge.textContent = `${currentUserDoc.nome || 'Usuário'} · ${currentUserDoc.matricula} · ${isAdmin?'ADMIN':'COMUM'}`;

  // show app
  authView.style.display = 'none';
  appView.style.display = '';

  // configure UI by role
  qs('#reportEditorCard').style.display = isAdmin ? '' : 'none';
  qs('#adminControls').style.display = isAdmin ? '' : 'none';
  qs('#userControls').style.display = !isAdmin ? '' : 'none';

  // default date today
  qs('#dataCaixa').value = fmtDateInput(new Date());

  // initial load
  if(isAdmin){
    selectedMatriculaForAdmin = '';
    qs('#listaTitulo').textContent = 'Relatórios (Admin — selecione uma matrícula)';
    renderAdminList(); // empty at first
  }else{
    qs('#listaTitulo').textContent = 'Seus Relatórios';
    renderUserList(currentUserDoc.matricula);
  }
});

// ======= Report Form =======
['#valorFolha','#valorDinheiro'].forEach(sel=>{
  qs(sel).addEventListener('input', calcSobraFalta);
});

qs('#clearFormBtn').addEventListener('click', ()=>{
  editReportId = null;
  qs('#reportForm').reset();
  qs('#dataCaixa').value = fmtDateInput(new Date());
  calcSobraFalta();
});

qs('#reportForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!isAdmin){ return alert('Apenas administradores podem salvar relatórios.'); }

  const data = {
    dataCaixa: Timestamp.fromDate(new Date(qs('#dataCaixa').value)),
    valorFolha: parseFloat(qs('#valorFolha').value||'0'),
    valorDinheiro: parseFloat(qs('#valorDinheiro').value||'0'),
    sobraFalta: parseFloat(qs('#sobraFalta').value||'0'),
    observacao: qs('#observacao').value.trim(),
    matricula: qs('#matriculaRef').value.trim(),
    posConferenciaEdited: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: currentUserDoc?.matricula || 'admin'
  };

  try{
    if(editReportId){
      await updateDoc(doc(db,'relatorios', editReportId), data);
    }else{
      await addDoc(collection(db,'relatorios'), data);
    }
    alert('Relatório salvo.');
    qs('#clearFormBtn').click();
    // refresh list if admin is currently viewing that matricula
    if(isAdmin){
      if(selectedMatriculaForAdmin){
        await renderAdminList(selectedMatriculaForAdmin);
      }
    }
  }catch(err){
    console.error(err);
    alert('Erro ao salvar relatório: ' + (err?.message || err));
  }
});

// ======= Lists rendering =======
async function renderUserList(matricula){
  const listEl = qs('#reportsList');
  listEl.innerHTML = '<div class="help">Carregando...</div>';
  const relRef = collection(db,'relatorios');
  const q1 = query(relRef, where('matricula','==',matricula), orderBy('dataCaixa','desc'));
  const snap = await getDocs(q1);
  const docs = snap.docs.map(d=>({id:d.id, ...d.data()}));
  buildReports(listEl, docs, { role:'user' });
}

async function renderAdminList(matricula=''){
  const listEl = qs('#reportsList');
  listEl.innerHTML = '';

  const filtro = qs('#adminFiltroMatricula').value.trim() || matricula || '';
  selectedMatriculaForAdmin = filtro;
  if(!filtro){
    listEl.innerHTML = '<div class="help">Digite uma matrícula para listar os relatórios.</div>';
    return;
  }

  const relRef = collection(db,'relatorios');
  const q1 = query(relRef, where('matricula','==',filtro), orderBy('dataCaixa','desc'));
  const snap = await getDocs(q1);
  const docs = snap.docs.map(d=>({id:d.id, ...d.data()}));
  buildReports(listEl, docs, { role:'admin' });
}

qs('#adminFiltroMatricula')?.addEventListener('change', ()=> renderAdminList());
qs('#abrirResumoBtn')?.addEventListener('click', ()=> openResumo());
qs('#fecharResumo')?.addEventListener('click', ()=> qs('#resumoContainer').classList.remove('open'));

// ======= Build Reports =======
function buildReports(container, items, ctx){
  container.innerHTML='';
  let expandedCount = 0;
  const expandLimit = ctx.role==='user' ? 15 : 20;

  items.forEach((it, idx)=>{
    const isExpanded = expandedCount < expandLimit;
    if(isExpanded) expandedCount++;

    const wrap = document.createElement('div');
    wrap.className='report';

    const header = document.createElement('div');
    header.className='report-header';

    const title = document.createElement('div');
    title.className='report-title';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = fmtDateBR(it.dataCaixa);
    title.appendChild(dateSpan);

    if(it.posConferenciaEdited){
      const badge = document.createElement('span');
      badge.className='badge-yellow';
      badge.textContent = 'verificar pós conferência';
      title.appendChild(badge);
    }

    header.appendChild(title);

    const btns = document.createElement('div');
    // comum: esconder/exibir + pós conferência
    // admin: esconder/exibir + editar + excluir + pós conferência
    const toggle = document.createElement('button');
    toggle.className='btn btn-ghost'; toggle.textContent = 'esconder/exibir';
    toggle.addEventListener('click', ()=> body.classList.toggle('open'));
    btns.appendChild(toggle);

    if(ctx.role==='admin'){
      const editar = document.createElement('button');
      editar.className='btn btn-metal'; editar.textContent='editar relatório';
      editar.addEventListener('click', ()=>{
        editReportId = it.id;
        qs('#dataCaixa').value = fmtDateInput(it.dataCaixa.toDate());
        qs('#valorFolha').value = it.valorFolha;
        qs('#valorDinheiro').value = it.valorDinheiro;
        qs('#sobraFalta').value = it.sobraFalta.toFixed(2);
        qs('#observacao').value = it.observacao || '';
        qs('#matriculaRef').value = it.matricula;
        window.scrollTo({top:0, behavior:'smooth'});
      });
      btns.appendChild(editar);

      const excluir = document.createElement('button');
      excluir.className='btn btn-danger'; excluir.textContent='excluir relatório';
      excluir.addEventListener('click', async ()=>{
        if(confirm('Excluir este relatório?')){
          await deleteDoc(doc(db,'relatorios', it.id));
          wrap.remove();
        }
      });
      btns.appendChild(excluir);
    }

    const pos = document.createElement('button');
    pos.className='btn btn-primary'; pos.textContent='pós conferência';
    pos.addEventListener('click', ()=> openPosModal(it.id, ctx.role==='admin'));
    btns.appendChild(pos);

    header.appendChild(btns);

    const body = document.createElement('div');
    body.className = 'report-body' + (isExpanded?' open':'');

    const grid = document.createElement('div');
    grid.className = 'report-grid';
    grid.appendChild(makeField('Data do caixa', fmtDateBR(it.dataCaixa)));
    grid.appendChild(makeField('Valor Folha', BRL.format(it.valorFolha)));
    grid.appendChild(makeField('Valor em Dinheiro', BRL.format(it.valorDinheiro)));
    grid.appendChild(makeField('Sobra/Falta', BRL.format(it.sobraFalta)));
    grid.appendChild(makeField('Observação', it.observacao || '—'));

    body.appendChild(grid);
    wrap.appendChild(header);
    wrap.appendChild(body);
    container.appendChild(wrap);
  });
}

function makeField(label, value){
  const d = document.createElement('div');
  d.className='field';
  const l = document.createElement('label');
  l.textContent = label;
  const v = document.createElement('div');
  v.textContent = value;
  v.style.color = '#fff';
  v.style.padding = '8px 10px';
  v.style.border = '2px solid var(--border)';
  v.style.borderRadius = '12px';
  v.style.background = '#141414';
  d.append(l,v);
  return d;
}

// ======= Resumo (Admin) =======
async function openResumo(){
  if(!isAdmin || !selectedMatriculaForAdmin){
    return alert('Selecione uma matrícula primeiro.');
  }
  const monthInput = qs('#mesResumo').value; // YYYY-MM
  const now = monthInput ? new Date(monthInput+'-01T00:00:00') : new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth()+1, 1);

  const relRef = collection(db,'relatorios');
  const q1 = query(relRef, where('matricula','==',selectedMatriculaForAdmin), where('dataCaixa','>=', Timestamp.fromDate(start)), where('dataCaixa','<', Timestamp.fromDate(end)), orderBy('dataCaixa','desc'));
  const snap = await getDocs(q1);
  const docs = snap.docs.map(d=>({id:d.id, ...d.data()}));

  const totalFolha = docs.reduce((s,r)=> s + (r.valorFolha||0), 0);
  const sobras = docs.filter(r=> (r.sobraFalta||0) > 0).map(r=> ({data: r.dataCaixa, v:r.sobraFalta}));
  const faltas = docs.filter(r=> (r.sobraFalta||0) < 0).map(r=> ({data: r.dataCaixa, v:r.sobraFalta}));

  qs('#resumoTotalFolha').textContent = BRL.format(totalFolha);
  qs('#resumoSobra').textContent = BRL.format(sobras.reduce((s,x)=>s+x.v,0));
  qs('#resumoFalta').textContent = BRL.format(faltas.reduce((s,x)=>s+x.v,0));

  const elS = qs('#listaSobras'); elS.innerHTML='';
  sobras.forEach(x=>{
    const p = document.createElement('div');
    p.textContent = `${fmtDateBR(x.data)} · ${BRL.format(x.v)}`;
    elS.appendChild(p);
  });
  const elF = qs('#listaFaltas'); elF.innerHTML='';
  faltas.forEach(x=>{
    const p = document.createElement('div');
    p.textContent = `${fmtDateBR(x.data)} · ${BRL.format(x.v)}`;
    elF.appendChild(p);
  });

  qs('#resumoContainer').classList.add('open');
}

// ======= Pós conferência modal =======
const modal = qs('#modalPos');
qs('#fecharModalPos').addEventListener('click', ()=> closePosModal());

async function openPosModal(reportId, canEdit){
  modalReportId = reportId;
  modal.style.display = 'flex';
  // load existing subdoc
  const subDocRef = doc(db, 'relatorios', reportId, 'posConferencia', 'dados');
  const snap = await getDoc(subDocRef);
  const data = snap.exists() ? snap.data() : null;
  qs('#posTexto').value = data?.texto || '';
  modalCurrentImageURL = data?.imageUrl || null;
  updateImagePreview();

  // role controls
  qs('#posTexto').disabled = !canEdit;
  qs('#anexarImagemBtn').style.display = canEdit ? '' : 'none';
  qs('#excluirImagemBtn').style.display = (canEdit && modalCurrentImageURL) ? '' : 'none';
  qs('#salvarPosBtn').style.display = canEdit ? '' : 'none';
}

function closePosModal(){
  modalReportId = null;
  modal.style.display = 'none';
}

function updateImagePreview(){
  const wrap = qs('#imagemPreviewWrap');
  if(modalCurrentImageURL){
    wrap.style.display = '';
    qs('#imagemPreview').src = modalCurrentImageURL;
    qs('#verImagemBtn').onclick = ()=> window.open(modalCurrentImageURL, '_blank');
  }else{
    wrap.style.display = 'none';
    qs('#verImagemBtn').onclick = ()=> alert('Nenhuma imagem anexada.');
  }
}

qs('#anexarImagemBtn').addEventListener('click', async ()=>{
  const file = qs('#posImagem').files[0];
  if(!file) return alert('Escolha um arquivo de imagem.');
  if(!modalReportId) return;
  const path = `pos_conferencia/${modalReportId}/${file.name}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  modalCurrentImageURL = await getDownloadURL(ref);
  qs('#excluirImagemBtn').style.display = '';
  updateImagePreview();
  alert('Imagem anexada.');
});

qs('#excluirImagemBtn').addEventListener('click', async ()=>{
  if(!modalReportId || !modalCurrentImageURL) return;
  if(!confirm('Excluir a imagem anexada?')) return;
  try{
    const ref = storageRef(storage, modalCurrentImageURL);
  }catch(_){}
  // storage delete by path is safer; but we only have URL, keep metadata removal only
  modalCurrentImageURL = null;
  updateImagePreview();
  alert('Imagem indicada para remoção ao salvar.');
});

qs('#salvarPosBtn').addEventListener('click', async ()=>{
  if(!modalReportId) return;
  const texto = qs('#posTexto').value.trim();
  const subDocRef = doc(db, 'relatorios', modalReportId, 'posConferencia', 'dados');
  await setDoc(subDocRef, {
    texto, imageUrl: modalCurrentImageURL || null, editedAt: serverTimestamp(), editedBy: currentUserDoc?.matricula || 'admin'
  }, { merge: true });
  await updateDoc(doc(db,'relatorios', modalReportId), { posConferenciaEdited: true, updatedAt: serverTimestamp() });
  alert('Pós conferência salvo.');
  closePosModal();
});

// ======= Init =======
window.addEventListener('load', ()=>{
  calcSobraFalta();
});
