/*
  UTILIDADES
  Funciones pequeñas que usan varios archivos. Las ponemos aquí
  una sola vez para no repetirlas.
*/

// =====================================================================
// LISTAS FIJAS DE RUTA (iguales a las del kit de datos de Conaltura).
// Si se agrega una agrupación o categoría, se agrega aquí
// y en firestore.rules.
// =====================================================================

// Agrupaciones = los espacios donde están los elementos: salas de ventas,
// apartamentos modelo (por tipología) y la bodega.
// "nombre" es lo que se ve en pantalla; "id" es el código del kit.
export const AGRUPACIONES = [
  { id: "AGR-A-AM1", proyecto: "PRY-A", tipo: "Apartamento modelo", estado: "Activa",         nombre: "Proyecto A · Apartamento modelo T1" },
  { id: "AGR-B-SV",  proyecto: "PRY-B", tipo: "Sala de ventas",     estado: "Activa",         nombre: "Proyecto B · Sala de ventas" },
  { id: "AGR-B-AM1", proyecto: "PRY-B", tipo: "Apartamento modelo", estado: "Activa",         nombre: "Proyecto B · Apartamento modelo T1" },
  { id: "AGR-B-AM2", proyecto: "PRY-B", tipo: "Apartamento modelo", estado: "Activa",         nombre: "Proyecto B · Apartamento modelo T2" },
  { id: "AGR-C-SV",  proyecto: "PRY-C", tipo: "Sala de ventas",     estado: "En cierre",      nombre: "Proyecto C · Sala de ventas" },
  { id: "AGR-C-AM1", proyecto: "PRY-C", tipo: "Apartamento modelo", estado: "En cierre",      nombre: "Proyecto C · Apartamento modelo T1" },
  { id: "AGR-D-SV",  proyecto: "PRY-D", tipo: "Sala de ventas",     estado: "En montaje",     nombre: "Proyecto D · Sala de ventas" },
  { id: "AGR-D-AM1", proyecto: "PRY-D", tipo: "Apartamento modelo", estado: "En montaje",     nombre: "Proyecto D · Apartamento modelo T1" },
  { id: "AGR-D-AM2", proyecto: "PRY-D", tipo: "Apartamento modelo", estado: "Por configurar", nombre: "Proyecto D · Apartamento modelo T2" },
  { id: "AGR-BOD",   proyecto: "BOD",   tipo: "Bodega",             estado: "Activa",         nombre: "Bodega central" }
];

// Nombres de todas las ubicaciones (para filtros y reportes)
export const UBICACIONES = AGRUPACIONES.map(function (a) { return a.nombre; });

// Donde se puede registrar o enviar elementos: todo menos lo "Por configurar"
export const UBICACIONES_DISPONIBLES = AGRUPACIONES
  .filter(function (a) { return a.estado !== "Por configurar"; })
  .map(function (a) { return a.nombre; });

// Buscar una agrupación por su nombre o por su código
export function agrupacionPorNombre(nombre) {
  return AGRUPACIONES.find(function (a) { return a.nombre === nombre; }) || null;
}
export function agrupacionPorId(id) {
  return AGRUPACIONES.find(function (a) { return a.id === id; }) || null;
}

export const CATEGORIAS = [
  "Mobiliario", "Decoración", "Textiles", "Iluminación", "Menaje",
  "Plantas y materas", "Electrodomésticos", "Tecnología", "Material comercial", "Utilería"
];

// Estado físico: cómo está el elemento ("N/A" = todavía no ha llegado)
export const ESTADOS = ["Bueno", "Regular", "Dañado"];
export const ESTADOS_CON_NA = ["Bueno", "Regular", "Dañado", "N/A"];

// Estado de gestión: en qué situación está
export const ESTADOS_GESTION = [
  "Asignado", "En reparación", "En tránsito", "En bodega",
  "En lista de saldos", "Pendiente de llegada", "De baja"
];

// El responsable es un rol, no una persona con nombre.
// En salas y apartamentos responde el Vendedor (responsable del espacio);
// en la bodega, el Bodeguista.
export const RESPONSABLES = ["Vendedor", "Bodeguista", "Coordinador de sala", "Compras", "Administrador"];
export function responsableDe(ubicacion) {
  return ubicacion === "Bodega central" ? "Bodeguista" : "Vendedor";
}

// Convierte un texto en un nombre de clase CSS: "Dañado" -> "danado", "N/A" -> "n-a"
export function claseDe(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, "-");
}

// Fecha corta en formato colombiano: 18/11/26, 6:04 p. m.
export function fecha(valor) {
  if (!(valor instanceof Date)) return "—";
  return valor.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

// Pesos colombianos: $ 1.250.000
export function pesos(valor) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor || 0);
}

// Arma las <option> de un <select>
export function opciones(lista, textoInicial) {
  let html = textoInicial ? '<option value="">' + textoInicial + "</option>" : "";
  for (const item of lista) {
    html += '<option value="' + escapar(item) + '">' + escapar(item) + "</option>";
  }
  return html;
}

// Seguridad: si alguien escribe código HTML en un campo (o en el Excel),
// esto lo convierte en texto normal para que no se ejecute en la página.
export function escapar(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Quita tildes, espacios y mayúsculas para comparar textos.
// Así "Decoracion", "decoración" y " DECORACIÓN " se toman igual.
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().toLowerCase();
}

// Mensaje de "cargando..." mientras llega la respuesta de Firebase
export function mostrarCargando(texto) {
  return '<p class="vacio">⏳ ' + texto + "</p>";
}

// Los elementos viejos (de antes de la aprobación) no tienen este dato:
// los tratamos como pendientes.
export function aprobacionDe(elemento) {
  return elemento.aprobacion || "Pendiente";
}

// Etiqueta de color para la aprobación (y el motivo si fue rechazado)
export function etiquetaAprobacion(elemento) {
  const estado = aprobacionDe(elemento);
  const iconos = { Pendiente: "⏳", Aprobado: "✅", Rechazado: "❌" };
  let html = '<span class="aprobacion aprobacion-' + normalizar(estado) + '">' +
    iconos[estado] + " " + estado + "</span>";
  if (estado === "Rechazado" && elemento.motivoRechazo) {
    html += '<div class="motivo">Motivo: ' + escapar(elemento.motivoRechazo) + "</div>";
  }
  return html;
}

// ¿Este elemento se puede reutilizar en otra sala? (caso de uso CU12 del kit)
// Sí, si está aprobado, no está dañado, no está de baja / en reparación /
// por llegar / en tránsito, no va en un traslado, y está en la bodega
// o en un espacio que se está cerrando.
export function disponibleParaReutilizar(el, codigosOcupados) {
  const agr = agrupacionPorId(el.agrupacion) || agrupacionPorNombre(el.ubicacion);
  const lugarLibre = el.ubicacion === "Bodega central" || (agr !== null && agr.estado === "En cierre");
  const situacionLibre = !["De baja", "En reparación", "Pendiente de llegada", "En tránsito"].includes(el.estadoGestion);
  return aprobacionDe(el) === "Aprobado" &&
    el.estado !== "Dañado" && el.estado !== "N/A" &&
    lugarLibre && situacionLibre &&
    !codigosOcupados.includes(el.codigo);
}
