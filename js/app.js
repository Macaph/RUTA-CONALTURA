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
  mostrarInformeTraslados,
  mostrarTrasladosAdmin
} from "./traslados.js";
import {
  mostrarNovedad,
  mostrarRevisarCompras,
  mostrarRegistrarCompra,
  mostrarComprasAdmin,
  preseleccionarNovedad
} from "./compras.js";
import { mostrarMisElementos } from "./mis-elementos.js";
import { mostrarReportes, mostrarUsuarios } from "./reportes.js";
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
    bienvenida: "Desde la bodega puedes:",
    puedeHacer: [
      "Registrar lo que llega y lo que se guarda en la bodega.",
      "Despachar los traslados aprobados y confirmar cuando llegan a su destino.",
      "Consultar el inventario y el historial de todos los traslados."
    ],
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
    bienvenida: "Como administrador puedes:",
    puedeHacer: [
      "Ver y controlar el inventario de todas las salas, apartamentos modelo y la bodega.",
      "Registrar elementos, que quedan aprobados de una vez.",
      "Gestionar traslados y compras, y consultar los reportes.",
      "Ver qué puede hacer cada rol en el sistema."
    ],
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
    bienvenida: "Desde Administración de Activos y Adquisiciones puedes:",
    puedeHacer: [
      "Revisar las solicitudes de compra antes de realizar una nueva adquisición.",
      "Registrar las adquisiciones y crear los activos en el inventario.",
      "Consultar y actualizar la información básica de los activos.",
      "Gestionar saldos y bajas sin perder la trazabilidad.",
      "Consultar la valoración operativa por proyecto y agrupación."
    ],
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
    bienvenida: "Como coordinador de las salas puedes:",
    puedeHacer: [
      "Revisar y aprobar el inventario que registran las salas, la bodega y compras.",
      "Aprobar o rechazar los traslados entre salas, apartamentos modelo y bodega.",
      "Consultar los reportes del estado de cada espacio."
    ],
    opciones: [
      "Ver inventario",
      "Aprobar inventario",
      "Aprobar solicitudes",
      "Reportes"
    ]
  }
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
  cajaUsuario.innerHTML =
    "<span>Conectado como</span>" +
    '<span class="etiqueta-rol rol-' + usuarioConectado.rol + '">' + rol.nombre + "</span>" +
    '<button class="boton boton-claro" id="botonSalir">Salir</button>';
  document.getElementById("botonSalir").addEventListener("click", salir);

  menu.innerHTML = "";
  menu.appendChild(crearBotonMenu("Inicio"));
  for (const opcion of rol.opciones) {
    menu.appendChild(crearBotonMenu(opcion));
  }

  historial = [];
  opcionActual = null;
  irA("Inicio", false);
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

  for (const boton of menu.querySelectorAll("button")) {
    boton.classList.toggle("activo", boton.dataset.opcion === opcion);
  }

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
    mostrarInformeTraslados(contenido, usuarioConectado);
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

  let html = "<h2>Bienvenido(a), " + rol.nombre + "</h2>";
  if (rol.parrafo) {
    html += '<p class="parrafo-inicio">' + rol.parrafo + "</p>";
  } else {
    html += '<p class="bienvenida">' + rol.bienvenida + "</p>";
    html += '<ul class="lista-inicio">';
    for (const frase of rol.puedeHacer) {
      html += "<li>" + frase + "</li>";
    }
    html += "</ul>";
  }
  html += '<p class="ayuda-menu">Abre el menú <b>☰</b> para empezar.</p>';

  contenido.innerHTML = html;
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
  if (evento.key === "Escape") cerrarMenu();
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
