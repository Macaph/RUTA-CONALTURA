/*
  LÓGICA PRINCIPAL DE RUTA: ingreso, roles y menú
  Aquí decimos QUÉ HACE la página cuando alguien interactúa con ella.

  Los usuarios y contraseñas viven en Firebase Authentication.
  El rol sale del correo (vendedor@conaltura.com -> vendedor).
*/

import { iniciarSesion, cerrarSesion, escucharSesion, mensajeDeError } from "./datos.js";
import { mostrarVerInventario, mostrarRegistrar } from "./inventario.js";
import { mostrarAprobar } from "./aprobaciones.js";
import {
  mostrarSolicitar,
  mostrarAprobarSolicitudes,
  mostrarEnviarRecibir,
  mostrarTrasladosAdmin
} from "./traslados.js";
import { mostrarNovedad, mostrarRevisarCompras, mostrarRegistrarCompra, mostrarComprasAdmin, preseleccionarNovedad } from "./compras.js";
import { mostrarHistorialBodega } from "./bodeguista.js";
import { mostrarMisElementos } from "./mis-elementos.js";
import { mostrarReportes, mostrarUsuarios } from "./reportes.js";
import { escapar } from "./utilidades.js";
import {
  mostrarRegistrarAdquisicion,
  mostrarGestionarActivos,
  mostrarSaldosBajas,
  mostrarValoracionActivos
} from "./activos-adquisiciones.js";

// =====================================================================
// 1. LOS ROLES Y SUS FUNCIONES
// =====================================================================
const ROLES = {
  vendedor: {
    nombre: "Vendedor",
    descripcion: "Usa la sala de ventas con los clientes y sube el inventario de su sala.",
    parrafo: "Consulta, registra y reporta las novedades con los elementos de la sala de ventas y apartamento modelo.",
    opciones: [
      "Ver inventario",
      "Registrar elementos",
      "Solicitar elementos",
      "Reportar novedad",
      "Mis elementos asignados"
    ]
  },

  bodeguista: {
    nombre: "Bodeguista",
    descripcion: "Gestiona la bodega, envía y recibe elementos.",
    parrafo: "Registra lo que llega a la bodega, despacha y recibe los traslados aprobados y consulta el historial de todos los movimientos.",
    opciones: [
      "Ver inventario",
      "Registrar elementos",
      "Enviar / Recibir traslados",
      "Informar traslados"
    ]
  },

  administrador: {
    nombre: "Administrador",
    descripcion: "Acceso completo y control del sistema.",
    parrafo: "Controla el inventario de todas las salas, apartamentos modelo y la bodega, gestiona los traslados y las compras, y consulta los reportes y los permisos de cada rol.",
    opciones: [
      "Ver inventario",
      "Registrar elementos",
      "Aprobar inventario",
      "Traslados",
      "Compras",
      "Reportes",
      "Usuarios"
    ]
  },

  compras: {
    nombre: "Administración de Activos y Adquisiciones",
    descripcion: "Gestiona adquisiciones, activos, saldos, bajas y valoración económica básica.",
    parrafo: "Revisa las solicitudes de compra, registra las adquisiciones y gestiona los activos, los saldos, las bajas y su valoración por proyecto.",
    opciones: [
      "Ver inventario",
      "Revisar solicitudes de compra",
      "Registrar compra",
      "Registrar adquisición",
      "Gestionar activos",
      "Gestionar saldos y bajas",
      "Valoración de activos",
      "Reportes"
    ]
  },

  coordinador: {
    nombre: "Coordinador",
    descripcion: "Está a cargo de la sala: aprueba el inventario y las solicitudes.",
    parrafo: "Aprueba el inventario que registran las salas, la bodega y compras, decide los traslados entre espacios y consulta los reportes de cada sala.",
    opciones: [
      "Ver inventario",
      "Aprobar inventario",
      "Aprobar solicitudes",
      "Reportes"
    ]
  }
};

// En el menú del encabezado, las opciones parecidas se juntan en un
// desplegable. Lo que no esté aquí sale como enlace directo.
const GRUPOS = {
  "Inventario": ["Ver inventario", "Registrar elementos", "Aprobar inventario", "Mis elementos asignados"],
  "Traslados": ["Solicitar elementos", "Aprobar solicitudes", "Enviar / Recibir traslados", "Informar traslados", "Traslados"],
  "Compras": ["Revisar solicitudes de compra", "Registrar compra", "Registrar adquisición", "Compras"],
  "Activos": ["Gestionar activos", "Gestionar saldos y bajas", "Valoración de activos"]
};

// =====================================================================
// 2. ELEMENTOS DEL HTML
// =====================================================================
const formIngreso      = document.getElementById("formIngreso");
const campoUsuario     = document.getElementById("campoUsuario");
const campoContrasena  = document.getElementById("campoContrasena");
const mensajeError     = document.getElementById("mensajeError");
const botonIngresar    = document.getElementById("botonIngresar");
const pantallaCargando = document.getElementById("pantallaCargando");
const pantallaIngreso  = document.getElementById("pantallaIngreso");
const pantallaPanel    = document.getElementById("pantallaPanel");
const menu             = document.getElementById("menu");
const menuLateral      = document.getElementById("menuLateral");
const fondoMenu        = document.getElementById("fondoMenu");
const botonMenu        = document.getElementById("botonMenu");
const botonAtras       = document.getElementById("botonAtras");
const tituloSeccion    = document.getElementById("tituloSeccion");
const contenido        = document.getElementById("contenido");
const cajaUsuario      = document.getElementById("usuarioActual");
const navSuperior      = document.getElementById("navSuperior");

let usuarioConectado = null;

// =====================================================================
// 3. INGRESAR Y SALIR
// =====================================================================
async function ingresar(evento) {
  evento.preventDefault();
  mensajeError.classList.add("oculto");
  botonIngresar.disabled = true;
  botonIngresar.textContent = "Ingresando...";

  try {
    await iniciarSesion(campoUsuario.value, campoContrasena.value);
    formIngreso.reset();
  } catch (error) {
    mensajeError.textContent = mensajeDeError(error);
    mensajeError.classList.remove("oculto");
    campoContrasena.value = "";
  }

  botonIngresar.disabled = false;
  botonIngresar.textContent = "Ingresar";
}

async function salir() {
  await cerrarSesion();
}

// =====================================================================
// 4. PANTALLA SEGÚN LA SESIÓN
// =====================================================================
function mostrarIngreso() {
  document.body.classList.add("en-ingreso");
  pantallaCargando.classList.add("oculto");
  pantallaPanel.classList.add("oculto");
  cajaUsuario.classList.add("oculto");
  pantallaIngreso.classList.remove("oculto");
}

function mostrarPanel() {
  const rol = ROLES[usuarioConectado.rol];
  document.body.classList.remove("en-ingreso");

  pantallaCargando.classList.add("oculto");
  pantallaIngreso.classList.add("oculto");
  pantallaPanel.classList.remove("oculto");

  cajaUsuario.classList.remove("oculto");
  // Como en las páginas modernas: un círculo con la inicial y, al tocarlo,
  // se despliega la cuenta y la opción de salir
  cajaUsuario.innerHTML =
    '<details class="desplegable cuenta">' +
    '<summary aria-label="Cuenta de ' + rol.nombre + '">' +
    '<span class="avatar">' + rol.nombre.charAt(0) + "</span>" +
    '<span class="cuenta-nombre">' + rol.nombre + "</span>" +
    "</summary>" +
    '<div class="cuenta-menu">' +
    "<b>" + rol.nombre + "</b>" +
    '<span class="cuenta-correo">' + escapar(usuarioConectado.correo) + "</span>" +
    '<button id="botonSalir">Cerrar sesión</button>' +
    "</div></details>";
  document.getElementById("botonSalir").addEventListener("click", salir);

  menu.innerHTML = "";
  menu.appendChild(crearBotonMenu("Inicio"));
  for (const opcion of rol.opciones) {
    menu.appendChild(crearBotonMenu(opcion));
  }
  armarMenuSuperior(rol.opciones);

  historial = [];
  opcionActual = null;
  irA("Inicio", false);
}

// Arma el menú horizontal del encabezado
function armarMenuSuperior(opciones) {
  navSuperior.innerHTML = "";
  const puestas = [];

  for (const opcion of opciones) {
    if (puestas.includes(opcion)) continue;

    const grupo = Object.keys(GRUPOS).find(function (g) { return GRUPOS[g].includes(opcion); });
    const delGrupo = grupo ? opciones.filter(function (o) { return GRUPOS[grupo].includes(o); }) : [opcion];
    puestas.push(...delGrupo);

    // Si el grupo tiene una sola opción, no hace falta desplegable
    if (delGrupo.length === 1) {
      navSuperior.appendChild(crearBotonMenu(opcion));
      continue;
    }

    const desplegable = document.createElement("details");
    desplegable.className = "desplegable";
    desplegable.innerHTML = "<summary>" + grupo + '</summary><div class="panel"></div>';
    for (const o of delGrupo) desplegable.querySelector(".panel").appendChild(crearBotonMenu(o));
    navSuperior.appendChild(desplegable);
  }
}

function crearBotonMenu(texto) {
  const boton = document.createElement("button");
  boton.textContent = texto;
  boton.dataset.opcion = texto;
  boton.addEventListener("click", function () {
    irA(texto, true);
  });
  return boton;
}

// =====================================================================
// 4b. MENÚ HAMBURGUESA Y BOTÓN ATRÁS
// =====================================================================
let historial = [];
let opcionActual = null;

function abrirMenu() {
  menuLateral.classList.add("abierto");
  fondoMenu.classList.remove("oculto");
  botonMenu.setAttribute("aria-expanded", "true");
  const activo = menu.querySelector(".activo") || menu.querySelector("button");
  if (activo) activo.focus();
}

function cerrarMenu() {
  menuLateral.classList.remove("abierto");
  fondoMenu.classList.add("oculto");
  botonMenu.setAttribute("aria-expanded", "false");
}

function irA(opcion, guardar) {
  if (guardar && opcionActual && opcionActual !== opcion) {
    historial.push(opcionActual);
  }
  opcionActual = opcion;

  // Marcamos en el menú la opción activa
  for (const b of document.querySelectorAll("[data-opcion]")) {
    b.classList.toggle("activo", b.dataset.opcion === opcion);
  }
  // También se resalta el grupo que contiene la opción
  for (const d of navSuperior.querySelectorAll("details")) {
    d.classList.toggle("activo", d.querySelector(".activo") !== null);
  }
  cerrarDesplegables();
  tituloSeccion.textContent = opcion;
  botonAtras.classList.toggle("oculto", historial.length === 0);

  cerrarMenu();
  abrirOpcion(opcion);
  window.scrollTo(0, 0);
}

function atras() {
  const anterior = historial.pop();
  if (anterior) irA(anterior, false);
}

// =====================================================================
// 5. CONTENIDO DE CADA OPCIÓN
// =====================================================================
function abrirOpcion(opcion) {
  if (opcion === "Inicio") {
    mostrarInicio();
  } else if (opcion === "Ver inventario") {
    mostrarVerInventario(contenido, usuarioConectado);
  } else if (opcion === "Registrar elementos") {
    mostrarRegistrar(contenido, usuarioConectado);
  } else if (opcion === "Aprobar inventario") {
    mostrarAprobar(contenido, usuarioConectado);
  } else if (opcion === "Solicitar elementos") {
    mostrarSolicitar(contenido, usuarioConectado);
  } else if (opcion === "Aprobar solicitudes") {
    mostrarAprobarSolicitudes(contenido, usuarioConectado);
  } else if (opcion === "Enviar / Recibir traslados") {
    mostrarEnviarRecibir(contenido, usuarioConectado);
  } else if (opcion === "Informar traslados") {
    mostrarHistorialBodega(contenido);                       // js/bodeguista.js
  } else if (opcion === "Traslados") {
    mostrarTrasladosAdmin(contenido, usuarioConectado);
  } else if (opcion === "Mis elementos asignados") {
    mostrarMisElementos(contenido, usuarioConectado, function (codigo) {
      preseleccionarNovedad(codigo);
      irA("Reportar novedad", true);
    });
  } else if (opcion === "Reportar novedad") {
    mostrarNovedad(contenido, usuarioConectado);
  } else if (opcion === "Revisar solicitudes de compra") {
    mostrarRevisarCompras(contenido, usuarioConectado);
  } else if (opcion === "Registrar compra") {
    mostrarRegistrarCompra(contenido, usuarioConectado);
  } else if (opcion === "Registrar adquisición") {
    mostrarRegistrarAdquisicion(contenido, usuarioConectado);
  } else if (opcion === "Gestionar activos") {
    mostrarGestionarActivos(contenido, usuarioConectado);
  } else if (opcion === "Gestionar saldos y bajas") {
    mostrarSaldosBajas(contenido, usuarioConectado);
  } else if (opcion === "Valoración de activos") {
    mostrarValoracionActivos(contenido, usuarioConectado);
  } else if (opcion === "Compras") {
    mostrarComprasAdmin(contenido, usuarioConectado);
  } else if (opcion === "Reportes") {
    mostrarReportes(contenido);
  } else if (opcion === "Usuarios") {
    mostrarUsuarios(contenido);
  } else {
    contenido.innerHTML =
      "<h2>" + opcion + "</h2>" +
      "<p>Esta sección todavía no está disponible.</p>";
  }
}

function mostrarInicio() {
  const rol = ROLES[usuarioConectado.rol];

  // Saludo + un párrafo corto con lo que puede hacer ese rol
  contenido.innerHTML =
    "<h2>Bienvenido(a), " + rol.nombre + "</h2>" +
    '<p class="parrafo-inicio">' + rol.parrafo + "</p>";
}

// =====================================================================
// 6. ARRANQUE
// =====================================================================
formIngreso.addEventListener("submit", ingresar);

botonMenu.addEventListener("click", abrirMenu);
document.getElementById("cerrarMenu").addEventListener("click", cerrarMenu);
fondoMenu.addEventListener("click", cerrarMenu);
botonAtras.addEventListener("click", atras);
document.addEventListener("keydown", function (evento) {
  if (evento.key === "Escape") {
    cerrarMenu();    // Esc cierra el menú
    cerrarDesplegables();  // y los del encabezado
  }
});

// Los desplegables del encabezado (menú y cuenta) se cierran al
// elegir algo, al tocar afuera o con Esc. "menosEste" se queda abierto.
function cerrarDesplegables(menosEste) {
  for (const d of document.querySelectorAll(".encabezado details[open]")) {
    if (d !== menosEste) d.open = false;
  }
}
document.addEventListener("click", function (evento) {
  cerrarDesplegables(evento.target.closest(".encabezado details"));
});

// El logo lleva al inicio
document.getElementById("botonLogo").addEventListener("click", function () {
  if (usuarioConectado) irA("Inicio", true);
});

escucharSesion(function (usuario) {
  if (usuario && ROLES[usuario.rol]) {
    usuarioConectado = usuario;
    mostrarPanel();
  } else if (usuario) {
    usuarioConectado = null;
    cerrarSesion();
    mensajeError.textContent = "Este usuario no tiene un rol asignado en RUTA.";
    mensajeError.classList.remove("oculto");
    mostrarIngreso();
  } else {
    usuarioConectado = null;
    mostrarIngreso();
  }
});
