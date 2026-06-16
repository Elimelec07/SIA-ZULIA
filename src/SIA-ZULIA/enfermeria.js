// ========== FIREBASE CONFIG ==========
const firebaseConfig = {
  apiKey: "AIzaSyAdLiqDQTm9742wgfZFj4ubWWYXxvwnsEE",
  authDomain: "sia-zulia.firebaseapp.com",
  projectId: "sia-zulia",
  storageBucket: "sia-zulia.firebasestorage.app",
  messagingSenderId: "1055318359879",
  appId: "1:1055318359879:web:089d39d68317a9c4955662"
};

// Inicializar Firebase (Verificación por si ya se inicializó en el HTML)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ===== VARIABLE GLOBAL: DATOS DESDE LA NUBE =====
let pacientesDesdeFirebase = [];

// ===== CÓDIGO DE ACCESO =====
const NURSE_CODE = '2024';

// ===== MAPA DE SÍNTOMAS =====
const SINT_MAP = {
  'cb-cefalea': 'Cefalea', 'cb-vision': 'Visión borrosa',
  'cb-epigastral': 'Epigastralgia', 'cb-edema': 'Edema', 'cb-convulsiones': 'Convulsiones'
};

function getSintNames(sintomasObj) {
  if (!sintomasObj) return 'Sin síntomas';
  const names = Object.entries(sintomasObj).filter(([, v]) => v).map(([k]) => SINT_MAP[k] || k);
  return names.length ? names.join(', ') : 'Sin síntomas';
}

function buildPatientObj(reg) {
  // Ahora leemos vitals y chat directamente del documento de Firebase
  const vitals = reg.vitals || [];
  const lastV = vitals.length ? vitals[vitals.length - 1] : null;
  const fum = new Date(reg.ultimaMens || Date.now());
  const diffD = Math.floor((new Date() - fum) / 86400000);
  const semana = Math.min(40, Math.max(0, Math.floor(diffD / 7)));

  let nivel = 'normal', presion = '--/--', fc = '--', fr = '--', sintomas = [];
  if (lastV) {
    presion = lastV.presion || '--/--';
    fc = lastV.frecuenciaCard || '--';
    fr = lastV.frecuenciaResp || '--';
    const [s, d] = (lastV.presion || '0/0').split('/').map(Number);
    if (s >= 160 || d >= 110) nivel = 'alerta';
    else if (s >= 140 || d >= 90) nivel = 'vigilancia';
    if (lastV.sintomas) sintomas = Object.entries(lastV.sintomas).filter(([, v]) => v).map(([k]) => SINT_MAP[k] || k);
  }

  return {
    id: reg.id,
    nombre: reg.nombreCompleto || (reg.nombres + ' ' + (reg.apellidos || '')) || 'Paciente',
    semana, presion, fc, fr, sintomas, nivel,
    eps: reg.eps || '--',
    tel: reg.tel || '--',
    ultimoReg: lastV ? ((lastV.fecha || '') + (lastV.hora ? ' · ' + lastV.hora : '')) : 'Sin registros',
    historial: vitals.slice(-5).reverse().map(v => ({
      fecha: (v.fecha || '') + (v.hora ? ' · ' + v.hora : ''),
      presion: v.presion || '--/--',
      fc: v.frecuenciaCard || '--',
      sint: getSintNames(v.sintomas)
    })),
    chat: reg.chat || [] // Se almacena el chat desde Firebase
  };
}

// ===== ESCUCHAR FIREBASE EN TIEMPO REAL =====
function iniciarSincronizacionFirebase() {
  db.collection("pacientes").onSnapshot((querySnapshot) => {
    const dataTemporal = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      data.id = doc.id; // Guardamos el ID del documento
      dataTemporal.push(data);
    });

    // Convertir datos crudos al formato de la interfaz
    pacientesDesdeFirebase = dataTemporal.map(buildPatientObj);

    // Si la enfermera está dentro del panel, actualizar vistas automáticamente
    if (sessionStorage.getItem('nurseLoggedIn') === 'true') {
      renderDashboard();
      if (!document.getElementById('secMensajes').classList.contains('hidden')) {
        renderChatList();
        if (currentEnChatPatientId) renderEnMessages();
      }
    }
  });
}

function getAllPatients() {
  // Ya no busca en localStorage, devuelve la memoria en la nube
  return pacientesDesdeFirebase;
}

function getRealPatient() {
  const all = getAllPatients();
  return all.length ? all[0] : null;
}

// ===== LOGIN =====
function nurseLogin() {
  const code = document.getElementById('nurseCode').value.trim();
  if (code === NURSE_CODE) {
    sessionStorage.setItem('nurseLoggedIn', 'true');
    document.getElementById('enLogin').classList.add('hidden');
    document.getElementById('enDash').classList.remove('hidden');
    renderDashboard();
  } else {
    showEnToast('Código incorrecto. Intenta de nuevo.', 'error');
    document.getElementById('nurseCode').value = '';
    document.getElementById('nurseCode').focus();
  }
}

function nurseLogout() {
  sessionStorage.removeItem('nurseLoggedIn');
  document.getElementById('enDash').classList.add('hidden');
  document.getElementById('enLogin').classList.remove('hidden');
  document.getElementById('nurseCode').value = '';
}

// ===== DASHBOARD =====
function renderDashboard() {
  const patients = getAllPatients();

  document.getElementById('statTotal').textContent = patients.length;
  document.getElementById('statNormal').textContent = patients.filter(p => p.nivel === 'normal').length;
  document.getElementById('statVigilancia').textContent = patients.filter(p => p.nivel === 'vigilancia').length;
  document.getElementById('statAlerta').textContent = patients.filter(p => p.nivel === 'alerta').length;

  if (!patients.length) {
    document.getElementById('enPatientList').innerHTML = `
      <div class="en-empty-state">
        <p style="font-size:48px">👩‍⚕️</p>
        <p>No hay pacientes registradas aún.</p>
        <p>Cuando una gestante se registre en la app, aparecerá aquí automáticamente.</p>
      </div>`;
    return;
  }

  const alertas = patients.filter(p => p.nivel === 'alerta');
  const vigilancias = patients.filter(p => p.nivel === 'vigilancia');
  const normales = patients.filter(p => p.nivel === 'normal');

  let html = '';
  if (alertas.length)
    html += `<div class="en-group-header en-group-red">🔴 Alerta activa — requiere atención inmediata</div>` + alertas.map(renderRow).join('');
  if (vigilancias.length)
    html += `<div class="en-group-header en-group-yellow">🟡 En vigilancia — registros límite recientes</div>` + vigilancias.map(renderRow).join('');
  if (normales.length)
    html += `<div class="en-group-header en-group-green">🟢 Sin novedad — dentro de parámetros normales</div>` + normales.map(renderRow).join('');

  document.getElementById('enPatientList').innerHTML = html;
}

function renderRow(p) {
  const colors = { alerta: '#C62828', vigilancia: '#E65100', normal: '#2E7D32' };
  const color = colors[p.nivel];
  let btn;
  if (p.nivel === 'alerta')
    btn = `<button class="en-btn-alerta"   onclick="openPatientModal('${p.id}')">Ver alerta ↗</button>`;
  else if (p.nivel === 'vigilancia')
    btn = `<button class="en-btn-historial" onclick="openPatientModal('${p.id}')">Historial</button>`;
  else
    btn = `<button class="en-btn-ver"       onclick="openPatientModal('${p.id}')">Ver</button>`;

  return `
    <div class="en-patient-row en-row-${p.nivel}">
      <div class="en-patient-dot" style="background:${color}"></div>
      <div class="en-patient-info">
        <div class="en-patient-name">${p.nombre}</div>
        <div class="en-patient-meta">Sem. ${p.semana} · EPS: ${p.eps} · Último reg: ${p.ultimoReg}</div>
      </div>
      <div class="en-patient-pa" style="color:${color}">${p.presion}</div>
      ${btn}
    </div>`;
}

// ===== MODAL PACIENTE =====
function openPatientModal(patientId) {
  const all = getAllPatients();
  const p = patientId ? all.find(x => x.id === patientId) : all[0];
  if (!p) return;

  document.getElementById('modalPatientName').textContent = p.nombre;
  document.getElementById('modalPatientInfo').textContent =
    `Sem. ${p.semana} · EPS: ${p.eps} · Tel: ${p.tel} · Último registro: ${p.ultimoReg}`;

  const colors = { alerta: '#C62828', vigilancia: '#E65100', normal: '#2E7D32' };
  const color = colors[p.nivel];
  const sintStr = p.sintomas.length ? p.sintomas.join(', ') : 'Sin síntomas';

  const alertBanner = p.nivel === 'alerta' ? `
    <div class="en-alert-banner">
      🚨 Alerta activa — PA: ${p.presion} mmHg · Síntomas: ${sintStr}
    </div>` : '';

  const histHTML = p.historial.length ? p.historial.map(h => {
    const [s, d] = (h.presion || '0/0').split('/').map(Number);
    let c = '#2E7D32';
    if (s >= 160 || d >= 110) c = '#C62828';
    else if (s >= 140 || d >= 90) c = '#E65100';
    return `
      <div class="en-hist-row">
        <span class="en-hist-fecha">${h.fecha}</span>
        <span class="en-hist-pa" style="color:${c}">${h.presion} mmHg</span>
        <span class="en-hist-fc">FC: ${h.fc} ppm</span>
        <span class="en-hist-sint">${h.sint}</span>
      </div>`;
  }).join('') : '<p style="color:var(--text-sec);font-size:13px;padding:8px 0">Sin registros aún.</p>';

  document.getElementById('enModalBody').innerHTML = `
    ${alertBanner}
    <div class="en-modal-vitals">
      <div class="en-modal-vital">
        <div class="en-modal-vital-label">Presión arterial</div>
        <div class="en-modal-vital-val" style="color:${color}">${p.presion} mmHg</div>
      </div>
      <div class="en-modal-vital">
        <div class="en-modal-vital-label">Frec. cardíaca</div>
        <div class="en-modal-vital-val">${p.fc} ppm</div>
      </div>
      <div class="en-modal-vital">
        <div class="en-modal-vital-label">Frec. respiratoria</div>
        <div class="en-modal-vital-val">${p.fr}/min</div>
      </div>
    </div>
    <div class="en-modal-sintomas"><strong>Síntomas:</strong> ${sintStr}</div>
    <div class="en-modal-section-title">Historial de registros</div>
    <div class="en-historial">${histHTML}</div>
    <div class="en-modal-actions">
      <button class="en-btn-call" onclick="window.location.href='tel:${p.tel}'">
        📞 Llamar paciente
      </button>
    </div>
  `;

  document.getElementById('enModal').classList.remove('hidden');
}

function closePatientModal() {
  document.getElementById('enModal').classList.add('hidden');
}

// ===== TOAST =====
function showEnToast(msg, type = 'success') {
  const t = document.getElementById('enToast');
  t.textContent = msg;
  t.className = `en-toast show en-toast-${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ===== NAVEGACIÓN DE TABS =====
function switchEnTab(tab) {
  ['panel', 'mensajes', 'ajustes'].forEach(t => {
    document.getElementById('sec' + t.charAt(0).toUpperCase() + t.slice(1)).classList.add('hidden');
    document.getElementById('nav' + t.charAt(0).toUpperCase() + t.slice(1)).classList.remove('active');
  });
  document.getElementById('sec' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');
  document.getElementById('nav' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');

  const titles = { panel: '⚕ Panel de Enfermería', mensajes: '💬 Mensajes', ajustes: '⚙️ Ajustes' };
  document.getElementById('enHeaderTitle').textContent = titles[tab];

  if (tab === 'mensajes') renderChatList();
  if (tab === 'ajustes') loadNurseSettings();
}

// ===== MENSAJES / CHAT =====
let currentEnChatPatientId = null;

function renderChatList() {
  const container = document.getElementById('enChatList');
  const patients = getAllPatients();

  if (!patients.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-sec);padding:40px 20px">No hay pacientes registradas aún.</p>';
    return;
  }

  container.innerHTML = patients.map(p => {
    const msgs = p.chat.filter(m => m.tipo !== 'typing');
    const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
    const initials = p.nombre.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const dotColor = { alerta: '#C62828', vigilancia: '#E65100', normal: '#2E7D32' }[p.nivel];
    const hasUnread = msgs.some(m => m.tipo === 'user' && !m.nurseRead);

    return `
    <div class="en-chat-item" onclick="openEnChat('${p.id}')">
      <div class="en-chat-item-avatar" style="background:${dotColor}">${initials}
        ${hasUnread ? '<span class="en-chat-unread"></span>' : ''}
      </div>
      <div class="en-chat-item-info">
        <div class="en-chat-item-name">${p.nombre} · Sem. ${p.semana}</div>
          <div class="en-chat-item-last">${lastMsg ? lastMsg.texto.substring(0, 50) : 'Sin mensajes aún — toca para iniciar'}</div>
        </div>
        <div class="en-chat-item-meta">
          <span class="en-chat-item-dot" style="background:${dotColor}"></span>
          ${lastMsg ? `<span class="en-chat-item-time">${lastMsg.hora}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function openEnChat(patientId) {
  const all = getAllPatients();
  const p = patientId ? all.find(x => x.id === patientId) : all[0];
  if (!p) return;

  currentEnChatPatientId = p.id;
  const initials = p.nombre.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const dotColor = { alerta: '#C62828', vigilancia: '#E65100', normal: '#2E7D32' }[p.nivel];

  document.getElementById('chatPatientName').textContent = p.nombre;
  document.getElementById('chatPatientAvatar').textContent = initials;
  document.getElementById('chatPatientAvatar').style.background = dotColor;

  // Actualizar la lectura de mensajes en Firebase si es necesario
  const mensajesNoLeidos = p.chat.some(m => m.tipo === 'user' && !m.nurseRead);
  if (mensajesNoLeidos) {
    const chatActualizado = p.chat.map(m => m.tipo === 'user' ? { ...m, nurseRead: true } : m);
    db.collection("pacientes").doc(p.id).update({ chat: chatActualizado });
  }

  renderEnMessages();
  document.getElementById('enChatModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('enChatInput')?.focus(), 300);
}

function closeEnChat() {
  document.getElementById('enChatModal').classList.add('hidden');
  currentEnChatPatientId = null;
}

function renderEnMessages() {
  const container = document.getElementById('enChatMessages');
  const all = getAllPatients();
  const p = currentEnChatPatientId ? all.find(x => x.id === currentEnChatPatientId) : all[0];

  if (!p) return;
  const msgs = p.chat.filter(m => m.tipo !== 'typing');

  if (msgs.length === 0) {
    container.innerHTML = `
      <div class="en-chat-empty">
        <div style="font-size:36px;margin-bottom:12px">💬</div>
        <p>Aún no hay mensajes. Inicia la conversación.</p>
        <div class="en-quick-replies">
          <button class="en-quick-reply" onclick="sendEnQuick('¿Cómo te has sentido hoy?')">¿Cómo te sientes?</button>
          <button class="en-quick-reply" onclick="sendEnQuick('¿Has tomado tu presión arterial hoy?')">¿Tomaste presión?</button>
          <button class="en-quick-reply" onclick="sendEnQuick('Recuerda tomar tu medicamento a tiempo 💊')">Recordatorio medicamento</button>
          <button class="en-quick-reply" onclick="sendEnQuick('Tu próxima cita es importante. ¿Tienes alguna duda?')">Próxima cita</button>
        </div>
      </div>`;
    return;
  }

  const initials = p.nombre.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  container.innerHTML = msgs.map(m => {
    if (m.tipo === 'nurse') {
      return `
        <div class="en-msg-row en-msg-right">
          <div class="en-msg-bubble en-bubble-nurse">
            <p>${m.texto}</p>
            <span class="en-msg-time">${m.hora}</span>
          </div>
        </div>`;
    } else {
      return `
        <div class="en-msg-row en-msg-left">
          <div class="en-msg-avatar-sm">${initials}</div>
          <div class="en-msg-bubble en-bubble-patient">
            <p>${m.texto}</p>
            <span class="en-msg-time">${m.hora}</span>
          </div>
        </div>`;
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function sendEnMessage() {
  const input = document.getElementById('enChatInput');
  const text = input?.value.trim();
  if (!text || !currentEnChatPatientId) return;

  const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const nuevoMensaje = { tipo: 'nurse', texto: text, hora, nurseRead: true };

  // Guardamos el mensaje en Firestore usando arrayUnion
  db.collection("pacientes").doc(currentEnChatPatientId).update({
    chat: firebase.firestore.FieldValue.arrayUnion(nuevoMensaje)
  });

  input.value = '';
  // No llamamos a renderEnMessages aquí porque onSnapshot lo hará automáticamente
}

function sendEnQuick(text) {
  if (!currentEnChatPatientId) return;
  const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const nuevoMensaje = { tipo: 'nurse', texto: text, hora, nurseRead: true };

  db.collection("pacientes").doc(currentEnChatPatientId).update({
    chat: firebase.firestore.FieldValue.arrayUnion(nuevoMensaje)
  });
}

// ===== AJUSTES / PERFIL =====
let nurseAccessCode = sessionStorage.getItem('nurseAccessCode') || NURSE_CODE;

function loadNurseSettings() {
  const nombre = localStorage.getItem('nurseNombre') || 'Enf. Zuleiny Sierra';
  const telefono = localStorage.getItem('nurseTelefono') || '3233128517';
  const cargo = localStorage.getItem('nurseCargo') || 'Enfermera · Programa HIE';
  const institucion = localStorage.getItem('nurseInstitucion') || '';
  const turno = localStorage.getItem('nurseTurno') || 'Turno tarde · 14:00–22:00';

  document.getElementById('settNombre').value = nombre;
  document.getElementById('settTelefono').value = telefono;
  document.getElementById('settCargo').value = cargo;
  document.getElementById('settInstitucion').value = institucion;

  const sel = document.getElementById('settTurno');
  if (sel) {
    [...sel.options].forEach(o => { o.selected = o.value === turno; });
  }

  const initials = nombre.replace('Enf. ', '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('enAvatarCircle').textContent = initials;
  document.getElementById('enProfileName').textContent = nombre;
  const roleEl = document.getElementById('enProfileRole');
  if (roleEl) roleEl.textContent = turno;

  if (localStorage.getItem('enDarkMode') === 'true') {
    document.getElementById('enDarkToggle').classList.add('active');
    document.documentElement.classList.add('en-dark');
  }
}

function saveNurseProfile() {
  const nombre = document.getElementById('settNombre').value.trim();
  const telefono = document.getElementById('settTelefono').value.trim();
  const cargo = document.getElementById('settCargo').value.trim();
  const institucion = document.getElementById('settInstitucion').value.trim();
  const turnoSel = document.getElementById('settTurno');
  const turno = turnoSel ? turnoSel.value : 'Turno tarde · 14:00–22:00';

  if (!nombre) { showEnToast('El nombre no puede estar vacío', 'error'); return; }
  if (!telefono) { showEnToast('Ingresa el número de teléfono', 'error'); return; }

  localStorage.setItem('nurseNombre', nombre);
  localStorage.setItem('nurseTelefono', telefono);
  localStorage.setItem('nurseCargo', cargo);
  localStorage.setItem('nurseInstitucion', institucion);
  localStorage.setItem('nurseTurno', turno);

  const initials = nombre.replace('Enf. ', '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('enAvatarCircle').textContent = initials;
  document.getElementById('enProfileName').textContent = nombre;
  document.getElementById('enHeaderNurseName').textContent = nombre;
  const roleEl = document.getElementById('enProfileRole');
  if (roleEl) roleEl.textContent = turno;

  showEnToast(`✓ Turno activado: ${nombre} · ${turno}`, 'success');
}

function changeNurseCode() {
  const actual = document.getElementById('settCodeActual').value.trim();
  const nuevo = document.getElementById('settCodeNuevo').value.trim();

  if (actual !== nurseAccessCode) { showEnToast('El código actual es incorrecto', 'error'); return; }
  if (nuevo.length < 4) { showEnToast('El nuevo código debe tener al menos 4 caracteres', 'error'); return; }

  nurseAccessCode = nuevo;
  sessionStorage.setItem('nurseAccessCode', nuevo);
  document.getElementById('settCodeActual').value = '';
  document.getElementById('settCodeNuevo').value = '';
  showEnToast('✓ Código de acceso actualizado', 'success');
}

function toggleEnDark() {
  const btn = document.getElementById('enDarkToggle');
  const isDark = btn.classList.toggle('active');
  document.documentElement.classList.toggle('en-dark', isDark);
  localStorage.setItem('enDarkMode', isDark);
  showEnToast(isDark ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado', 'success');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Iniciar la escucha a la base de datos de inmediato
  iniciarSincronizacionFirebase();

  if (sessionStorage.getItem('nurseLoggedIn') === 'true') {
    document.getElementById('enLogin').classList.add('hidden');
    document.getElementById('enDash').classList.remove('hidden');

    // Restaurar modo oscuro
    if (localStorage.getItem('enDarkMode') === 'true') {
      document.documentElement.classList.add('en-dark');
    }
    // Restaurar nombre en header
    const nombre = localStorage.getItem('nurseNombre');
    if (nombre) document.getElementById('enHeaderNurseName').textContent = nombre;
  }
});