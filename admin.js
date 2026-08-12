import { db, auth } from 'firebase-config.js';

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  ref,
  get,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";


/* =========================================================
   VARIABLES
   ========================================================= */

let applications = [];
let selected = null;


/* =========================================================
   UTILIDADES
   ========================================================= */

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[c])
  );


const statusClass = status =>
  'status-' +
  String(status || 'Pendiente')
    .toLowerCase()
    .replace(/\s+/g, '-');


/* =========================================================
   MOSTRAR PANEL
   ========================================================= */

function showApp(user) {

  $('adminLogin').classList.add('hidden');

  $('adminApp').classList.remove('hidden');

  $('adminUserLabel').textContent =
    user?.email || 'Administrador';

  loadApplications();
}


/* =========================================================
   LOGIN FIREBASE
   ========================================================= */

async function login() {

  const email =
    $('adminUser').value.trim();

  const password =
    $('adminPassword').value;

  const message =
    $('adminLoginMessage');

  message.textContent = '';

  if (!email || !password) {

    message.textContent =
      'Ingresa tu correo y contraseña.';

    return;
  }


  const button =
    $('adminLoginForm')
      .querySelector(
        'button[type="submit"]'
      );


  button.disabled = true;
  button.textContent = 'Ingresando...';


  try {

    const credential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


    console.log(
      'Administrador autenticado:',
      credential.user.uid
    );


    showApp(
      credential.user
    );


  } catch (error) {

    console.error(
      'Error de autenticación:',
      error
    );


    let messageText =
      'No se pudo iniciar sesión.';


    switch (error.code) {

      case 'auth/invalid-credential':
        messageText =
          'Correo o contraseña incorrectos.';
        break;

      case 'auth/user-not-found':
        messageText =
          'No existe un administrador con este correo.';
        break;

      case 'auth/wrong-password':
        messageText =
          'La contraseña es incorrecta.';
        break;

      case 'auth/invalid-email':
        messageText =
          'El correo ingresado no es válido.';
        break;

      case 'auth/too-many-requests':
        messageText =
          'Demasiados intentos. Inténtalo nuevamente más tarde.';
        break;

      default:
        messageText =
          error.message ||
          messageText;
    }


    message.textContent =
      messageText;


  } finally {

    button.disabled = false;
    button.textContent = 'Ingresar';

  }
}


/* =========================================================
   CARGAR TODAS LAS POSTULACIONES
   ========================================================= */

async function loadApplications() {

  $('applicationsBody').innerHTML =
    '<tr><td colspan="8" class="empty">Cargando solicitudes...</td></tr>';


  try {

    const snapshot =
      await get(
        ref(db, 'personas')
      );


    if (!snapshot.exists()) {

      applications = [];

      render();

      return;
    }


    const people =
      snapshot.val();

    const result = [];


    /*
      Estructura Firebase:

      personas
        └── DNI
             ├── dni
             ├── nombreCompleto
             └── postulaciones
                  └── CODIGO
    */


    Object.entries(
      people
    ).forEach(
      ([dni, person]) => {

        if (!person) return;


        const postulaciones =
          person.postulaciones || {};


        const entries =
          Array.isArray(postulaciones)

            ? postulaciones.map(
                (item, index) =>
                  [index, item]
              )

            : Object.entries(
                postulaciones
              );


        entries.forEach(
          ([postKey, application]) => {

            if (!application) return;


            result.push({

              ...application,

              apoderadoDni:
                application.apoderadoDni ||
                dni,

              apoderadoNombre:
                application.apoderadoNombre ||
                person.nombreCompleto ||
                '',

              _personDni:
                dni,

              _postKey:
                postKey

            });

          }
        );

      }
    );


    applications =
      result;


    render();


  } catch (error) {

    console.error(
      'Error cargando postulaciones:',
      error
    );


    $('applicationsBody').innerHTML =
      `
      <tr>
        <td colspan="8" class="empty">
          ${esc(
            error.message ||
            'No se pudieron cargar las solicitudes.'
          )}
        </td>
      </tr>
      `;

  }
}


/* =========================================================
   FILTROS
   ========================================================= */

function filtered() {

  const q =
    $('searchInput')
      .value
      .trim()
      .toLowerCase();


  const status =
    $('statusFilter').value;


  return applications.filter(
    application => {

      const hay = [

        application.codigo,

        application.apoderadoNombre,

        application.apoderadoDni,

        application.nombres,

        application.apellidos,

        application.hijoDni

      ]
        .join(' ')
        .toLowerCase();


      return (

        (!q ||
          hay.includes(q)) &&

        (!status ||
          (application.estado ||
            'Pendiente') === status)

      );

    }
  );
}


/* =========================================================
   RENDERIZAR TABLA
   ========================================================= */

function render() {

  const total =
    applications.length;


  const count =
    status =>
      applications.filter(
        application =>
          (application.estado ||
            'Pendiente') === status
      ).length;


  $('statTotal').textContent =
    total;


  $('statPending').textContent =
    count('Pendiente');


  $('statReview').textContent =
    count('En revisión');


  $('statApproved').textContent =
    count('Aprobada');


  const rows =
    filtered();


  if (!rows.length) {

    $('applicationsBody').innerHTML =
      `
      <tr>
        <td colspan="8" class="empty">
          No hay solicitudes que coincidan con los filtros.
        </td>
      </tr>
      `;

    return;
  }


  $('applicationsBody').innerHTML =
    rows.map(
      application => {

        const date =
          application.fechaRegistro
            ? new Date(
                application.fechaRegistro
              ).toLocaleDateString(
                'es-PE'
              )
            : '-';


        const status =
          application.estado ||
          'Pendiente';


        return `
          <tr>

            <td>
              <strong>
                ${esc(application.codigo)}
              </strong>
            </td>


            <td>
              ${esc(
                application.apoderadoNombre
              )}
              <br>

              <small>
                ${esc(
                  application.apoderadoDni
                )}
              </small>
            </td>


            <td>
              <span class="student-name">
                ${esc(
                  application.nombres
                )}
                ${esc(
                  application.apellidos
                )}
              </span>
            </td>


            <td>
              ${esc(
                application.hijoDni
              )}
            </td>


            <td>
              ${
                application.ultimoAnio
                  ? 'Sí'
                  : 'No'
              }
            </td>


            <td>
              ${date}
            </td>


            <td>
              <span
                class="status-pill ${statusClass(
                  status
                )}"
              >
                ${esc(status)}
              </span>
            </td>


            <td>

              <div class="action-buttons">

                <button
                  class="view-btn"
                  data-code="${esc(
                    application.codigo
                  )}"
                  type="button"
                >
                  Ver detalle
                </button>


                <button
                  class="delete-btn"
                  data-code="${esc(
                    application.codigo
                  )}"
                  type="button"
                >
                  Eliminar
                </button>

              </div>

            </td>

          </tr>
        `;

      }
    ).join('');


  /*
    Botones VER DETALLE
  */

  document
    .querySelectorAll('.view-btn')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          openDetail(
            button.dataset.code
          )
      );

    });


  /*
    Botones ELIMINAR
  */

  document
    .querySelectorAll('.delete-btn')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          deleteApplication(
            button.dataset.code
          )
      );

    });

}


/* =========================================================
   ABRIR DETALLE
   ========================================================= */

function openDetail(code) {

  selected =
    applications.find(
      application =>
        application.codigo === code
    );


  if (!selected) return;


  $('detailCode').textContent =
    selected.codigo;


  $('detailStatus').value =
    selected.estado ||
    'Pendiente';


  const date =
    selected.fechaRegistro
      ? new Date(
          selected.fechaRegistro
        ).toLocaleString('es-PE')
      : '-';


  const academicStatus =
    selected.ultimoAnio

      ? 'Cursa 5.º de secundaria'

      : `Culminó secundaria${
          selected.anioCulmino
            ? ` (${selected.anioCulmino})`
            : ''
        }`;


  const items = [

    [
      'Apoderado',
      selected.apoderadoNombre
    ],

    [
      'DNI apoderado',
      selected.apoderadoDni
    ],

    [
      'Estudiante',
      `${selected.nombres} ${selected.apellidos}`
    ],

    [
      'DNI estudiante',
      selected.hijoDni
    ],

    [
      'Situación académica',
      academicStatus
    ],

    [
      'Fecha de inscripción',
      date
    ]

  ];


  $('detailContent').innerHTML =
    items
      .map(
        ([key, value]) => `
          <div class="detail-item">

            <span>
              ${esc(key)}
            </span>

            <strong>
              ${esc(value)}
            </strong>

          </div>
        `
      )
      .join('');


  $('detailModal')
    .classList
    .remove('hidden');

}


/* =========================================================
   GUARDAR ESTADO
   ========================================================= */

async function saveStatus() {

  if (!selected) return;


  const button =
    $('saveStatus');


  const newStatus =
    $('detailStatus').value;


  button.disabled = true;
  button.textContent =
    'Guardando...';


  try {

    /*
      La postulación está en:

      personas/{DNI}/postulaciones/{CODIGO}
    */

    const applicationRef =
      ref(
        db,
        `personas/${selected._personDni}/postulaciones/${selected.codigo}`
      );


    const updateTime =
      new Date().toISOString();


    await update(
      applicationRef,
      {

        estado:
          newStatus,

        ultimaActualizacion:
          updateTime

      }
    );


    selected.estado =
      newStatus;


    selected.ultimaActualizacion =
      updateTime;


    $('detailModal')
      .classList
      .add('hidden');


    await loadApplications();


  } catch (error) {

    console.error(
      'Error actualizando estado:',
      error
    );


    alert(
      error.message ||
      'No se pudo actualizar el estado.'
    );


  } finally {

    button.disabled = false;

    button.textContent =
      'Guardar estado';

  }

}


/* =========================================================
   ELIMINAR POSTULACIÓN
   ========================================================= */

async function deleteApplication(code) {

  const application =
    applications.find(
      item =>
        item.codigo === code
    );


  if (!application) {

    alert(
      'No se encontró la postulación.'
    );

    return;
  }


  /*
    Confirmación antes de eliminar.
  */

  const studentName =
    `${application.nombres || ''} ${application.apellidos || ''}`.trim();


  const confirmed =
    confirm(
      `¿Estás seguro de eliminar esta postulación?\n\n` +
      `Código: ${application.codigo}\n` +
      `Estudiante: ${studentName}\n` +
      `DNI estudiante: ${application.hijoDni}\n\n` +
      `Esta acción no se puede deshacer.`
    );


  if (!confirmed) return;


  /*
    Buscar el botón para bloquearlo
    mientras se elimina.
  */

  const buttons =
    document.querySelectorAll(
      `.delete-btn[data-code="${CSS.escape(code)}"]`
    );


  buttons.forEach(
    button => {

      button.disabled = true;

      button.textContent =
        'Eliminando...';

    }
  );


  try {

    /*
      RUTA EXACTA:

      personas
        └── DNI APODERADO
             └── postulaciones
                  └── CODIGO
    */

    const applicationRef =
      ref(
        db,
        `personas/${application._personDni}/postulaciones/${application.codigo}`
      );


    await remove(
      applicationRef
    );


    /*
      También eliminamos la solicitud
      del arreglo local.
    */

    applications =
      applications.filter(
        item =>
          !(
            item.codigo ===
              application.codigo &&

            item._personDni ===
              application._personDni
          )
      );


    /*
      Si el modal estaba abierto
      para esa solicitud, cerrarlo.
    */

    if (
      selected &&
      selected.codigo ===
        application.codigo
    ) {

      selected = null;

      $('detailModal')
        .classList
        .add('hidden');

    }


    /*
      Actualizar tabla y estadísticas.
    */

    render();


    alert(
      'La postulación fue eliminada correctamente.'
    );


  } catch (error) {

    console.error(
      'Error eliminando postulación:',
      error
    );


    alert(
      error.message ||
      'No se pudo eliminar la postulación.'
    );


    /*
      Volvemos a cargar por seguridad
      si ocurrió algún error.
    */

    await loadApplications();

  }

}


/* =========================================================
   EXPORTAR CSV
   ========================================================= */

function exportCsv() {

  const rows =
    filtered();


  const headers = [

    'Codigo',

    'Apoderado',

    'DNI Apoderado',

    'Estudiante',

    'DNI Estudiante',

    'Ultimo año',

    'Fecha',

    'Estado'

  ];


  const lines = [

    headers,

    ...rows.map(
      application => [

        application.codigo,

        application.apoderadoNombre,

        application.apoderadoDni,

        `${application.nombres} ${application.apellidos}`,

        application.hijoDni,

        application.ultimoAnio
          ? 'Sí'
          : 'No',

        application.fechaRegistro
          ? new Date(
              application.fechaRegistro
            ).toLocaleString(
              'es-PE'
            )
          : '',

        application.estado ||
          'Pendiente'

      ]
    )

  ].map(

    row =>
      row
        .map(
          value =>
            `"${String(
              value ?? ''
            ).replace(
              /"/g,
              '""'
            )}"`
        )
        .join(',')

  );


  const blob =
    new Blob(
      [
        '\ufeff' +
        lines.join('\n')
      ],
      {
        type:
          'text/csv;charset=utf-8'
      }
    );


  const url =
    URL.createObjectURL(blob);


  const a =
    document.createElement('a');


  a.href = url;


  a.download =
    `solicitudes-becas-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;


  a.click();


  URL.revokeObjectURL(url);

}


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

async function logout() {

  try {

    await signOut(auth);

  } catch (error) {

    console.error(
      'Error cerrando sesión:',
      error
    );

  }


  applications = [];

  selected = null;


  $('adminApp')
    .classList
    .add('hidden');


  $('adminLogin')
    .classList
    .remove('hidden');


  $('adminLoginForm').reset();


  $('adminLoginMessage').textContent =
    '';

}


/* =========================================================
   EVENTOS
   ========================================================= */

$('adminLoginForm')
  .addEventListener(
    'submit',
    e => {

      e.preventDefault();

      login();

    }
  );


$('adminLogout')
  .addEventListener(
    'click',
    logout
  );


$('refreshBtn')
  .addEventListener(
    'click',
    loadApplications
  );


$('searchInput')
  .addEventListener(
    'input',
    render
  );


$('statusFilter')
  .addEventListener(
    'change',
    render
  );


$('exportBtn')
  .addEventListener(
    'click',
    exportCsv
  );


$('closeModal')
  .addEventListener(
    'click',
    () =>
      $('detailModal')
        .classList
        .add('hidden')
  );


$('saveStatus')
  .addEventListener(
    'click',
    saveStatus
  );


$('detailModal')
  .addEventListener(
    'click',
    e => {

      if (
        e.target ===
        $('detailModal')
      ) {

        $('detailModal')
          .classList
          .add('hidden');

      }

    }
  );


/* =========================================================
   RESTAURAR SESIÓN FIREBASE
   ========================================================= */

onAuthStateChanged(
  auth,
  user => {

    if (user) {

      showApp(user);

    } else {

      $('adminApp')
        .classList
        .add('hidden');


      $('adminLogin')
        .classList
        .remove('hidden');

    }

  }
);
