import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-L4C73-koH0wONPgMq9lI-Oi88diYfTE",
  authDomain: "roadmap-uitzendbureau.firebaseapp.com",
  projectId: "roadmap-uitzendbureau",
  storageBucket: "roadmap-uitzendbureau.firebasestorage.app",
  messagingSenderId: "336499917608",
  appId: "1:336499917608:web:77c46d154272027430861d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLORS = ['#00513A','#C9A227','#1A6B4A','#8B5E0A','#2E5D4B','#A67C52','#4A7C6F','#6B4226'];
let selectedColor = COLORS[0];
let doelen = [];
let unsubDoelen = null;
const openDoelen = {};

const cp = document.getElementById('color-picker');
COLORS.forEach(c => {
  const d = document.createElement('div');
  d.className = 'color-dot' + (c === selectedColor ? ' selected' : '');
  d.style.background = c;
  d.onclick = () => {
    selectedColor = c;
    document.querySelectorAll('.color-dot').forEach(x => x.classList.remove('selected'));
    d.classList.add('selected');
  };
  cp.appendChild(d);
});

window.doLogin = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('auth-error');
  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Inloggen...';

  if (!email || !password) {
    err.textContent = 'Vul je e-mail en wachtwoord in.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Inloggen';
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    err.textContent = 'Inloggen mislukt. Controleer je e-mail en wachtwoord.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Inloggen';
  }
};

window.doLogout = () => signOut(auth);

const authForm = document.getElementById('login-form');
if (authForm) {
  authForm.addEventListener('submit', e => {
    e.preventDefault();
    window.doLogin();
  });
}

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    document.getElementById('user-email').textContent = user.email;
    startListening();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-btn').disabled = false;
    document.getElementById('login-btn').textContent = 'Inloggen';
    if (unsubDoelen) { unsubDoelen(); unsubDoelen = null; }
  }
});

function startListening() {
  const q = query(collection(db, 'doelen'), orderBy('aangemaakt'));
  unsubDoelen = onSnapshot(q, snap => {
    doelen = snap.docs.map(d => ({ id: d.id, ...d.data(), taken: d.data().taken || [] }));
    render();
  });
}

function render() { renderStats(); renderDashboardDoelen(); renderDoelenList(); }

function calcStats() {
  let totalTaken = 0, gepland = 0, bezig = 0, afgerond = 0;
  doelen.forEach(d => d.taken.forEach(t => {
    totalTaken++;
    if (t.status === 'gepland') gepland++;
    else if (t.status === 'bezig') bezig++;
    else afgerond++;
  }));
  return { totalDoelen: doelen.length, totalTaken, gepland, bezig, afgerond };
}

function renderStats() {
  const s = calcStats();
  const pct = s.totalTaken ? Math.round(s.afgerond / s.totalTaken * 100) : 0;
  document.getElementById('overall-pct').textContent = pct + '%';
  document.getElementById('overall-bar').style.width = pct + '%';
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card c-green"><div class="n">${s.totalDoelen}</div><div class="l">Doelen</div><div class="accent-line"></div></div>
    <div class="stat-card c-ink"><div class="n">${s.gepland}</div><div class="l">Gepland</div><div class="accent-line"></div></div>
    <div class="stat-card c-gold"><div class="n">${s.bezig}</div><div class="l">Bezig</div><div class="accent-line"></div></div>
    <div class="stat-card c-green"><div class="n">${s.afgerond}</div><div class="l">Afgerond</div><div class="accent-line"></div></div>`;
}

function doelProgress(d) {
  return !d.taken.length ? 0 : Math.round(d.taken.filter(t => t.status === 'afgerond').length / d.taken.length * 100);
}

function renderDashboardDoelen() {
  const el = document.getElementById('dashboard-doelen');
  if (!doelen.length) {
    el.innerHTML = '<div class="empty-state">Nog geen doelen. Ga naar "Doelen & Taken" om te starten.</div>';
    return;
  }
  el.innerHTML = doelen.map(d => {
    const pct = doelProgress(d);
    return `<div class="doel-card" style="margin-bottom:.6rem"><div class="doel-header" style="cursor:default"><span class="doel-color" style="background:${d.kleur}"></span><span class="doel-name">${d.naam}</span><div class="doel-prog-wrap"><div class="doel-prog-bar"><div class="doel-prog-fill" style="width:${pct}%;background:${d.kleur}"></div></div><span class="doel-prog-pct">${pct}%</span></div></div></div>`;
  }).join('');
}

function renderDoelenList() {
  const el = document.getElementById('doelen-list');
  if (!doelen.length) {
    el.innerHTML = '<div class="empty-state">Nog geen doelen. Klik op "+ Doel toevoegen" om te starten.</div>';
    return;
  }

  el.innerHTML = doelen.map(d => {
    const pct = doelProgress(d);
    const open = openDoelen[d.id] !== false;
    return `<div class="doel-card"><div class="doel-header" onclick="toggleDoel('${d.id}')" role="button" aria-expanded="${open}" tabindex="0"><span class="doel-color" style="background:${d.kleur}"></span><span class="doel-name">${d.naam}</span><div class="doel-prog-wrap"><div class="doel-prog-bar"><div class="doel-prog-fill" style="width:${pct}%;background:${d.kleur}"></div></div><span class="doel-prog-pct">${pct}%</span><div class="doel-btns"><button type="button" class="doel-btn" onclick="event.stopPropagation();renameDoel('${d.id}')" title="Hernoemen" aria-label="Hernoemen">✎</button><button type="button" class="doel-btn del" onclick="event.stopPropagation();delDoel('${d.id}')" title="Verwijderen" aria-label="Verwijderen">×</button></div><span class="doel-chevron ${open ? 'open' : ''}" aria-hidden="true">⌄</span></div></div>${open ? `<div class="doel-actions-wrap">${d.taken.map((t,i) => `<div class="taak-row"><button type="button" class="taak-check ${t.status === 'afgerond' ? 'checked' : ''}" onclick="toggleCheck('${d.id}',${i})" aria-label="Markeer taak als ${t.status === 'afgerond' ? 'onafgerond' : 'afgerond'}"></button><span class="taak-text ${t.status === 'afgerond' ? 'done' : ''}">${t.tekst}</span><button type="button" class="status-pill s-${t.status}" onclick="cycleStatus('${d.id}',${i})">${t.status}</button><button type="button" class="taak-del" onclick="delTaak('${d.id}',${i})" aria-label="Taak verwijderen">×</button></div>`).join('')}<div class="add-taak-wrap"><div class="add-taak-form"><input type="text" id="taak-input-${d.id}" placeholder="Nieuwe taak omschrijven..." onkeydown="if(event.key==='Enter')addTaak('${d.id}')" aria-label="Nieuwe taak omschrijven"/><select id="taak-status-${d.id}" aria-label="Taakstatus"><option value="gepland">gepland</option><option value="bezig">bezig</option><option value="afgerond">afgerond</option></select><button type="button" class="btn-add-taak" onclick="addTaak('${d.id}')">+ Taak</button></div></div></div>` : ''}</div>`;
  }).join('');
}

window.toggleDoel = (id) => {
  openDoelen[id] = openDoelen[id] === false ? true : false;
  renderDoelenList();
};

window.delDoel = async (id) => {
  if (!confirm('Weet je zeker dat je dit doel en alle taken wilt verwijderen?')) return;
  await deleteDoc(doc(db, 'doelen', id));
};

window.renameDoel = async (id) => {
  const d = doelen.find(x => x.id === id);
  if (!d) return;
  const naam = prompt('Nieuwe naam voor dit doel:', d.naam);
  if (!naam || !naam.trim()) return;
  await updateDoc(doc(db, 'doelen', id), { naam: naam.trim() });
};

window.addTaak = async (doelId) => {
  const inp = document.getElementById('taak-input-' + doelId);
  const sel = document.getElementById('taak-status-' + doelId);
  if (!inp || !inp.value.trim()) return;
  const d = doelen.find(x => x.id === doelId);
  if (!d) return;
  const taken = [...d.taken, { tekst: inp.value.trim(), status: sel.value }];
  await updateDoc(doc(db, 'doelen', doelId), { taken });
  inp.value = '';
};

window.toggleCheck = async (doelId, idx) => {
  const d = doelen.find(x => x.id === doelId);
  if (!d) return;
  const taken = [...d.taken];
  taken[idx] = { ...taken[idx], status: taken[idx].status === 'afgerond' ? 'gepland' : 'afgerond' };
  await updateDoc(doc(db, 'doelen', doelId), { taken });
};

window.cycleStatus = async (doelId, idx) => {
  const d = doelen.find(x => x.id === doelId);
  if (!d) return;
  const v = ['gepland', 'bezig', 'afgerond'];
  const taken = [...d.taken];
  const h = v.indexOf(taken[idx].status);
  taken[idx] = { ...taken[idx], status: v[(h + 1) % 3] };
  await updateDoc(doc(db, 'doelen', doelId), { taken });
};

window.delTaak = async (doelId, idx) => {
  const d = doelen.find(x => x.id === doelId);
  if (!d) return;
  const taken = d.taken.filter((_, i) => i !== idx);
  await updateDoc(doc(db, 'doelen', doelId), { taken });
};

window.openAddDoel = () => {
  document.getElementById('modal-naam').value = '';
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal').setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('modal-naam').focus(), 50);
};

window.closeModal = (e) => {
  if (e.target.id === 'modal') closeModalDirect();
};

window.closeModalDirect = () => {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal').setAttribute('aria-hidden', 'true');
};

window.saveDoel = async () => {
  const naam = document.getElementById('modal-naam').value.trim();
  if (!naam) return;
  await addDoc(collection(db, 'doelen'), { naam, kleur: selectedColor, taken: [], aangemaakt: serverTimestamp() });
  closeModalDirect();
};

const modalNaam = document.getElementById('modal-naam');
if (modalNaam) {
  modalNaam.addEventListener('keydown', e => { if (e.key === 'Enter') window.saveDoel(); });
}

window.showTab = (tab) => {
  document.getElementById('tab-dashboard').style.display = tab === 'dashboard' ? 'block' : 'none';
  document.getElementById('tab-doelen').style.display = tab === 'doelen' ? 'block' : 'none';
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', (i === 0 && tab === 'dashboard') || (i === 1 && tab === 'doelen')));
};

window.openPwModal = () => {
  document.getElementById('pw-current').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  const msg = document.getElementById('pw-msg');
  msg.className = 'pw-msg';
  msg.style.display = 'none';
  document.getElementById('pw-modal').style.display = 'flex';
  document.getElementById('pw-modal').setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('pw-current').focus(), 50);
};

window.closePwModal = () => {
  document.getElementById('pw-modal').style.display = 'none';
  document.getElementById('pw-modal').setAttribute('aria-hidden', 'true');
};

window.changePw = async () => {
  const current = document.getElementById('pw-current').value;
  const newPw = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const msg = document.getElementById('pw-msg');
  const btn = document.getElementById('pw-save-btn');

  msg.className = 'pw-msg';
  msg.style.display = 'none';

  if (!current || !newPw || !confirm) {
    msg.textContent = 'Vul alle velden in.';
    msg.className = 'pw-msg error';
    msg.style.display = 'block';
    return;
  }
  if (newPw.length < 6) {
    msg.textContent = 'Nieuw wachtwoord moet minimaal 6 tekens zijn.';
    msg.className = 'pw-msg error';
    msg.style.display = 'block';
    return;
  }
  if (newPw !== confirm) {
    msg.textContent = 'Nieuwe wachtwoorden komen niet overeen.';
    msg.className = 'pw-msg error';
    msg.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Opslaan...';
  try {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, current);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPw);
    msg.textContent = 'Wachtwoord succesvol gewijzigd!';
    msg.className = 'pw-msg success';
    msg.style.display = 'block';
    setTimeout(() => closePwModal(), 1500);
  } catch (e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      msg.textContent = 'Huidig wachtwoord is onjuist.';
    } else {
      msg.textContent = 'Er ging iets mis. Probeer het opnieuw.';
    }
    msg.className = 'pw-msg error';
    msg.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Opslaan';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModalDirect();
    closePwModal();
  }
});
