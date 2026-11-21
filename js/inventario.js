/*
  MÓDULO DE INVENTARIO
  Sigue el modelo del kit de datos de Conaltura (hoja "Inventario"):
  cada elemento tiene código EL-00001, agrupación (sala, apartamento
  modelo o bodega), espacio, categoría, cantidad, estado físico,
  estado de gestión, valor, fecha de compra y proveedor.

  Aquí está todo lo del inventario:
    - Ver el inventario con filtros
    - Registrar un elemento a mano (con foto)
    - Importar desde Excel (con validación de errores) y exportar a Excel

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
  escapar, normalizar, claseDe, mostrarCargando, aprobacionDe, etiquetaAprobacion, opciones, pesos,
  CATEGORIAS, ESTADOS, ESTADOS_CON_NA, ESTADOS_GESTION, UBICACIONES, UBICACIONES_DISPONIBLES,
  AGRUPACIONES, agrupacionPorNombre, agrupacionPorId, responsableDe
} from "./utilidades.js";
import { historialHtml, codigosEnTraslado } from "./traslados.js";

// =====================================================================
// 1. LISTAS FIJAS (categorías, ubicaciones, etc. están en utilidades.js)
// =====================================================================
const APROBACIONES = ["Pendiente", "Aprobado", "Rechazado"];

// Columnas del Excel: las mismas de la hoja "Inventario" del kit
const COLUMNAS_EXCEL = [
  "Codigo", "Proyecto_ID", "Agrupacion_ID", "Espacio", "Elemento", "Categoria", "Cantidad",
  "Estado_fisico", "Estado_gestion", "Valor_unitario_COP", "Valor_total_COP", "Fecha_compra",
  "Proveedor", "Reparaciones", "Foto_URL", "Observaciones"
];

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

// Crea los siguientes códigos libres: EL-00602, EL-00603, ...
function siguienteNumero(lista) {
  let mayor = 0;
  for (const el of lista) {
    const numero = parseInt(String(el.codigo).replace(/\D/g, ""), 10);
    if (numero > mayor) mayor = numero;
  }
  return mayor + 1;
}
function codigoDe(numero) {
  return "EL-" + String(numero).padStart(5, "0");
}

// Hoy en formato AAAA-MM-DD (para comparar fechas de compra)
function hoyISO() {
  const h = new Date();
  return h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0") + "-" + String(h.getDate()).padStart(2, "0");
}

// Valor total de un elemento = cantidad × valor unitario
export function valorTotal(el) {
  return (Number(el.cantidad) || 0) * (Number(el.valorUnitario) || 0);
}

// Ubicaciones donde el rol conectado puede registrar elementos.
// El Vendedor solo registra en salas y apartamentos modelo:
// la bodega es responsabilidad del Bodeguista.
// (Las reglas de Firebase revisan lo mismo en el servidor.)
function ubicacionesPermitidas() {
  if (usuario.rol === "vendedor") {
    return UBICACIONES_DISPONIBLES.filter(function (u) { return u !== "Bodega central"; });
  }
  return UBICACIONES_DISPONIBLES;
}

// Datos de aprobación de lo que se registra:
// - Lo que registra el Administrador queda aprobado de una.
// - Lo que registran los demás queda PENDIENTE hasta que el
//   Coordinador lo revise (quien registra no se aprueba a sí mismo).
function datosDeAprobacion() {
  if (usuario.rol === "administrador") {
    return { aprobacion: "Aprobado", aprobadoPor: "administrador", motivoRechazo: "" };
  }
  return { aprobacion: "Pendiente", aprobadoPor: "", motivoRechazo: "" };
}

// Arregla mayúsculas y espacios de un nombre:
// "LAMPARA DE TECHO " -> "Lampara de techo", "canasta" -> "Canasta"
function arreglarNombre(texto) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (limpio === "") return "";
  if (limpio === limpio.toUpperCase() || limpio === limpio.toLowerCase()) {
    return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
  }
  return limpio;
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
    '  <input id="filtroTexto" placeholder="Buscar por elemento, código o espacio">' +
    '  <select id="filtroUbicacion">' + opciones(UBICACIONES, "Todas las ubicaciones") + "</select>" +
    '  <select id="filtroCategoria">' + opciones(CATEGORIAS, "Todas las categorías") + "</select>" +
    '  <select id="filtroEstado">' + opciones(ESTADOS_CON_NA, "Todo estado físico") + "</select>" +
    '  <select id="filtroGestion">' + opciones(ESTADOS_GESTION, "Toda situación") + "</select>" +
    '  <select id="filtroAprobacion">' + opciones(APROBACIONES, "Toda aprobación") + "</select>" +
    '  <button id="botonExportar" class="boton">⬇ Descargar Excel</button>' +
    "</div>" +
    '<div id="panelHistorial"></div>' +
    '<div id="tablaInventario">' + mostrarCargando("Cargando inventario...") + "</div>";

  // Cada vez que cambie un filtro, volvemos a dibujar la tabla
  document.getElementById("filtroTexto").addEventListener("input", dibujarTabla);
  for (const id of ["filtroUbicacion", "filtroCategoria", "filtroEstado", "filtroGestion", "filtroAprobacion"]) {
    document.getElementById(id).addEventListener("change", dibujarTabla);
  }
  document.getElementById("botonExportar").addEventListener("click", exportarExcel);

  // Pedimos inventario y traslados a Firebase al tiempo (await = esperamos la respuesta)
  try {
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

  const texto      = normalizar(document.getElementById("filtroTexto").value);
  const ubicacion  = document.getElementById("filtroUbicacion").value;
  const categoria  = document.getElementById("filtroCategoria").value;
  const estado     = document.getElementById("filtroEstado").value;
  const gestion    = document.getElementById("filtroGestion").value;
  const aprobacion = document.getElementById("filtroAprobacion").value;

  // Filtramos: solo quedan los que cumplen todo lo elegido
  const filtrados = inventarioCargado.filter(function (el) {
    return normalizar(el.nombre + " " + el.codigo + " " + (el.espacio || "")).includes(texto) &&
      (ubicacion === "" || el.ubicacion === ubicacion) &&
      (categoria === "" || el.categoria === categoria) &&
      (estado === "" || el.estado === estado) &&
      (gestion === "" || el.estadoGestion === gestion) &&
      (aprobacion === "" || aprobacionDe(el) === aprobacion);
  });

  // Resumen: elementos, unidades, estados, pendientes y valor
  const unidades = filtrados.reduce(function (s, el) { return s + (Number(el.cantidad) || 0); }, 0);
  const valor = filtrados.reduce(function (s, el) { return s + valorTotal(el); }, 0);
  let resumen = '<div class="cuadro">Elementos<br><b>' + filtrados.length + "</b></div>" +
    '<div class="cuadro">Unidades<br><b>' + unidades + "</b></div>";
  for (const est of ESTADOS) {
    const n = filtrados.filter(function (el) { return el.estado === est; }).length;
    resumen += '<div class="cuadro estado-' + claseDe(est) + '">' + est + "<br><b>" + n + "</b></div>";
  }
  const pendientes = filtrados.filter(function (el) { return aprobacionDe(el) === "Pendiente"; }).length;
  resumen += '<div class="cuadro aprobacion-pendiente">⏳ Pendientes<br><b>' + pendientes + "</b></div>" +
    '<div class="cuadro">Valor<br><b>' + pesos(valor) + "</b></div>";
  document.getElementById("resumen").innerHTML = resumen;

  if (inventarioCargado.length === 0) {
    caja.innerHTML = '<p class="vacio">Aún no hay elementos en el inventario. ' +
      "Se pueden registrar en <b>Registrar elementos</b> (a mano o importando el Excel del kit).</p>";
    return;
  }
  if (filtrados.length === 0) {
    caja.innerHTML = '<p class="vacio">Ningún elemento coincide con los filtros.</p>';
    return;
  }

  let html = '<div class="tabla-scroll"><table><thead><tr>' +
    "<th>Foto</th><th>Código</th><th>Elemento</th><th>Categoría</th><th>Ubicación</th>" +
    "<th>Cant.</th><th>Estado</th><th>Situación</th><th>Valor total</th><th>Aprobación</th><th>Historial</th>" +
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
      '<td class="col-codigo">' + escapar(el.codigo) + "</td>" +
      "<td>" + escapar(el.nombre) +
        (el.espacio ? '<div class="detalle">' + escapar(el.espacio) + "</div>" : "") +
        (el.observaciones ? '<div class="detalle">' + escapar(el.observaciones) + "</div>" : "") + "</td>" +
      "<td>" + escapar(el.categoria) + "</td>" +
      "<td>" + escapar(el.ubicacion) +
        (enTraslado.includes(el.codigo) ? '<div class="en-traslado">🚚 En traslado</div>' : "") + "</td>" +
      '<td class="centro">' + escapar(el.cantidad) + "</td>" +
      '<td><span class="estado estado-' + claseDe(el.estado) + '">' + escapar(el.estado) + "</span></td>" +
      '<td class="col-situacion">' + escapar(el.estadoGestion || "") + "</td>" +
      '<td class="col-codigo">' + pesos(valorTotal(el)) + "</td>" +
      "<td>" + etiquetaAprobacion(el) + "</td>" +
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
    "  <h3>Opción A · Cargar el inventario desde Excel</h3>" +
    "  <p>Sube el Excel del kit de Conaltura (hoja <b>Inventario</b>) o la plantilla de RUTA. " +
    "  Cada fila se revisa antes de guardarse: las que tienen errores se rechazan y se explica por qué. " +
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
    '    <label class="boton">⬆ Cargar Excel<input type="file" id="archivoExcel" accept=".xlsx,.xls" hidden></label>' +
    "  </div>" +
    '  <div id="resultadoImportacion"></div>' +
    "</div>" +

    // --- Opción B: registrar uno por uno ---
    '<div class="bloque">' +
    "  <h3>Opción B · Registrar un elemento a mano</h3>" +
    '  <form id="formElemento" class="formulario-grid">' +
    '    <label>Elemento *<input id="elNombre" required maxlength="100" placeholder="Ej: Poltrona gris"></label>' +
    '    <label>Categoría *<select id="elCategoria" required>' + opciones(CATEGORIAS, "Elige...") + "</select></label>" +
    '    <label>Ubicación *<select id="elUbicacion" required>' + opciones(ubicacionesPermitidas(), "Elige...") + "</select></label>" +
    '    <label>Espacio<input id="elEspacio" maxlength="60" placeholder="Ej: SALA, COCINA, ESTANTERÍA A3"></label>' +
    '    <label>Cantidad *<input id="elCantidad" type="number" min="1" max="999" value="1" required></label>' +
    '    <label>Estado físico *<select id="elEstado" required>' + opciones(ESTADOS, "Elige...") + "</select></label>" +
    '    <label>Valor unitario (COP) *<input id="elValor" type="number" min="0" step="1000" required placeholder="Ej: 1500000"></label>' +
    '    <label>Fecha de compra<input id="elFecha" type="date" max="' + hoyISO() + '"></label>' +
    '    <label>Proveedor<input id="elProveedor" maxlength="100" placeholder="Ej: Proveedor Mobiliario 01"></label>' +
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
      if (!confirm("¿Seguro? Se borrarán TODOS los elementos, traslados y compras.")) return;
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

// Arma un elemento completo a partir de su ubicación y sus datos
function armarElemento(datos) {
  const agr = agrupacionPorNombre(datos.ubicacion);
  return Object.assign({
    codigo: datos.codigo,
    proyecto: agr.proyecto,
    agrupacion: agr.id,
    ubicacion: agr.nombre,
    espacio: datos.espacio || "",
    nombre: datos.nombre,
    categoria: datos.categoria,
    cantidad: datos.cantidad,
    estado: datos.estado,
    // Si no dicen la situación: en bodega queda "En bodega", si no "Asignado"
    estadoGestion: datos.estadoGestion || (agr.id === "AGR-BOD" ? "En bodega" : "Asignado"),
    valorUnitario: datos.valorUnitario,
    fechaCompra: datos.fechaCompra || "",
    proveedor: datos.proveedor || "",
    reparaciones: datos.reparaciones || 0,
    responsable: responsableDe(agr.nombre),
    observaciones: datos.observaciones || ""
  }, datosDeAprobacion());
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

    const elemento = armarElemento({
      codigo: codigoDe(siguienteNumero(inventario)),
      nombre: arreglarNombre(document.getElementById("elNombre").value),
      categoria: document.getElementById("elCategoria").value,
      ubicacion: document.getElementById("elUbicacion").value,
      espacio: document.getElementById("elEspacio").value.trim().toUpperCase(),
      cantidad: parseInt(document.getElementById("elCantidad").value, 10),
      estado: document.getElementById("elEstado").value,
      valorUnitario: parseInt(document.getElementById("elValor").value, 10),
      fechaCompra: document.getElementById("elFecha").value,
      proveedor: document.getElementById("elProveedor").value.trim(),
      observaciones: document.getElementById("elObservaciones").value.trim()
    });
    elemento.foto = foto;

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
// 5. EXCEL: IMPORTAR (con validación), EXPORTAR Y PLANTILLA
// =====================================================================
// Usamos la librería SheetJS (archivo js/lib/xlsx.full.min.js), que
// nos da el objeto "XLSX" para leer y crear archivos de Excel.

// Lee el archivo: usa la hoja "Inventario" si existe; si no, la primera
function leerArchivoExcel(archivo) {
  return new Promise(function (resolver) {
    const lector = new FileReader();
    lector.onload = function () {
      const libro = XLSX.read(lector.result, { type: "array" });
      const nombreHoja = libro.SheetNames.find(function (n) { return normalizar(n) === "inventario"; }) || libro.SheetNames[0];
      // raw: true deja las fechas como número de Excel (las convertimos abajo)
      resolver(XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { defval: "", raw: true }));
    };
    lector.readAsArrayBuffer(archivo);
  });
}

// Convierte una fecha de Excel (número o texto) a "AAAA-MM-DD". Si no se puede, null.
function fechaISO(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  if (typeof valor === "number") {
    const f = XLSX.SSF.parse_date_code(valor);
    if (!f) return null;
    return f.y + "-" + String(f.m).padStart(2, "0") + "-" + String(f.d).padStart(2, "0");
  }
  const texto = String(valor).trim();
  let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);           // 31/05/2024
  if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return null;
}

// Los tipos de error que puede encontrar la validación (para el informe)
const TIPOS_ERROR = {
  codigoRepetido:     "Código repetido en el archivo",
  codigoFormato:      "Código con formato inválido",
  agrupacionNoExiste: "Agrupación que no existe",
  agrupacionNoLista:  "Agrupación por configurar",
  proyectoNoCoincide: "Proyecto que no coincide con la agrupación",
  sinPermiso:         "Ubicación no permitida para tu rol",
  faltaNombre:        "Fila sin nombre del elemento",
  categoria:          "Categoría no válida",
  cantidad:           "Cantidad en cero o inválida",
  estado:             "Estado físico vacío o no válido",
  gestion:            "Estado de gestión no válido",
  valor:              "Valor unitario vacío o inválido",
  fechaFutura:        "Fecha de compra en el futuro",
  fechaInvalida:      "Fecha de compra inválida"
};

async function importarExcel(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  const resultado = document.getElementById("resultadoImportacion");
  resultado.innerHTML = mostrarCargando("Revisando el Excel fila por fila...");

  try {
    const filas = await leerArchivoExcel(archivo);
    const inventario = await leerInventario();
    const permitidas = ubicacionesPermitidas();
    const hoy = hoyISO();

    const paraGuardar = [];
    const codigosVistos = {};   // código -> fila donde apareció primero
    const errores = [];         // { fila, tipos: [...], textos: [...] }
    const ajustes = [];         // nombres corregidos automáticamente
    let agregados = 0;
    let actualizados = 0;
    let saltadas = 0;
    let proximo = siguienteNumero(inventario);

    filas.forEach(function (filaOriginal, i) {
      const numeroFila = i + 2; // +2 porque la fila 1 del Excel son los títulos

      // Leemos las columnas sin importar tildes ni mayúsculas en los títulos
      const fila = {};
      for (const titulo in filaOriginal) fila[normalizar(titulo)] = filaOriginal[titulo];
      const txt = function (k) { return String(fila[k] ?? "").trim(); };

      // Filas totalmente vacías: se ignoran
      if (Object.values(fila).every(function (v) { return String(v).trim() === ""; })) {
        saltadas++;
        return;
      }

      const tipos = [];
      const textos = [];
      const problema = function (tipo, texto) { tipos.push(tipo); textos.push(texto); };

      // --- Código ---
      let codigo = txt("codigo").toUpperCase();
      if (codigo && !/^EL-\d{5}$/.test(codigo)) {
        problema("codigoFormato", 'código "' + codigo + '" no tiene el formato EL-00000');
      } else if (codigo && codigosVistos[codigo]) {
        problema("codigoRepetido", "el código " + codigo + " ya se usó en la fila " + codigosVistos[codigo]);
      }

      // --- Agrupación y proyecto ---
      const agr = agrupacionPorId(txt("agrupacion_id").toUpperCase());
      const proyecto = txt("proyecto_id").toUpperCase();
      if (!agr) {
        problema("agrupacionNoExiste", 'la agrupación "' + (txt("agrupacion_id") || "vacía") + '" no existe');
      } else {
        if (agr.estado === "Por configurar") problema("agrupacionNoLista", agr.id + " aún está por configurar");
        if (proyecto && proyecto !== agr.proyecto) {
          problema("proyectoNoCoincide", "dice " + proyecto + " pero " + agr.id + " es del " + agr.proyecto);
        }
        if (!permitidas.includes(agr.nombre) && agr.estado !== "Por configurar") {
          problema("sinPermiso", 'tu rol no puede registrar en "' + agr.nombre + '"');
        }
      }

      // --- Elemento, categoría, cantidad ---
      const nombreOriginal = String(fila["elemento"] ?? "");
      const nombre = arreglarNombre(nombreOriginal);
      if (!nombre) problema("faltaNombre", "falta el nombre del elemento");
      const categoria = buscarEnLista(CATEGORIAS, txt("categoria"));
      if (!categoria) problema("categoria", 'categoría "' + (txt("categoria") || "vacía") + '" no válida');
      const cantidad = Number(fila["cantidad"]);
      if (!Number.isInteger(cantidad) || cantidad < 1) problema("cantidad", 'cantidad "' + txt("cantidad") + '" no válida');

      // --- Estados ---
      const gestion = txt("estado_gestion") ? buscarEnLista(ESTADOS_GESTION, txt("estado_gestion")) : "";
      if (gestion === null) problema("gestion", 'estado de gestión "' + txt("estado_gestion") + '" no válido');
      let estado = txt("estado_fisico") ? buscarEnLista(ESTADOS_CON_NA, txt("estado_fisico")) : "";
      if (!estado && gestion === "Pendiente de llegada") estado = "N/A";   // aún no llega
      if (!estado) problema("estado", 'estado físico "' + (txt("estado_fisico") || "vacío") + '" no válido');

      // --- Valor y fecha ---
      const valor = Number(fila["valor_unitario_cop"]);
      if (txt("valor_unitario_cop") === "" || !Number.isFinite(valor) || valor < 0) {
        problema("valor", "falta el valor unitario");
      }
      const fechaCompra = fechaISO(fila["fecha_compra"]);
      if (fechaCompra === null) problema("fechaInvalida", 'fecha "' + txt("fecha_compra") + '" no se entiende');
      else if (fechaCompra && fechaCompra > hoy) problema("fechaFutura", "fecha de compra " + fechaCompra + " está en el futuro");

      // --- Si el código ya existe en RUTA en un lugar que el rol no puede tocar ---
      const existente = codigo ? inventario.find(function (el) { return el.codigo === codigo; }) : null;
      if (existente && !permitidas.includes(existente.ubicacion)) {
        problema("sinPermiso", "el código " + codigo + ' ya está en "' + existente.ubicacion + '"');
      }

      if (codigo && !codigosVistos[codigo]) codigosVistos[codigo] = numeroFila;

      if (tipos.length > 0) {
        errores.push({ fila: numeroFila, codigo: codigo, elemento: nombreOriginal.trim(), tipos: tipos, textos: textos });
        return;
      }

      if (nombre !== nombreOriginal) {
        ajustes.push("Fila " + numeroFila + ': "' + nombreOriginal + '" → "' + nombre + '"');
      }
      if (!codigo) codigo = codigoDe(proximo++);

      paraGuardar.push(armarElemento({
        codigo: codigo,
        nombre: nombre.slice(0, 100),
        categoria: categoria,
        ubicacion: agr.nombre,
        espacio: txt("espacio").toUpperCase().slice(0, 60),
        cantidad: cantidad,
        estado: estado,
        estadoGestion: gestion,
        valorUnitario: Math.round(valor),
        fechaCompra: fechaCompra,
        proveedor: txt("proveedor").slice(0, 100),
        reparaciones: Math.max(0, parseInt(fila["reparaciones"], 10) || 0),
        observaciones: txt("observaciones").slice(0, 300)
      }));
      if (existente) actualizados++; else agregados++;
    });

    // Guardamos todo en Firebase (en lotes de 400)
    if (paraGuardar.length > 0) {
      resultado.innerHTML = mostrarCargando("Guardando " + paraGuardar.length + " elementos en la base de datos...");
      await guardarElementos(paraGuardar, usuario.rol);
    }

    resultado.innerHTML = informeImportacion(filas.length - saltadas, agregados, actualizados, errores, ajustes);
  } catch (error) {
    resultado.innerHTML = '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
  }

  evento.target.value = ""; // permite volver a cargar el mismo archivo
}

// Informe de la carga: qué entró, qué se rechazó y por qué
function informeImportacion(revisadas, agregados, actualizados, errores, ajustes) {
  let html = '<div class="informe">' +
    '<p class="exito">✔ ' + revisadas + " filas revisadas · " + agregados + " agregadas · " +
    actualizados + " actualizadas · " + errores.length + " rechazadas</p>";
  if (agregados + actualizados > 0 && usuario.rol !== "administrador") {
    html += "<p>⏳ Los elementos guardados quedan pendientes de aprobación del Coordinador.</p>";
  }

  if (errores.length > 0) {
    // Resumen: cuántas filas por cada tipo de error
    const conteo = {};
    for (const e of errores) for (const t of new Set(e.tipos)) conteo[t] = (conteo[t] || 0) + 1;
    html += "<h4>Errores encontrados</h4>" +
      '<div class="tabla-scroll"><table><thead><tr><th>Tipo de error</th><th>Filas</th></tr></thead><tbody>';
    for (const t of Object.keys(TIPOS_ERROR)) {
      if (conteo[t]) html += "<tr><td>" + TIPOS_ERROR[t] + '</td><td class="centro">' + conteo[t] + "</td></tr>";
    }
    html += "</tbody></table></div>";

    html += "<details><summary>Ver el detalle de las " + errores.length + " filas rechazadas</summary>" +
      '<ul class="lista-errores">';
    for (const e of errores) {
      html += "<li><b>Fila " + e.fila + "</b>" + (e.codigo ? " (" + escapar(e.codigo) + ")" : "") +
        (e.elemento ? " " + escapar(e.elemento) : "") + ": " + escapar(e.textos.join("; ")) + "</li>";
    }
    html += "</ul></details>";
  }

  if (ajustes.length > 0) {
    html += "<details><summary>✏️ " + ajustes.length + " nombres con mayúsculas o espacios corregidos automáticamente</summary><ul>";
    for (const a of ajustes) html += "<li>" + escapar(a) + "</li>";
    html += "</ul></details>";
  }
  return html + "</div>";
}

async function exportarExcel() {
  const inventario = inventarioCargado;
  if (inventario.length === 0) {
    alert("El inventario está vacío, no hay nada para descargar.");
    return;
  }

  // Mismas columnas del kit, más la ubicación y la aprobación
  const filas = inventario.map(function (el) {
    return {
      "Codigo": el.codigo,
      "Proyecto_ID": el.proyecto || "",
      "Agrupacion_ID": el.agrupacion || "",
      "Ubicacion": el.ubicacion,
      "Espacio": el.espacio || "",
      "Elemento": el.nombre,
      "Categoria": el.categoria,
      "Cantidad": el.cantidad,
      "Estado_fisico": el.estado,
      "Estado_gestion": el.estadoGestion || "",
      "Valor_unitario_COP": el.valorUnitario ?? "",
      "Valor_total_COP": valorTotal(el),
      "Fecha_compra": el.fechaCompra || "",
      "Proveedor": el.proveedor || "",
      "Reparaciones": el.reparaciones || 0,
      "Observaciones": el.observaciones || "",
      "Aprobacion": aprobacionDe(el),
      "Motivo_rechazo": el.motivoRechazo || "",
      "Tiene_foto": el.foto ? "Sí" : "No"
    };
  });

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [11, 9, 11, 32, 18, 28, 18, 8, 11, 18, 14, 14, 11, 24, 11, 36, 11, 24, 9].map(function (w) { return { wch: w }; });
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");

  const hoy = new Date().toISOString().slice(0, 10); // ej: 2026-11-21
  XLSX.writeFile(libro, "inventario_RUTA_" + hoy + ".xlsx");
}

function descargarPlantilla() {
  // Hoja 1: las columnas del kit y una fila de ejemplo
  const hoja = XLSX.utils.aoa_to_sheet([
    COLUMNAS_EXCEL,
    ["", "PRY-D", "AGR-D-SV", "SALA DE ESPERA", "Poltrona gris", "Mobiliario", 1, "Bueno", "Asignado",
     1450000, 1450000, "2026-11-10", "Proveedor Mobiliario 01", 0, "", "Fila de ejemplo: bórrala"]
  ]);
  hoja["!cols"] = [11, 11, 13, 18, 26, 18, 9, 13, 18, 18, 16, 13, 24, 12, 10, 30].map(function (w) { return { wch: w }; });

  // Hoja 2: los valores permitidos, para que sepan qué escribir
  const valores = [["Agrupacion_ID", "Proyecto_ID", "Ubicación", "Categoria", "Estado_fisico", "Estado_gestion"]];
  const maximo = Math.max(AGRUPACIONES.length, CATEGORIAS.length, ESTADOS_GESTION.length);
  for (let i = 0; i < maximo; i++) {
    const a = AGRUPACIONES.at(i);
    valores.push([
      a ? a.id : "", a ? a.proyecto : "", a ? a.nombre + (a.estado === "Por configurar" ? " (por configurar)" : "") : "",
      CATEGORIAS.at(i) || "", ESTADOS_CON_NA.at(i) || "", ESTADOS_GESTION.at(i) || ""
    ]);
  }
  const hojaValores = XLSX.utils.aoa_to_sheet(valores);
  hojaValores["!cols"] = [14, 12, 40, 20, 14, 22].map(function (w) { return { wch: w }; });

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");
  XLSX.utils.book_append_sheet(libro, hojaValores, "Valores permitidos");
  XLSX.writeFile(libro, "plantilla_inventario_RUTA.xlsx");
}
