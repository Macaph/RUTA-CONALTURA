/*
  VISTA DEL BODEGUISTA: historial de todos los traslados
  Muestra cada traslado con su recorrido completo: quién lo pidió,
  quién lo aprobó o rechazó, quién lo envió y quién lo recibió.

  Es una pantalla de SOLO CONSULTA. Enviar y recibir se hace en
  "Enviar / Recibir traslados" (traslados.js).
*/

import { leerTraslados, mensajeDeError } from "./datos.js";
import { escapar, normalizar, mostrarCargando, fecha, opciones } from "./utilidades.js";
import { ESTADOS_TRASLADO, etiquetaTraslado, exportarTraslados } from "./traslados.js";

// Una línea del recorrido, ej: "Envió: bodeguista · 20/11/26, 9:00 a. m."
// Si ese paso todavía no ha pasado, no muestra nada.
function paso(texto, quien, cuando) {
  if (!quien) return "";
  return '<div class="detalle">' + texto + ": <b>" + escapar(quien) + "</b> · " + fecha(cuando) + "</div>";
}

function tablaHistorial(lista) {
  if (lista.length === 0) return '<p class="vacio">No hay traslados que coincidan.</p>';

  let html = '<div class="tabla-scroll"><table><thead><tr>' +
    "<th>Elemento</th><th>Desde → Hacia</th><th>Motivo</th><th>Estado</th><th>Recorrido</th>" +
    "</tr></thead><tbody>";

  for (const t of lista) {
    const decision = t.estado === "Rechazado" ? "Rechazó" : "Aprobó";
    html += "<tr>" +
      '<td><span class="col-codigo">' + escapar(t.codigoElemento) + "</span><br>" + escapar(t.nombreElemento) + "</td>" +
      "<td>" + escapar(t.origen) + " <b>→</b> " + escapar(t.destino) + "</td>" +
      "<td>" + escapar(t.motivo) + "</td>" +
      "<td>" + etiquetaTraslado(t) + "</td>" +
      "<td>" +
        paso("Solicitó", t.solicitadoPor, t.solicitadoEn) +
        paso(decision, t.aprobadoPor, t.aprobadoEn) +
        paso("Envió", t.enviadoPor, t.enviadoEn) +
        paso("Recibió", t.recibidoPor, t.recibidoEn) +
      "</td>" +
      "</tr>";
  }
  return html + "</tbody></table></div>";
}

// Bodeguista -> "Informar traslados"
export async function mostrarHistorialBodega(contenido) {
  contenido.innerHTML = "<h2>Informe de traslados</h2>" + mostrarCargando("Cargando traslados...");

  let traslados;
  try {
    traslados = await leerTraslados();
  } catch (error) {
    contenido.innerHTML = "<h2>Informe de traslados</h2>" +
      '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
    return;
  }

  contenido.innerHTML =
    "<h2>Informe de traslados</h2>" +
    '<div class="filtros">' +
    '  <input id="buscarTraslado" placeholder="Buscar por código, elemento o ubicación">' +
    '  <select id="filtroTraslado">' + opciones(ESTADOS_TRASLADO, "Todos los estados") + "</select>" +
    '  <button id="botonExportarTraslados" class="boton">⬇ Descargar Excel</button>' +
    "</div>" +
    '<div id="tablaHistorial"></div>';

  const buscador = document.getElementById("buscarTraslado");
  const filtro = document.getElementById("filtroTraslado");
  const tabla = document.getElementById("tablaHistorial");
  let visibles = traslados;

  function redibujar() {
    const texto = normalizar(buscador.value);
    visibles = traslados.filter(function (t) {
      const dondeBuscar = [t.codigoElemento, t.nombreElemento, t.origen, t.destino].join(" ");
      return normalizar(dondeBuscar).includes(texto) && (!filtro.value || t.estado === filtro.value);
    });
    tabla.innerHTML = tablaHistorial(visibles);
  }

  buscador.addEventListener("input", redibujar);
  filtro.addEventListener("change", redibujar);
  // El Excel lleva lo mismo que se está viendo (respeta los filtros)
  document.getElementById("botonExportarTraslados").addEventListener("click", function () {
    exportarTraslados(visibles);
  });
  redibujar();
}
