// ========== FIREBASE CONFIG ==========
const firebaseConfig = {
  apiKey: "AIzaSyAdLiqDQTm9742wgfZFj4ubWWYXxvwnsEE",
  authDomain: "sia-zulia.firebaseapp.com",
  projectId: "sia-zulia",
  storageBucket: "sia-zulia.firebasestorage.app",
  messagingSenderId: "1055318359879",
  appId: "1:1055318359879:web:089d39d68317a9c4955662"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ========== LEGAL TEXTS ==========
const LEGAL = {
  terminos: {
    title: 'Términos de Servicio',
    html: `
      <h3>1. Aceptación</h3>
      <p>Al registrarte y usar SIA Zulia aceptas estos términos. Si no estás de acuerdo, no uses la aplicación.</p>

      <h3>2. Propósito de la aplicación</h3>
      <p>SIA Zulia es una herramienta de acompañamiento y seguimiento para el embarazo. No reemplaza la atención médica profesional ni constituye diagnóstico, prescripción o tratamiento médico.</p>

      <h3>3. Uso responsable</h3>
      <p>Eres responsable de la exactitud de los datos que ingreses. En caso de urgencia médica, contacta directamente a tu médico o servicios de emergencia.</p>

      <h3>4. Acceso y cuenta</h3>
      <p>Debes mantener la confidencialidad de tu contraseña. No compartas tu cuenta con terceros. SIA Zulia no se responsabiliza por accesos no autorizados derivados de tu descuido.</p>

      <h3>5. Contenido informativo</h3>
      <p>La información sobre semanas de gestación, síntomas y cuidados es de carácter educativo. Consulta siempre a tu equipo de salud ante cualquier duda o síntoma.</p>

      <h3>6. Modificaciones</h3>
      <p>SIA Zulia puede actualizar estos términos en cualquier momento. Te notificaremos los cambios relevantes. El uso continuado implica aceptación.</p>

      <h3>7. Contacto</h3>
      <p>Para dudas sobre estos términos escríbenos a <strong>soporte@siazulia.com</strong>.</p>
    `
  },
  privacidad: {
    title: 'Política de Privacidad',
    html: `
      <h3>1. Datos que recopilamos</h3>
      <p>Recopilamos: nombres, apellidos, fecha de nacimiento, documento de identidad, correo electrónico, teléfono, EPS, régimen de salud, fecha de última menstruación y fecha probable de parto.</p>

      <h3>2. Finalidad del tratamiento</h3>
      <p>Usamos tus datos exclusivamente para personalizar tu experiencia en la app, calcular semanas de gestación, y facilitar el seguimiento de tu embarazo.</p>

      <h3>3. Almacenamiento</h3>
      <p>Tus datos se almacenan de forma segura. No vendemos, arrendamos ni compartimos tu información personal con terceros sin tu consentimiento, salvo obligación legal.</p>

      <h3>4. Seguridad</h3>
      <p>Aplicamos medidas técnicas y organizativas para proteger tu información contra accesos no autorizados, pérdida o alteración.</p>

      <h3>5. Tus derechos</h3>
      <p>Tienes derecho a acceder, rectificar, actualizar o eliminar tus datos en cualquier momento. Para ejercerlos contáctanos en <strong>privacidad@siazulia.com</strong>.</p>

      <h3>6. Cookies y almacenamiento local</h3>
      <p>La app utiliza <em>localStorage</em> del navegador para guardar tu sesión y preferencias de forma local en tu dispositivo.</p>

      <h3>7. Menores de edad</h3>
      <p>Si eres menor de 18 años, el uso de la aplicación debe contar con la autorización de tu padre, madre o tutor legal.</p>

      <h3>8. Cambios a esta política</h3>
      <p>Podemos actualizar esta política. Te informaremos de cambios significativos a través de la aplicación.</p>
    `
  }
};

function openModal(tipo) {
  const data = LEGAL[tipo];
  if (!data) return;
  document.getElementById('modalTitle').textContent = data.title;
  document.getElementById('modalBody').innerHTML = data.html;
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function showRegister() {
  document.getElementById('loginCard').classList.add('hidden');
  document.getElementById('registerCard').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('registerCard').classList.add('hidden');
  document.getElementById('loginCard').classList.remove('hidden');
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = isError ? '#c0392b' : '#3c9e3c';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function handleLogin() {
  const tipo = document.getElementById('loginTipoDoc').value;
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPassword').value;

  if (!tipo) return showToast('Selecciona el tipo de documento', true);
  if (!email) return showToast('Ingresa tu correo electrónico', true);
  if (!pass) return showToast('Ingresa tu contraseña', true);

  try {
    // Autenticar con Firebase
    const userCredential = await auth.signInWithEmailAndPassword(email, pass);
    const user = userCredential.user;

    // Obtener datos del usuario de Firestore
    const docRef = await db.collection('pacientes').doc(user.uid).get();
    if (!docRef.exists) return showToast('Datos del usuario no encontrados', true);

    const patient = docRef.data();
    _loadPatientSession(patient, user.uid);
    showToast('Bienvenida a SIA Zulia');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
  } catch (error) {
    showToast('Correo o contraseña incorrectos', true);
  }
}

async function handleRegister() {
  const nombres = document.getElementById('regNombres').value.trim();
  const apellidos = document.getElementById('regApellidos').value.trim();
  const fecha = document.getElementById('regFecha').value;
  const tipoDoc = document.getElementById('regTipoDoc').value;
  const numDoc = document.getElementById('regNumDoc').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const tel = document.getElementById('regTel').value.trim();
  const pass = document.getElementById('regPass').value;
  const passConf = document.getElementById('regPassConf').value;
  const eps = document.getElementById('regEPS').value;
  const regimen = document.getElementById('regRegimen').value;
  const ultimaMens = document.getElementById('regUltimaMens').value;

  if (!nombres) return showToast('Ingresa tus nombres', true);
  if (!apellidos) return showToast('Ingresa tus apellidos', true);
  if (!fecha) return showToast('Ingresa tu fecha de nacimiento', true);
  if (!tipoDoc) return showToast('Selecciona el tipo de documento', true);
  if (!numDoc) return showToast('Ingresa el número de documento', true);
  if (!email || !email.includes('@')) return showToast('Ingresa un correo válido', true);
  if (!tel) return showToast('Ingresa tu número de teléfono', true);
  if (pass.length < 6) return showToast('La contraseña debe tener mínimo 6 caracteres', true);
  if (pass !== passConf) return showToast('Las contraseñas no coinciden', true);
  if (!eps) return showToast('Selecciona tu EPS', true);
  if (!regimen) return showToast('Selecciona el régimen de salud', true);
  if (!ultimaMens) return showToast('Ingresa la fecha de última menstruación', true);

  try {
    // Crear usuario en Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    const user = userCredential.user;

    // Preparar datos del paciente
    const patient = {
      email, nombres, apellidos,
      nombreCompleto: nombres + ' ' + apellidos,
      tipoDoc, numDoc, tel, eps, regimen, ultimaMens,
      fechaNac: fecha,
      nombreBebe: document.getElementById('regNombreBebe').value.trim(),
      fechaParto: document.getElementById('regFechaParto').value,
      registradoEn: new Date().toISOString()
    };

    // Guardar datos en Firestore
    await db.collection('pacientes').doc(user.uid).set(patient);

    _loadPatientSession(patient, user.uid);
    showToast('Registro exitoso. ¡Bienvenida!');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      showToast('Ya existe una cuenta con ese correo', true);
    } else {
      showToast('Error en el registro: ' + error.message, true);
    }
  }
}

function _loadPatientSession(p, uid) {
  localStorage.setItem('currentPatientId', uid);
  localStorage.setItem('ultimaMens', p.ultimaMens);
  localStorage.setItem('nombreBebe', p.nombreBebe || '');
  localStorage.setItem('nombreMadre', p.nombres);
  localStorage.setItem('regEPS', p.eps);
  localStorage.setItem('regTel', p.tel);
}
