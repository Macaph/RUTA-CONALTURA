/*
  SOLICITUDES Y TRASLADOS (PASO 3)
  Resuelve otra parte del reto: "los traslados entre salas o hacia la
  bodega no siempre se documentan".

  Flujo (cada paso lo hace un rol distinto):
    1. Vendedor solicita un elemento   ->  📝 Solicitado
    2. Coordinador aprueba o rechaza   ->  ✅ Aprobado  /  ❌ Rechazado
    3. Bodeguista lo envía             ->  🚚 En tránsito
    4. Bodeguista lo recibe            ->  📦 Recibido (y el elemento cambia de ubicación solo)
  Aprobar o rechazar es SOLO del Coordinador (ni siquiera el Administrador).
  El Administrador puede solicitar, enviar y recibir.

  Todo queda guardado: así cada elemento tiene su historial.
*/

import { leerInventario, leerTraslados, crearSolicitud, avanzarTraslado, mensajeDeError } from "./datos.js";
import { escapar, normalizar, mostrarCargando, aprobacionDe, fecha, UBICACIONES } from "./utilidades.js";

const ESTADOS_TRASLADO = ["Solicitado", "Aprobado", "En tránsito", "Recibido", "Rechazado"];
const ICONOS = { "Solicitado": "📝", "Aprobado": "✅", "En tránsito": "🚚", "Recibido": "📦", "Rechazado": "❌" };

// Estados en los que el traslado sigue "abierto"
const ACTIVOS = ["Solicitado", "Aprobado", "En tránsito"];

let usuario = null;
let contenido = null;
let traslados = [];
let inventario = [];
let pantallaActual = null; // para volver a dibujar después de una acción

// =====================================================================
// 1. AYUDANTES
// =====================================================================
function etiquetaTraslado(t) {
  let html = '<span class="traslado traslado-' + normalizar(t.estado).replace(" ", "-") + '">' +
    ICONOS[t.estado] + " " + escapar(t.estado) + "</span>";
  if (t.estado === "Rechazado" && t.motivoRechazo) {
    html += '<div class="motivo">Motivo: ' + escapar(t.motivoRechazo) + "</div>";
  }
  return html;
}

// ¿Qué botones ve este rol para este traslado?
function accionesPermitidas(t) {
  const rol = usuario.rol;
  if (t.estado === "Solicitado" && rol === "coordinador") return ["aprobar", "rechazar"];
  if (t.estado === "Aprobado" && (rol === "bodeguista" || rol === "administrador")) return ["enviar"];
  if (t.estado === "En tránsito" && (rol === "bodeguista" || rol === "administrador")) return ["recibir"];
  return [];
}

const BOTONES = {
  aprobar:  '<button class="boton boton-mini boton-aprobar" data-accion="aprobar">✅ Aprobar</button>',
  rechazar: '<button class="boton boton-mini boton-peligro" data-accion="rechazar">❌ Rechazar</button>',
  enviar:   '<button class="boton boton-mini" data-accion="enviar">🚚 Enviar</button>',
  recibir:  '<button class="boton boton-mini boton-aprobar" data-accion="recibir">📦 Recibir</button>'
};

// Dibuja una tabla de traslados (con botones si el rol puede actuar)
function tablaTraslados(lista, textoVacio) {
  if (lista.length === 0) return '<p class="vacio">' + textoVacio + "</p>";

  let html = '<div class="tabla-scroll"><table><thead><tr>' +
    "<th>Solicitado</th><th>Elemento</th><th>Desde → Hacia</th><th>Motivo</th>" +
    "<th>Estado</th><th>Solicitó</th><th>Acciones</th>" +
    "</tr></thead><tbody>";

  for (const t of lista) {
    let botones = "";
    for (const accion of accionesPermitidas(t)) botones += BOTONES[accion];

    html += '<tr data-id="' + escapar(t.id) + '">' +
      "<td>" + fecha(t.solicitadoEn) + "</td>" +
      '<td><span class="col-codigo">' + escapar(t.codigoElemento) + "</span><br>" + escapar(t.nombreElemento) + "</td>" +
      "<td>" + escapar(t.origen) + " <b>→</b> " + escapar(t.destino) + "</td>" +
      "<td>" + escapar(t.motivo) + "</td>" +
      "<td>" + etiquetaTraslado(t) + "</td>" +
      "<td>" + escapar(t.solicitadoPor) + "</td>" +
      '<td class="celda-acciones">' + (botones || "—") + "</td>" +
      "</tr>";
  }
  return html + "</tbody></table></div>";
}

// Un solo "escuchador" para todos los botones de acción de la pantalla
function activarBotones() {
  contenido.querySelectorAll("[data-accion]").forEach(function (boton) {
    // Si este botón ya tiene su "escuchador", no le ponemos otro.
    // (Antes se conectaba dos veces y la acción se mandaba doble.)
    if (boton.dataset.conectado) return;
    boton.dataset.conectado = "si";

    boton.addEventListener("click", function () {
      const id = boton.closest("tr").dataset.id;
      const traslado = traslados.find(function (t) { return t.id === id; });
      ejecutarAccion(traslado, boton.dataset.accion, boton);
    });
  });
}

async function ejecutarAccion(traslado, accion, boton) {
  let motivo = "";
  if (accion === "rechazar") {
    motivo = prompt("¿Por qué se rechaza la solicitud?");
    if (motivo === null) return;
    motivo = motivo.trim().slice(0, 200);
    if (!motivo) { alert("Para rechazar hay que escribir el motivo."); return; }
  }
  if (accion === "recibir" &&
      !confirm("¿Confirmas que " + traslado.nombreElemento + " llegó a " + traslado.destino + "?")) {
    return;
  }

  // Mientras se guarda, bloqueamos TODOS los botones de acción
  // para que no se pueda dar doble clic
  contenido.querySelectorAll("[data-accion]").forEach(function (b) { b.disabled = true; });
  boton.textContent = "Guardando...";
  try {
    await avanzarTraslado(traslado, accion, usuario.rol, motivo);
  } catch (error) {
    alert(mensajeDeError(error));
  }
  await pantallaActual(); // volvemos a cargar y dibujar con los datos reales
}

// Carga inventario y traslados al tiempo (Promise.all = las dos a la vez)
async function cargarDatos() {
  const resultados = await Promise.all([leerInventario(), leerTraslados()]);
  inventario = resultados[0];
  traslados = resultados[1];
}

// Envuelve cada pantalla: guarda quién está, muestra "cargando" y maneja errores
function pantalla(dibujar) {
  return async function (cajaContenido, usuarioConectado) {
    contenido = cajaContenido;
    usuario = usuarioConectado;
    pantallaActual = async function () {
      contenido.innerHTML = mostrarCargando("Cargando traslados...");
      try {
        await cargarDatos();
        dibujar();
        activarBotones();
      } catch (error) {
        contenido.innerHTML = '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
      }
    };
    await pantallaActual();
  };
}

// =====================================================================
// 2. FORMULARIO PARA SOLICITAR (Vendedor y Administrador)
// =====================================================================
function formularioSolicitud() {
  // Solo se pueden pedir elementos aprobados y que no estén ya en un traslado
  const ocupados = traslados
    .filter(function (t) { return ACTIVOS.includes(t.estado); })
    .map(function (t) { return t.codigoElemento; });
  const disponibles = inventario.filter(function (el) {
    return aprobacionDe(el) === "Aprobado" && !ocupados.includes(el.codigo);
  });

  if (disponibles.length === 0) {
    return '<div class="bloque"><h3>Nueva solicitud</h3>' +
      '<p class="vacio">No hay elementos disponibles para trasladar (deben estar aprobados y sin otro traslado en curso).</p></div>';
  }

  // Lista agrupada por ubicación (<optgroup>), para encontrar más fácil
  let opcionesElementos = '<option value="">Elige el elemento...</option>';
  for (const ubic of UBICACIONES) {
    const deAqui = disponibles.filter(function (el) { return el.ubicacion === ubic; });
    if (deAqui.length === 0) continue;
    opcionesElementos += '<optgroup label="' + escapar(ubic) + '">';
    for (const el of deAqui) {
      opcionesElementos += '<option value="' + escapar(el.codigo) + '">' +
        escapar(el.codigo + " · " + el.nombre + " (" + el.estado + ")") + "</option>";
    }
    opcionesElementos += "</optgroup>";
  }

  return '<div class="bloque">' +
    "<h3>Nueva solicitud</h3>" +
    '<form id="formSolicitud" class="formulario-grid">' +
    '  <label>Elemento *<select id="solElemento" required>' + opcionesElementos + "</select></label>" +
    '  <label>¿A dónde lo llevamos? *<select id="solDestino" required><option value="">Primero elige el elemento</option></select></label>' +
    '  <label class="ancho-completo">Motivo *<input id="solMotivo" required maxlength="200" placeholder="Ej: se abre la nueva sala del Proyecto 2"></label>' +
    '  <button type="submit" id="botonSolicitar" class="boton ancho-completo">📝 Enviar solicitud</button>' +
    "</form>" +
    '<p id="mensajeSolicitud" class="oculto"></p>' +
    "</div>";
}

function activarFormulario() {
  const form = document.getElementById("formSolicitud");
  if (!form) return;
  const selElemento = document.getElementById("solElemento");
  const selDestino = document.getElementById("solDestino");

  // Al elegir el elemento, el destino no puede ser donde ya está
  selElemento.addEventListener("change", function () {
    const el = inventario.find(function (e) { return e.codigo === selElemento.value; });
    let html = '<option value="">Elige el destino...</option>';
    for (const ubic of UBICACIONES) {
      if (el && ubic !== el.ubicacion) html += '<option value="' + escapar(ubic) + '">' + escapar(ubic) + "</option>";
    }
    selDestino.innerHTML = html;
  });

  form.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const el = inventario.find(function (e) { return e.codigo === selElemento.value; });
    const boton = document.getElementById("botonSolicitar");
    boton.disabled = true;
    try {
      await crearSolicitud({
        codigoElemento: el.codigo,
        nombreElemento: el.nombre,
        origen: el.ubicacion,
        destino: selDestino.value,
        motivo: document.getElementById("solMotivo").value.trim()
      }, usuario.rol);
      await pantallaActual();
      const mensaje = document.getElementById("mensajeSolicitud") || document.createElement("p");
      mensaje.className = "exito";
      mensaje.textContent = "✔ Solicitud enviada. Ahora el Coordinador debe aprobarla.";
      contenido.querySelector("h2").after(mensaje);
    } catch (error) {
      alert(mensajeDeError(error));
      boton.disabled = false;
    }
  });
}

// =====================================================================
// 3. PANTALLAS (una por opción del menú)
// =====================================================================

// Vendedor -> "Solicitar elementos"
export const mostrarSolicitar = pantalla(function () {
  const mias = traslados.filter(function (t) { return t.solicitadoPor === usuario.rol; });
  contenido.innerHTML =
    "<h2>Solicitar elementos</h2>" +
    "<p>Pide un elemento de otra sala o de la bodega. El Coordinador aprueba y el Bodeguista lo lleva.</p>" +
    formularioSolicitud() +
    "<h3>Mis solicitudes</h3>" +
    tablaTraslados(mias, "Aún no has hecho solicitudes.");
  activarFormulario();
});

// Coordinador -> "Aprobar solicitudes"
export const mostrarAprobarSolicitudes = pantalla(function () {
  const porAprobar = traslados.filter(function (t) { return t.estado === "Solicitado"; });
  const decididas = traslados.filter(function (t) { return t.estado !== "Solicitado"; }).slice(0, 10);
  contenido.innerHTML =
    "<h2>Aprobar solicitudes</h2>" +
    "<p>Solicitudes de traslado que esperan tu decisión.</p>" +
    tablaTraslados(porAprobar, "🎉 No hay solicitudes pendientes.") +
    "<h3>Últimas decididas</h3>" +
    tablaTraslados(decididas, "Todavía no hay solicitudes decididas.");
});

// Bodeguista -> "Enviar / Recibir traslados"
export const mostrarEnviarRecibir = pantalla(function () {
  const porEnviar = traslados.filter(function (t) { return t.estado === "Aprobado"; });
  const enCamino = traslados.filter(function (t) { return t.estado === "En tránsito"; });
  contenido.innerHTML =
    "<h2>Enviar / Recibir traslados</h2>" +
    "<h3>🚚 Por enviar (" + porEnviar.length + ")</h3>" +
    "<p>Aprobados por el Coordinador. Dale <b>Enviar</b> cuando el elemento salga.</p>" +
    tablaTraslados(porEnviar, "No hay nada por enviar.") +
    "<h3>📦 En camino (" + enCamino.length + ")</h3>" +
    "<p>Dale <b>Recibir</b> cuando llegue: el elemento cambia de ubicación automáticamente.</p>" +
    tablaTraslados(enCamino, "No hay nada en camino.");
});

// Bodeguista -> "Informar traslados"  /  Administrador -> "Traslados"
function dibujarInforme(conFormulario) {
  return function () {
    contenido.innerHTML =
      "<h2>" + (conFormulario ? "Traslados" : "Informe de traslados") + "</h2>" +
      (conFormulario ? formularioSolicitud() : "") +
      '<div class="filtros">' +
      '  <select id="filtroTraslado"><option value="">Todos los estados</option>' +
      ESTADOS_TRASLADO.map(function (e) { return '<option value="' + e + '">' + ICONOS[e] + " " + e + "</option>"; }).join("") +
      "  </select>" +
      '  <button id="botonExportarTraslados" class="boton">⬇ Descargar Excel</button>' +
      "</div>" +
      '<div id="tablaTraslados"></div>';

    const filtro = document.getElementById("filtroTraslado");
    function redibujar() {
      const lista = traslados.filter(function (t) { return !filtro.value || t.estado === filtro.value; });
      document.getElementById("tablaTraslados").innerHTML = tablaTraslados(lista, "No hay traslados con ese filtro.");
      activarBotones();
    }
    filtro.addEventListener("change", redibujar);
    document.getElementById("botonExportarTraslados").addEventListener("click", exportarTraslados);
    redibujar();
    if (conFormulario) activarFormulario();
  };
}
export const mostrarInformeTraslados = pantalla(dibujarInforme(false));
export const mostrarTrasladosAdmin = pantalla(dibujarInforme(true));

function exportarTraslados() {
  if (traslados.length === 0) { alert("No hay traslados para descargar."); return; }
  const filas = traslados.map(function (t) {
    return {
      "Código": t.codigoElemento,
      "Elemento": t.nombreElemento,
      "Desde": t.origen,
      "Hacia": t.destino,
      "Motivo": t.motivo,
      "Estado": t.estado,
      "Solicitó": t.solicitadoPor,
      "Fecha solicitud": fecha(t.solicitadoEn),
      "Aprobó / Rechazó": t.aprobadoPor || "",
      "Motivo de rechazo": t.motivoRechazo || "",
      "Envió": t.enviadoPor || "",
      "Fecha envío": fecha(t.enviadoEn),
      "Recibió": t.recibidoPor || "",
      "Fecha recibido": fecha(t.recibidoEn)
    };
  });
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = filas.length ? Object.keys(filas[0]).map(function () { return { wch: 18 }; }) : [];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Traslados");
  XLSX.writeFile(libro, "traslados_RUTA_" + new Date().toISOString().slice(0, 10) + ".xlsx");
}

// =====================================================================
// 4. HISTORIAL DE UN ELEMENTO (se usa en "Ver inventario")
// =====================================================================
export function codigosEnTraslado(listaTraslados) {
  return listaTraslados
    .filter(function (t) { return ACTIVOS.includes(t.estado); })
    .map(function (t) { return t.codigoElemento; });
}

export function historialHtml(elemento, listaTraslados) {
  const suyos = listaTraslados.filter(function (t) { return t.codigoElemento === elemento.codigo; });
  let html = '<div class="bloque historial">' +
    '<button class="cerrar" id="cerrarHistorial" title="Cerrar">✕</button>' +
    "<h3>🕓 Historial de " + escapar(elemento.codigo) + " · " + escapar(elemento.nombre) + "</h3>" +
    "<p>Ubicación actual: <b>" + escapar(elemento.ubicacion) + "</b></p>";

  if (suyos.length === 0) {
    return html + '<p class="vacio">Este elemento no ha tenido traslados.</p></div>';
  }

  html += '<ol class="linea-tiempo">';
  for (const t of suyos) {
    html += "<li>" + etiquetaTraslado(t) + " <b>" + escapar(t.origen) + " → " + escapar(t.destino) + "</b><br>" +
      "<small>Solicitó: " + escapar(t.solicitadoPor) + " (" + fecha(t.solicitadoEn) + ")" +
      (t.aprobadoPor ? " · Decidió: " + escapar(t.aprobadoPor) + " (" + fecha(t.aprobadoEn) + ")" : "") +
      (t.enviadoPor ? " · Envió: " + escapar(t.enviadoPor) + " (" + fecha(t.enviadoEn) + ")" : "") +
      (t.recibidoPor ? " · Recibió: " + escapar(t.recibidoPor) + " (" + fecha(t.recibidoEn) + ")" : "") +
      "<br>Motivo: " + escapar(t.motivo) + "</small></li>";
  }
  return html + "</ol></div>";
}
