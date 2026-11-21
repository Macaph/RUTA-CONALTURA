/*
  MIS ELEMENTOS ASIGNADOS (Vendedor)
  Muestra los elementos de los que el Vendedor es responsable
  (los que tienen "Responsable: Vendedor"), agrupados por sala
  o apartamento modelo, con un botón para reportar novedades.
*/

import { leerInventario, leerTraslados, mensajeDeError } from "./datos.js";
import { escapar, normalizar, mostrarCargando, etiquetaAprobacion, aprobacionDe, ESTADOS, UBICACIONES } from "./utilidades.js";
import { codigosEnTraslado } from "./traslados.js";

// Qué valor de "Responsable" corresponde a cada rol
const RESPONSABLE_DEL_ROL = {
  vendedor: "Vendedor",
  bodeguista: "Bodeguista",
  coordinador: "Coordinador de sala",
  compras: "Compras",
  administrador: "Administrador"
};

// alReportar(codigo) lo manda app.js: abre "Reportar novedad" con ese elemento
export async function mostrarMisElementos(contenido, usuario, alReportar) {
  const responsable = RESPONSABLE_DEL_ROL[usuario.rol];
  contenido.innerHTML = "<h2>Mis elementos asignados</h2>" + mostrarCargando("Buscando tus elementos...");

  let inventario, traslados;
  try {
    const r = await Promise.all([leerInventario(), leerTraslados()]);
    inventario = r[0];
    traslados = r[1];
  } catch (error) {
    contenido.innerHTML = "<h2>Mis elementos asignados</h2>" +
      '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
    return;
  }

  const mios = inventario.filter(function (el) { return el.responsable === responsable; });
  const enTraslado = codigosEnTraslado(traslados);

  let html = "<h2>Mis elementos asignados</h2>" +
    "<p>Elementos de los que eres responsable como <b>" + escapar(responsable) + "</b>.</p>";

  if (mios.length === 0) {
    contenido.innerHTML = html +
      '<p class="vacio">No tienes elementos asignados todavía. Cuando registres un elemento, ' +
      "elige <b>Responsable: " + escapar(responsable) + "</b> para que aparezca aquí.</p>";
    return;
  }

  // Resumen: total, cuántos en cada estado y cuántos pendientes
  html += '<div class="resumen"><div class="cuadro">Total<br><b>' + mios.length + "</b></div>";
  for (const est of ESTADOS) {
    const n = mios.filter(function (el) { return el.estado === est; }).length;
    html += '<div class="cuadro estado-' + normalizar(est) + '">' + est + "<br><b>" + n + "</b></div>";
  }
  const pendientes = mios.filter(function (el) { return aprobacionDe(el) === "Pendiente"; }).length;
  html += '<div class="cuadro aprobacion-pendiente">⏳ Pendientes<br><b>' + pendientes + "</b></div></div>";

  // Una tabla por cada sala o apartamento modelo
  for (const ubic of UBICACIONES) {
    const deAqui = mios.filter(function (el) { return el.ubicacion === ubic; });
    if (deAqui.length === 0) continue;

    html += "<h3>" + escapar(ubic) + " (" + deAqui.length + ")</h3>" +
      '<div class="tabla-scroll"><table><thead><tr>' +
      "<th>Foto</th><th>Código</th><th>Nombre</th><th>Categoría</th><th>Estado</th><th>Aprobación</th><th></th>" +
      "</tr></thead><tbody>";

    for (const el of deAqui) {
      const fotoValida = typeof el.foto === "string" && el.foto.startsWith("data:image/");
      const foto = fotoValida
        ? '<img class="miniatura" src="' + el.foto + '" alt="Foto de ' + escapar(el.nombre) + '">'
        : '<span class="sin-foto">Sin foto</span>';

      // Se puede reportar si está en una sala (no en bodega) y no va en un traslado
      let accion;
      if (enTraslado.includes(el.codigo)) {
        accion = '<span class="en-traslado">🚚 En traslado</span>';
      } else if (el.ubicacion === "Bodega central") {
        accion = "—";
      } else {
        accion = '<button class="boton boton-mini boton-secundario" data-reportar="' + escapar(el.codigo) + '">⚠️ Reportar</button>';
      }

      html += "<tr>" +
        "<td>" + foto + "</td>" +
        '<td class="col-codigo">' + escapar(el.codigo) + "</td>" +
        "<td>" + escapar(el.nombre) + "</td>" +
        "<td>" + escapar(el.categoria) + "</td>" +
        '<td><span class="estado estado-' + normalizar(el.estado) + '">' + escapar(el.estado) + "</span></td>" +
        "<td>" + etiquetaAprobacion(el) + "</td>" +
        "<td>" + accion + "</td>" +
        "</tr>";
    }
    html += "</tbody></table></div>";
  }

  contenido.innerHTML = html;

  // Botones "Reportar": abren Reportar novedad con el elemento ya escogido
  contenido.querySelectorAll("[data-reportar]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      alReportar(boton.dataset.reportar);
    });
  });
}
