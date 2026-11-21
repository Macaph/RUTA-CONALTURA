/*
  REPORTES Y USUARIOS (PASO 4)
  Reportes: ayudan a "tomar mejores decisiones al abrir o cerrar salas"
  y a "reducir costos de dotación" (palabras del reto).
  Usuarios: muestra qué puede hacer cada rol.
*/

import { leerInventario, leerTraslados, leerCompras, mensajeDeError } from "./datos.js";
import {
  escapar, mostrarCargando, aprobacionDe, fecha, pesos, ESTADOS, UBICACIONES, CATEGORIAS,
  AGRUPACIONES, disponibleParaReutilizar
} from "./utilidades.js";
import { valorTotal } from "./inventario.js";
import { codigosEnTraslado } from "./traslados.js";

// =====================================================================
// 1. CÁLCULOS (todo sale de los datos que ya tenemos)
// =====================================================================
function calcular(inventario, traslados, compras) {
  const ocupados = codigosEnTraslado(traslados);
  // Disponibles para reutilizar: en bodega o en espacios en cierre (ver utilidades.js)
  const reutilizables = inventario.filter(function (el) { return disponibleParaReutilizar(el, ocupados); });

  // Valor de un grupo de elementos (cantidad × valor unitario)
  const valorDe = function (lista) { return lista.reduce(function (s, el) { return s + valorTotal(el); }, 0); };

  const compradas = compras.filter(function (c) { return c.estado === "Comprada"; });
  const gastado = compradas.reduce(function (suma, c) { return suma + (c.valorUnitario || 0) * c.cantidad; }, 0);

  return {
    total: inventario.length,
    pendientes: inventario.filter(function (el) { return aprobacionDe(el) === "Pendiente"; }).length,
    malos: inventario.filter(function (el) { return el.estado === "Dañado"; }),
    valorTotal: valorDe(inventario),
    valorSaldos: valorDe(inventario.filter(function (el) { return el.estadoGestion === "En lista de saldos"; })),
    valorReutilizable: valorDe(reutilizables),
    // Valor por agrupación y por proyecto (caso de uso CU11 del kit)
    valorPorAgrupacion: AGRUPACIONES.map(function (a) {
      const deAqui = inventario.filter(function (el) { return el.agrupacion === a.id; });
      return { nombre: a.nombre, estado: a.estado, elementos: deAqui.length, valor: valorDe(deAqui),
        danados: valorDe(deAqui.filter(function (el) { return el.estado === "Dañado"; })) };
    }),
    valorPorProyecto: ["PRY-A", "PRY-B", "PRY-C", "PRY-D", "BOD"].map(function (p) {
      const deAqui = inventario.filter(function (el) { return el.proyecto === p; });
      return { nombre: p === "BOD" ? "Bodega central" : "Proyecto " + p.slice(-1), elementos: deAqui.length, valor: valorDe(deAqui) };
    }),
    reutilizables: reutilizables,
    trasladosActivos: ocupados.length,
    trasladosRecibidos: traslados.filter(function (t) { return t.estado === "Recibido"; }).length,
    comprasEvitadas: compras.filter(function (c) { return c.estado === "Reutilizada"; }).length,
    comprasHechas: compradas.length,
    gastado: gastado,
    // Conteos para las gráficas y la tabla
    porUbicacion: UBICACIONES.map(function (u) {
      const deAqui = inventario.filter(function (el) { return el.ubicacion === u; });
      const fila = { nombre: u, total: deAqui.length };
      for (const est of ESTADOS) fila[est] = deAqui.filter(function (el) { return el.estado === est; }).length;
      return fila;
    }),
    porCategoria: CATEGORIAS.map(function (c) {
      return { nombre: c, total: inventario.filter(function (el) { return el.categoria === c; }).length };
    }).filter(function (f) { return f.total > 0; })
  };
}

// =====================================================================
// 2. PIEZAS VISUALES
// =====================================================================
// Indicador grande (un número y su explicación)
function indicador(numero, texto, detalle) {
  return '<div class="indicador"><b>' + numero + "</b><span>" + texto + "</span>" +
    (detalle ? "<small>" + detalle + "</small>" : "") + "</div>";
}

// Gráfica de barras horizontales hecha solo con HTML y CSS.
// Una sola serie (un solo color), con el valor escrito al final de cada barra.
// Al pasar el mouse, el "title" muestra el dato completo.
function barras(filas, titulo) {
  const maximo = Math.max(1, ...filas.map(function (f) { return f.total; }));
  let html = '<figure class="grafica"><figcaption>' + titulo + "</figcaption>";
  for (const f of filas) {
    const ancho = (f.total / maximo) * 100;
    html += '<div class="barra-fila" title="' + escapar(f.nombre) + ": " + f.total + ' elementos">' +
      '<span class="barra-nombre">' + escapar(f.nombre) + "</span>" +
      '<span class="barra-pista"><span class="barra" style="width:' + ancho + '%"></span></span>' +
      '<span class="barra-valor">' + f.total + "</span>" +
      "</div>";
  }
  return html + "</figure>";
}

function tablaElementos(lista, textoVacio) {
  if (lista.length === 0) return '<p class="vacio">' + textoVacio + "</p>";
  let html = '<div class="tabla-scroll"><table><thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Ubicación</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>';
  for (const el of lista) {
    html += '<tr><td class="col-codigo">' + escapar(el.codigo) + "</td><td>" + escapar(el.nombre) + "</td><td>" +
      escapar(el.categoria) + "</td><td>" + escapar(el.ubicacion) + "</td><td>" + escapar(el.estado) + "</td><td>" +
      escapar(el.observaciones) + "</td></tr>";
  }
  return html + "</tbody></table></div>";
}

// =====================================================================
// 3. PANTALLA: REPORTES (Compras, Coordinador y Administrador)
// =====================================================================
export async function mostrarReportes(contenido) {
  contenido.innerHTML = mostrarCargando("Armando los reportes...");
  let inventario, traslados, compras;
  try {
    const r = await Promise.all([leerInventario(), leerTraslados(), leerCompras()]);
    inventario = r[0]; traslados = r[1]; compras = r[2];
  } catch (error) {
    contenido.innerHTML = '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
    return;
  }
  const d = calcular(inventario, traslados, compras);

  // Tabla ubicación x estado
  let tablaUbic = '<div class="tabla-scroll"><table><thead><tr><th>Ubicación</th>';
  for (const est of ESTADOS) tablaUbic += "<th>" + est + "</th>";
  tablaUbic += "<th>Total</th></tr></thead><tbody>";
  for (const f of d.porUbicacion) {
    tablaUbic += "<tr><td>" + escapar(f.nombre) + "</td>";
    for (const est of ESTADOS) tablaUbic += "<td>" + f[est] + "</td>";
    tablaUbic += "<td><b>" + f.total + "</b></td></tr>";
  }
  tablaUbic += "</tbody></table></div>";

  // Tabla de valor por agrupación (sala, apartamento modelo, bodega)
  let tablaValor = '<div class="tabla-scroll"><table><thead><tr><th>Agrupación</th><th>Estado del espacio</th>' +
    '<th class="derecha">Elementos</th><th class="derecha">Valor</th><th class="derecha">Valor dañado</th></tr></thead><tbody>';
  for (const f of d.valorPorAgrupacion) {
    tablaValor += "<tr><td>" + escapar(f.nombre) + "</td><td>" + escapar(f.estado) + '</td><td class="derecha">' + f.elementos +
      '</td><td class="derecha"><b>' + pesos(f.valor) + '</b></td><td class="derecha">' + pesos(f.danados) + "</td></tr>";
  }
  tablaValor += "</tbody></table></div>";

  // Tabla de valor por proyecto
  let tablaProyecto = '<div class="tabla-scroll"><table><thead><tr><th>Proyecto</th>' +
    '<th class="derecha">Elementos</th><th class="derecha">Valor</th></tr></thead><tbody>';
  for (const f of d.valorPorProyecto) {
    tablaProyecto += "<tr><td>" + escapar(f.nombre) + '</td><td class="derecha">' + f.elementos +
      '</td><td class="derecha"><b>' + pesos(f.valor) + "</b></td></tr>";
  }
  tablaProyecto += '<tr class="fila-total"><td>Total</td><td class="derecha">' + d.total +
    '</td><td class="derecha"><b>' + pesos(d.valorTotal) + "</b></td></tr></tbody></table></div>";

  contenido.innerHTML =
    '<div class="fila-titulo"><h2>Reportes</h2>' +
    '<button id="botonExportarReporte" class="boton">⬇ Descargar reporte en Excel</button></div>' +
    '<p class="subtitulo">Corte: ' + fecha(new Date()) + "</p>" +

    '<div class="indicadores">' +
    indicador(d.total, "elementos en el inventario", d.pendientes + " pendientes de aprobación") +
    indicador(pesos(d.valorTotal), "valor del inventario", "valor de referencia de todo lo registrado") +
    indicador(d.reutilizables.length, "disponibles para reutilizar", pesos(d.valorReutilizable) + " en bodega y espacios en cierre") +
    indicador(d.malos.length, "dañados", "evaluar reparación o baja") +
    indicador(pesos(d.valorSaldos), "en lista de saldos", "para vender") +
    indicador(d.trasladosActivos, "traslados en curso", d.trasladosRecibidos + " ya recibidos") +
    indicador(d.comprasEvitadas, "compras evitadas ♻️", "porque se reutilizó algo existente") +
    indicador(pesos(d.gastado), "gastado en compras", d.comprasHechas + " compras registradas") +
    "</div>" +

    '<div class="graficas">' +
    barras(d.porUbicacion, "Elementos por ubicación") +
    barras(d.porCategoria, "Elementos por categoría") +
    "</div>" +

    "<h3>💰 Valor por proyecto</h3>" + tablaProyecto +
    "<h3>💰 Valor por agrupación</h3>" + tablaValor +
    "<h3>Estado físico por ubicación</h3>" + tablaUbic +
    "<h3>⚠️ Dañados</h3>" + tablaElementos(d.malos, "Ningún elemento dañado. 👏") +
    "<h3>♻️ Disponibles para reutilizar al abrir una sala</h3>" +
    (d.reutilizables.length > 15
      ? '<details class="plegable"><summary>Ver los ' + d.reutilizables.length + " elementos disponibles</summary>" +
        tablaElementos(d.reutilizables, "") + "</details>"
      : tablaElementos(d.reutilizables, "No hay elementos disponibles para reutilizar."));

  document.getElementById("botonExportarReporte").addEventListener("click", function () {
    exportarReporte(d, traslados, compras);
  });
}

function exportarReporte(d, traslados, compras) {
  const libro = XLSX.utils.book_new();

  const resumen = [
    ["Reporte RUTA", fecha(new Date())],
    [],
    ["Elementos en el inventario", d.total],
    ["Valor del inventario (COP)", d.valorTotal],
    ["Valor en lista de saldos (COP)", d.valorSaldos],
    ["Pendientes de aprobación", d.pendientes],
    ["Disponibles para reutilizar", d.reutilizables.length],
    ["Dañados", d.malos.length],
    ["Traslados en curso", d.trasladosActivos],
    ["Traslados recibidos", d.trasladosRecibidos],
    ["Compras evitadas (reutilización)", d.comprasEvitadas],
    ["Compras registradas", d.comprasHechas],
    ["Total gastado en compras (COP)", d.gastado]
  ];
  agregarHoja(libro, XLSX.utils.aoa_to_sheet(resumen), "Resumen", [34, 18]);

  const ubic = d.porUbicacion.map(function (f) {
    return { "Ubicación": f.nombre, "Bueno": f.Bueno, "Regular": f.Regular, "Dañado": f["Dañado"], "Total": f.total };
  });
  agregarHoja(libro, XLSX.utils.json_to_sheet(ubic), "Por ubicación", [32, 10, 10, 10, 10]);

  agregarHoja(libro, XLSX.utils.json_to_sheet(d.valorPorAgrupacion.map(function (f) {
    return { "Agrupación": f.nombre, "Estado del espacio": f.estado, "Elementos": f.elementos, "Valor (COP)": f.valor, "Valor dañado (COP)": f.danados };
  })), "Valor por agrupación", [36, 16, 11, 16, 18]);

  const fila = function (el) {
    return { "Código": el.codigo, "Nombre": el.nombre, "Categoría": el.categoria, "Ubicación": el.ubicacion, "Estado": el.estado, "Observaciones": el.observaciones || "" };
  };
  agregarHoja(libro, XLSX.utils.json_to_sheet(d.malos.map(fila)), "Dañados", [11, 30, 20, 32, 10, 40]);
  agregarHoja(libro, XLSX.utils.json_to_sheet(d.reutilizables.map(fila)), "Reutilizables", [11, 30, 20, 32, 10, 40]);

  agregarHoja(libro, XLSX.utils.json_to_sheet(compras.map(function (c) {
    return {
      "Fecha": fecha(c.solicitadoEn), "Qué": c.nombre, "Categoría": c.categoria, "Cantidad": c.cantidad,
      "Para": c.destino, "Motivo": c.motivo, "Estado": c.estado, "Pidió": c.solicitadoPor,
      "Revisó": c.revisadoPor || "", "Reutiliza": c.reutilizaCodigo || "",
      "Valor unitario": c.valorUnitario || "", "Valor total": c.valorUnitario ? c.valorUnitario * c.cantidad : ""
    };
  })), "Compras", [16, 26, 18, 9, 30, 36, 12, 12, 12, 11, 14, 14]);

  agregarHoja(libro, XLSX.utils.json_to_sheet(traslados.map(function (t) {
    return {
      "Fecha": fecha(t.solicitadoEn), "Código": t.codigoElemento, "Elemento": t.nombreElemento,
      "Desde": t.origen, "Hacia": t.destino, "Estado": t.estado, "Solicitó": t.solicitadoPor
    };
  })), "Traslados", [16, 11, 26, 30, 30, 12, 12]);

  XLSX.writeFile(libro, "reporte_RUTA_" + new Date().toISOString().slice(0, 10) + ".xlsx");
}

function agregarHoja(libro, hoja, nombre, anchos) {
  hoja["!cols"] = anchos.map(function (w) { return { wch: w }; });
  XLSX.utils.book_append_sheet(libro, hoja, nombre);
}

// =====================================================================
// 4. PANTALLA: USUARIOS (Administrador)
// =====================================================================
// Qué puede hacer cada rol (lo mismo que revisan las reglas de Firebase)
const PERMISOS = [
  ["Ver el inventario y el historial",            true,  true,  true,  true,  true],
  ["Registrar elementos (a mano o con Excel)",    "Salas", true, true,  "Compras nuevas", false],
  ["Aprobar o rechazar el inventario",            false, false, true,  false, true],
  ["Reportar novedades",                          true,  false, false, false, false],
  ["Ver sus elementos asignados",                 true,  false, false, false, false],
  ["Solicitar traslados",                         true,  false, true,  false, false],
  ["Aprobar o rechazar traslados",                false, false, false, false, true],
  ["Enviar y recibir traslados",                  false, true,  true,  false, false],
  ["Solicitar compras",                           true,  false, true,  true,  false],
  ["Revisar compras (reutilizar / aprobar)",      false, false, true,  true,  false],
  ["Registrar compras",                           false, false, true,  true,  false],
  ["Ver reportes",                                false, false, true,  true,  true],
  ["Vaciar el inventario (demos)",                false, false, true,  false, false]
];
const ROLES_COLUMNAS = ["vendedor", "bodeguista", "administrador", "compras", "coordinador"];

export function mostrarUsuarios(contenido) {
  let tabla = '<div class="tabla-scroll"><table class="matriz"><thead><tr><th>Acción</th>';
  for (const rol of ROLES_COLUMNAS) {
    tabla += '<th><span class="etiqueta-rol rol-' + rol + '">' + rol.charAt(0).toUpperCase() + rol.slice(1) + "</span></th>";
  }
  tabla += "</tr></thead><tbody>";
  for (const fila of PERMISOS) {
    tabla += "<tr><td>" + fila[0] + "</td>";
    for (let i = 1; i < fila.length; i++) {
      const v = fila[i];
      const celda = v === true ? '<span class="si" title="Sí">✔</span>'
        : v === false ? '<span class="no" title="No">—</span>'
        : '<span class="si" title="Con límite">✔</span><small>' + v + "</small>";
      tabla += '<td class="centro">' + celda + "</td>";
    }
    tabla += "</tr>";
  }
  tabla += "</tbody></table></div>";

  let cuentas = "<ul>";
  for (const rol of ROLES_COLUMNAS) cuentas += "<li><code>" + rol + "@conaltura.com</code></li>";
  cuentas += "</ul>";

  contenido.innerHTML =
    "<h2>Usuarios y permisos</h2>" +
    "<p>Cada rol tiene una cuenta. El rol sale del correo (lo que va antes de la @). " +
    "Estos permisos no solo se esconden en la pantalla: <b>las reglas de Firebase los revisan en el servidor</b>.</p>" +
    tabla +
    '<div class="bloque">' +
    "<h3>Cuentas del sistema</h3>" + cuentas +
    "<h3>¿Cómo crear o cambiar un usuario?</h3>" +
    "<ol>" +
    "<li>Entra a la consola de Firebase → <b>Authentication</b> → <b>Usuarios</b>.</li>" +
    "<li><b>Agregar usuario</b>: el correo debe ser <code>rol@conaltura.com</code> (por ejemplo <code>vendedor@conaltura.com</code>).</li>" +
    "<li>Para cambiar una contraseña: borra el usuario y créalo de nuevo con la contraseña nueva. " +
    "No uses <b>Restablecer contraseña</b>: enviaría un correo a una dirección que podría ser real en Conaltura.</li>" +
    "</ol>" +
    '<p class="aviso">¿Por qué no se crean desde aquí? Porque crear usuarios es una acción delicada: ' +
    "Firebase solo la permite desde la consola o desde un servidor (backend). " +
    "Además desactivamos el registro público para que nadie pueda crearse una cuenta por su cuenta.</p>" +
    "</div>";
}
