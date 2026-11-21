/*
  APROBACIÓN DEL INVENTARIO (Coordinador y Administrador)
  Resuelve una parte del reto: "no hay un proceso formal para aprobar
  el inventario".

  Flujo:
    Vendedor / Bodeguista registran  ->  queda ⏳ Pendiente
    Coordinador revisa               ->  ✅ Aprobado  o  ❌ Rechazado (con motivo)
    Si lo rechazan, se corrige y se vuelve a subir -> queda Pendiente otra vez
*/

import { leerInventario, decidirAprobacion, mensajeDeError } from "./datos.js";
import { escapar, mostrarCargando, aprobacionDe } from "./utilidades.js";

let usuario = null;
let pendientes = [];

export async function mostrarAprobar(cajaContenido, usuarioConectado) {
  usuario = usuarioConectado;

  cajaContenido.innerHTML =
    "<h2>Aprobar inventario</h2>" +
    "<p>Estos elementos los registró el Vendedor o el Bodeguista y esperan tu revisión. " +
    "Revisa que existan y que el estado sea el real.</p>" +
    '<div id="zonaAprobar">' + mostrarCargando("Buscando pendientes...") + "</div>";

  try {
    const inventario = await leerInventario();
    pendientes = inventario.filter(function (el) { return aprobacionDe(el) === "Pendiente"; });
    dibujarPendientes();
  } catch (error) {
    document.getElementById("zonaAprobar").innerHTML =
      '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
  }
}

function dibujarPendientes() {
  const zona = document.getElementById("zonaAprobar");
  if (!zona) return; // por si ya cambiaron de pantalla

  if (pendientes.length === 0) {
    zona.innerHTML = '<p class="vacio">🎉 No hay nada pendiente por aprobar.</p>';
    return;
  }

  let html =
    '<p><b id="contadorSeleccion">0</b> de ' + pendientes.length + " seleccionados</p>" +
    '<div class="fila-botones">' +
    '  <button id="botonAprobar" class="boton boton-aprobar" disabled>✅ Aprobar seleccionados</button>' +
    '  <button id="botonRechazar" class="boton boton-peligro" disabled>❌ Rechazar seleccionados</button>' +
    "</div>" +
    '<div id="resultadoAprobacion"></div>' +
    '<div class="tabla-scroll"><table><thead><tr>' +
    '<th><input type="checkbox" id="seleccionarTodos" title="Seleccionar todos"></th>' +
    "<th>Foto</th><th>Código</th><th>Nombre</th><th>Categoría</th>" +
    "<th>Ubicación</th><th>Estado</th><th>Registrado por</th><th>Observaciones</th>" +
    "</tr></thead><tbody>";

  for (const el of pendientes) {
    const fotoValida = typeof el.foto === "string" && el.foto.startsWith("data:image/");
    const foto = fotoValida
      ? '<img class="miniatura" src="' + el.foto + '" alt="Foto de ' + escapar(el.nombre) + '">'
      : '<span class="sin-foto">Sin foto</span>';
    html += "<tr>" +
      '<td><input type="checkbox" class="casilla" value="' + escapar(el.codigo) + '"></td>' +
      "<td>" + foto + "</td>" +
      "<td class=\"col-codigo\">" + escapar(el.codigo) + "</td>" +
      "<td>" + escapar(el.nombre) + "</td>" +
      "<td>" + escapar(el.categoria) + "</td>" +
      "<td>" + escapar(el.ubicacion) + "</td>" +
      "<td>" + escapar(el.estado) + "</td>" +
      "<td>" + escapar(el.actualizadoPor || "—") + "</td>" +
      "<td>" + escapar(el.observaciones) + "</td>" +
      "</tr>";
  }
  html += "</tbody></table></div>";
  zona.innerHTML = html;

  // Casillas: actualizar el contador y activar/desactivar los botones
  const todos = document.getElementById("seleccionarTodos");
  todos.addEventListener("change", function () {
    for (const c of document.querySelectorAll(".casilla")) c.checked = todos.checked;
    actualizarSeleccion();
  });
  for (const c of document.querySelectorAll(".casilla")) {
    c.addEventListener("change", actualizarSeleccion);
  }

  document.getElementById("botonAprobar").addEventListener("click", function () {
    decidir("Aprobado", "");
  });
  document.getElementById("botonRechazar").addEventListener("click", function () {
    const motivo = prompt("¿Por qué se rechazan? (este motivo lo verá quien los registró)");
    if (motivo === null) return; // canceló
    if (motivo.trim() === "") {
      alert("Para rechazar hay que escribir el motivo.");
      return;
    }
    decidir("Rechazado", motivo.trim().slice(0, 200));
  });
}

function codigosSeleccionados() {
  const lista = [];
  for (const c of document.querySelectorAll(".casilla:checked")) lista.push(c.value);
  return lista;
}

function actualizarSeleccion() {
  const cantidad = codigosSeleccionados().length;
  document.getElementById("contadorSeleccion").textContent = cantidad;
  document.getElementById("botonAprobar").disabled = cantidad === 0;
  document.getElementById("botonRechazar").disabled = cantidad === 0;
}

async function decidir(decision, motivo) {
  const codigos = codigosSeleccionados();
  const resultado = document.getElementById("resultadoAprobacion");
  document.getElementById("botonAprobar").disabled = true;
  document.getElementById("botonRechazar").disabled = true;
  resultado.innerHTML = mostrarCargando("Guardando...");

  try {
    await decidirAprobacion(codigos, decision, motivo, usuario.rol);
    // Quitamos de la lista los que ya se decidieron y redibujamos
    pendientes = pendientes.filter(function (el) { return !codigos.includes(el.codigo); });
    dibujarPendientes();
    const zona = document.getElementById("zonaAprobar");
    const aviso = document.createElement("p");
    aviso.className = "exito";
    aviso.textContent = (decision === "Aprobado" ? "✅ Aprobados: " : "❌ Rechazados: ") + codigos.length + ".";
    zona.prepend(aviso);
  } catch (error) {
    resultado.innerHTML = '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
    actualizarSeleccion();
  }
}
