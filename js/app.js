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
    opciones: ["Ver inventario", "Registrar elementos", "Solicitar elementos", "Reportar novedad"]
  },
  bodeguista: {
    nombre: "Bodeguista",
    descripcion: "Gestiona la bodega, envía y recibe elementos.",
    opciones: ["Ver inventario", "Registrar elementos", "Enviar / Recibir traslados", "Informar traslados"]
  },
  administrador: {
    nombre: "Administrador",
    descripcion: "Acceso completo y control del sistema.",
    opciones: ["Ver inventario", "Registrar elementos", "Aprobar inventario", "Traslados", "Compras", "Reportes", "Usuarios"]
  },
  compras: {
    nombre: "Compras",
    descripcion: "Revisa si lo que piden ya existe para reutilizarlo; si no, compra y registra.",
    opciones: ["Ver inventario", "Revisar solicitudes de compra", "Registrar compra", "Reportes"]
  },
  coordinador: {
    nombre: "Coordinador",
    descripcion: "Está a cargo de la sala: aprueba el inventario y las solicitudes.",
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

  // Arriba a la derecha: rol conectado (con su color) y botón Salir
  cajaUsuario.classList.remove("oculto");
  cajaUsuario.innerHTML =
    "<span>Conectado como</span>" +
    '<span class="etiqueta-rol rol-' + usuarioConectado.rol + '">' + rol.nombre + "</span>" +
    '<button class="boton boton-claro" id="botonSalir">Salir</button>';
  document.getElementById("botonSalir").addEventListener("click", salir);

  // Armamos el menú: un botón por cada opción del rol
  menu.innerHTML = "";
  const botonInicio = crearBotonMenu("Inicio");
  menu.appendChild(botonInicio);
  for (const opcion of rol.opciones) {
    menu.appendChild(crearBotonMenu(opcion));
  }

  // Al entrar, mostramos la bienvenida
  botonInicio.click();
}

function crearBotonMenu(texto) {
  const boton = document.createElement("button");
  boton.textContent = texto;

  boton.addEventListener("click", function () {
    // Marcamos este botón como el activo y desmarcamos los demás
    for (const b of menu.querySelectorAll("button")) {
      b.classList.remove("activo");
    }
    boton.classList.add("activo");

    abrirOpcion(texto);
  });

  return boton;
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
  html += "<p>" + rol.descripcion + "</p>";
  html += "<p>Esto es lo que puedes hacer en RUTA:</p>";
  html += '<ul class="funciones">';
  for (const opcion of rol.opciones) {
    html += '<li class="rol-' + usuarioConectado.rol + '">' + opcion + "</li>";
  }
  html += "</ul>";

  contenido.innerHTML = html;
}

// =====================================================================
// 6. ARRANQUE: esto se ejecuta apenas se abre la página
// =====================================================================
// "submit" pasa al dar clic en Ingresar o al presionar Enter
formIngreso.addEventListener("submit", ingresar);

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
