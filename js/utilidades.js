/*
  UTILIDADES
  Funciones pequeñas que usan varios archivos. Las ponemos aquí
  una sola vez para no repetirlas.
*/

// =====================================================================
// LISTAS FIJAS DEL RUTA (si se agrega una sala, se agrega aquí
// y en firestore.rules)
// =====================================================================
export const CATEGORIAS = ["Mobiliario", "Decoración", "Electrodomésticos", "Tecnología", "Material publicitario", "Otro"];
export const ESTADOS = ["Bueno", "Regular", "Malo"];
export const UBICACIONES = [
  "Bodega central",
  "Sala de ventas - Proyecto 1",
  "Apartamento modelo - Proyecto 1",
  "Sala de ventas - Proyecto 2",
  "Apartamento modelo - Proyecto 2"
];
// El responsable es un rol o el encargado de la sala, no una persona con nombre
export const RESPONSABLES = ["Coordinador de sala", "Bodeguista", "Administrador", "Compras", "Vendedor"];

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
