/*
  MÓDULO DE INVENTARIO
  Responde a la nota de la cartelera:
  "¿Se puede realizar un inventario inicial de lo que se tiene
   en la parte de salas y bodegas?"  ->  ¡Sí! A mano o desde un Excel.

  Aquí está todo lo del inventario:
    - Ver el inventario con filtros
    - Registrar un elemento a mano (con foto)
    - Importar desde Excel y exportar a Excel

  Los datos se leen y se guardan con las funciones de datos.js
  (que es el archivo que habla con Firebase).
*/

import {
  leerInventario,
  leerTraslados,
  guardarElementos,
  vaciarInventario,
  mensajeDeError
} from "./datos.js";
import {
  escapar, normalizar, mostrarCargando, aprobacionDe, etiquetaAprobacion, opciones,
  CATEGORIAS, ESTADOS, UBICACIONES, RESPONSABLES
} from "./utilidades.js";
import { historialHtml, codigosEnTraslado } from "./traslados.js";

// =====================================================================
// 1. LISTAS FIJAS (categorías, ubicaciones, etc. están en utilidades.js)
// =====================================================================
const APROBACIONES = ["Pendiente", "Aprobado", "Rechazado"];

// Columnas que debe tener el Excel (en este orden)
const COLUMNAS_EXCEL = ["Código", "Nombre", "Categoría", "Ubicación", "Estado", "Responsable", "Observaciones"];

// Quién está conectado y dónde dibujamos (los recibe cada pantalla)
let usuario = null;
let contenido = null;

// Copia del inventario que trajimos de Firebase, para filtrar sin
// volver a pedirlo a internet cada vez que alguien escribe en el buscador
let inventarioCargado = [];
let trasladosCargados = [];

// =====================================================================
// 2. AYUDANTES
// =====================================================================
// Busca un valor en una lista sin importar tildes ni mayúsculas.
// Devuelve el valor bien escrito, o null si no está.
function buscarEnLista(lista, valor) {
  return lista.find(function (item) { return normalizar(item) === normalizar(valor); }) || null;
}

// Crea un código nuevo: RUTA-001, RUTA-002, ...
function nuevoCodigo(lista) {
  let mayor = 0;
  for (const el of lista) {
    const numero = parseInt(String(el.codigo).replace(/\D/g, ""), 10);
    if (numero > mayor) mayor = numero;
  }
  return "RUTA-" + String(mayor + 1).padStart(3, "0");
}

// Ubicaciones donde el rol conectado puede registrar elementos.
// El Vendedor solo registra en salas y apartamentos modelo:
// la bodega es responsabilidad del Bodeguista.
// (Las reglas de Firebase revisan lo mismo en el servidor.)
function ubicacionesPermitidas() {
  if (usuario.rol === "vendedor") {
    return UBICACIONES.filter(function (u) { return u !== "Bodega central"; });
  }
  return UBICACIONES;
}

// Datos de aprobación de lo que se registra:
// - Lo que registra el Administrador queda aprobado de una.
// - Lo que registran el Vendedor o el Bodeguista queda PENDIENTE
//   hasta que el Coordinador lo revise (quien registra no se aprueba
//   a sí mismo). Las reglas de Firebase revisan lo mismo.
function datosDeAprobacion() {
  if (usuario.rol === "administrador") {
    return { aprobacion: "Aprobado", aprobadoPor: "administrador", motivoRechazo: "" };
  }
  return { aprobacion: "Pendiente", aprobadoPor: "", motivoRechazo: "" };
}

// =====================================================================
// 3. PANTALLA: VER INVENTARIO (todos los roles)
// =====================================================================
export async function mostrarVerInventario(cajaContenido, usuarioConectado) {
  contenido = cajaContenido;
  usuario = usuarioConectado;

  contenido.innerHTML =
    "<h2>Inventario</h2>" +
    '<div id="resumen" class="resumen"></div>' +
    '<div class="filtros">' +
    '  <input id="filtroTexto" placeholder="Buscar por nombre o código">' +
    '  <select id="filtroUbicacion">' + opciones(UBICACIONES, "Todas las ubicaciones") + "</select>" +
    '  <select id="filtroEstado">' + opciones(ESTADOS, "Todos los estados") + "</select>" +
    '  <select id="filtroAprobacion">' + opciones(APROBACIONES, "Toda aprobación") + "</select>" +
    '  <button id="botonExportar" class="boton">⬇ Descargar Excel</button>' +
    "</div>" +
    '<div id="panelHistorial"></div>' +
    '<div id="tablaInventario">' + mostrarCargando("Cargando inventario...") + "</div>";

  // Cada vez que cambie un filtro, volvemos a dibujar la tabla
  document.getElementById("filtroTexto").addEventListener("input", dibujarTabla);
  document.getElementById("filtroUbicacion").addEventListener("change", dibujarTabla);
  document.getElementById("filtroEstado").addEventListener("change", dibujarTabla);
  document.getElementById("filtroAprobacion").addEventListener("change", dibujarTabla);
  document.getElementById("botonExportar").addEventListener("click", exportarExcel);

  // Pedimos el inventario a Firebase (await = esperamos la respuesta)
  try {
    // Pedimos inventario y traslados al tiempo
    const resultados = await Promise.all([leerInventario(), leerTraslados()]);
    inventarioCargado = resultados[0];
    trasladosCargados = resultados[1];
    dibujarTabla();
  } catch (error) {
    document.getElementById("tablaInventario").innerHTML =
      '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
  }
}

function dibujarTabla() {
  const caja = document.getElementById("tablaInventario");
  if (!caja) return; // por si ya cambiaron de pantalla

  const texto     = normalizar(document.getElementById("filtroTexto").value);
  const ubicacion = document.getElementById("filtroUbicacion").value;
  const estado    = document.getElementById("filtroEstado").value;
  const aprobacion = document.getElementById("filtroAprobacion").value;

  // Filtramos: solo quedan los que cumplen todo lo elegido
  const filtrados = inventarioCargado.filter(function (el) {
    const coincideTexto = normalizar(el.nombre + " " + el.codigo).includes(texto);
    const coincideUbic  = ubicacion === "" || el.ubicacion === ubicacion;
    const coincideEst   = estado === "" || el.estado === estado;
    const coincideAprob = aprobacion === "" || aprobacionDe(el) === aprobacion;
    return coincideTexto && coincideUbic && coincideEst && coincideAprob;
  });

  // Resumen: cuántos hay en cada estado
  let resumen = '<div class="cuadro">Total<br><b>' + filtrados.length + "</b></div>";
  for (const est of ESTADOS) {
    const cantidad = filtrados.filter(function (el) { return el.estado === est; }).length;
    resumen += '<div class="cuadro estado-' + normalizar(est) + '">' + est + "<br><b>" + cantidad + "</b></div>";
  }
  const pendientes = filtrados.filter(function (el) { return aprobacionDe(el) === "Pendiente"; }).length;
  resumen += '<div class="cuadro aprobacion-pendiente">⏳ Pendientes<br><b>' + pendientes + "</b></div>";
  document.getElementById("resumen").innerHTML = resumen;

  if (inventarioCargado.length === 0) {
    caja.innerHTML = '<p class="vacio">Aún no hay elementos en el inventario. ' +
      "El Vendedor, el Bodeguista o el Administrador pueden registrarlos en <b>Registrar elementos</b> " +
      "(a mano o importando un Excel).</p>";
    return;
  }
  if (filtrados.length === 0) {
    caja.innerHTML = '<p class="vacio">Ningún elemento coincide con los filtros.</p>';
    return;
  }

  let html = '<div class="tabla-scroll"><table><thead><tr>' +
    "<th>Foto</th><th>Código</th><th>Nombre</th><th>Categoría</th>" +
    "<th>Ubicación</th><th>Estado</th><th>Responsable</th><th>Aprobación</th><th>Observaciones</th><th>Historial</th>" +
    "</tr></thead><tbody>";

  const enTraslado = codigosEnTraslado(trasladosCargados);

  for (const el of filtrados) {
    // Solo mostramos fotos que sean imágenes guardadas por nosotros
    const fotoValida = typeof el.foto === "string" && el.foto.startsWith("data:image/");
    const foto = fotoValida
      ? '<img class="miniatura" src="' + el.foto + '" alt="Foto de ' + escapar(el.nombre) + '">'
      : '<span class="sin-foto">Sin foto</span>';
    html += "<tr>" +
      "<td>" + foto + "</td>" +
      "<td class=\"col-codigo\">" + escapar(el.codigo) + "</td>" +
      "<td>" + escapar(el.nombre) + "</td>" +
      "<td>" + escapar(el.categoria) + "</td>" +
      "<td>" + escapar(el.ubicacion) +
        (enTraslado.includes(el.codigo) ? '<div class="en-traslado">🚚 En traslado</div>' : "") + "</td>" +
      '<td><span class="estado estado-' + normalizar(el.estado) + '">' + escapar(el.estado) + "</span></td>" +
      "<td>" + escapar(el.responsable) + "</td>" +
      "<td>" + etiquetaAprobacion(el) + "</td>" +
      "<td>" + escapar(el.observaciones) + "</td>" +
      '<td><button class="boton boton-mini boton-secundario" data-historial="' + escapar(el.codigo) + '">🕓 Ver</button></td>' +
      "</tr>";
  }
  html += "</tbody></table></div>";
  caja.innerHTML = html;

  // Botón "Ver" historial: muestra el recorrido del elemento arriba de la tabla
  caja.querySelectorAll("[data-historial]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      const el = inventarioCargado.find(function (e) { return e.codigo === boton.dataset.historial; });
      const panel = document.getElementById("panelHistorial");
      panel.innerHTML = historialHtml(el, trasladosCargados);
      document.getElementById("cerrarHistorial").addEventListener("click", function () { panel.innerHTML = ""; });
      panel.scrollIntoView({ behavior: "smooth" });
    });
  });
}

// =====================================================================
// 4. PANTALLA: REGISTRAR ELEMENTOS (Vendedor, Bodeguista y Administrador)
// =====================================================================
export function mostrarRegistrar(cajaContenido, usuarioConectado) {
  contenido = cajaContenido;
  usuario = usuarioConectado;

  let html =
    "<h2>Registrar elementos</h2>" +

    // --- Opción A: importar desde Excel ---
    '<div class="bloque">' +
    "  <h3>Opción A · Inventario inicial desde Excel</h3>" +
    "  <p>Sube un Excel (.xlsx) con estas columnas: <b>" + COLUMNAS_EXCEL.join(", ") + "</b>. " +
    "  Si el código ya existe, se actualiza; si no, se agrega.</p>" +
    (usuario.rol !== "administrador"
      ? '  <p class="aviso">⏳ Lo que registres queda <b>Pendiente</b> hasta que el Coordinador lo apruebe.</p>'
      : "") +
    (usuario.rol === "vendedor"
      ? '  <p class="aviso">Como Vendedor puedes subir el inventario de salas de ventas y apartamentos modelo. ' +
        "Las filas de la Bodega central se rechazan (esas las sube el Bodeguista).</p>"
      : "") +
    '  <div class="fila-botones">' +
    '    <button id="botonPlantilla" class="boton boton-secundario">⬇ Descargar plantilla</button>' +
    '    <label class="boton">⬆ Cargar Excel<input type="file" id="archivoExcel" accept=".xlsx,.xls,.csv" hidden></label>' +
    "  </div>" +
    '  <div id="resultadoImportacion"></div>' +
    "</div>" +

    // --- Opción B: registrar uno por uno ---
    '<div class="bloque">' +
    "  <h3>Opción B · Registrar un elemento a mano</h3>" +
    '  <form id="formElemento" class="formulario-grid">' +
    '    <label>Nombre *<input id="elNombre" required maxlength="100" placeholder="Ej: Sofá 3 puestos gris"></label>' +
    '    <label>Categoría *<select id="elCategoria" required>' + opciones(CATEGORIAS, "Elige...") + "</select></label>" +
    '    <label>Ubicación *<select id="elUbicacion" required>' + opciones(ubicacionesPermitidas(), "Elige...") + "</select></label>" +
    '    <label>Estado *<select id="elEstado" required>' + opciones(ESTADOS, "Elige...") + "</select></label>" +
    '    <label>Responsable *<select id="elResponsable" required>' + opciones(RESPONSABLES, "Elige...") + "</select></label>" +
    '    <label>Foto<input type="file" id="elFoto" accept="image/*"></label>' +
    '    <label class="ancho-completo">Observaciones<input id="elObservaciones" maxlength="300" placeholder="Ej: tiene un rayón en el brazo derecho"></label>' +
    '    <button type="submit" id="botonGuardar" class="boton ancho-completo">Guardar elemento</button>' +
    "  </form>" +
    '  <p id="mensajeGuardado" class="oculto"></p>' +
    "</div>";

  // El Administrador puede vaciar el inventario (útil para hacer demos)
  if (usuario.rol === "administrador") {
    html +=
      '<div class="bloque peligro">' +
      "  <h3>Zona del administrador</h3>" +
      '  <button id="botonVaciar" class="boton boton-peligro">Vaciar todo el inventario</button>' +
      "</div>";
  }

  contenido.innerHTML = html;

  document.getElementById("botonPlantilla").addEventListener("click", descargarPlantilla);
  document.getElementById("archivoExcel").addEventListener("change", importarExcel);
  document.getElementById("formElemento").addEventListener("submit", guardarElemento);

  const botonVaciar = document.getElementById("botonVaciar");
  if (botonVaciar) {
    botonVaciar.addEventListener("click", async function () {
      if (!confirm("¿Seguro? Se borrarán TODOS los elementos del inventario.")) return;
      botonVaciar.disabled = true;
      try {
        await vaciarInventario();
        alert("Inventario vaciado.");
      } catch (error) {
        alert(mensajeDeError(error));
      }
      botonVaciar.disabled = false;
    });
  }
}

// Muestra un mensaje verde (éxito) o rojo (error) debajo del formulario
function avisoGuardado(texto, esError) {
  const mensaje = document.getElementById("mensajeGuardado");
  mensaje.textContent = texto;
  mensaje.className = esError ? "lista-errores" : "exito";
}

// Guardar un elemento escrito a mano
async function guardarElemento(evento) {
  evento.preventDefault();
  const formulario = evento.target;
  const boton = document.getElementById("botonGuardar");
  boton.disabled = true;
  boton.textContent = "Guardando...";

  try {
    // Necesitamos el inventario actual para saber qué código sigue
    const inventario = await leerInventario();

    // Si subieron una foto, la achicamos para que quepa en la base de datos
    const archivoFoto = document.getElementById("elFoto").files[0];
    const foto = archivoFoto ? await reducirFoto(archivoFoto) : "";

    const elemento = {
      codigo: nuevoCodigo(inventario),
      nombre: document.getElementById("elNombre").value.trim(),
      categoria: document.getElementById("elCategoria").value,
      ubicacion: document.getElementById("elUbicacion").value,
      estado: document.getElementById("elEstado").value,
      responsable: document.getElementById("elResponsable").value,
      observaciones: document.getElementById("elObservaciones").value.trim(),
      foto: foto
    };
    Object.assign(elemento, datosDeAprobacion());

    await guardarElementos([elemento], usuario.rol);
    avisoGuardado("✔ Se guardó " + elemento.nombre + " con el código " + elemento.codigo +
      (elemento.aprobacion === "Pendiente" ? ". Queda pendiente de aprobación." : "."), false);
    formulario.reset();
  } catch (error) {
    avisoGuardado(mensajeDeError(error), true);
  }

  boton.disabled = false;
  boton.textContent = "Guardar elemento";
}

// Convierte la foto en una imagen pequeña (máx. 320 px) guardable como texto
function reducirFoto(archivo) {
  return new Promise(function (resolver) {
    const lector = new FileReader();
    lector.onload = function () {
      const imagen = new Image();
      imagen.onload = function () {
        const escala = Math.min(1, 320 / Math.max(imagen.width, imagen.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(imagen.width * escala);
        lienzo.height = Math.round(imagen.height * escala);
        lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
        resolver(lienzo.toDataURL("image/jpeg", 0.7));
      };
      imagen.onerror = function () { resolver(""); };
      imagen.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// =====================================================================
// 5. EXCEL: IMPORTAR, EXPORTAR Y PLANTILLA
// =====================================================================
// Usamos la librería SheetJS (archivo js/lib/xlsx.full.min.js), que
// nos da el objeto "XLSX" para leer y crear archivos de Excel.

// Lee el archivo que eligieron y lo convierte en filas
function leerArchivoExcel(archivo) {
  return new Promise(function (resolver) {
    const lector = new FileReader();
    lector.onload = function () {
      const libro = XLSX.read(lector.result, { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      // Cada fila queda así: {Nombre: "...", Estado: "...", ...}
      resolver(XLSX.utils.sheet_to_json(hoja, { defval: "" }));
    };
    lector.readAsArrayBuffer(archivo);
  });
}

async function importarExcel(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  const resultado = document.getElementById("resultadoImportacion");
  resultado.innerHTML = mostrarCargando("Leyendo el Excel y guardando en la base de datos...");

  try {
    const filas = await leerArchivoExcel(archivo);
    const inventario = await leerInventario();
    const permitidas = ubicacionesPermitidas();

    const paraGuardar = [];
    let agregados = 0;
    let actualizados = 0;
    const errores = [];

    filas.forEach(function (filaOriginal, i) {
      const numeroFila = i + 2; // +2 porque la fila 1 del Excel son los títulos

      // Leemos las columnas sin importar tildes ni mayúsculas en los títulos
      const fila = {};
      for (const titulo in filaOriginal) {
        fila[normalizar(titulo)] = String(filaOriginal[titulo]).trim();
      }

      const nombre      = fila["nombre"];
      const categoria   = buscarEnLista(CATEGORIAS, fila["categoria"]);
      const ubicacion   = buscarEnLista(UBICACIONES, fila["ubicacion"]);
      const estado      = buscarEnLista(ESTADOS, fila["estado"]);
      const responsable = buscarEnLista(RESPONSABLES, fila["responsable"]);

      // Si viene código, lo normalizamos: "ruta-1" -> "RUTA-1"
      let codigo = String(fila["codigo"] || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const existente = codigo
        ? inventario.concat(paraGuardar).find(function (el) { return el.codigo === codigo; })
        : null;

      // Validaciones: si algo está mal, anotamos el error y saltamos la fila
      const problemas = [];
      if (!nombre) problemas.push("falta el nombre");
      if (!categoria) problemas.push('categoría "' + (fila["categoria"] || "vacía") + '" no válida');
      if (!ubicacion) {
        problemas.push('ubicación "' + (fila["ubicacion"] || "vacía") + '" no válida');
      } else if (!permitidas.includes(ubicacion)) {
        problemas.push('tu rol no puede registrar en "' + ubicacion + '"');
      }
      if (existente && !permitidas.includes(existente.ubicacion)) {
        problemas.push("el código " + codigo + ' ya está en "' + existente.ubicacion + '" y tu rol no puede modificarlo');
      }
      if (!estado) problemas.push('estado "' + (fila["estado"] || "vacío") + '" no válido');
      if (!responsable) problemas.push('responsable "' + (fila["responsable"] || "vacío") + '" no válido');

      if (problemas.length > 0) {
        errores.push("Fila " + numeroFila + ": " + problemas.join(", "));
        return;
      }

      // Sin código: le asignamos el siguiente
      if (!codigo) codigo = nuevoCodigo(inventario.concat(paraGuardar));

      paraGuardar.push({
        codigo: codigo,
        nombre: nombre.slice(0, 100),
        categoria: categoria,
        ubicacion: ubicacion,
        estado: estado,
        responsable: responsable,
        observaciones: (fila["observaciones"] || "").slice(0, 300),
        ...datosDeAprobacion()
      });
      if (existente) actualizados++; else agregados++;
    });

    // Guardamos todo de una vez en Firebase
    if (paraGuardar.length > 0) {
      await guardarElementos(paraGuardar, usuario.rol);
    }

    let html = '<p class="exito">✔ ' + agregados + " agregados · " + actualizados + " actualizados · " +
      errores.length + " con errores.</p>";
    if (paraGuardar.length > 0 && usuario.rol !== "administrador") {
      html += "<p>⏳ Los elementos guardados quedan pendientes de aprobación del Coordinador.</p>";
    }
    if (errores.length > 0) {
      html += '<ul class="lista-errores">';
      for (const err of errores) html += "<li>" + escapar(err) + "</li>";
      html += "</ul>";
    }
    resultado.innerHTML = html;
  } catch (error) {
    resultado.innerHTML = '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
  }

  evento.target.value = ""; // permite volver a cargar el mismo archivo
}

async function exportarExcel() {
  const inventario = inventarioCargado;
  if (inventario.length === 0) {
    alert("El inventario está vacío, no hay nada para descargar.");
    return;
  }

  // Armamos las filas con los mismos títulos de la plantilla (sin la foto)
  const filas = inventario.map(function (el) {
    return {
      "Código": el.codigo,
      "Nombre": el.nombre,
      "Categoría": el.categoria,
      "Ubicación": el.ubicacion,
      "Estado": el.estado,
      "Responsable": el.responsable,
      "Observaciones": el.observaciones || "",
      "Aprobación": aprobacionDe(el),
      "Motivo de rechazo": el.motivoRechazo || "",
      "¿Tiene foto?": el.foto ? "Sí" : "No"
    };
  });

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [{ wch: 11 }, { wch: 30 }, { wch: 20 }, { wch: 32 }, { wch: 9 }, { wch: 20 }, { wch: 40 }, { wch: 11 }, { wch: 30 }, { wch: 12 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");

  const hoy = new Date().toISOString().slice(0, 10); // ej: 2026-11-18
  XLSX.writeFile(libro, "inventario_RUTA_" + hoy + ".xlsx");
}

function descargarPlantilla() {
  // Hoja 1: los títulos y una fila de ejemplo
  const hoja = XLSX.utils.aoa_to_sheet([
    COLUMNAS_EXCEL,
    ["", "Sofá 3 puestos gris", "Mobiliario", "Sala de ventas - Proyecto 1", "Bueno", "Coordinador de sala", "Fila de ejemplo: bórrala"]
  ]);
  hoja["!cols"] = [{ wch: 11 }, { wch: 30 }, { wch: 20 }, { wch: 32 }, { wch: 9 }, { wch: 20 }, { wch: 40 }];

  // Hoja 2: los valores permitidos, para que sepan qué escribir
  const maximo = Math.max(CATEGORIAS.length, UBICACIONES.length, ESTADOS.length, RESPONSABLES.length);
  const valores = [["Categoría", "Ubicación", "Estado", "Responsable"]];
  for (let i = 0; i < maximo; i++) {
    valores.push([CATEGORIAS[i] || "", UBICACIONES[i] || "", ESTADOS[i] || "", RESPONSABLES[i] || ""]);
  }
  const hojaValores = XLSX.utils.aoa_to_sheet(valores);
  hojaValores["!cols"] = [{ wch: 22 }, { wch: 32 }, { wch: 10 }, { wch: 22 }];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");
  XLSX.utils.book_append_sheet(libro, hojaValores, "Valores permitidos");
  XLSX.writeFile(libro, "plantilla_inventario_RUTA.xlsx");
}
