/*
  LÓGICA PRINCIPAL DEL RUTA: ingreso, roles y menú
  Aquí decimos QUÉ HACE la página cuando alguien interactúa con ella.

  Orden de la cartelera:
    RUTA -> Página web -> Roles -> (Vendedor, Bodeguista, Administrador,
    Compras, Coordinador) -> Inventario

  Los usuarios y contraseñas ya NO están aquí: viven en Firebase
  Authentication. El rol sale del correo (vendedor@conaltura.com -> vendedor).
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
import { mostrarNovedad, mostrarRevisarCompras, mostrarRegistrarCompra, mostrarComprasAdmin } from "./compras.js";
import { mostrarReportes, mostrarUsuarios } from "./reportes.js";

// =====================================================================
// 1. LOS ROLES Y SUS FUNCIONES (tal como están en las notas adhesivas)
// =====================================================================
// Cada rol tiene un nombre, una descripción y una lista de opciones
// de menú. Cada opción es una cosa que ese rol puede hacer.
const ROLES = {
  vendedor: {
    nombre: "Vendedor",
    descripcion: "Usa la sala de ventas con los clientes y sube el inventario de su sala.",
    // Lo que se muestra en la pantalla de Inicio
    bienvenida: "Desde tu sala de ventas o apartamento modelo puedes:",
    puedeHacer: [
      "Registrar el inventario de tu sala, a mano o cargando un Excel.",
      "Consultar qué elementos hay, en qué estado están y por dónde han pasado.",
      "Pedir elementos de otra sala o de la bodega.",
      "Reportar si algo se daña o se pierde, y pedir su reposición."
    ],
    opciones: ["Ver inventario", "Registrar elementos", "Solicitar elementos", "Reportar novedad"]
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
    opciones: ["Ver inventario", "Registrar elementos", "Enviar / Recibir traslados", "Informar traslados"]
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
    opciones: ["Ver inventario", "Registrar elementos", "Aprobar inventario", "Traslados", "Compras", "Reportes", "Usuarios"]
  },
  compras: {
    nombre: "Compras",
    descripcion: "Revisa si lo que piden ya existe para reutilizarlo; si no, compra y registra.",
    bienvenida: "Desde compras puedes:",
    puedeHacer: [
      "Revisar si lo que piden las salas ya existe, para reutilizarlo antes de comprar.",
      "Aprobar compras y registrar lo que llega, con su valor.",
      "Consultar cuánto se ha gastado y qué se puede reutilizar."
    ],
    opciones: ["Ver inventario", "Revisar solicitudes de compra", "Registrar compra", "Reportes"]
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
    opciones: ["Ver inventario", "Aprobar inventario", "Aprobar solicitudes", "Reportes"]
  }
};

// =====================================================================
// 2. TOMAMOS LOS ELEMENTOS DEL HTML QUE VAMOS A USAR
// =====================================================================
// document.getElementById busca en el HTML la etiqueta con ese id.
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

// Aquí guardamos quién está conectado: {correo, rol}
let usuarioConectado = null;

// =====================================================================
// 3. INGRESAR Y SALIR
// =====================================================================
async function ingresar(evento) {
  // Evita que el formulario recargue la página (es lo que hace por defecto)
  evento.preventDefault();
  mensajeError.classList.add("oculto");
  botonIngresar.disabled = true;
  botonIngresar.textContent = "Ingresando...";

  try {
    // Firebase revisa el usuario y la contraseña.
    // Si están bien, "escucharSesion" (abajo) se entera y muestra el panel.
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
  await cerrarSesion(); // "escucharSesion" se entera y muestra el ingreso
}

// =====================================================================
// 4. MOSTRAR LA PANTALLA CORRECTA SEGÚN LA SESIÓN
// =====================================================================
function mostrarIngreso() {
  document.body.classList.add("en-ingreso");     // imagen de fondo visible
  pantallaCargando.classList.add("oculto");
  pantallaPanel.classList.add("oculto");
  cajaUsuario.classList.add("oculto");
  pantallaIngreso.classList.remove("oculto");
}

function mostrarPanel() {
  const rol = ROLES[usuarioConectado.rol];
  document.body.classList.remove("en-ingreso");  // sin imagen de fondo adentro

  // Escondemos el ingreso y mostramos el panel
  pantallaCargando.classList.add("oculto");
  pantallaIngreso.classList.add("oculto");
  pantallaPanel.classList.remove("oculto");

  // Arriba a la derecha: rol conectado y botón Salir
  cajaUsuario.classList.remove("oculto");
  cajaUsuario.innerHTML =
    "<span>Conectado como</span>" +
    '<span class="etiqueta-rol rol-' + usuarioConectado.rol + '">' + rol.nombre + "</span>" +
    '<button class="boton boton-claro" id="botonSalir">Salir</button>';
  document.getElementById("botonSalir").addEventListener("click", salir);

  // Armamos el menú lateral: un botón por cada opción del rol
  menu.innerHTML = "";
  menu.appendChild(crearBotonMenu("Inicio"));
  for (const opcion of rol.opciones) {
    menu.appendChild(crearBotonMenu(opcion));
  }

  // Al entrar, empezamos en Inicio y sin historial
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
// "historial" guarda las pantallas por las que pasó el usuario,
// como las migas de pan: Atrás saca la última y vuelve a ella.
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

// Va a una pantalla. Si "guardar" es true, la actual queda en el historial.
function irA(opcion, guardar) {
  if (guardar && opcionActual && opcionActual !== opcion) {
    historial.push(opcionActual);
  }
  opcionActual = opcion;

  // Marcamos en el menú la opción activa
  for (const b of menu.querySelectorAll("button")) {
    b.classList.toggle("activo", b.dataset.opcion === opcion);
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
// 5. QUÉ SE MUESTRA EN CADA OPCIÓN DEL MENÚ
// =====================================================================
function abrirOpcion(opcion) {
  if (opcion === "Inicio") {
    mostrarInicio();
  } else if (opcion === "Ver inventario") {
    mostrarVerInventario(contenido, usuarioConectado);   // está en js/inventario.js
  } else if (opcion === "Registrar elementos") {
    mostrarRegistrar(contenido, usuarioConectado);       // está en js/inventario.js
  } else if (opcion === "Aprobar inventario") {
    mostrarAprobar(contenido, usuarioConectado);         // está en js/aprobaciones.js
  } else if (opcion === "Solicitar elementos") {
    mostrarSolicitar(contenido, usuarioConectado);           // los 5 están en js/traslados.js
  } else if (opcion === "Aprobar solicitudes") {
    mostrarAprobarSolicitudes(contenido, usuarioConectado);
  } else if (opcion === "Enviar / Recibir traslados") {
    mostrarEnviarRecibir(contenido, usuarioConectado);
  } else if (opcion === "Informar traslados") {
    mostrarInformeTraslados(contenido, usuarioConectado);
  } else if (opcion === "Traslados") {
    mostrarTrasladosAdmin(contenido, usuarioConectado);
  } else if (opcion === "Reportar novedad") {
    mostrarNovedad(contenido, usuarioConectado);             // los 4 están en js/compras.js
  } else if (opcion === "Revisar solicitudes de compra") {
    mostrarRevisarCompras(contenido, usuarioConectado);
  } else if (opcion === "Registrar compra") {
    mostrarRegistrarCompra(contenido, usuarioConectado);
  } else if (opcion === "Compras") {
    mostrarComprasAdmin(contenido, usuarioConectado);
  } else if (opcion === "Reportes") {
    mostrarReportes(contenido);                              // js/reportes.js
  } else if (opcion === "Usuarios") {
    mostrarUsuarios(contenido);                              // js/reportes.js
  } else {
    // Las demás opciones las construimos en los siguientes pasos
    contenido.innerHTML =
      "<h2>" + opcion + "</h2>" +
      "<p>Esta sección la construimos en el siguiente paso. 🚧</p>";
  }
}

function mostrarInicio() {
  const rol = ROLES[usuarioConectado.rol];

  let html = "<h2>Bienvenido(a), " + rol.nombre + "</h2>";
  html += '<p class="bienvenida">' + rol.bienvenida + "</p>";
  html += '<ul class="lista-inicio">';
  for (const frase of rol.puedeHacer) {
    html += "<li>" + frase + "</li>";
  }
  html += "</ul>";
  html += '<p class="ayuda-menu">Abre el menú <b>☰</b> para empezar.</p>';

  contenido.innerHTML = html;
}

// =====================================================================
// 6. ARRANQUE: esto se ejecuta apenas se abre la página
// =====================================================================
// "submit" pasa al dar clic en Ingresar o al presionar Enter
formIngreso.addEventListener("submit", ingresar);

// Menú hamburguesa y botón Atrás
botonMenu.addEventListener("click", abrirMenu);
document.getElementById("cerrarMenu").addEventListener("click", cerrarMenu);
fondoMenu.addEventListener("click", cerrarMenu);
botonAtras.addEventListener("click", atras);
document.addEventListener("keydown", function (evento) {
  if (evento.key === "Escape") cerrarMenu();   // Esc cierra el menú
});

// Firebase nos avisa si hay alguien conectado (también al recargar la página)
escucharSesion(function (usuario) {
  if (usuario && ROLES[usuario.rol]) {
    usuarioConectado = usuario;
    mostrarPanel();
  } else if (usuario) {
    // Entró alguien con un correo que no es de ningún rol: lo sacamos
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
