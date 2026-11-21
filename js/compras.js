/*
  NOVEDADES Y COMPRAS (PASO 4)
  Resuelve dos partes del reto:
  - "se pierden o se deterioran elementos sin que nadie lo note"
       -> el Vendedor REPORTA NOVEDADES
  - "se compran artículos que ya existen en otra sala"
       -> antes de comprar, RUTA le muestra a Compras lo que ya hay
          para REUTILIZAR

  Flujo de una compra:
    Solicitada -> ♻️ Reutilizada (había uno igual, no se compra)
               -> ✅ Aprobada -> 🛒 Comprada (los elementos entran al inventario)
               -> ❌ Rechazada
*/

import {
  leerInventario, leerTraslados, leerCompras, guardarElementos,
  crearSolicitudCompra, revisarCompra, registrarCompra, mensajeDeError
} from "./datos.js";
import {
  escapar, normalizar, mostrarCargando, aprobacionDe, opciones, fecha, pesos,
  CATEGORIAS, ESTADOS, UBICACIONES
} from "./utilidades.js";
import { codigosEnTraslado } from "./traslados.js";

const ICONOS = { "Solicitada": "📝", "Aprobada": "✅", "Comprada": "🛒", "Reutilizada": "♻️", "Rechazada": "❌" };

let usuario = null;
let contenido = null;
let inventario = [];
let traslados = [];
let compras = [];
let pantallaActual = null;

// Si llegan desde "Mis elementos asignados", aquí queda el código
// del elemento para dejarlo escogido en el formulario de novedad.
let codigoPreseleccionado = "";
export function preseleccionarNovedad(codigo) {
  codigoPreseleccionado = codigo;
}

// =====================================================================
// 1. AYUDANTES
// =====================================================================
async function cargarDatos() {
  const r = await Promise.all([leerInventario(), leerTraslados(), leerCompras()]);
  inventario = r[0];
  traslados = r[1];
  compras = r[2];
}

// Igual que en traslados.js: guarda quién está, muestra "cargando" y maneja errores
function pantalla(dibujar) {
  return async function (cajaContenido, usuarioConectado) {
    contenido = cajaContenido;
    usuario = usuarioConectado;
    pantallaActual = async function (mensajeExito) {
      contenido.innerHTML = mostrarCargando("Cargando...");
      try {
        await cargarDatos();
        dibujar();
        if (mensajeExito) {
          const p = document.createElement("p");
          p.className = "exito";
          p.textContent = mensajeExito;
          contenido.querySelector("h2").after(p);
        }
      } catch (error) {
        contenido.innerHTML = '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
      }
    };
    await pantallaActual();
  };
}

function etiquetaCompra(c) {
  let html = '<span class="compra compra-' + normalizar(c.estado) + '">' + ICONOS[c.estado] + " " + escapar(c.estado) + "</span>";
  if (c.motivoRechazo) html += '<div class="motivo">' + escapar(c.motivoRechazo) + "</div>";
  return html;
}

// Siguiente código libre (RUTA-001, RUTA-002...) contando los ya usados
function siguientesCodigos(cantidad) {
  let mayor = 0;
  for (const el of inventario) {
    const n = parseInt(String(el.codigo).replace(/\D/g, ""), 10);
    if (n > mayor) mayor = n;
  }
  const lista = [];
  for (let i = 1; i <= cantidad; i++) lista.push("RUTA-" + String(mayor + i).padStart(3, "0"));
  return lista;
}

// ♻️ EL CORAZÓN DE ESTE PASO:
// busca en el inventario elementos parecidos a lo que quieren comprar.
// Parecido = misma categoría, aprobado, que no esté en mal estado ni en
// traslado. Primero los que coinciden en el nombre y los de la bodega.
function buscarReutilizables(compra) {
  const ocupados = codigosEnTraslado(traslados);
  const palabras = normalizar(compra.nombre).split(/\s+/).filter(function (p) { return p.length >= 4; });

  return inventario
    .filter(function (el) {
      return el.categoria === compra.categoria &&
        aprobacionDe(el) === "Aprobado" &&
        el.estado !== "Malo" &&
        !ocupados.includes(el.codigo) &&
        el.ubicacion !== compra.destino;
    })
    .map(function (el) {
      const nombre = normalizar(el.nombre);
      const coincidencias = palabras.filter(function (p) { return nombre.includes(p); }).length;
      const enBodega = el.ubicacion === "Bodega central" ? 1 : 0;
      return { el: el, puntos: coincidencias * 10 + enBodega * 5 + (el.estado === "Bueno" ? 1 : 0), coincidencias: coincidencias };
    })
    .sort(function (a, b) { return b.puntos - a.puntos; });
}

// Si hay elementos con nombre parecido, solo mostramos esos (⭐).
// Si no hay, mostramos máximo 3 de la misma categoría como idea.
function sugerenciasParaMostrar(compra) {
  const todas = buscarReutilizables(compra);
  const conNombre = todas.filter(function (s) { return s.coincidencias > 0; });
  if (conNombre.length > 0) return { lista: conNombre.slice(0, 5), parecidosEnNombre: true };
  return { lista: todas.slice(0, 3), parecidosEnNombre: false };
}

// Tabla de compras (solo lectura)
function tablaCompras(lista, textoVacio) {
  if (lista.length === 0) return '<p class="vacio">' + textoVacio + "</p>";
  let html = '<div class="tabla-scroll"><table><thead><tr>' +
    "<th>Fecha</th><th>Qué</th><th>Cant.</th><th>Para</th><th>Motivo</th><th>Estado</th><th>Pidió</th><th>Valor</th>" +
    "</tr></thead><tbody>";
  for (const c of lista) {
    const valor = c.estado === "Comprada" ? pesos(c.valorUnitario * c.cantidad) : "—";
    html += "<tr>" +
      "<td>" + fecha(c.solicitadoEn) + "</td>" +
      "<td>" + escapar(c.nombre) + "<br><small>" + escapar(c.categoria) + "</small></td>" +
      "<td>" + escapar(c.cantidad) + "</td>" +
      "<td>" + escapar(c.destino) + "</td>" +
      "<td>" + escapar(c.motivo) + "</td>" +
      "<td>" + etiquetaCompra(c) + "</td>" +
      "<td>" + escapar(c.solicitadoPor) + "</td>" +
      "<td>" + valor + "</td>" +
      "</tr>";
  }
  return html + "</tbody></table></div>";
}

// =====================================================================
// 2. FORMULARIO: NUEVA SOLICITUD DE COMPRA (Vendedor, Compras, Admin)
// =====================================================================
function formularioCompra() {
  return '<div class="bloque">' +
    "<h3>🛒 Solicitar una compra</h3>" +
    "<p>Antes de comprar, Compras revisa si ya existe algo igual para reutilizarlo.</p>" +
    '<form id="formCompra" class="formulario-grid">' +
    '  <label>¿Qué se necesita? *<input id="compNombre" required maxlength="100" placeholder="Ej: Sofá 3 puestos"></label>' +
    '  <label>Categoría *<select id="compCategoria" required>' + opciones(CATEGORIAS, "Elige...") + "</select></label>" +
    '  <label>Cantidad *<input id="compCantidad" type="number" min="1" max="50" value="1" required></label>' +
    '  <label>¿Para dónde? *<select id="compDestino" required>' + opciones(UBICACIONES, "Elige...") + "</select></label>" +
    '  <label class="ancho-completo">Motivo *<input id="compMotivo" required maxlength="300" placeholder="Ej: apertura de la sala del Proyecto 2"></label>' +
    '  <button type="submit" class="boton ancho-completo">📝 Enviar solicitud de compra</button>' +
    "</form></div>";
}

function activarFormularioCompra() {
  const form = document.getElementById("formCompra");
  if (!form) return;
  form.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    form.querySelector("button").disabled = true;
    try {
      await crearSolicitudCompra({
        nombre: document.getElementById("compNombre").value.trim(),
        categoria: document.getElementById("compCategoria").value,
        cantidad: parseInt(document.getElementById("compCantidad").value, 10),
        destino: document.getElementById("compDestino").value,
        motivo: document.getElementById("compMotivo").value.trim()
      }, usuario.rol);
      await pantallaActual("✔ Solicitud de compra enviada. Compras la revisará.");
    } catch (error) {
      alert(mensajeDeError(error));
      form.querySelector("button").disabled = false;
    }
  });
}

// =====================================================================
// 3. VENDEDOR -> "Reportar novedad"
// =====================================================================
export const mostrarNovedad = pantalla(function () {
  // El vendedor reporta lo de las salas y apartamentos (no la bodega)
  const ocupados = codigosEnTraslado(traslados);
  const deSalas = inventario.filter(function (el) {
    return el.ubicacion !== "Bodega central" && !ocupados.includes(el.codigo);
  });

  let opcionesEl = '<option value="">Elige el elemento...</option>';
  for (const ubic of UBICACIONES) {
    const deAqui = deSalas.filter(function (el) { return el.ubicacion === ubic; });
    if (deAqui.length === 0) continue;
    opcionesEl += '<optgroup label="' + escapar(ubic) + '">';
    for (const el of deAqui) {
      opcionesEl += '<option value="' + escapar(el.codigo) + '">' + escapar(el.codigo + " · " + el.nombre + " (hoy: " + el.estado + ")") + "</option>";
    }
    opcionesEl += "</optgroup>";
  }

  const mias = compras.filter(function (c) { return c.solicitadoPor === usuario.rol; });

  contenido.innerHTML =
    "<h2>Reportar novedad</h2>" +
    '<div class="bloque">' +
    "<h3>⚠️ ¿Algo se dañó, se perdió o está en mal estado?</h3>" +
    "<p>El elemento cambia de estado y queda <b>pendiente</b> para que el Coordinador lo confirme.</p>" +
    '<form id="formNovedad" class="formulario-grid">' +
    '  <label>Elemento *<select id="novElemento" required>' + opcionesEl + "</select></label>" +
    '  <label>¿Cómo está ahora? *<select id="novEstado" required>' + opciones(ESTADOS, "Elige...") + "</select></label>" +
    '  <label class="ancho-completo">¿Qué pasó? *<input id="novTexto" required maxlength="200" placeholder="Ej: un cliente regó café sobre el cojín"></label>' +
    '  <label class="ancho-completo check"><input type="checkbox" id="novReponer"> Pedir reposición (crea una solicitud de compra)</label>' +
    '  <button type="submit" class="boton ancho-completo">⚠️ Reportar novedad</button>' +
    "</form></div>" +
    formularioCompra() +
    "<h3>Mis solicitudes de compra</h3>" +
    tablaCompras(mias, "Aún no has pedido compras.");

  activarFormularioCompra();

  // Si vienen de "Mis elementos asignados", dejamos el elemento ya escogido
  if (codigoPreseleccionado) {
    const lista = document.getElementById("novElemento");
    if (lista.querySelector('option[value="' + codigoPreseleccionado + '"]')) {
      lista.value = codigoPreseleccionado;
      document.getElementById("novEstado").focus();
    }
    codigoPreseleccionado = "";
  }

  document.getElementById("formNovedad").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const el = inventario.find(function (e) { return e.codigo === document.getElementById("novElemento").value; });
    const estado = document.getElementById("novEstado").value;
    const texto = document.getElementById("novTexto").value.trim();
    const hoy = new Date().toLocaleDateString("es-CO");
    evento.target.querySelector("button[type=submit]").disabled = true;
    try {
      // 1) Actualizamos el elemento: nuevo estado y vuelve a quedar pendiente
      await guardarElementos([{
        codigo: el.codigo,
        estado: estado,
        observaciones: ("Novedad " + hoy + ": " + texto).slice(0, 300),
        aprobacion: "Pendiente",
        aprobadoPor: "",
        motivoRechazo: ""
      }], usuario.rol);

      // 2) Si pidieron reposición, creamos la solicitud de compra
      if (document.getElementById("novReponer").checked) {
        await crearSolicitudCompra({
          nombre: el.nombre,
          categoria: el.categoria,
          cantidad: 1,
          destino: el.ubicacion,
          motivo: ("Reposición de " + el.codigo + ": " + texto).slice(0, 300),
          elementoRelacionado: el.codigo
        }, usuario.rol);
      }
      await pantallaActual("✔ Novedad reportada en " + el.codigo + ". El Coordinador debe confirmarla.");
    } catch (error) {
      alert(mensajeDeError(error));
      evento.target.querySelector("button[type=submit]").disabled = false;
    }
  });
});

// =====================================================================
// 4. COMPRAS -> "Revisar solicitudes de compra"
// =====================================================================
function seccionRevisar() {
  const porRevisar = compras.filter(function (c) { return c.estado === "Solicitada"; });
  let html = "<h3>📝 Por revisar (" + porRevisar.length + ")</h3>";
  if (porRevisar.length === 0) return html + '<p class="vacio">🎉 No hay solicitudes por revisar.</p>';

  for (const c of porRevisar) {
    const sugerencias = sugerenciasParaMostrar(c);
    html += '<div class="bloque tarjeta-compra" data-id="' + escapar(c.id) + '">' +
      "<h4>" + escapar(c.cantidad) + " × " + escapar(c.nombre) + " <small>(" + escapar(c.categoria) + ")</small></h4>" +
      "<p>Para: <b>" + escapar(c.destino) + "</b> · Pidió: " + escapar(c.solicitadoPor) + " · " + fecha(c.solicitadoEn) + "<br>" +
      "Motivo: " + escapar(c.motivo) + "</p>";

    if (sugerencias.lista.length > 0) {
      html += '<div class="reutilizar"><b>' +
        (sugerencias.parecidosEnNombre
          ? "♻️ ¡Ojo! Ya hay elementos parecidos que se podrían reutilizar:"
          : "♻️ No hay nada con ese nombre, pero sí de la misma categoría por si sirve:") +
        "</b><ul>";
      for (const s of sugerencias.lista) {
        html += "<li>" + (s.coincidencias > 0 ? "⭐ " : "") +
          "<b>" + escapar(s.el.codigo) + "</b> · " + escapar(s.el.nombre) + " · " + escapar(s.el.ubicacion) + " · " + escapar(s.el.estado) +
          ' <button class="boton boton-mini boton-secundario" data-accion="reutilizar" data-codigo="' + escapar(s.el.codigo) + '">♻️ Reutilizar este</button></li>';
      }
      html += "</ul></div>";
    } else {
      html += '<p class="sin-sugerencias">No hay nada parecido disponible en el inventario.</p>';
    }

    html += '<div class="fila-botones">' +
      '<button class="boton boton-mini boton-aprobar" data-accion="aprobar">✅ Aprobar compra</button>' +
      '<button class="boton boton-mini boton-peligro" data-accion="rechazar">❌ Rechazar</button>' +
      "</div></div>";
  }
  return html;
}

function activarRevisar() {
  contenido.querySelectorAll(".tarjeta-compra [data-accion]").forEach(function (boton) {
    boton.addEventListener("click", async function () {
      const compra = compras.find(function (c) { return c.id === boton.closest(".tarjeta-compra").dataset.id; });
      const accion = boton.dataset.accion;
      let decision, motivo = "", codigo = "";

      if (accion === "aprobar") {
        decision = "Aprobada";
      } else if (accion === "reutilizar") {
        const el = inventario.find(function (e) { return e.codigo === boton.dataset.codigo; });
        decision = "Reutilizada";
        codigo = el.codigo;
        motivo = "Se reutiliza " + el.codigo + " (" + el.nombre + ", " + el.ubicacion + "). Pedir el traslado.";
      } else {
        decision = "Rechazada";
        motivo = prompt("¿Por qué se rechaza la compra?");
        if (motivo === null) return;
        motivo = motivo.trim().slice(0, 200);
        if (!motivo) { alert("Para rechazar hay que escribir el motivo."); return; }
      }

      boton.disabled = true;
      try {
        await revisarCompra(compra, decision, motivo, codigo, usuario.rol);
        await pantallaActual(decision === "Reutilizada"
          ? "♻️ ¡Compra evitada! Quien la pidió debe solicitar el traslado de " + codigo + "."
          : "✔ Solicitud " + decision.toLowerCase() + ".");
      } catch (error) {
        alert(mensajeDeError(error));
        boton.disabled = false;
      }
    });
  });
}

// =====================================================================
// 5. COMPRAS -> "Registrar compra"
// =====================================================================
function seccionRegistrar() {
  const porComprar = compras.filter(function (c) { return c.estado === "Aprobada"; });
  let html = "<h3>🛒 Aprobadas, por comprar (" + porComprar.length + ")</h3>" +
    "<p>Cuando llegue la compra, registra el valor: los elementos entran al inventario " +
    "(quedan pendientes de que el Coordinador los apruebe).</p>";
  if (porComprar.length === 0) return html + '<p class="vacio">No hay compras aprobadas pendientes.</p>';

  for (const c of porComprar) {
    html += '<form class="bloque formulario-grid form-registrar" data-id="' + escapar(c.id) + '">' +
      '<h4 class="ancho-completo">' + escapar(c.cantidad) + " × " + escapar(c.nombre) + " <small>(" + escapar(c.categoria) + ")</small></h4>" +
      '<label>Valor unitario (COP) *<input type="number" class="regValor" min="0" step="1000" required placeholder="Ej: 1500000"></label>' +
      '<label>¿Dónde queda? *<select class="regUbicacion" required>' + opciones(UBICACIONES) + "</select></label>" +
      '<label>Estado *<select class="regEstado" required>' + opciones(ESTADOS) + "</select></label>" +
      '<button type="submit" class="boton ancho-completo">🛒 Registrar compra e ingresar al inventario</button>' +
      "</form>";
  }
  return html;
}

function activarRegistrar() {
  contenido.querySelectorAll(".form-registrar").forEach(function (form) {
    const compra = compras.find(function (c) { return c.id === form.dataset.id; });
    form.querySelector(".regUbicacion").value = compra.destino; // por defecto, donde la pidieron

    form.addEventListener("submit", async function (evento) {
      evento.preventDefault();
      const valor = parseInt(form.querySelector(".regValor").value, 10);
      const codigos = siguientesCodigos(compra.cantidad);
      const elementos = codigos.map(function (codigo) {
        return {
          codigo: codigo,
          nombre: compra.nombre,
          categoria: compra.categoria,
          ubicacion: form.querySelector(".regUbicacion").value,
          estado: form.querySelector(".regEstado").value,
          responsable: "Compras",
          observaciones: "Compra nueva: " + compra.motivo.slice(0, 250),
          foto: "",
          valorCompra: valor,
          aprobacion: "Pendiente",
          aprobadoPor: "",
          motivoRechazo: ""
        };
      });
      form.querySelector("button").disabled = true;
      try {
        await registrarCompra(compra, elementos, valor, usuario.rol);
        await pantallaActual("✔ Compra registrada. Entraron al inventario: " + codigos.join(", ") + ".");
      } catch (error) {
        alert(mensajeDeError(error));
        form.querySelector("button").disabled = false;
      }
    });
  });
}

// =====================================================================
// 6. PANTALLAS
// =====================================================================

// Compras -> "Revisar solicitudes de compra"
export const mostrarRevisarCompras = pantalla(function () {
  contenido.innerHTML =
    "<h2>Revisar solicitudes de compra</h2>" +
    seccionRevisar() +
    formularioCompra() +
    "<h3>Historial de compras</h3>" +
    tablaCompras(compras.filter(function (c) { return c.estado !== "Solicitada"; }), "Aún no hay compras revisadas.");
  activarRevisar();
  activarFormularioCompra();
});

// Compras -> "Registrar compra"
export const mostrarRegistrarCompra = pantalla(function () {
  contenido.innerHTML = "<h2>Registrar compra</h2>" + seccionRegistrar();
  activarRegistrar();
});

// Administrador -> "Compras" (todo junto)
export const mostrarComprasAdmin = pantalla(function () {
  contenido.innerHTML =
    "<h2>Compras</h2>" +
    seccionRevisar() +
    seccionRegistrar() +
    formularioCompra() +
    "<h3>Todas las compras</h3>" +
    tablaCompras(compras, "Aún no hay solicitudes de compra.");
  activarRevisar();
  activarRegistrar();
  activarFormularioCompra();
});
