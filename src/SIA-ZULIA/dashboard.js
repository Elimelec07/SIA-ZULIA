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
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ===== VARIABLES GLOBALES Y ESTADO =====
let currentPatientId = 'default';
let vitalsData = [];
let chatMessages = [];
let completedModules = [];
let ultimaMens = localStorage.getItem('ultimaMens') || '2024-01-15';
const TODAY = new Date();
let carouselIndex = 0;
let currentLessonId = null;

// ===== AUTENTICACIÓN Y SINCRONIZACIÓN EN TIEMPO REAL =====
auth.onAuthStateChanged((user) => {
  if (user) {
    currentPatientId = user.uid;
    localStorage.setItem('currentPatientId', user.uid);
    iniciarSincronizacionPaciente();
  }
});

function iniciarSincronizacionPaciente() {
  if (!currentPatientId || currentPatientId === 'default') return;

  db.collection("pacientes").doc(currentPatientId).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();

      // Actualizar variables con los datos de la nube
      vitalsData = data.vitals || [];
      chatMessages = data.chat || [];
      completedModules = data.modulos || [];

      if (data.nombreCompleto) localStorage.setItem('nombreMadre', data.nombreCompleto);
      if (data.nombreBebe) localStorage.setItem('nombreBebe', data.nombreBebe);
      if (data.ultimaMens) {
        ultimaMens = data.ultimaMens;
        localStorage.setItem('ultimaMens', data.ultimaMens);
      }
      if (data.tel) localStorage.setItem('regTel', data.tel);
      if (data.eps) localStorage.setItem('regEPS', data.eps);

      // Crear mensaje de bienvenida si es nueva
      if (chatMessages.length === 0) {
        crearMensajeBienvenida();
      }

      // Refrescar la interfaz
      renderWeek();
      updateVitalCards();
      renderRegistros();
      renderAprender();

      if (document.getElementById('modalChat')?.classList.contains('show')) {
        renderChatMessages();
      }
      if (document.getElementById('modalPerfil')?.classList.contains('show')) {
        loadProfile();
      }
      if (document.getElementById('modalEvolucion')?.classList.contains('show')) {
        loadEvolucion();
      }
    } else {
      // Registrar nueva paciente en la base de datos
      db.collection("pacientes").doc(currentPatientId).set({
        vitals: [],
        chat: [],
        modulos: [],
        nombreCompleto: localStorage.getItem('nombreMadre') || 'Gestante',
        fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });
}

function crearMensajeBienvenida() {
  const nurseName = localStorage.getItem('nurseNombre') || 'tu enfermera';
  const welcomeMsg = {
    tipo: 'nurse',
    texto: `¡Hola! Soy ${nurseName}. Estoy aquí para acompañarte durante tu embarazo 💕. Escríbeme cualquier duda o síntoma.`,
    hora: formatChatTime(new Date()),
    nurseRead: true
  };
  db.collection("pacientes").doc(currentPatientId).set({
    chat: firebase.firestore.FieldValue.arrayUnion(welcomeMsg)
  }, { merge: true });
}

function formatChatTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ===== DATOS DEL CARRUSEL DE CONSEJOS =====
const carouselTips = [
  { icon: '💡', categoria: 'Ten en cuenta', titulo: 'No ignores estos síntomas', texto: 'Cada vez que estés preocupada por un nuevo síntoma de embarazo que estés experimentando, llama a tu enfermera. No esperes a la próxima consulta si sientes algo diferente.', color: '#7B68EE' },
  { icon: '⚠️', categoria: 'Signos de alarma', titulo: 'Reconoce la preeclampsia', texto: 'Dolor de cabeza fuerte, visión borrosa, zumbido en los oídos, dolor en la parte alta del abdomen o hinchazón súbita son señales de que necesitas atención médica inmediata.', color: '#E85476' },
  { icon: '🩺', categoria: 'Sabías que', titulo: 'Tu presión arterial importa', texto: 'Una presión mayor a 130/90 mmHg durante el embarazo necesita vigilancia. Con 140/100 mmHg o más, debes contactar a tu enfermera de inmediato sin esperar.', color: '#2E7D9A' },
  { icon: '🥗', categoria: 'Nutrición', titulo: 'Come bien, cuida tu presión', texto: 'Reduce el consumo de sal. Prefiere frutas, verduras y proteínas magras. Una buena alimentación apoya el control de tu presión arterial durante el embarazo.', color: '#40916C' },
  { icon: '💧', categoria: 'Hidratación', titulo: 'El agua y la presión arterial', texto: 'Bebe 8 a 10 vasos de agua al día. Mantenerte hidratada ayuda a mantener el volumen de sangre y favorece el funcionamiento de tus riñones durante el embarazo.', color: '#2980B9' },
  { icon: '😴', categoria: 'Descanso', titulo: 'Descansa del lado izquierdo', texto: 'Dormir sobre tu lado izquierdo mejora la circulación hacia el bebé y puede ayudar a reducir la presión arterial. Intenta al menos 8 horas de sueño cada noche.', color: '#8E44AD' },
  { icon: '🏥', categoria: 'Ve a urgencias si...', titulo: 'Cuándo ir de inmediato', texto: 'Debes ir a urgencias sin esperar si presentas convulsiones, presión mayor a 160/110, dolor de cabeza que no cede, visión muy borrosa o pérdida de conciencia.', color: '#C0392B' },
  { icon: '💪', categoria: 'Tu fortaleza', titulo: 'Eres tu mejor aliada', texto: 'Registrar tus signos vitales cada día, reconocer los síntomas de alarma y asistir a tus controles prenatales son los actos más importantes que puedes hacer por ti y tu bebé.', color: '#E85476' }
];

// ===== DATOS DEL CURSO EDUCATIVO =====
const modulosData = [
  {
    id: 1, titulo: '¿Qué es la preeclampsia?', duracion: '5 min', semanaDisponible: 0, contenido: [
      { tipo: 'intro', texto: 'La preeclampsia o Hipertensión Inducida por el Embarazo (HIE) es una complicación caracterizada por presión arterial alta y daño a órganos como los riñones. Aparece después de la semana 20 y afecta al 5-8% de los embarazos.' },
      { tipo: 'puntos', titulo: '¿Qué la causa?', items: ['Problemas en el desarrollo de la placenta desde el inicio', 'Factores de riesgo: primer embarazo, obesidad, hipertensión crónica', 'Historia familiar de preeclampsia aumenta el riesgo', 'Con vigilancia adecuada se puede manejar de forma segura'] },
      { tipo: 'alerta', texto: 'La preeclampsia puede evolucionar rápidamente. Registrar tu presión todos los días es tu arma más poderosa de detección temprana.' }
    ]
  },
  {
    id: 2, titulo: 'Signos de alarma que debes conocer', duracion: '7 min', semanaDisponible: 0, contenido: [
      { tipo: 'intro', texto: 'Reconocer los signos de alarma a tiempo puede salvar tu vida y la de tu bebé. Cada síntoma es una señal que tu cuerpo te envía.' },
      { tipo: 'puntos', titulo: 'Señales de alarma inmediata', items: ['🤕 Dolor de cabeza fuerte que no cede con analgésicos', '👁️ Visión borrosa, destellos de luz o manchas', '😣 Dolor intenso en la parte alta del abdomen', '🦶 Hinchazón repentina de cara, manos o pies', '⚡ Convulsiones o pérdida de conciencia'] },
      { tipo: 'alerta', texto: 'Cefalea + Visión borrosa al mismo tiempo = ve a urgencias AHORA sin esperar ningún resultado.' },
      { tipo: 'puntos', titulo: 'Cuándo llamar a tu enfermera', items: ['Presión ≥ 140/100 mmHg', 'Cualquier síntoma de la lista anterior', 'Reducción de movimientos del bebé', 'Cualquier cambio que te preocupe, por pequeño que sea'] }
    ]
  },
  {
    id: 3, titulo: 'Cómo tomar bien tu presión arterial', duracion: '4 min', semanaDisponible: 0, contenido: [
      { tipo: 'intro', texto: 'Una medición correcta es la base del monitoreo. Una técnica incorrecta puede darte valores falsos y hacerte tomar decisiones equivocadas.' },
      { tipo: 'puntos', titulo: 'Pasos para una medición correcta', items: ['1️⃣ Siéntate y descansa al menos 5 minutos antes', '2️⃣ Apoya ambos pies en el suelo, sin cruzar las piernas', '3️⃣ Coloca el brazalete al nivel del corazón', '4️⃣ No hables, no te muevas durante la medición', '5️⃣ Espera 2 minutos y repite. Anota el promedio'] },
      { tipo: 'puntos', titulo: '¿Qué significan los valores?', items: ['✅ Normal: menos de 130/90 mmHg', '⚡ Vigilancia: 130–139 / 90–99 mmHg', '🚨 Alarma: 140/100 mmHg o más — llama ahora'] },
      { tipo: 'alerta', texto: 'Mide siempre a la misma hora del día. Registra los valores en la app inmediatamente para que no se te olviden.' }
    ]
  },
  {
    id: 4, titulo: 'Alimentación y presión arterial', duracion: '6 min', semanaDisponible: 26, contenido: [
      { tipo: 'intro', texto: 'Lo que comes influye directamente en tu presión. Una dieta adecuada complementa tu tratamiento médico y puede ayudarte a mantener valores estables.' },
      { tipo: 'puntos', titulo: 'Alimentos que debes preferir', items: ['🥬 Verduras verdes: espinacas, brócoli, acelgas', '🫘 Legumbres: lentejas, fríjoles, garbanzos', '🐟 Proteínas magras: pollo sin piel, pescado, huevo', '🍌 Frutas ricas en potasio: banano, kiwi, naranja', '🥛 Lácteos descremados para el calcio'] },
      { tipo: 'puntos', titulo: 'Qué debes evitar o reducir', items: ['🧂 Sal y alimentos ultra-procesados o enlatados', '🍟 Comida rápida y frituras', '🧃 Bebidas azucaradas y gaseosas', '☕ Cafeína: máximo 1 taza al día', '🚫 Alcohol: completamente prohibido'] },
      { tipo: 'alerta', texto: 'Reducir la sal es uno de los cambios más efectivos. Prueba con hierbas como cilantro, perejil o limón para dar sabor sin sal.' }
    ]
  },
  {
    id: 5, titulo: '¿Cuándo ir a urgencias?', duracion: '5 min', semanaDisponible: 27, contenido: [
      { tipo: 'intro', texto: 'Saber cuándo es una emergencia evita perder tiempo valioso. Ante la duda, siempre es mejor una consulta extra que esperar demasiado.' },
      { tipo: 'puntos', titulo: 'Ve a urgencias AHORA si tienes', items: ['⚡ Convulsiones o pérdida de conciencia', '🔴 Presión ≥ 160/110 mmHg', '🤕 Cefalea muy intensa que no cede con analgésicos', '👁️ Pérdida de visión o visión muy borrosa', '😣 Dolor fuerte en el abdomen superior derecho', '🫀 Dificultad para respirar súbita'] },
      { tipo: 'puntos', titulo: 'Llama a tu enfermera si tienes', items: ['Presión 140–159 / 100–109 mmHg', 'Hinchazón repentina de cara o manos', 'Menos movimientos del bebé de lo normal', 'Cefalea leve que persiste más de 1 hora'] },
      { tipo: 'alerta', texto: 'Nunca esperes a la próxima cita programada si tienes cualquier señal de alarma. Ve directamente al servicio de urgencias.' }
    ]
  },
  {
    id: 6, titulo: 'Medicamentos en el embarazo', duracion: '6 min', semanaDisponible: 28, contenido: [
      { tipo: 'intro', texto: 'Con HIE, algunos medicamentos son necesarios para proteger tu salud y la de tu bebé. Es importante que conozcas cuáles son seguros y cómo tomarlos.' },
      { tipo: 'puntos', titulo: 'Antihipertensivos seguros en embarazo', items: ['💊 Metildopa: el más estudiado y seguro durante el embarazo', '💊 Nifedipino: controla la presión en situaciones urgentes', '💊 Labetalol: se usa en emergencias hipertensivas', '⚠️ NUNCA tomes enalapril, losartán ni captopril en el embarazo'] },
      { tipo: 'puntos', titulo: 'Reglas de oro del medicamento', items: ['Nunca suspendas la medicación sin consultar al médico', 'Tómala a la misma hora todos los días', 'Anota si tienes mareos, náuseas u otros efectos', 'No tomes ningún medicamento sin autorización médica'] },
      { tipo: 'alerta', texto: 'El ibuprofeno y el naproxeno están contraindicados en el embarazo. Para el dolor, solo usa acetaminofén (Tylenol) con indicación médica.' }
    ]
  },
  {
    id: 7, titulo: 'Preparación para el parto', duracion: '8 min', semanaDisponible: 32, contenido: [
      { tipo: 'intro', texto: 'Con HIE el parto puede ocurrir antes de la semana 40. Conocer qué esperar te ayuda a prepararte mentalmente y actuar con calma.' },
      { tipo: 'puntos', titulo: 'Qué puede pasar con HIE al nacer', items: ['El parto puede programarse antes de la semana 40', 'Puede requerir inducción del parto o cesárea', 'Tendrás monitoreo continuo de presión y bebé', 'El equipo médico tomará la mejor decisión para las dos'] },
      { tipo: 'puntos', titulo: 'Qué llevar al hospital', items: ['📋 Carnet de citas y todos tus documentos médicos', '💊 Tu medicación actual y dosis exacta', '👗 Ropa cómoda para ti y para el bebé', '📞 Teléfono cargado con contactos de emergencia listos'] },
      { tipo: 'alerta', texto: 'Si antes de tu fecha programada sientes cualquier signo de alarma, ve al hospital de inmediato — no llames, ve directamente.' }
    ]
  },
  {
    id: 8, titulo: 'Cuidados posparto y seguimiento', duracion: '5 min', semanaDisponible: 36, contenido: [
      { tipo: 'intro', texto: 'La HIE no siempre termina con el parto. Las primeras 6 semanas posparto son un período de alto riesgo que requiere vigilancia especial.' },
      { tipo: 'puntos', titulo: 'Qué monitorear después del parto', items: ['📊 Mide tu presión todos los días durante al menos 2 semanas', '⚠️ La preeclampsia puede aparecer por primera vez posparto', '💊 Sigue el medicamento según te indique el médico', '🏥 Asiste a todos los controles posparto sin falta'] },
      { tipo: 'puntos', titulo: 'Señales de alarma posparto', items: ['Dolor de cabeza fuerte en los días siguientes al parto', 'Visión borrosa o destellos de luz', 'Presión persistentemente alta', 'Hinchazón súbita de cara o manos'] },
      { tipo: 'alerta', texto: 'Las mujeres con preeclampsia tienen mayor riesgo de hipertensión en futuros embarazos. Informa siempre a tu médico en controles futuros.' }
    ]
  }
];

const LOGROS_DEF = [
  { id: 'primer_paso', emoji: '🌱', nombre: 'Primer paso', desc: 'Completaste tu primer módulo educativo', req: (d, t, v) => d >= 1 },
  { id: 'en_camino', emoji: '📚', nombre: 'En camino', desc: 'Completaste la mitad de los módulos educativos', req: (d, t, v) => t > 0 && d >= Math.ceil(t / 2) },
  { id: 'experta', emoji: '🎓', nombre: 'Experta prenatal', desc: 'Completaste todos los módulos educativos. ¡Increíble!', req: (d, t, v) => t > 0 && d >= t },
  { id: 'primera_med', emoji: '🩺', nombre: 'Primera medición', desc: 'Registraste tus signos vitales por primera vez', req: (d, t, v) => v >= 1 },
  { id: 'constante', emoji: '💪', nombre: 'Constante', desc: 'Llevas 5 o más registros de signos vitales', req: (d, t, v) => v >= 5 },
  { id: 'dedicada', emoji: '⭐', nombre: 'Dedicada', desc: 'Llevas 10 o más registros de signos vitales', req: (d, t, v) => v >= 10 },
  { id: 'mama_estrella', emoji: '🌟', nombre: 'Mamá estrella', desc: 'Completaste todo el curso y tienes 10+ registros', req: (d, t, v) => t > 0 && d >= t && v >= 10 },
];

function getLogros() {
  const done = completedModules.length;
  const total = modulosData.length;
  const vitals = vitalsData.length;
  return LOGROS_DEF.map(l => ({ ...l, unlocked: l.req(done, total, vitals) }));
}

// ===== CONSTANTES CLÍNICAS =====
const RANGES = {
  sistolica: { ok: 130, warn: 140 },
  diastolica: { ok: 90, warn: 100 },
  frecCard: { minOk: 60, maxOk: 100, maxWarn: 120 },
  frecResp: { minOk: 12, maxOk: 20, maxWarn: 24 }
};

const babySizeData = {
  4: { emoji: '🌱', name: 'Semilla de amapola', desc: '~0.2 cm', weight: '<1 g' },
  5: { emoji: '🫘', name: 'Semilla de sésamo', desc: '~0.4 cm', weight: '~1 g' },
  6: { emoji: '🫛', name: 'Lenteja', desc: '~0.6 cm', weight: '~2 g' },
  7: { emoji: '🫐', name: 'Arándano', desc: '~1 cm', weight: '~3 g' },
  8: { emoji: '🍓', name: 'Fresa pequeña', desc: '~1.6 cm', weight: '~5 g' },
  9: { emoji: '🍇', name: 'Uva', desc: '~2.3 cm', weight: '~8 g' },
  10: { emoji: '🫒', name: 'Aceituna', desc: '~3.1 cm', weight: '~10 g' },
  11: { emoji: '🥚', name: 'Lima pequeña', desc: '~4.1 cm', weight: '~14 g' },
  12: { emoji: '🍋', name: 'Limón', desc: '~5.4 cm', weight: '~20 g' },
  13: { emoji: '🥚', name: 'Huevo', desc: '~7.4 cm', weight: '~30 g' },
  14: { emoji: '🍑', name: 'Durazno', desc: '~8.7 cm', weight: '~45 g' },
  15: { emoji: '🍎', name: 'Manzana', desc: '~10 cm', weight: '~70 g' },
  16: { emoji: '🥑', name: 'Aguacate', desc: '~11.6 cm', weight: '~100 g' },
  17: { emoji: '🌽', name: 'Mazorca pequeña', desc: '~13 cm', weight: '~140 g' },
  18: { emoji: '🥕', name: 'Zanahoria', desc: '~14.2 cm', weight: '~190 g' },
  19: { emoji: '🍅', name: 'Tomate grande', desc: '~15.3 cm', weight: '~240 g' },
  20: { emoji: '🌶️', name: 'Pimentón', desc: '~16.4 cm', weight: '~300 g' },
  21: { emoji: '🥦', name: 'Brócoli', desc: '~26.7 cm', weight: '~360 g' },
  22: { emoji: '🫑', name: 'Pimentón grande', desc: '~27.8 cm', weight: '~430 g' },
  23: { emoji: '🥭', name: 'Mango', desc: '~28.9 cm', weight: '~500 g' },
  24: { emoji: '🌽', name: 'Mazorca', desc: '~30 cm', weight: '~600 g' },
  25: { emoji: '🥒', name: 'Pepino', desc: '~34.6 cm', weight: '~680 g' },
  26: { emoji: '🍆', name: 'Berenjena', desc: '~35.6 cm', weight: '~760 g' },
  27: { emoji: '🧅', name: 'Coliflor', desc: '~36.6 cm', weight: '~875 g' },
  28: { emoji: '🍌', name: 'Plátano', desc: '~37.6 cm', weight: '~1 kg' },
  29: { emoji: '🥬', name: 'Col rizada', desc: '~38.6 cm', weight: '~1.2 kg' },
  30: { emoji: '🥦', name: 'Repollo', desc: '~39.9 cm', weight: '~1.3 kg' },
  31: { emoji: '🥥', name: 'Coco', desc: '~41.1 cm', weight: '~1.5 kg' },
  32: { emoji: '🍍', name: 'Piña pequeña', desc: '~42.4 cm', weight: '~1.7 kg' },
  33: { emoji: '🎃', name: 'Calabaza pequeña', desc: '~43.7 cm', weight: '~1.9 kg' },
  34: { emoji: '🥭', name: 'Melón mediano', desc: '~45 cm', weight: '~2.1 kg' },
  35: { emoji: '🎃', name: 'Calabaza', desc: '~46.2 cm', weight: '~2.4 kg' },
  36: { emoji: '🌿', name: 'Apio grande', desc: '~47.4 cm', weight: '~2.6 kg' },
  37: { emoji: '🎃', name: 'Melón verde', desc: '~48.6 cm', weight: '~2.9 kg' },
  38: { emoji: '🍈', name: 'Sandía pequeña', desc: '~49.8 cm', weight: '~3.1 kg' },
  39: { emoji: '🍉', name: 'Sandía mediana', desc: '~50.7 cm', weight: '~3.3 kg' },
  40: { emoji: '🍉', name: 'Sandía — ¡Listo!', desc: '~51 cm', weight: '~3.4 kg' }
};

const weekDevelopment = {
  4: { bebe: 'El embrión se implanta en el útero. El tubo neural —futuro cerebro y médula espinal— comienza a formarse.', cuerpo: 'Primeros síntomas posibles: sensibilidad en senos y leve fatiga.', sentidos: 'Aún no hay desarrollo sensorial activo.', consejo: 'Inicia ácido fólico 400 mcg/día si aún no lo has comenzado. Evita alcohol, tabaco y medicamentos sin prescripción.' },
  5: { bebe: 'El corazón primitivo late por primera vez. Se forman los esbozos de ojos, nariz y boca.', cuerpo: 'Posibles náuseas matutinas y aumento de la frecuencia urinaria.', sentidos: 'El sistema nervioso comienza su desarrollo más básico.', consejo: 'Come porciones pequeñas y frecuentes para manejar las náuseas. Mantén buena hidratación.' },
  6: { bebe: 'Brazos y piernas empiezan a brotar. El cerebro se divide en sus partes principales.', cuerpo: 'Las náuseas pueden intensificarse. Posible mayor sensibilidad al olfato.', sentidos: 'El cerebro primitivo comienza a coordinar señales básicas.', consejo: 'Identifica los olores que desencadenan náuseas y evítalos.' },
  7: { bebe: 'El embrión tiene cara reconocible. Pulmones y riñones están tomando forma.', cuerpo: 'El útero ha crecido al doble. Posible salivación excesiva.', sentidos: 'Los ojos ya tienen pigmento, aunque los párpados están fusionados.', consejo: 'Agenda tu primera cita prenatal si aún no lo has hecho.' },
  8: { bebe: 'Los dedos de manos y pies se están formando. Todos los órganos principales están presentes.', cuerpo: 'El útero ha duplicado su tamaño. Las náuseas suelen ser más intensas.', sentidos: 'Responde a toques con movimientos reflejos, aunque aún no los sientes.', consejo: 'La primera ecografía obstétrica suele realizarse entre las semanas 8 y 12.' },
  9: { bebe: 'Los órganos genitales externos comienzan a diferenciarse. A partir de ahora se llama "feto".', cuerpo: 'Posible estreñimiento por cambios hormonales. Senos más voluminosos.', sentidos: 'El oído interno empieza a formarse.', consejo: 'Evita el esfuerzo físico intenso. Consulta con tu médico qué actividades son seguras.' },
  10: { bebe: 'Ya tiene todos los órganos en su lugar. Las uñas empiezan a crecer. Puede doblar los codos.', cuerpo: 'Puedes notar un leve abultamiento en el bajo vientre.', sentidos: 'Puede sentir toques dentro del útero, aunque no los percibes aún.', consejo: 'Si tienes náuseas intensas, consulta sobre tratamiento seguro con tu médico.' },
  11: { bebe: 'Sus riñones producen orina. Ya puede bostezar. El diafragma está formándose.', cuerpo: 'Las náuseas suelen empezar a mejorar. Regresa algo de energía.', sentidos: 'Comienza a percibir cambios de presión en el líquido amniótico.', consejo: 'Buen momento para el tamizaje de cromosomopatías del primer trimestre.' },
  12: { bebe: 'Fin del primer trimestre. Todos los órganos están formados. Ya puede cerrar el puño.', cuerpo: 'Las náuseas disminuyen. Tu barriga empieza a notarse.', sentidos: 'Sus dedos tienen huellas dactilares únicas. Los nervios empiezan a mielinizarse.', consejo: 'Si las náuseas persisten después de la semana 12, infórmale a tu médico.' },
  13: { bebe: 'Sus cuerdas vocales están formándose. Los intestinos se organizan dentro del abdomen.', cuerpo: 'Inicio del segundo trimestre. La energía suele mejorar notablemente.', sentidos: 'Puede tragar líquido amniótico y percibir sabores básicos.', consejo: 'Excelente momento para retomar actividad física suave: caminatas o natación prenatal.' },
  14: { bebe: 'Puede hacer muecas. El cuello se alarga. Sus músculos se fortalecen con cada movimiento.', cuerpo: 'El útero sube por encima del pubis. Posibles dolores ligamentarios.', sentidos: 'El oído externo está casi formado; empieza a percibir sonidos graves.', consejo: 'Inicia calcio 1.200 mg/día desde esta semana según indicación médica.' },
  15: { bebe: 'Su esqueleto cambia de cartílago a hueso. Puede chupar el pulgar dentro del vientre.', cuerpo: 'Posible congestión nasal (rinitis del embarazo). Encías más sensibles.', sentidos: 'Reacciona a la luz con movimientos aunque sus ojos permanezcan cerrados.', consejo: 'Usa hilo dental con suavidad; las encías son más frágiles durante el embarazo.' },
  16: { bebe: 'Puede hacer movimientos faciales y chupar el pulgar. Sus huesos se están endureciendo.', cuerpo: 'Podrías sentir los primeros movimientos (sensación de mariposas en el vientre).', sentidos: 'Oye sonidos amortiguados del exterior, incluyendo tu voz claramente.', consejo: 'Habla y cántale a tu bebé. Ya puede escucharte y reconocer tu voz.' },
  17: { bebe: 'Su grasa corporal empieza a acumularse. El cordón umbilical se engrosa y fortalece.', cuerpo: 'Barriga ya visible. El centro de gravedad cambia — ten cuidado con el equilibrio.', sentidos: 'Ya puede escuchar el latido de tu corazón y tu voz con claridad.', consejo: 'Duerme sobre el lado izquierdo para mejorar el flujo de sangre hacia el bebé.' },
  18: { bebe: 'Se mueve activamente: voltea, patea y hace piruetas. La mielina cubre los nervios cerebrales.', cuerpo: 'Puedes sentir movimientos más definidos. Posible dolor de espalda.', sentidos: 'Reacciona a sonidos externos con movimientos o con latidos más rápidos.', consejo: 'Registra los movimientos de tu bebé. Si los notas disminuidos, consulta de inmediato.' },
  19: { bebe: 'Se cubre de vérnix caseosa, sustancia grasa que protege su piel. Sus pulmones maduran.', cuerpo: 'Posibles calambres en las piernas. Presión en la pelvis.', sentidos: 'Su sentido del gusto está activo; experimenta sabores del líquido amniótico.', consejo: 'Estira las piernas antes de dormir para prevenir calambres nocturnos.' },
  20: { bebe: 'Mitad del embarazo. Ya tiene cejas, pestañas y uñas. Ciclos de sueño establecidos.', cuerpo: 'Barriga visible. Patadas perceptibles. Pueden aparecer estrías.', sentidos: 'Ciclos de sueño y vigilia bien definidos. Reacciona a música y voces conocidas.', consejo: 'Aplica crema hidratante en el abdomen para reducir el riesgo de estrías.' },
  21: { bebe: 'Sus movimientos son más coordinados. La médula ósea ya produce glóbulos rojos.', cuerpo: 'Posible acidez gástrica por el crecimiento del útero. Mayor cansancio.', sentidos: 'Puede distinguir diferentes sabores y olores en el líquido amniótico.', consejo: 'Come despacio y en porciones pequeñas para reducir la acidez gástrica.' },
  22: { bebe: 'Pesa casi medio kilo. Sus labios, cejas y pestañas son claramente visibles.', cuerpo: 'Posible aparición de línea negra en el abdomen. Piel más sensible al sol.', sentidos: 'Su cerebro procesa señales sensoriales complejas. Reconoce perfectamente la voz materna.', consejo: 'Usa protector solar al salir. La piel es más fotosensible durante el embarazo.' },
  23: { bebe: 'Sus pulmones producen surfactante, vital para respirar al nacer. Piel rosada y translúcida.', cuerpo: 'Posible edema en pies y tobillos. Controla tu presión arterial regularmente.', sentidos: 'Responde a música y sonidos fuertes con movimientos visibles desde afuera.', consejo: 'Eleva los pies cuando descanses para reducir la hinchazón.' },
  24: { bebe: 'Sus pulmones se desarrollan activamente. Sus huellas dactilares son únicas e irrepetibles.', cuerpo: 'Posible dolor de espalda. Tu centro de gravedad continúa cambiando.', sentidos: 'Ciclo sueño-vigilia más definido. Patadas más fuertes y regulares.', consejo: 'Registra 10 movimientos del bebé en 2 horas cada día. Si no los sientes, consulta.' },
  25: { bebe: 'Su cara está completamente formada. El cerebro crece muy rápidamente esta semana.', cuerpo: 'Posibles contracciones de Braxton Hicks (práctica, sin dolor). Acidez frecuente.', sentidos: 'Su oído está completamente desarrollado. Distingue con claridad voces familiares.', consejo: 'Las contracciones de Braxton Hicks son normales. Si son dolorosas o regulares, consulta.' },
  26: { bebe: 'Sus ojos se abren por primera vez. Puede ver luz a través de la pared abdominal.', cuerpo: 'Posible dificultad para dormir cómodamente. Piernas inquietas por las noches.', sentidos: 'Reacciona a la luz con cambios en actividad y frecuencia cardíaca.', consejo: 'Usa almohada entre las rodillas y detrás de la espalda para dormir mejor.' },
  27: { bebe: 'Puede soñar (hay actividad cerebral en fase REM). Su cerebro tiene pliegues más complejos.', cuerpo: 'El útero presiona el diafragma — puedes sentir dificultad para respirar profundo.', sentidos: 'Su tacto está muy desarrollado; toca el cordón umbilical y su propio rostro.', consejo: 'Inicia clases de preparación para el parto si aún no lo has hecho.' },
  28: { bebe: 'Tercer trimestre. Puede abrir los ojos y parpadear. Reacciona a luz y sonido activamente.', cuerpo: 'El bebé ocupa más espacio. Posible dificultad para respirar y mayor presión pélvica.', sentidos: 'Parpadea y enfoca objetos. Reconoce canciones y voces que escucha regularmente.', consejo: 'A partir de ahora, visitas prenatales cada 2 semanas. Controla tu presión cada día.' },
  29: { bebe: 'Su cerebro puede regular temperatura corporal. Músculos y pulmones continúan madurando.', cuerpo: 'Aumento de peso más notorio. Posible visión borrosa por cambios hormonales.', sentidos: 'Muy sensible a la voz materna. Puede calmarse al escuchar música suave familiar.', consejo: 'Visión borrosa + dolor de cabeza + hinchazón repentina = ve a urgencias de inmediato.' },
  30: { bebe: 'Produce surfactante activamente. Si naciera hoy, tendría altas posibilidades de sobrevivir.', cuerpo: 'Acidez intensa. Dificultad para encontrar posición cómoda para dormir.', sentidos: 'Su gusto, oído y tacto están completamente maduros y funcionando.', consejo: 'Continúa registrando tus signos vitales diariamente en SIA Zulia.' },
  31: { bebe: 'Todos los sistemas están desarrollados; el tiempo restante es para crecer y terminar de madurar.', cuerpo: 'Posible hinchazón de manos y pies. Mayor cansancio general.', sentidos: 'Sus pupilas se contraen y dilatan en respuesta a estímulos luminosos.', consejo: 'Descansa lo necesario. Empieza a preparar la maleta para la clínica.' },
  32: { bebe: 'Practica respirar con líquido amniótico. Su cerebro crece a gran velocidad esta semana.', cuerpo: 'Acidez frecuente. Las visitas prenatales son ahora más seguidas.', sentidos: 'Muy reactivo a estímulos externos: música, voces y movimiento materno.', consejo: 'Duerme sobre el lado izquierdo para mejorar la circulación hacia el bebé.' },
  33: { bebe: 'Sus huesos se endurecen (excepto el cráneo, que debe ser flexible para el parto).', cuerpo: 'La pelvis empieza a prepararse. Posibles dolores en zona pélvica y lumbar.', sentidos: 'Coordina bien succión y deglución, movimientos esenciales para la lactancia.', consejo: 'Habla con tu médico sobre tu plan de parto y tus preferencias.' },
  34: { bebe: 'Sus uñas han llegado a la punta de los dedos. El sistema nervioso central está casi maduro.', cuerpo: 'Posible sensación de "alivio" si el bebé baja hacia la pelvis (encajamiento).', sentidos: 'Reacciona con sobresalto ante sonidos fuertes e inesperados.', consejo: 'Aprende los signos de trabajo de parto: contracciones regulares, pérdida del tapón mucoso.' },
  35: { bebe: 'Sus pulmones están casi completamente maduros. Gana aproximadamente 200 g por semana.', cuerpo: 'Contracciones de Braxton Hicks más frecuentes. Presión pélvica intensa.', sentidos: 'Muy activo en períodos de vigilia. Reconoce claramente la voz materna.', consejo: 'Reduce actividades intensas. Prepara todo lo necesario para recibir al bebé en casa.' },
  36: { bebe: 'Ya casi listo. Su cabeza puede bajar hacia la pelvis (encajamiento). Grasa corporal formada.', cuerpo: 'Contracciones de Braxton Hicks más frecuentes. Posible alivio al respirar.', sentidos: 'Completamente desarrollados. Reconoce canciones que escuchó durante el embarazo.', consejo: 'Visitas semanales al médico a partir de ahora. Vigila tu presión arterial cada día.' },
  37: { bebe: 'Se considera "a término temprano". Sus pulmones están maduros. Gana unos 30 g al día.', cuerpo: 'Pelvis muy presionada. Posible pérdida del tapón mucoso.', sentidos: 'Muy sensible a tu estado emocional. El estrés materno le afecta directamente.', consejo: 'Mantén la calma y el reposo. Tu maleta de maternidad debe estar lista.' },
  38: { bebe: 'Ya tiene toda la grasa de recién nacido. Su cerebro sigue madurando hasta el último día.', cuerpo: 'Posibles contracciones irregulares. Mucho peso en la pelvis.', sentidos: 'Puede reconocer su nombre si lo has repetido durante el embarazo.', consejo: 'Si las contracciones son regulares (cada 5 min durante 1 hora), ve a la clínica.' },
  39: { bebe: 'Pulmones completamente maduros. Reservas de grasa y energía listas para el nacimiento.', cuerpo: 'El cuello uterino comienza a madurar (borramiento). Mucho cansancio.', sentidos: 'Todos los sentidos completamente desarrollados. Listo para la vida fuera del útero.', consejo: 'Ante rotura de membranas o contracciones regulares, ve a urgencias de inmediato.' },
  40: { bebe: '¡Tu bebé está completamente listo para nacer! Pesa alrededor de 3.4 kg.', cuerpo: 'Estás en la semana del parto. Cualquier síntoma, ve a tu cita médica.', sentidos: 'Todos los sentidos activos y perfectamente preparados para explorar el mundo.', consejo: 'Si no hay señales de parto espontáneo, consulta a tu médico sobre seguimiento o inducción.' }
};

const trimData = {
  1: {
    bebe_aspecto: 'Pasa de embrión a feto. Su corazón late desde la semana 5, se forman todos los órganos principales y para la semana 12 ya tiene dedos, nariz y puede cerrar el puño. Su tamaño pasa de una semilla a un limón.',
    bebe_movimiento: 'Ya se mueve dentro del útero desde la semana 8, pero es tan pequeño que aún no lo puedes sentir. ¡Sus primeras acrobacias suceden en silencio!',
    cuerpo_sintomas: ['Náuseas y vómitos (especialmente por la mañana)', 'Senos sensibles y voluminosos', 'Fatiga intensa — el cuerpo trabaja mucho por dentro', 'Aumento de la frecuencia urinaria', 'Mayor sensibilidad al olfato y al sabor', 'Leve sangrado de implantación posible en la semana 4-5'],
    cuerpo_cambios: 'El útero pasa del tamaño de una pera al de un pomelo. Tu peso puede variar poco o incluso bajar si tienes náuseas intensas. El volumen de sangre comienza a aumentar.',
  },
  2: {
    bebe_aspecto: 'El bebé crece rápidamente. Su piel es traslúcida y rosada, desarrolla cejas, pestañas y lanugo (vello fino). Sus ojos se mueven aunque los párpados permanecen cerrados hasta la semana 26. Ya tiene expresiones faciales.',
    bebe_movimiento: 'Sentirás los primeros movimientos entre las semanas 16 y 20 — como mariposas o pequeñas burbujas. Con el tiempo las patadas serán cada vez más fuertes y definidas.',
    cuerpo_sintomas: ['Barriga visible y en crecimiento progresivo', 'Posibles estrías en abdomen, senos y caderas', 'Dolor de ligamentos redondos (costados del abdomen al girarte)', 'Acidez gástrica por el crecimiento del útero', 'Congestión nasal por aumento del flujo sanguíneo', 'Mayor energía en comparación con el primer trimestre'],
    cuerpo_cambios: 'El útero sale de la pelvis y sube hacia el abdomen. Tu peso debería aumentar entre 0.3 y 0.5 kg por semana. El centro de gravedad cambia — ten cuidado con el equilibrio.',
  },
  3: {
    bebe_aspecto: 'El bebé acumula grasa corporal, sus pulmones maduran semana a semana y sus rasgos se definen por completo. Sus ojos están abiertos, puede soñar (actividad REM), reconoce voces y reacciona a la luz.',
    bebe_movimiento: 'Los movimientos son muy activos y deben registrarse. Debes sentir al menos 10 movimientos en 2 horas cada día. Si los notas disminuidos o ausentes, consulta de inmediato — es una señal de alarma.',
    cuerpo_sintomas: ['Contracciones de Braxton Hicks (práctica, irregulares)', 'Dificultad para respirar profundo por presión del útero', 'Acidez e indigestión intensa', 'Hinchazón de pies, tobillos y manos', 'Dolor de espalda baja y pelvis', 'Dificultad para dormir y encontrar posición cómoda', 'Calambres nocturnos en las piernas'],
    cuerpo_cambios: 'El útero llega casi hasta las costillas. Tu peso total habrá aumentado entre 9 y 12 kg respecto al inicio. Las visitas prenatales son ahora semanales o cada 2 semanas.',
  }
};

function getWeekContent(weeks) {
  const keys = Object.keys(weekDevelopment).map(Number).sort((a, b) => Math.abs(a - weeks) - Math.abs(b - weeks));
  return weekDevelopment[keys[0]] || weekDevelopment[40];
}

function getBabySizeInfo(weeks) {
  if (babySizeData[weeks]) return babySizeData[weeks];
  const keys = Object.keys(babySizeData).map(Number).sort((a, b) => Math.abs(a - weeks) - Math.abs(b - weeks));
  return babySizeData[keys[0]];
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show toast-' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== CÁLCULO GESTACIONAL =====
function calcGestacion(offsetWeeks) {
  const fum = new Date(ultimaMens);
  const diffMs = TODAY - fum + offsetWeeks * 7 * 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.min(280, Math.max(0, days));
}

function renderWeek() {
  const totalDays = calcGestacion(0);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const remaining = Math.max(0, 280 - totalDays);
  const fum = new Date(ultimaMens);
  const progress = Math.min(100, Math.round((totalDays / 280) * 100));

  document.getElementById('weekLabel').textContent = `${weeks} sem ${days}d`;
  document.getElementById('daysLeft').textContent = `${remaining} días`;
  document.getElementById('progressFill').style.width = progress + '%';

  const weekStart = new Date(fum.getTime() + (weeks * 7) * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = d => d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
  document.getElementById('weekRange').textContent = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

  const daysEl = document.getElementById('cardDaysLeft');
  const fillEl = document.getElementById('cardMiniFill');
  const fruitEl = document.getElementById('cardFruitEmoji');
  if (daysEl) daysEl.textContent = `faltan ${remaining} días`;
  if (fillEl) fillEl.style.width = progress + '%';
  if (fruitEl) fruitEl.textContent = getBabySizeInfo(weeks).emoji;

  updateBabySize(weeks);
}

function updateBabySize(weeks) {
  const info = getBabySizeInfo(weeks);
  const el = document.getElementById('babySize');
  if (el) el.textContent = info.name;
}

// ===== MODALS =====
function openModal(type) {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));

  const map = {
    destacado: 'modalDestacado', tamano: 'modalTamano', bebe: 'modalBebe',
    cuerpo: 'modalCuerpo', perfil: 'modalPerfil', recordatorios: 'modalRecordatorios',
    vitales: 'modalVitales', presion: 'modalVitales', ritmo: 'modalVitales',
    respiracion: 'modalVitales', sintomas: 'modalVitales',
    chat: 'modalChat', evolucion: 'modalEvolucion'
  };

  const el = document.getElementById(map[type]);
  if (el) el.classList.add('show');
  document.getElementById('modalOverlay').classList.add('show');

  if (type === 'evolucion') loadEvolucion();
  if (type === 'tamano') updateBabyModal();
  if (type === 'bebe') updateBebeModal();
  if (type === 'cuerpo') updateCuerpoModal();
  if (type === 'destacado') updateDestacadoModal();
  if (type === 'perfil') loadProfile();
  if (type === 'recordatorios') loadRecordatorios();
  if (type === 'chat') { renderChatMessages(); setTimeout(() => document.getElementById('chatInput')?.focus(), 350); }

  if (type === 'presion') setTimeout(() => document.getElementById('presionSist')?.focus(), 300);
  if (type === 'ritmo') setTimeout(() => document.getElementById('frecuenciaCard')?.focus(), 300);
  if (type === 'respiracion') setTimeout(() => document.getElementById('frecuenciaResp')?.focus(), 300);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

document.getElementById('modalOverlay')?.addEventListener('click', closeModal);

function updateBabyModal() {
  const weeks = Math.floor(calcGestacion(0) / 7);
  const info = getBabySizeInfo(weeks);
  const content = getWeekContent(weeks);
  const trimester = weeks < 13 ? '1er Trimestre' : weeks < 27 ? '2do Trimestre' : '3er Trimestre';

  document.querySelector('#modalTamano .modal-content').innerHTML = `
    <div class="size-display">
      <div class="size-emoji">${info.emoji}</div>
      <h3 class="size-name">${info.name}</h3>
      <p class="size-week-label">Semana ${weeks} · ${trimester}</p>
      <div class="size-stats">
        <div class="size-stat">
          <span class="size-stat-val">${info.desc}</span>
          <span class="size-stat-lbl">Longitud</span>
        </div>
        <div class="size-stat-divider"></div>
        <div class="size-stat">
          <span class="size-stat-val">${info.weight}</span>
          <span class="size-stat-lbl">Peso aprox.</span>
        </div>
      </div>
    </div>
    <div class="info-card">
      <h3>👶 Desarrollo esta semana</h3>
      <p>${content.bebe}</p>
    </div>
    <div class="info-card">
      <h3>🌸 Tu cuerpo esta semana</h3>
      <p>${content.cuerpo}</p>
    </div>
    <div class="info-card info-card-purple">
      <h3>🧠 Sentidos del bebé</h3>
      <p>${content.sentidos}</p>
    </div>
    <div class="info-card info-card-green">
      <h3>💡 Consejo de la semana</h3>
      <p>${content.consejo}</p>
    </div>
  `;
}

function updateBebeModal() {
  const weeks = Math.floor(calcGestacion(0) / 7);
  const info = getBabySizeInfo(weeks);
  const content = getWeekContent(weeks);
  const trimNum = weeks < 13 ? 1 : weeks < 27 ? 2 : 3;
  const trim = trimData[trimNum];
  const trimLabel = trimNum === 1 ? '1er Trimestre' : trimNum === 2 ? '2do Trimestre' : '3er Trimestre';
  const trimColor = trimNum === 1 ? '#E85476' : trimNum === 2 ? '#7B68EE' : '#2E7D9A';

  document.querySelector('#modalBebe .modal-content').innerHTML = `
    <div class="bebe-header-row">
      <span class="bebe-emoji-lg">${info.emoji}</span>
      <div>
        <p class="bebe-semana">Semana ${weeks} de 40</p>
        <span class="bebe-trim-badge" style="background:${trimColor}20;color:${trimColor}">${trimLabel}</span>
      </div>
    </div>
    <div class="info-card">
      <h3>🔬 Desarrollo esta semana</h3>
      <p>${content.bebe}</p>
    </div>
    <div class="info-card">
      <h3>👁️ Aspecto físico en este trimestre</h3>
      <p>${trim.bebe_aspecto}</p>
    </div>
    <div class="info-card info-card-purple">
      <h3>🤸 Movimientos del bebé</h3>
      <p>${trim.bebe_movimiento}</p>
    </div>
  `;
}

function updateCuerpoModal() {
  const weeks = Math.floor(calcGestacion(0) / 7);
  const content = getWeekContent(weeks);
  const trimNum = weeks < 13 ? 1 : weeks < 27 ? 2 : 3;
  const trim = trimData[trimNum];

  const sintomasList = trim.cuerpo_sintomas.map(s => `<li>${s}</li>`).join('');

  document.querySelector('#modalCuerpo .modal-content').innerHTML = `
    <div class="info-card">
      <h3>🌸 Tu cuerpo esta semana (Sem. ${weeks})</h3>
      <p>${content.cuerpo}</p>
    </div>
    <div class="info-card">
      <h3>📋 Síntomas frecuentes en este trimestre</h3>
      <ul class="food-list">${sintomasList}</ul>
    </div>
    <div class="info-card">
      <h3>⚖️ Cambios físicos del trimestre</h3>
      <p>${trim.cuerpo_cambios}</p>
    </div>
    <div class="info-card info-card-red">
      <h3>🚨 Signos de alarma — Ve a urgencias YA</h3>
      <ul class="food-list">
        <li><strong>Dolor de cabeza</strong> intenso que no mejora con acetaminofén</li>
        <li><strong>Visión borrosa</strong>, manchas o destellos de luz</li>
        <li><strong>Presión arterial ≥ 160/110 mmHg</strong> medida en casa</li>
        <li><strong>Dolor en la boca del estómago</strong> o bajo las costillas derechas</li>
        <li><strong>Hinchazón súbita</strong> de cara, manos o pies</li>
        <li><strong>Convulsiones</strong> o pérdida de conciencia — llama al 123</li>
        <li><strong>Sangrado vaginal</strong> en cualquier cantidad</li>
        <li><strong>Disminución o ausencia</strong> de movimientos del bebé</li>
        <li><strong>Dificultad para respirar</strong> o sensación de ahogo</li>
        <li><strong>Orina espumosa</strong> o disminución marcada de la orina</li>
      </ul>
    </div>
    <div class="info-card">
      <h3>🩺 Rangos de presión arterial</h3>
      <div class="pa-rangos">
        <div class="pa-rango pa-ok">
          <span class="pa-dot"></span>
          <div><strong>Normal</strong><p>&lt; 120/80 mmHg</p></div>
        </div>
        <div class="pa-rango pa-warn">
          <span class="pa-dot"></span>
          <div><strong>Atención (leve)</strong><p>140/90 – 159/109 mmHg</p></div>
        </div>
        <div class="pa-rango pa-danger">
          <span class="pa-dot"></span>
          <div><strong>Urgencia (severa)</strong><p>≥ 160/110 mmHg — ve a urgencias</p></div>
        </div>
      </div>
    </div>
  `;
}

function updateDestacadoModal() {
  const weeks = Math.floor(calcGestacion(0) / 7);
  const info = getBabySizeInfo(weeks);
  const content = getWeekContent(weeks);

  document.querySelector('#modalDestacado .modal-content').innerHTML = `
    <div class="info-card">
      <h3>${info.emoji} Semana ${weeks} de tu embarazo</h3>
      <p>${content.bebe}</p>
    </div>
    <div class="info-card">
      <h3>Tu cuerpo</h3>
      <p>${content.cuerpo}</p>
    </div>
    <div class="info-card">
      <h3>Recomendaciones HIE</h3>
      <ul>
        <li>Toma tu presión arterial todos los días</li>
        <li>Reporta síntomas de alarma de inmediato</li>
        <li>Asiste a todos tus controles prenatales</li>
        <li>Mantén hidratación y reposo adecuados</li>
      </ul>
    </div>
    <div class="info-card info-card-green">
      <h3>✅ Alimentos recomendados (Dieta DASH)</h3>
      <p class="food-subtitle">Reducen el riesgo de preeclampsia hasta un 35–45% y ayudan a controlar la presión arterial.</p>
      <ul class="food-list">
        <li><strong>🥦 Verduras y frutas</strong> — 5 a 8 porciones/día</li>
        <li><strong>🌾 Cereales integrales</strong> — arroz integral, avena, pan integral</li>
        <li><strong>🥛 Lácteos bajos en grasa</strong> — leche descremada, yogur</li>
        <li><strong>🍗 Proteínas magras</strong> — pollo sin piel, pescado, lentejas</li>
        <li><strong>💧 Agua</strong> — mínimo 8 vasos al día (2 litros)</li>
      </ul>
    </div>
    <div class="info-card info-card-red">
      <h3>🚫 Alimentos que debes evitar</h3>
      <ul class="food-list">
        <li><strong>Sal</strong> — máximo 2 g de sodio al día</li>
        <li><strong>Embutidos</strong> — salchicha, chorizo, jamón</li>
        <li><strong>Enlatados y sopas instantáneas</strong></li>
        <li><strong>Bebidas azucaradas y Cafeína en exceso</strong></li>
        <li><strong>Alcohol</strong> — prohibido durante todo el embarazo</li>
      </ul>
    </div>
  `;
}

// ===== VALIDACIÓN EN VIVO =====
function presionLevel(sist, dias) {
  if (sist >= 140 || dias >= 100) return 'danger';
  if (sist >= 130 || dias >= 90) return 'warning';
  if (sist > 0 && dias > 0) return 'ok';
  return 'none';
}

function frecCardLevel(val) {
  if (val > 120 || val < 40) return 'danger';
  if (val > 100 || val < 55) return 'warning';
  if (val > 0) return 'ok';
  return 'none';
}

function frecRespLevel(val) {
  if (val > 24 || val < 8) return 'danger';
  if (val > 20 || val < 12) return 'warning';
  if (val > 0) return 'ok';
  return 'none';
}

function applyInputColor(id, level) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('input-ok', 'input-warning', 'input-danger');
  if (level !== 'none') el.classList.add('input-' + level);
}

function updateLiveStatus() {
  const sist = parseInt(document.getElementById('presionSist').value) || 0;
  const dias = parseInt(document.getElementById('presionDias').value) || 0;
  const fc = parseInt(document.getElementById('frecuenciaCard').value) || 0;
  const fr = parseInt(document.getElementById('frecuenciaResp').value) || 0;
  const cefalea = document.getElementById('cb-cefalea')?.checked;
  const vision = document.getElementById('cb-vision')?.checked;
  const conv = document.getElementById('cb-convulsiones')?.checked;

  const pLevel = presionLevel(sist, dias);
  applyInputColor('presionSist', pLevel);
  applyInputColor('presionDias', pLevel);
  applyInputColor('frecuenciaCard', frecCardLevel(fc));
  applyInputColor('frecuenciaResp', frecRespLevel(fr));

  const statusDiv = document.getElementById('vitalStatusLive');
  if (!statusDiv) return;

  const hasData = sist > 0 || dias > 0 || fc > 0 || fr > 0 || cefalea || vision || conv;
  if (!hasData) { statusDiv.style.display = 'none'; return; }

  statusDiv.style.display = 'block';

  let html = '';
  if ((cefalea && vision) || conv) {
    const txt = conv ? '🚨 CONVULSIONES — Llama al 123 de inmediato' : '🚨 ALERTA ROJA: Cefalea + Visión borrosa requieren atención inmediata';
    html = `<div class="live-status live-danger">${txt}</div>`;
  } else if (pLevel === 'danger' || fc > 120 || fr > 24) {
    const pa = sist > 0 ? ` (${sist}/${dias} mmHg)` : '';
    html = `<div class="live-status live-danger">⚠️ Valores de alarma${pa} — Contacta a tu enfermera</div>`;
  } else if (pLevel === 'warning' || fc > 100 || fr > 20 || cefalea || vision) {
    html = `<div class="live-status live-warning">⚡ Valores en vigilancia — Continúa monitoreando</div>`;
  } else if (pLevel === 'ok' && fc > 0 && fr > 0) {
    html = `<div class="live-status live-ok">✓ Todos los valores normales — ¡Muy bien!</div>`;
  } else if (pLevel === 'ok') {
    html = `<div class="live-status live-ok">✓ Presión normal</div>`;
  }

  statusDiv.innerHTML = html;
}

function setupLiveValidation() {
  ['presionSist', 'presionDias', 'frecuenciaCard', 'frecuenciaResp'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateLiveStatus);
  });
  ['cb-cefalea', 'cb-vision', 'cb-epigastral', 'cb-edema', 'cb-convulsiones'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateLiveStatus);
  });
}

// ===== TARJETAS DE SIGNOS VITALES =====
function updateVitalCards() {
  if (vitalsData.length === 0) return;
  const last = vitalsData[vitalsData.length - 1];
  const [sist, dias] = last.presion.split('/').map(Number);
  const fc = parseInt(last.frecuenciaCard);
  const fr = parseInt(last.frecuenciaResp);

  const setCard = (id, value, level) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.className = 'vital-input ' + (level !== 'none' ? 'input-' + level : '');
  };

  setCard('displayPresion', last.presion + ' mmHg', presionLevel(sist, dias));
  setCard('displayRitmo', fc + ' ppm', frecCardLevel(fc));
  setCard('displayResp', fr + ' resp/min', frecRespLevel(fr));

  if (last.sintomas) {
    const names = { cefalea: 'Cefalea', vision: 'Visión', epigastral: 'Epigastralgia', edema: 'Edema', convulsiones: 'Convuls.' };
    const active = Object.entries(last.sintomas).filter(([, v]) => v).map(([k]) => names[k] || k);
    setCard('displaySintomas', active.length > 0 ? active.join(', ') : 'Sin síntomas', active.length > 0 ? 'warning' : 'ok');
  }

  const cards = document.querySelectorAll('.vital-card');
  if (cards[0]) {
    cards[0].classList.remove('vital-card-ok', 'vital-card-warning', 'vital-card-danger');
    const lv = presionLevel(sist, dias);
    if (lv !== 'none') cards[0].classList.add('vital-card-' + lv);
  }
}

// ===== GUARDAR SIGNOS VITALES A FIREBASE =====
function saveVitals() {
  if (currentPatientId === 'default') {
    showToast('Error: No has iniciado sesión correctamente', 'error');
    return;
  }

  const ps = document.getElementById('presionSist').value.trim();
  const pd = document.getElementById('presionDias').value.trim();
  const fc = document.getElementById('frecuenciaCard').value.trim();
  const fr = document.getElementById('frecuenciaResp').value.trim();

  if (!ps || !pd || !fc || !fr) {
    showToast('Por favor completa todos los campos de signos vitales', 'error');
    return;
  }

  const sist = parseInt(ps), dias = parseInt(pd), fcVal = parseInt(fc), frVal = parseInt(fr);

  if (sist < 50 || sist > 250 || dias < 30 || dias > 150) {
    showToast('Verifica los valores de presión arterial ingresados', 'error');
    return;
  }

  const sintomas = {
    cefalea: document.getElementById('cb-cefalea')?.checked || false,
    vision: document.getElementById('cb-vision')?.checked || false,
    epigastral: document.getElementById('cb-epigastral')?.checked || false,
    edema: document.getElementById('cb-edema')?.checked || false,
    convulsiones: document.getElementById('cb-convulsiones')?.checked || false
  };

  const nuevoRegistro = {
    fecha: new Date().toLocaleDateString('es-CO'),
    hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    presion: `${sist}/${dias}`,
    frecuenciaCard: fcVal,
    frecuenciaResp: frVal,
    sintomas,
    timestamp: Date.now()
  };

  // ENVIAR A LA NUBE
  db.collection("pacientes").doc(currentPatientId).set({
    vitals: firebase.firestore.FieldValue.arrayUnion(nuevoRegistro)
  }, { merge: true });

  checkAlerts(sist, dias, sintomas);

  ['presionSist', 'presionDias', 'frecuenciaCard', 'frecuenciaResp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('input-ok', 'input-warning', 'input-danger'); }
  });
  ['cb-cefalea', 'cb-vision', 'cb-epigastral', 'cb-edema', 'cb-convulsiones'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  closeModal();

  if (sintomas.convulsiones) {
    showToast('🚨 EMERGENCIA: Convulsiones — Llama al 123 AHORA', 'error');
  } else if (sintomas.cefalea && sintomas.vision) {
    showToast('🚨 ALERTA: Cefalea + Visión borrosa — Contacta tu enfermera', 'error');
  } else if (sist >= 140 || dias >= 100) {
    showToast('⚠️ Registro guardado — Presión en zona de alarma', 'error');
  } else {
    showToast('✓ Registro guardado exitosamente', 'success');
  }
}

// ===== DETECCIÓN DE TENDENCIA =====
function detectTrend() {
  if (vitalsData.length < 3) return null;
  const last3 = vitalsData.slice(-3);
  const sists = last3.map(v => parseInt(v.presion.split('/')[0]));
  const diass = last3.map(v => parseInt(v.presion.split('/')[1]));
  const sistOk = sists[0] < sists[1] && sists[1] < sists[2] && sists[2] >= 120;
  const diasOk = diass[0] < diass[1] && diass[1] < diass[2] && diass[2] >= 80;
  return (sistOk || diasOk) ? { sists, diass } : null;
}

// ===== EVALUAR Y MOSTRAR ALERTAS =====
function checkAlerts(sist, dias, sintomas = {}) {
  const container = document.querySelector('.alerts-container');
  if (!container) return;

  const trend = detectTrend();
  let level = 'green', title = '✓ Sin novedad', msg = 'Tus registros están dentro de los parámetros normales.', actions = '';

  if (sintomas.convulsiones) {
    level = 'red';
    title = '🚨 EMERGENCIA — Llama al 123 ahora';
    msg = 'Las convulsiones son una emergencia médica grave. No esperes.';
    actions = `<div class="alert-actions"><button class="alert-btn-call" onclick="showToast('📞 Marcando al 123…','error')">📞 Llamar al 123</button></div>`;
  } else if (sintomas.cefalea && sintomas.vision) {
    level = 'red';
    title = '🚨 ALERTA ROJA — Llama a tu enfermera AHORA';
    msg = 'Cefalea + Visión borrosa juntas son señal de peligro para HIE. No esperes.';
    actions = `<div class="alert-actions"><button class="alert-btn-call" onclick="showToast('📞 Notificando a tu enfermera…','success')">📞 Llamar enfermera</button></div>`;
  } else if (sist >= 140 || dias >= 100) {
    level = 'red';
    title = `⚠️ Presión alta — Atención inmediata`;
    msg = `Tu presión (${sist}/${dias} mmHg) está en zona de alarma. Contacta a tu enfermera en menos de 15 minutos.`;
    actions = `<div class="alert-actions"><button class="alert-btn-call" onclick="showToast('📞 Notificando a tu enfermera…','success')">📞 Llamar enfermera</button></div>`;
  } else if (sist >= 130 || dias >= 90 || sintomas.cefalea || sintomas.vision || sintomas.epigastral) {
    level = 'yellow';
    title = `⚡ En vigilancia`;
    msg = `Valores límite${sist > 0 ? ' (' + sist + '/' + dias + ' mmHg)' : ''}. Descansa y sigue midiendo. Comunica cualquier empeoramiento.`;
  } else if (sintomas.edema) {
    level = 'yellow';
    title = '⚡ Edema reportado — En vigilancia';
    msg = 'La hinchazón puede ser normal o una señal de alerta. Monitorea si empeora o se vuelve súbita.';
  }

  const colors = { green: 'var(--success-color)', yellow: 'var(--warning-color)', red: 'var(--danger-color)' };
  const pulse = level === 'red' ? 'class="alert-dot pulse"' : 'class="alert-dot"';

  let trendHTML = '';
  if (trend && level === 'green') {
    trendHTML = `
      <div class="alert-item alert-yellow" style="margin-top:10px">
        <span class="alert-dot"></span>
        <div>
          <h4>📈 Tendencia al alza detectada</h4>
          <p>Tu presión sistólica ha subido 3 registros seguidos: ${trend.sists.join(' → ')} mmHg. Cuéntale a tu enfermera.</p>
        </div>
      </div>`;
  }

  container.innerHTML = `
    <div class="alert-item alert-${level}" style="border-left-color:${colors[level]}">
      <span ${pulse}></span>
      <div style="flex:1">
        <h4>${title}</h4>
        <p>${msg}</p>
        ${actions}
      </div>
    </div>
    ${trendHTML}
  `;
}

// ===== CARRUSEL DE CONSEJOS =====
function renderCarousel() {
  const sec = document.getElementById('carouselHome');
  if (!sec) return;

  const tip = carouselTips[carouselIndex];
  const dots = carouselTips.map((_, i) => `<span class="carousel-dot ${i === carouselIndex ? 'active' : ''}" onclick="goToSlide(${i})"></span>`).join('');

  sec.innerHTML = `
    <div class="carousel-wrapper">
      <div class="carousel-card" style="border-top: 4px solid ${tip.color}">
        <div class="carousel-category" style="color:${tip.color}">
          <span class="carousel-icon">${tip.icon}</span>
          <span>${tip.categoria}</span>
        </div>
        <h2 class="carousel-title">${tip.titulo}</h2>
        <p class="carousel-text">${tip.texto}</p>
      </div>
      <div class="carousel-nav">
        <button class="carousel-arrow" onclick="prevSlide()">←</button>
        <div class="carousel-dots">${dots}</div>
        <button class="carousel-arrow" onclick="nextSlide()">→</button>
      </div>
      <p class="carousel-counter">${carouselIndex + 1} de ${carouselTips.length} consejos</p>
    </div>
  `;
  setupCarouselSwipe(sec.querySelector('.carousel-card'));
}

function nextSlide() { carouselIndex = (carouselIndex + 1) % carouselTips.length; renderCarousel(); }
function prevSlide() { carouselIndex = (carouselIndex - 1 + carouselTips.length) % carouselTips.length; renderCarousel(); }
function goToSlide(i) { carouselIndex = i; renderCarousel(); }

function setupCarouselSwipe(el) {
  if (!el) return;
  let startX = 0;
  el.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? nextSlide() : prevSlide();
  }, { passive: true });
}

// ===== CHAT CON ENFERMERA A FIREBASE =====
function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  container.innerHTML = chatMessages.map(m => {
    if (m.tipo === 'nurse') {
      return `
        <div class="chat-msg-row chat-msg-nurse">
          <div class="chat-bubble chat-bubble-nurse">
            <p>${m.texto}</p>
            <span class="chat-time">${m.hora}</span>
          </div>
        </div>`;
    } else {
      return `
        <div class="chat-msg-row chat-msg-user">
          <div class="chat-bubble chat-bubble-user">
            <p>${m.texto}</p>
            <span class="chat-time">${m.hora}</span>
          </div>
        </div>`;
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input?.value.trim();
  if (!text || currentPatientId === 'default') return;

  const hora = formatChatTime(new Date());
  const nuevoMensaje = { tipo: 'user', texto: text, hora, nurseRead: false };

  // ENVIAR MENSAJE A LA NUBE
  db.collection("pacientes").doc(currentPatientId).set({
    chat: firebase.firestore.FieldValue.arrayUnion(nuevoMensaje)
  }, { merge: true });

  input.value = '';
  document.getElementById('chatQuickReplies').style.display = 'none';
}

function sendQuickReply(text) {
  const input = document.getElementById('chatInput');
  if (input) input.value = text;
  sendChatMessage();
}

// ===== PESTAÑA REGISTROS =====
function renderRegistros() {
  const sec = document.getElementById('seccionRegistros');
  if (!sec) return;

  if (vitalsData.length === 0) {
    sec.innerHTML = `
      <div class="empty-registros">
        <div class="empty-icon">📋</div>
        <h3>Sin registros aún</h3>
        <p>Usa el botón <strong>+</strong> para registrar tus primeros signos vitales</p>
        <button class="btn-primary" onclick="openModal('vitales')" style="margin-top:16px;max-width:240px">
          + Agregar primer registro
        </button>
      </div>`;
    return;
  }

  const trend = detectTrend();
  const trendBanner = trend ? `<div class="trend-banner">📈 Tendencia al alza: ${trend.sists.join(' → ')} mmHg en los últimos 3 registros</div>` : '';

  const rows = [...vitalsData].reverse().map(v => {
    const [s, d] = v.presion.split('/').map(Number);
    const lv = presionLevel(s, d);
    const cfg = {
      ok: { color: 'var(--success-color)', label: 'Normal' },
      warning: { color: 'var(--warning-color)', label: 'Límite' },
      danger: { color: 'var(--danger-color)', label: '⚠ Alerta' },
      none: { color: 'var(--text-secondary)', label: '--' }
    }[lv] || { color: 'var(--text-secondary)', label: '--' };

    const sintNames = { cefalea: 'Cefalea', vision: 'Visión', epigastral: 'Epigastralgia', edema: 'Edema', convulsiones: 'Convulsiones' };
    const tags = v.sintomas
      ? Object.entries(v.sintomas).filter(([, val]) => val).map(([k]) => `<span class="sintoma-tag">${sintNames[k] || k}</span>`).join('')
      : '';

    return `
      <div class="registro-row">
        <div class="registro-fecha">
          <span class="registro-dia">${v.fecha}</span>
          <span class="registro-hora">${v.hora || ''}</span>
        </div>
        <div class="registro-vitales">
          <div class="registro-pa" style="color:${cfg.color}">
            <strong>${v.presion}</strong>
            <span class="registro-label" style="background:${cfg.color}20;color:${cfg.color}">${cfg.label}</span>
          </div>
          <div class="registro-fc">❤️ ${v.frecuenciaCard} ppm</div>
          <div class="registro-fr">🫁 ${v.frecuenciaResp}/min</div>
        </div>
        ${tags ? `<div class="registro-sintomas">${tags}</div>` : ''}
      </div>`;
  }).join('');

  sec.innerHTML = `
    <div class="registros-header">
      <h3 class="section-title" style="margin:0">Mis registros (${vitalsData.length})</h3>
      <button class="btn-small-danger" onclick="clearRegistros()">🗑 Limpiar</button>
    </div>
    ${trendBanner}
    <div class="registros-list">${rows}</div>
    <div style="height:20px"></div>
  `;
}

function clearRegistros() {
  if (!confirm('¿Eliminar todos los registros? Esta acción no se puede deshacer.')) return;
  db.collection("pacientes").doc(currentPatientId).update({
    vitals: []
  }).then(() => {
    showToast('Registros eliminados', 'success');
  });
}

// ===== MI EVOLUCIÓN =====
function loadEvolucion() {
  const container = document.getElementById('evolucionContent');
  if (!container) return;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7 = vitalsData.filter(v => v.timestamp && new Date(v.timestamp) >= sevenDaysAgo);
  const uniqueDays = new Set(last7.map(v => v.fecha)).size;
  const avgSist = last7.length > 0 ? Math.round(last7.reduce((sum, v) => sum + parseInt(v.presion.split('/')[0]), 0) / last7.length) : '--';
  const alertCount = last7.filter(v => {
    const [s, d] = v.presion.split('/').map(Number);
    const lv = presionLevel(s, d);
    return lv === 'warning' || lv === 'danger';
  }).length;

  const sintNames = { cefalea: 'Cefalea', vision: 'Visión borrosa', epigastral: 'Epigastralgia', edema: 'Edema', convulsiones: 'Convulsiones' };

  const rows = [...vitalsData].slice(-7).reverse().map(v => {
    const [s, d] = v.presion.split('/').map(Number);
    const lv = presionLevel(s, d);
    const cfg = {
      ok: { label: 'Normal', color: '#2E7D32', bg: '#E8F5E9' },
      warning: { label: 'Límite', color: '#E65100', bg: '#FFF3E0' },
      danger: { label: 'Alerta', color: '#C62828', bg: '#FFEBEE' },
      none: { label: '--', color: '#9E9E9E', bg: '#F5F5F5' }
    }[lv] || { label: '--', color: '#9E9E9E', bg: '#F5F5F5' };

    const sintList = v.sintomas ? Object.entries(v.sintomas).filter(([, val]) => val).map(([k]) => sintNames[k]).join(', ') : '';

    let dateLabel;
    if (v.timestamp) {
      const vDate = new Date(v.timestamp);
      const diff = Math.floor((now - vDate) / (1000 * 60 * 60 * 24));
      if (diff === 0) dateLabel = 'Hoy';
      else if (diff === 1) dateLabel = 'Ayer';
      else dateLabel = vDate.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
    } else {
      dateLabel = v.fecha || '--';
    }

    return `
      <div class="evol-row">
        <div class="evol-date">${dateLabel}</div>
        <div class="evol-vitals">
          <div class="evol-pa">${v.presion} mmHg</div>
          <div class="evol-sub">FC: ${v.frecuenciaCard}${sintList ? ' · ' + sintList : ' · Sin síntomas'}</div>
        </div>
        <span class="evol-badge" style="color:${cfg.color}; background:${cfg.bg}">${cfg.label}</span>
      </div>`;
  }).join('');

  const emptyMsg = vitalsData.length === 0 ? '<div class="empty-registros"><div class="empty-icon">📊</div><p>No hay registros aún.<br>Empieza registrando tus signos vitales.</p></div>' : '';

  container.innerHTML = `
    <p class="evol-section-title">RESUMEN DE LA SEMANA</p>
    <div class="evol-summary">
      <div class="evol-stat evol-stat-green">
        <div class="evol-stat-value">${uniqueDays}/7</div>
        <div class="evol-stat-label">Registros realizados</div>
      </div>
      <div class="evol-stat evol-stat-pink">
        <div class="evol-stat-value">${avgSist}</div>
        <div class="evol-stat-label">PA sistólica prom.</div>
      </div>
      <div class="evol-stat evol-stat-red">
        <div class="evol-stat-value">${alertCount}</div>
        <div class="evol-stat-label">Alertas generadas</div>
      </div>
    </div>
    <p class="evol-section-title" style="margin-top:20px">HISTORIAL DE REGISTROS</p>
    ${emptyMsg || `<div class="evol-list">${rows}</div>`}
    <button class="evol-trends-btn" onclick="closeModal(); switchTab('registros')">Entender mis tendencias ↗</button>
  `;
}

// ===== SECCIÓN APRENDER =====
function renderAprender() {
  const sec = document.getElementById('seccionAprender');
  if (!sec) return;

  const totalModules = modulosData.length;
  const completedCount = completedModules.length;
  const progressPct = Math.round((completedCount / totalModules) * 100);

  const modulesHTML = modulosData.map(m => {
    const isDone = completedModules.includes(m.id);
    let iconHTML, statusText, fillClass, fillWidth, rowClass;

    if (isDone) {
      iconHTML = `<div class="modulo-icon modulo-icon-done"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>`;
      statusText = `Completado · ${m.duracion}`;
      fillClass = 'modulo-fill-done';
      fillWidth = '100%';
      rowClass = 'modulo-completado';
    } else {
      iconHTML = `<div class="modulo-icon modulo-icon-active"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h10z"/></svg></div>`;
      statusText = `Disponible · ${m.duracion}`;
      fillClass = 'modulo-fill-active';
      fillWidth = '35%';
      rowClass = 'modulo-disponible';
    }

    return `
      <div class="modulo-item ${rowClass}" onclick="openLesson(${m.id})">
        ${iconHTML}
        <div class="modulo-info">
          <p class="modulo-titulo">${m.titulo}</p>
          <p class="modulo-status">${statusText}</p>
          <div class="modulo-progress-bar"><div class="modulo-progress-fill ${fillClass}" style="width:${fillWidth}"></div></div>
        </div>
      </div>`;
  }).join('');

  const logros = getLogros();
  const unlockedCount = logros.filter(l => l.unlocked).length;

  const certBanner = completedCount === totalModules && totalModules > 0 ? `
    <div class="cert-banner">
      <div class="cert-banner-icon">🎓</div>
      <div class="cert-banner-text">
        <strong>¡Felicitaciones! Curso completado</strong>
        <p>Descarga tu certificado de finalización</p>
      </div>
      <button class="cert-btn" onclick="generarCertificado()">⬇ Descargar</button>
    </div>` : '';

  const logrosHTML = logros.map(l => `
    <div class="logro-item ${l.unlocked ? 'logro-unlocked' : 'logro-locked'}" onclick="${l.unlocked ? `showToast('${l.nombre}: ${l.desc}', 'success')` : `showToast('Sigue adelante para desbloquear: ${l.nombre}', 'info')`}">
      <div class="logro-emoji">${l.emoji}</div>
      <p class="logro-nombre">${l.nombre}</p>
      ${l.unlocked ? '<div class="logro-check">✓</div>' : '<div class="logro-lock">🔒</div>'}
    </div>`).join('');

  sec.innerHTML = `
    ${certBanner}
    <h3 class="section-title" style="letter-spacing:0.5px">TU PROGRESO EDUCATIVO</h3>
    <div class="aprender-progress-card">
      <div class="aprender-progress-header">
        <span>Módulos completados</span>
        <span class="aprender-progress-count">${completedCount} de ${totalModules}</span>
      </div>
      <div class="aprender-progress-bar">
        <div class="aprender-progress-fill" style="width:${progressPct}%"></div>
      </div>
      <p class="aprender-progress-sub">${progressPct === 100 ? '🎓 ¡Curso completado!' : progressPct === 0 ? 'Comienza tu primer módulo' : `${100 - progressPct}% restante — ¡tú puedes!`}</p>
    </div>
    <h3 class="section-title" style="letter-spacing:0.5px;margin-top:20px">MIS LOGROS
      <span class="logros-count-badge">${unlockedCount}/${logros.length}</span>
    </h3>
    <div class="logros-grid">${logrosHTML}</div>
    <h3 class="section-title" style="letter-spacing:0.5px;margin-top:20px">MÓDULOS</h3>
    <div class="modulos-list">${modulesHTML}</div>
    <div style="height:20px"></div>
  `;
}

function openLesson(id) {
  currentLessonId = id;
  const m = modulosData.find(mod => mod.id === id);
  if (!m) return;

  const isDone = completedModules.includes(id);

  const contentHTML = m.contenido.map(b => {
    if (b.tipo === 'intro') return `<div class="leccion-intro"><p>${b.texto}</p></div>`;
    if (b.tipo === 'puntos') return `<div class="info-card"><h3>${b.titulo}</h3><ul>${b.items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    if (b.tipo === 'alerta') return `<div class="leccion-alerta"><p>⚠️ ${b.texto}</p></div>`;
    return '';
  }).join('');

  document.getElementById('leccionTitle').textContent = m.titulo;
  document.getElementById('leccionContent').innerHTML = contentHTML;

  const btn = document.getElementById('leccionCompleteBtn');
  if (btn) {
    btn.textContent = isDone ? '✓ Ya completado' : '✓ Marcar como completado';
    btn.disabled = isDone;
    btn.style.opacity = isDone ? '0.5' : '1';
  }

  document.querySelectorAll('.modal').forEach(el => el.classList.remove('show'));
  document.getElementById('modalLeccion').classList.add('show');
  document.getElementById('modalOverlay').classList.add('show');
}

function completeCurrentLesson() {
  if (!currentLessonId || currentPatientId === 'default') return;
  if (!completedModules.includes(currentLessonId)) {
    db.collection("pacientes").doc(currentPatientId).set({
      modulos: firebase.firestore.FieldValue.arrayUnion(currentLessonId)
    }, { merge: true });
    showToast('¡Módulo completado! 🎓', 'success');
  }
  closeModal();
}

// ===== CERTIFICADO =====
function generarCertificado() {
  const nombre = localStorage.getItem('nombreMadre') || 'Gestante';
  const totalMods = modulosData.length;
  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const W = 1200, H = 860;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#FDF0F5'); bg.addColorStop(0.5, '#FFFFFF'); bg.addColorStop(1, '#FCE4EC');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.07; ctx.fillStyle = '#C2185B';
  [[90, 90, 130], [W - 90, 90, 90], [90, H - 90, 90], [W - 90, H - 90, 130], [W / 2, H / 2, 200]].forEach(([x, y, r]) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#C2185B'; ctx.lineWidth = 10;
  certRoundRect(ctx, 24, 24, W - 48, H - 48, 22); ctx.stroke();
  ctx.strokeStyle = '#F48FB1'; ctx.lineWidth = 2;
  certRoundRect(ctx, 40, 40, W - 80, H - 80, 16); ctx.stroke();

  const ban = ctx.createLinearGradient(0, 50, 0, 170);
  ban.addColorStop(0, '#C2185B'); ban.addColorStop(1, '#880E4F');
  ctx.fillStyle = ban; ctx.beginPath();
  ctx.moveTo(62, 50); ctx.lineTo(W - 62, 50); ctx.quadraticCurveTo(W - 40, 50, W - 40, 72);
  ctx.lineTo(W - 40, 170); ctx.lineTo(40, 170); ctx.lineTo(40, 72);
  ctx.quadraticCurveTo(40, 50, 62, 50); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 44px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('🌙 SIA Zulia', W / 2, 108);
  ctx.font = '19px Arial, sans-serif'; ctx.fillStyle = '#F8BBD9';
  ctx.fillText('Programa de Educación Prenatal en Salud Materna', W / 2, 145);

  ctx.fillStyle = '#880E4F'; ctx.font = 'bold 54px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('Certificado de Finalización', W / 2, 255);

  ctx.strokeStyle = '#C2185B'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - 270, 275); ctx.lineTo(W / 2 + 270, 275); ctx.stroke();
  [W / 2 - 270, W / 2, W / 2 + 270].forEach(x => certDiamond(ctx, x, 275, x === W / 2 ? 6 : 9, '#C2185B'));

  ctx.fillStyle = '#7A7A9D'; ctx.font = '23px Arial, sans-serif';
  ctx.fillText('Este certificado acredita que', W / 2, 335);

  ctx.fillStyle = '#C2185B'; ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(nombre, W / 2, 425);

  const nw = ctx.measureText(nombre).width;
  ctx.strokeStyle = '#F48FB1'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - nw / 2 - 20, 442); ctx.lineTo(W / 2 + nw / 2 + 20, 442); ctx.stroke();

  ctx.fillStyle = '#1A1A2E'; ctx.font = '22px Arial, sans-serif';
  ctx.fillText('ha completado satisfactoriamente el curso educativo prenatal:', W / 2, 492);
  ctx.fillStyle = '#880E4F'; ctx.font = 'bold 27px Georgia, serif';
  ctx.fillText('"Cuidado y Bienestar en el Embarazo con HIE"', W / 2, 535);
  ctx.fillStyle = '#7A7A9D'; ctx.font = '20px Arial, sans-serif';
  ctx.fillText(`${totalMods} módulos completados · ${totalMods * 5} minutos de formación prenatal`, W / 2, 572);

  ctx.strokeStyle = '#F0D9E8'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 625); ctx.lineTo(W - 80, 625); ctx.stroke();

  ctx.strokeStyle = '#C2185B'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(155, 660); ctx.lineTo(395, 660); ctx.stroke();
  ctx.fillStyle = '#1A1A2E'; ctx.font = 'bold 19px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('Enf. Zuleiny Sierra', 275, 685);
  ctx.fillStyle = '#7A7A9D'; ctx.font = '15px Arial, sans-serif';
  ctx.fillText('Enfermera Responsable', 275, 705);

  ctx.fillStyle = '#C2185B'; ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText('FECHA DE EXPEDICIÓN', W / 2, 657);
  ctx.fillStyle = '#1A1A2E'; ctx.font = '19px Georgia, serif';
  ctx.fillText(fecha, W / 2, 682);

  ctx.strokeStyle = '#C2185B'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W - 395, 660); ctx.lineTo(W - 155, 660); ctx.stroke();
  ctx.fillStyle = '#1A1A2E'; ctx.font = 'bold 19px Georgia, serif';
  ctx.fillText('SIA Zulia', W - 275, 685);
  ctx.fillStyle = '#7A7A9D'; ctx.font = '15px Arial, sans-serif';
  ctx.fillText('Plataforma de Salud Materna', W - 275, 705);

  ctx.fillStyle = '#F48FB1'; ctx.font = '14px Arial, sans-serif';
  ctx.fillText('Generado por SIA Zulia · Acompañamiento prenatal integral', W / 2, 760);

  const link = document.createElement('a');
  link.download = `Certificado_SIA Zulia_${nombre.replace(/ /g, '_')}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
  showToast('¡Certificado descargado! 🎓', 'success');
}

function certRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function certDiamond(ctx, x, y, s, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
  ctx.closePath(); ctx.fill();
}

// ===== NAVEGACIÓN Y PERFIL A FIREBASE =====
function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  event?.target?.closest?.('.nav-item')?.classList.add('active');

  const hoy = document.getElementById('seccionHoy');
  const registros = document.getElementById('seccionRegistros');
  const aprender = document.getElementById('seccionAprender');
  const progress = document.querySelector('.progress-section');

  if (hoy) hoy.style.display = 'none';
  if (registros) registros.style.display = 'none';
  if (aprender) aprender.style.display = 'none';
  if (progress) progress.style.display = 'none';

  if (tab === 'registros') {
    if (registros) { registros.style.display = 'block'; renderRegistros(); }
  } else if (tab === 'aprender') {
    if (aprender) { aprender.style.display = 'block'; renderAprender(); }
  } else if (tab === 'perfil') {
    if (hoy) hoy.style.display = 'block';
    if (progress) progress.style.display = 'block';
    openModal('perfil');
  } else {
    if (hoy) hoy.style.display = 'block';
    if (progress) progress.style.display = 'block';
  }
}

function loadProfile() {
  const container = document.querySelector('#modalPerfil .modal-content');
  if (!container) return;

  const nombre = localStorage.getItem('nombreMadre') || 'Gestante';
  const bebe = localStorage.getItem('nombreBebe') || '--';
  const eps = localStorage.getItem('regEPS') || '--';
  const telefono = localStorage.getItem('regTel') || '--';

  const totalDays = calcGestacion(0);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const fum = new Date(ultimaMens);
  const fumStr = fum.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const initials = nombre.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);

  let vitalsHTML = '<p style="color:var(--text-secondary);text-align:center;padding:16px">No hay registros aún</p>';
  if (vitalsData.length > 0) {
    vitalsHTML = [...vitalsData].slice(-5).reverse().map(v => {
      const [s, d] = v.presion.split('/').map(Number);
      const lv = presionLevel(s, d);
      const color = { ok: 'var(--success-color)', warning: 'var(--warning-color)', danger: 'var(--danger-color)', none: 'var(--primary-color)' }[lv];
      return `
        <div class="vital-record" style="border-left-color:${color}">
          <div class="vital-record-date">📅 ${v.fecha}${v.hora ? ' · ' + v.hora : ''}</div>
          <div class="vital-record-values">
            <div class="vital-value"><div class="vital-value-label">Presión</div><div class="vital-value-number" style="color:${color}">${v.presion}</div></div>
            <div class="vital-value"><div class="vital-value-label">FC</div><div class="vital-value-number">${v.frecuenciaCard} ppm</div></div>
            <div class="vital-value"><div class="vital-value-label">FR</div><div class="vital-value-number">${v.frecuenciaResp}/min</div></div>
          </div>
        </div>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar"><span>${initials}</span></div>
      <div class="profile-info"><h3>${nombre}</h3><p>Semana ${weeks} · ${days} días</p></div>
    </div>
    <div class="profile-section">
      <h4>Información personal</h4>
      <div class="profile-item"><label>Nombre completo</label><p>${nombre}</p></div>
      <div class="profile-item"><label>Nombre del bebé</label><p>${bebe}</p></div>
      <div class="profile-item"><label>Última menstruación</label><p>${fumStr}</p></div>
      <div class="profile-item"><label>Edad gestacional</label><p>${weeks} semanas y ${days} días</p></div>
    </div>
    <div class="profile-section">
      <h4>Datos de salud</h4>
      <div class="profile-item"><label>EPS / Aseguradora</label><p>${eps}</p></div>
      <div class="profile-item"><label>Teléfono de emergencia</label><p>${telefono}</p></div>
    </div>
    <div class="profile-section">
      <h4>Progreso educativo</h4>
      <div class="profile-learn-bar-wrap">
        <div class="profile-learn-bar-header">
          <span>${completedModules.length} de ${modulosData.length} módulos</span>
          <span class="profile-learn-pct">${Math.round((completedModules.length / modulosData.length) * 100) || 0}%</span>
        </div>
        <div class="profile-learn-bar"><div class="profile-learn-fill" style="width:${Math.round((completedModules.length / modulosData.length) * 100) || 0}%"></div></div>
      </div>
      <div class="profile-logros-row">
        ${getLogros().map(l => `<div class="profile-logro-badge ${l.unlocked ? '' : 'profile-logro-locked'}" title="${l.nombre}"><span>${l.emoji}</span></div>`).join('')}
      </div>
      <p class="profile-logros-label">${getLogros().filter(l => l.unlocked).length} de ${LOGROS_DEF.length} logros desbloqueados</p>
    </div>
    <div class="profile-section">
      <h4>Últimos registros vitales</h4>
      <div class="vitals-history">${vitalsHTML}</div>
    </div>
    <div class="profile-actions">
      <button class="btn-secondary" onclick="editProfile()">✏️ Editar datos</button>
      <button class="btn-danger" onclick="logout()">🚪 Cerrar sesión</button>
    </div>
  `;
}

function editProfile() {
  const nombre = localStorage.getItem('nombreMadre') || '';
  const bebe = localStorage.getItem('nombreBebe') || '';
  const tel = localStorage.getItem('regTel') || '';
  const eps = localStorage.getItem('regEPS') || '';

  document.querySelector('#modalPerfil .modal-content').innerHTML = `
    <h3 style="color:var(--primary-color);margin-bottom:16px">✏️ Editar mis datos</h3>
    <div class="form-group"><label>Tu nombre completo</label><input type="text" id="editNombre" value="${nombre}"></div>
    <div class="form-group"><label>Nombre del bebé</label><input type="text" id="editBebe" value="${bebe}"></div>
    <div class="form-group"><label>Teléfono de emergencia</label><input type="tel" id="editTel" value="${tel}"></div>
    <div class="form-group"><label>EPS / Aseguradora</label><input type="text" id="editEPS" value="${eps}"></div>
    <div style="display:flex;gap:12px;margin-top:8px">
      <button class="btn-primary" onclick="saveProfile()" style="flex:1">💾 Guardar cambios</button>
      <button class="btn-secondary" onclick="loadProfile()" style="flex:1">Cancelar</button>
    </div>
  `;
}

function saveProfile() {
  const nombre = document.getElementById('editNombre')?.value.trim();
  const bebe = document.getElementById('editBebe')?.value.trim();
  const tel = document.getElementById('editTel')?.value.trim();
  const eps = document.getElementById('editEPS')?.value.trim();

  db.collection("pacientes").doc(currentPatientId).set({
    nombreCompleto: nombre || '',
    nombreBebe: bebe || '',
    tel: tel || '',
    eps: eps || ''
  }, { merge: true }).then(() => {
    showToast('✓ Datos actualizados en la nube', 'success');
  });
}

function logout() {
  if (confirm('¿Estás segura de que deseas cerrar sesión?')) {
    auth.signOut().then(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    }).catch(error => alert('Error al cerrar sesión: ' + error.message));
  }
}

// ===== RECORDATORIOS Y AJUSTES =====
function loadRecordatorios() {
  const list = [
    { emoji: '💧', titulo: 'Hidratación', desc: 'Bebe 8-10 vasos de agua diarios.', consejos: ['Aumenta en clima cálido', 'Evita cafeína excesiva', 'Orina clara = buena hidratación'] },
    { emoji: '🥗', titulo: 'Nutrición', desc: 'Proteínas, calcio y hierro en cada comida.', consejos: ['Incluye frutas y verduras', 'Toma ácido fólico', 'Evita alimentos crudos'] },
    { emoji: '😴', titulo: 'Descanso', desc: '8-10 horas diarias favorecen al bebé.', consejos: ['Duerme del lado izquierdo', 'Usa almohada de apoyo', 'Evita pantallas antes de dormir'] },
    { emoji: '🚴', titulo: 'Ejercicio', desc: 'Camina 30 min al día mejora la circulación.', consejos: ['Yoga prenatal es excelente', 'Evita deportes de impacto', 'Detente si sientes dolor'] },
    { emoji: '🏥', titulo: 'Control prenatal', desc: 'Asiste a todos tus controles.', consejos: ['Lleva tu carnet de citas', 'Anota tus síntomas', 'Reporta cambios de presión'] },
    { emoji: '🫀', titulo: 'Registra vitales', desc: 'Registra presión y síntomas TODOS los días.', consejos: ['Mide a la misma hora', 'PA normal: < 130/90 mmHg', 'Alerta: ≥ 140/100 mmHg'] },
    { emoji: '🧘', titulo: 'Maneja el estrés', desc: 'El estrés puede elevar tu presión arterial.', consejos: ['Respiración profunda 5 min/día', 'Habla con tu familia', 'Música relajante'] },
    { emoji: '🚫', titulo: 'Evita', desc: 'Sustancias que pueden dañar al bebé.', consejos: ['No fumar', 'Cero alcohol', 'Consulta antes de tomar medicamentos'] }
  ];
  const container = document.getElementById('recordatoriosContainer');
  if (!container) return;
  container.innerHTML = list.map(r => `
    <div class="recordatorio-card">
      <div class="recordatorio-emoji">${r.emoji}</div>
      <div class="recordatorio-titulo">${r.titulo}</div>
      <div class="recordatorio-desc">${r.desc}</div>
      <div class="recordatorio-consejos"><ul>${r.consejos.map(c => `<li>${c}</li>`).join('')}</ul></div>
    </div>`).join('');
}

function toggleDarkMode() {
  const btn = document.getElementById('darkModeToggle');
  const isDark = btn.classList.toggle('active');
  document.documentElement.classList.toggle('dark-mode', isDark);
  localStorage.setItem('darkMode', isDark);
  showToast(isDark ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado', 'success');
}

function toggleLargeFont() {
  const btn = document.getElementById('largeFontToggle');
  const isLarge = btn.classList.toggle('active');
  document.documentElement.classList.toggle('large-font', isLarge);
  localStorage.setItem('largeFont', isLarge);
}

function toggleSetting(id) { document.getElementById(id)?.classList.toggle('active'); }

function applyStoredSettings() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.getElementById('darkModeToggle')?.classList.add('active');
    document.documentElement.classList.add('dark-mode');
  }
  if (localStorage.getItem('largeFont') === 'true') {
    document.getElementById('largeFontToggle')?.classList.add('active');
    document.documentElement.classList.add('large-font');
  }
}

function toggleMenu() {
  const dropdown = document.getElementById('menuDropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('show');
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!dropdown.contains(e.target) && !e.target.closest('#menuBtn')) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', handler);
      }
    });
  }, 100);
}

function loadNurseCard() {
  const nombre = localStorage.getItem('nurseNombre') || 'Enf. Zuleiny Sierra';
  const telefono = localStorage.getItem('nurseTelefono') || '3233128517';
  const turno = localStorage.getItem('nurseTurno') || 'Turno tarde · 14:00–22:00';
  const initials = nombre.replace('Enf. ', '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  if (document.getElementById('nurseAvatarCard')) document.getElementById('nurseAvatarCard').textContent = initials;
  if (document.getElementById('nurseNameCard')) document.getElementById('nurseNameCard').textContent = nombre;
  if (document.getElementById('nurseStatusCard')) document.getElementById('nurseStatusCard').innerHTML = `${turno} · <span class="online-dot"></span> En línea`;
  if (document.getElementById('nurseCallBtn')) document.getElementById('nurseCallBtn').setAttribute('onclick', `event.stopPropagation(); window.location.href='tel:${telefono}'`);

  if (document.getElementById('chatNurseAvatar')) document.getElementById('chatNurseAvatar').textContent = initials;
  if (document.getElementById('chatNurseName')) document.getElementById('chatNurseName').textContent = nombre;
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  applyStoredSettings();
  renderWeek();
  renderCarousel();
  setupLiveValidation();
  updateVitalCards();
  loadNurseCard();
});