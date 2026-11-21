/*
  CAPA DE DATOS
  Este es el ÚNICO archivo que habla con Firebase.
  Los demás archivos le piden cosas ("dame el inventario", "guarda esto")
  sin saber cómo se guardan. Si mañana cambiamos Firebase por otra base
  de datos, solo hay que tocar este archivo.

  Palabras nuevas:
  - async / await: pedirle algo a internet toma tiempo. "await" significa
    "espera la respuesta antes de seguir con la siguiente línea".
  - Colección y documento: Firestore guarda los datos como carpetas
    (colecciones) llenas de fichas (documentos). Nuestra colección se
    llama "inventario" y cada ficha es un elemento (ej: RUTA-001).
*/

import { auth, db } from "./firebase-config.js";
import { agrupacionPorNombre } from "./utilidades.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  addDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

// Todos los usuarios tienen correo de Conaltura: vendedor@conaltura.com, ...
const DOMINIO = "@conaltura.com";
const COLECCION = "inventario";
const TRASLADOS = "traslados";
const COMPRAS = "compras";

// Firebase devuelve las fechas en un formato propio (Timestamp).
// Esto las convierte en fechas normales de JavaScript.
function convertirFechas(datos) {
  for (const campo in datos) {
    if (datos[campo] && typeof datos[campo].toDate === "function") {
      datos[campo] = datos[campo].toDate();
    }
  }
  return datos;
}

// =====================================================================
// SESIÓN (iniciar, cerrar y saber quién está conectado)
// =====================================================================

// El rol sale de la primera parte del correo:
// "bodeguista@conaltura.com"  ->  "bodeguista"
function rolDesdeCorreo(correo) {
  return String(correo || "").split("@")[0].toLowerCase();
}

export async function iniciarSesion(usuario, contrasena) {
  // Se puede escribir solo "vendedor" o el correo completo
  let correo = usuario.trim().toLowerCase();
  if (!correo.includes("@")) correo = correo + DOMINIO;

  await signInWithEmailAndPassword(auth, correo, contrasena);
}

export async function cerrarSesion() {
  await signOut(auth);
}

// Avisa cada vez que alguien entra o sale.
// Llama a la función "cuandoCambie" con {correo, rol} o con null.
export function escucharSesion(cuandoCambie) {
  onAuthStateChanged(auth, function (usuarioFirebase) {
    if (usuarioFirebase) {
      cuandoCambie({
        correo: usuarioFirebase.email,
        rol: rolDesdeCorreo(usuarioFirebase.email)
      });
    } else {
      cuandoCambie(null);
    }
  });
}

// Traduce los errores de Firebase a mensajes entendibles
export function mensajeDeError(error) {
  const codigo = error && error.code ? error.code : "";
  if (codigo === "auth/invalid-credential" || codigo === "auth/wrong-password" ||
      codigo === "auth/user-not-found" || codigo === "auth/invalid-email") {
    return "Usuario o contraseña incorrectos.";
  }
  if (codigo === "auth/too-many-requests") {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  }
  if (codigo === "auth/network-request-failed" || codigo === "unavailable") {
    return "No hay conexión a internet.";
  }
  if (codigo === "permission-denied") {
    return "Tu rol no tiene permiso para hacer esto.";
  }
  return "Ocurrió un error: " + (error && error.message ? error.message : error);
}

// =====================================================================
// INVENTARIO (leer, guardar y borrar)
// =====================================================================

// Trae todos los elementos, ordenados por código
export async function leerInventario() {
  const resultado = await getDocs(collection(db, COLECCION));
  const lista = [];
  resultado.forEach(function (documento) {
    lista.push(convertirFechas(documento.data()));
  });
  lista.sort(function (a, b) { return String(a.codigo).localeCompare(String(b.codigo)); });
  return lista;
}

// Guarda uno o varios elementos de una sola vez.
// Si el código ya existe, actualiza solo los campos que le mandamos
// (por eso al reimportar un Excel no se pierde la foto).
export async function guardarElementos(elementos, rolQueGuarda) {
  // Firestore deja guardar máximo 500 cosas por lote, así que vamos de a 400
  for (let inicio = 0; inicio < elementos.length; inicio += 400) {
    const lote = writeBatch(db);
    for (const el of elementos.slice(inicio, inicio + 400)) {
      const ficha = doc(db, COLECCION, el.codigo);
      lote.set(ficha, Object.assign({}, el, {
        actualizadoPor: rolQueGuarda,
        actualizadoEn: serverTimestamp()
      }), { merge: true });
    }
    await lote.commit();
  }
}

// Aprueba o rechaza varios elementos de una vez (Coordinador o Administrador).
// Solo cambia los datos de aprobación; el resto del elemento queda igual.
export async function decidirAprobacion(codigos, decision, motivo, rolQueDecide) {
  for (let inicio = 0; inicio < codigos.length; inicio += 400) {
    const lote = writeBatch(db);
    for (const codigo of codigos.slice(inicio, inicio + 400)) {
      lote.update(doc(db, COLECCION, codigo), {
        aprobacion: decision,                       // "Aprobado" o "Rechazado"
        aprobadoPor: rolQueDecide,
        aprobadoEn: serverTimestamp(),
        motivoRechazo: decision === "Rechazado" ? motivo : ""
      });
    }
    await lote.commit();
  }
}

// Borra todo el inventario, traslados y compras (solo el Administrador)
export async function vaciarInventario() {
  const fichas = [];
  for (const nombre of [COLECCION, TRASLADOS, COMPRAS]) {
    const resultado = await getDocs(collection(db, nombre));
    resultado.forEach(function (documento) { fichas.push(documento.ref); });
  }

  for (let inicio = 0; inicio < fichas.length; inicio += 400) {
    const lote = writeBatch(db);
    for (const ficha of fichas.slice(inicio, inicio + 400)) lote.delete(ficha);
    await lote.commit();
  }
}

// =====================================================================
// TRASLADOS (solicitar, aprobar, enviar y recibir)
// =====================================================================
// Cada traslado es una ficha en la colección "traslados" con su estado:
//   Solicitado -> Aprobado -> En tránsito -> Recibido
//              -> Rechazado

// Trae todos los traslados, del más nuevo al más viejo
export async function leerTraslados() {
  const resultado = await getDocs(collection(db, TRASLADOS));
  const lista = [];
  resultado.forEach(function (documento) {
    // El id lo crea Firebase; lo guardamos para poder actualizar la ficha
    lista.push(Object.assign({ id: documento.id }, convertirFechas(documento.data())));
  });
  lista.sort(function (a, b) { return (b.solicitadoEn || 0) - (a.solicitadoEn || 0); });
  return lista;
}

// Crea una solicitud nueva (Vendedor o Administrador)
export async function crearSolicitud(solicitud, rolQueSolicita) {
  await addDoc(collection(db, TRASLADOS), {
    codigoElemento: solicitud.codigoElemento,
    nombreElemento: solicitud.nombreElemento,
    origen: solicitud.origen,
    destino: solicitud.destino,
    motivo: solicitud.motivo,
    estado: "Solicitado",
    solicitadoPor: rolQueSolicita,
    solicitadoEn: serverTimestamp()
  });
}

// Mueve el traslado al siguiente estado según la acción:
//   "aprobar" / "rechazar"  -> solo el Coordinador
//   "enviar" / "recibir"    -> Bodeguista (o Administrador)
export async function avanzarTraslado(traslado, accion, rol, motivo) {
  const ficha = doc(db, TRASLADOS, traslado.id);

  if (accion === "aprobar") {
    await updateDoc(ficha, { estado: "Aprobado", aprobadoPor: rol, aprobadoEn: serverTimestamp(), motivoRechazo: "" });
  } else if (accion === "rechazar") {
    await updateDoc(ficha, { estado: "Rechazado", aprobadoPor: rol, aprobadoEn: serverTimestamp(), motivoRechazo: motivo });
  } else if (accion === "enviar") {
    await updateDoc(ficha, { estado: "En tránsito", enviadoPor: rol, enviadoEn: serverTimestamp() });
  } else if (accion === "recibir") {
    // Al recibir pasan DOS cosas al mismo tiempo (en un lote):
    // el traslado queda "Recibido" y el elemento cambia de ubicación.
    // Si una falla, no se guarda ninguna.
    const lote = writeBatch(db);
    lote.update(ficha, { estado: "Recibido", recibidoPor: rol, recibidoEn: serverTimestamp() });
    // El elemento queda en su nuevo lugar: ubicación, agrupación, proyecto y situación
    const destino = agrupacionPorNombre(traslado.destino);
    lote.update(doc(db, COLECCION, traslado.codigoElemento), {
      ubicacion: traslado.destino,
      agrupacion: destino.id,
      proyecto: destino.proyecto,
      estadoGestion: destino.id === "AGR-BOD" ? "En bodega" : "Asignado",
      ultimoTraslado: traslado.id
    });
    await lote.commit();
  }
}

// =====================================================================
// COMPRAS (solicitar, revisar y registrar)
// =====================================================================
// Estados:  Solicitada -> Aprobada -> Comprada
//                      -> Reutilizada (había uno igual: no se compra)
//                      -> Rechazada

export async function leerCompras() {
  const resultado = await getDocs(collection(db, COMPRAS));
  const lista = [];
  resultado.forEach(function (documento) {
    lista.push(Object.assign({ id: documento.id }, convertirFechas(documento.data())));
  });
  lista.sort(function (a, b) { return (b.solicitadoEn || 0) - (a.solicitadoEn || 0); });
  return lista;
}

export async function crearSolicitudCompra(solicitud, rolQueSolicita) {
  await addDoc(collection(db, COMPRAS), {
    nombre: solicitud.nombre,
    categoria: solicitud.categoria,
    cantidad: solicitud.cantidad,
    destino: solicitud.destino,
    motivo: solicitud.motivo,
    elementoRelacionado: solicitud.elementoRelacionado || "",
    estado: "Solicitada",
    solicitadoPor: rolQueSolicita,
    solicitadoEn: serverTimestamp()
  });
}

// Compras decide: "Aprobada", "Rechazada" o "Reutilizada"
export async function revisarCompra(compra, decision, motivo, codigoReutilizado, rol) {
  await updateDoc(doc(db, COMPRAS, compra.id), {
    estado: decision,
    revisadoPor: rol,
    revisadoEn: serverTimestamp(),
    motivoRechazo: motivo || "",
    reutilizaCodigo: codigoReutilizado || ""
  });
}

// Registra la compra: crea los elementos nuevos en el inventario y marca
// la solicitud como "Comprada", todo en un solo lote.
export async function registrarCompra(compra, elementosNuevos, valorUnitario, rol) {
  const lote = writeBatch(db);
  for (const el of elementosNuevos) {
    lote.set(doc(db, COLECCION, el.codigo), Object.assign({}, el, {
      actualizadoPor: rol,
      actualizadoEn: serverTimestamp()
    }));
  }
  lote.update(doc(db, COMPRAS, compra.id), {
    estado: "Comprada",
    compradoPor: rol,
    compradoEn: serverTimestamp(),
    valorUnitario: valorUnitario,
    codigosCreados: elementosNuevos.map(function (el) { return el.codigo; })
  });
  await lote.commit();
}
