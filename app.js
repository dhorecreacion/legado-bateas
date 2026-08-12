import { db } from 'firebase-config.js';

import {
  ref,
  get,
  update
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const state = {
  user: null
};

const $ = (id) => document.getElementById(id);

function show(viewId) {
  ['loginView', 'formView', 'successView'].forEach(id => {
    const element = $(id);
    if (element) {
      element.classList.toggle('hidden', id !== viewId);
    }
  });

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function setMessage(el, text, ok = false) {
  if (!el) return;

  el.textContent = text || '';
  el.className = `message${ok ? ' ok' : ''}`;
}

function onlyDigits(input) {
  input.value = input.value
    .replace(/\D/g, '')
    .slice(0, 8);
}

function resetAcademicFields() {
  $('finishedYearField').classList.add('hidden');
  $('finishedYear').required = false;
}

function getFirstName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts.length
    ? parts[parts.length - 1]
    : '';
}

/* =========================================================
   VALIDACIONES DE CAMPOS
   ========================================================= */

$('loginDni').addEventListener('input', e => {
  onlyDigits(e.target);
});

$('childDni').addEventListener('input', e => {
  onlyDigits(e.target);
});

$('applicationForm').addEventListener('reset', () => {
  setTimeout(resetAcademicFields, 0);
});

$('finishedYear').addEventListener('input', e => {
  e.target.value = e.target.value
    .replace(/\D/g, '')
    .slice(0, 4);
});

$('finishedSecondary').addEventListener('change', () => {
  $('finishedYearField').classList.remove('hidden');
  $('finishedYear').required = true;
});

$('lastYear').addEventListener('change', () => {
  $('finishedYearField').classList.add('hidden');
  $('finishedYear').required = false;
  $('finishedYear').value = '';
});

/* =========================================================
   LOGIN POR DNI
   ========================================================= */

$('loginForm').addEventListener('submit', async (e) => {
  console.log('SUBMIT DEL LOGIN CAPTURADO');
  e.preventDefault();

  const dni = $('loginDni').value.trim();
  const msg = $('loginMessage');

  if (dni.length !== 8) {
    setMessage(
      msg,
      'Ingresa un DNI válido de 8 dígitos.'
    );
    return;
  }

  const button = e.submitter;

  button.disabled = true;
  button.textContent = 'Validando...';

  try {
    console.log('Buscando DNI:', dni);

    const personRef = ref(
      db,
      `personas/${dni}`
    );

    const snapshot = await get(personRef);

    console.log('Persona encontrada:', snapshot.exists());

    if (!snapshot.exists()) {
      setMessage(
        msg,
        'El DNI ingresado no se encuentra habilitado para este proceso.'
      );
      return;
    }

    const person = snapshot.val();

    state.user = {
      dni: person.dni || dni,
      nombreCompleto: person.nombreCompleto || '',
      primerNombre: getFirstName(
        person.nombreCompleto || ''
      )
    };

    $('welcomeName').textContent =
      state.user.primerNombre;

    $('applicationForm').reset();

    setMessage(
      $('formMessage'),
      ''
    );

    show('formView');

  } catch (error) {
    console.error(
      'Error consultando Firebase:',
      error
    );

    setMessage(
      msg,
      'No se pudo consultar la base de datos. Verifica las reglas de Firebase.'
    );

  } finally {
    button.disabled = false;
    button.innerHTML =
      'Continuar <span>→</span>';
  }
});

/* =========================================================
   REGISTRAR POSTULACIÓN
   ========================================================= */

$('applicationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const msg = $('formMessage');

  if (!state.user) {
    setMessage(
      msg,
      'Tu sesión no es válida. Ingresa nuevamente.'
    );

    show('loginView');
    return;
  }

  const payload = {
    apoderadoDni: state.user.dni,
    apoderadoNombre: state.user.nombreCompleto,

    hijoDni: $('childDni').value.trim(),

    nombres: $('names').value.trim(),

    apellidos: $('lastnames').value.trim(),

    ultimoAnio: $('lastYear').checked,

    anioCulmino:
      $('finishedSecondary').checked
        ? $('finishedYear').value.trim()
        : null
  };

  /* =======================================================
     VALIDACIONES
     ======================================================= */

  if (
    payload.hijoDni.length !== 8 ||
    !payload.nombres ||
    !payload.apellidos ||
    (
      !$('lastYear').checked &&
      !$('finishedSecondary').checked
    ) ||
    (
      $('finishedSecondary').checked &&
      !/^(19|20)\d{2}$/.test(
        payload.anioCulmino
      )
    )
  ) {
    setMessage(
      msg,
      'Completa todos los campos obligatorios.'
    );

    return;
  }

  const button = e.submitter;

  button.disabled = true;
  button.textContent = 'Registrando...';

  try {
    /* =====================================================
       VERIFICAR PERSONA
       ===================================================== */

    const personRef = ref(
      db,
      `personas/${state.user.dni}`
    );

    const personSnapshot =
      await get(personRef);

    if (!personSnapshot.exists()) {
      setMessage(
        msg,
        'No se encontró la persona en la base de datos.'
      );

      return;
    }

    const person =
      personSnapshot.val();

    /* =====================================================
       VERIFICAR DUPLICADO
       ===================================================== */

    const postulaciones =
      person.postulaciones || {};

    const postulacionesArray =
      Array.isArray(postulaciones)
        ? postulaciones
        : Object.values(postulaciones);

    const duplicate =
      postulacionesArray.some(item => {

        if (!item) return false;

        return (
          String(
            item.apoderadoDni || ''
          ) === state.user.dni &&

          String(
            item.hijoDni || ''
          ) === payload.hijoDni
        );
      });

    if (duplicate) {
      setMessage(
        msg,
        'Este estudiante ya fue registrado por este apoderado.'
      );

      return;
    }

    /* =====================================================
       GENERAR CÓDIGO
       ===================================================== */

    const code =
      `BEC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    /* =====================================================
       CREAR POSTULACIÓN
       ===================================================== */

    const application = {
      codigo: code,

      apoderadoDni:
        state.user.dni,

      apoderadoNombre:
        state.user.nombreCompleto,

      hijoDni:
        payload.hijoDni,

      nombres:
        payload.nombres,

      apellidos:
        payload.apellidos,

      ultimoAnio:
        payload.ultimoAnio,

      anioCulmina:
        payload.anioCulmino
          ? Number(payload.anioCulmino)
          : null,

      fechaRegistro:
        new Date().toISOString(),

      estado:
        'Pendiente'
    };

    /* =====================================================
       GUARDAR EN:

       personas/{DNI}/postulaciones/{CODIGO}
       ===================================================== */

    const applicationRef =
      ref(
        db,
        `personas/${state.user.dni}/postulaciones/${code}`
      );

    await update(
      applicationRef,
      application
    );

    console.log(
      'Postulación registrada:',
      application
    );

    /* =====================================================
       CONFIRMACIÓN
       ===================================================== */

    $('applicationCode').textContent =
      code;

    show('successView');

  } catch (error) {
    console.error(
      'Error registrando postulación:',
      error
    );

    setMessage(
      msg,
      'No se pudo registrar la inscripción. Verifica las reglas de Firebase.'
    );

  } finally {
    button.disabled = false;

    button.innerHTML =
      'Registrar inscripción <span>→</span>';
  }
});

/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

$('logoutBtn').addEventListener('click', () => {

  state.user = null;

  $('loginForm').reset();

  setMessage(
    $('loginMessage'),
    ''
  );

  show('loginView');
});

/* =========================================================
   VOLVER AL LOGIN
   ========================================================= */

$('backBtn').addEventListener('click', () => {

  state.user = null;

  $('loginForm').reset();

  setMessage(
    $('loginMessage'),
    ''
  );

  show('loginView');
});

/* =========================================================
   NUEVA POSTULACIÓN
   ========================================================= */

$('newBtn').addEventListener('click', () => {

  $('applicationForm').reset();

  setMessage(
    $('formMessage'),
    ''
  );

  show('formView');
});
