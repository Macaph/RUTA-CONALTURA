/*
  ADMINISTRACIÓN DE ACTIVOS Y ADQUISICIONES
  Módulo del rol Compras, Administración y Finanzas.

  Submódulos:
    1. Registrar adquisición
    2. Gestionar activos
    3. Gestionar saldos y bajas
    4. Valoración de activos

  Este archivo contiene la interfaz y la lógica del módulo.
  La comunicación con Firebase permanece centralizada en datos.js.
*/

import {
  leerInventario,
  guardarElementos,
  leerMovimientosActivos,
  registrarMovimientoActivo,
  mensajeDeError
} from "./datos.js";

import {
  escapar,
  normalizar,
  mostrarCargando,
  opciones,
  pesos,
  fecha,
  CATEGORIAS,
  ESTADOS,
  ESTADOS_GESTION,
  UBICACIONES,
  UBICACIONES_DISPONIBLES,
  AGRUPACIONES,
  agrupacionPorNombre,
  responsableDe
} from "./utilidades.js";

let contenido = null;
let usuario = null;
let inventario = [];
let movimientos = [];
let pantallaActual = null;

const MOTIVOS_SALDO = [
  "Cierre de sala",
  "Remodelación",
  "Reemplazo",
  "Disponible para reutilización",
  "Otro"
];

const MOTIVOS_BAJA = [
  "Daño irreparable",
  "Obsolescencia",
  "Pérdida",
  "Hurto",
  "Fin de vida útil",
  "Otro"
];

function hoyISO() {
  const hoy = new Date();
  return hoy.getFullYear() + "-" +
    String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
    String(hoy.getDate()).padStart(2, "0");
}

function valorTotal(elemento) {
  return (Number(elemento.cantidad) || 0) * (Number(elemento.valorUnitario) || 0);
}

function siguienteCodigo() {
  let mayor = 0;
  for (const elemento of inventario) {
    const numero = parseInt(String(elemento.codigo || "").replace(/\D/g, ""), 10);
    if (Number.isFinite(numero) && numero > mayor) mayor = numero;
  }
  return "EL-" + String(mayor + 1).padStart(5, "0");
}

async function cargarDatos() {
  const resultados = await Promise.all([
    leerInventario(),
    leerMovimientosActivos()
  ]);
  inventario = resultados[0];
  movimientos = resultados[1];
}

function crearPantalla(dibujar) {
  return async function (cajaContenido, usuarioConectado) {
    contenido = cajaContenido;
    usuario = usuarioConectado;
    pantallaActual = async function (mensajeExito) {
      contenido.innerHTML = mostrarCargando("Cargando activos...");
      try {
        await cargarDatos();
        dibujar();
        if (mensajeExito) {
          const aviso = document.createElement("p");
          aviso.className = "exito";
          aviso.textContent = mensajeExito;
          const titulo = contenido.querySelector("h2");
          if (titulo) titulo.after(aviso);
        }
      } catch (error) {
        contenido.innerHTML =
          '<p class="lista-errores">' + escapar(mensajeDeError(error)) + "</p>";
      }
    };
    await pantallaActual();
  };
}

function opcionesAgrupaciones() {
  return opciones(UBICACIONES_DISPONIBLES, "Elige el destino...");
}

function tablaActivos(lista, incluirAcciones) {
  if (lista.length === 0) {
    return '<p class="vacio">No hay activos que coincidan con los filtros.</p>';
  }

  let html = '<div class="tabla-scroll"><table><thead><tr>' +
    "<th>Código</th><th>Activo</th><th>Categoría</th><th>Ubicación</th>" +
    "<th>Responsable</th><th>Estado físico</th><th>Situación</th>" +
    '<th class="derecha">Valor</th>' +
    (incluirAcciones ? "<th>Acciones</th>" : "") +
    "</tr></thead><tbody>";

  for (const elemento of lista) {
    html += '<tr data-codigo="' + escapar(elemento.codigo) + '">' +
      '<td class="col-codigo">' + escapar(elemento.codigo) + "</td>" +
      "<td><b>" + escapar(elemento.nombre) + "</b>" +
      (elemento.espacio ? '<div class="detalle">' + escapar(elemento.espacio) + "</div>" : "") +
      "</td>" +
      "<td>" + escapar(elemento.categoria) + "</td>" +
      "<td>" + escapar(elemento.ubicacion) + "</td>" +
      "<td>" + escapar(elemento.responsable || "—") + "</td>" +
      "<td>" + escapar(elemento.estado || "—") + "</td>" +
      '<td class="col-situacion">' + escapar(elemento.estadoGestion || "—") + "</td>" +
      '<td class="derecha">' + pesos(valorTotal(elemento)) + "</td>";

    if (incluirAcciones) {
      html += '<td class="celda-acciones">' +
        '<button type="button" class="boton boton-mini boton-secundario" data-ver="' + escapar(elemento.codigo) + '">Ver</button> ' +
        '<button type="button" class="boton boton-mini" data-editar="' + escapar(elemento.codigo) + '">Editar</button>' +
        "</td>";
    }
    html += "</tr>";
  }

  return html + "</tbody></table></div>";
}

function historialDelActivo(codigo) {
  const lista = movimientos.filter(function (movimiento) {
    return movimiento.codigoActivo === codigo;
  });

  if (lista.length === 0) {
    return '<p class="vacio">Este activo todavía no tiene movimientos administrativos registrados.</p>';
  }

  let html = '<ol class="linea-tiempo">';
  for (const movimiento of lista) {
    html += "<li><b>" + escapar(movimiento.tipo) + "</b> · " + fecha(movimiento.creadoEn) +
      "<br><small>Usuario: " + escapar(movimiento.creadoPor || "—") +
      (movimiento.motivo ? " · Motivo: " + escapar(movimiento.motivo) : "") +
      (movimiento.observaciones ? "<br>" + escapar(movimiento.observaciones) : "") +
      "</small></li>";
  }
  return html + "</ol>";
}

export const mostrarRegistrarAdquisicion = crearPantalla(function () {
  contenido.innerHTML =
    "<h2>Registrar adquisición</h2>" +
    '<p class="subtitulo">Registra la compra y crea el activo directamente en el inventario de RUTA.</p>' +
    '<div class="bloque">' +
    '<form id="formAdquisicion" class="formulario-grid">' +
    '<label>Nombre del activo *<input id="adqNombre" required maxlength="100" placeholder="Ej: Televisor 55 pulgadas"></label>' +
    '<label>Categoría *<select id="adqCategoria" required>' + opciones(CATEGORIAS, "Elige...") + "</select></label>" +
    '<label>Cantidad *<input id="adqCantidad" type="number" min="1" max="999" value="1" required></label>' +
    '<label>Valor unitario (COP) *<input id="adqValor" type="number" min="0" step="1000" required placeholder="Ej: 2500000"></label>' +
    '<label>Proveedor *<input id="adqProveedor" required maxlength="100" placeholder="Ej: Proveedor Tecnología 01"></label>' +
    '<label>Fecha de compra *<input id="adqFecha" type="date" max="' + hoyISO() + '" required></label>' +
    '<label>Proyecto o ubicación destino *<select id="adqUbicacion" required>' + opcionesAgrupaciones() + "</select></label>" +
    '<label>Estado físico *<select id="adqEstado" required>' + opciones(ESTADOS, "Elige...") + "</select></label>" +
    '<label class="ancho-completo">Observaciones<input id="adqObservaciones" maxlength="300" placeholder="Información adicional de la adquisición"></label>' +
    '<div class="fila-botones ancho-completo">' +
    '<button type="submit" id="botonGuardarAdquisicion" class="boton">Guardar adquisición</button>' +
    '<button type="reset" class="boton boton-secundario">Limpiar formulario</button>' +
    "</div></form></div>";

  document.getElementById("adqFecha").value = hoyISO();

  document.getElementById("formAdquisicion").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const boton = document.getElementById("botonGuardarAdquisicion");
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
      const ubicacion = document.getElementById("adqUbicacion").value;
      const agrupacion = agrupacionPorNombre(ubicacion);
      if (!agrupacion) throw new Error("La ubicación seleccionada no es válida.");

      const cantidad = parseInt(document.getElementById("adqCantidad").value, 10);
      const valor = parseInt(document.getElementById("adqValor").value, 10);
      const codigoInicial = parseInt(siguienteCodigo().replace(/\D/g, ""), 10);
      const elementos = [];

      for (let i = 0; i < cantidad; i++) {
        elementos.push({
          codigo: "EL-" + String(codigoInicial + i).padStart(5, "0"),
          proyecto: agrupacion.proyecto,
          agrupacion: agrupacion.id,
          ubicacion: agrupacion.nombre,
          espacio: "",
          nombre: document.getElementById("adqNombre").value.trim(),
          categoria: document.getElementById("adqCategoria").value,
          cantidad: 1,
          estado: document.getElementById("adqEstado").value,
          estadoGestion: agrupacion.id === "AGR-BOD" ? "En bodega" : "Asignado",
          valorUnitario: valor,
          fechaCompra: document.getElementById("adqFecha").value,
          proveedor: document.getElementById("adqProveedor").value.trim(),
          reparaciones: 0,
          responsable: responsableDe(agrupacion.nombre),
          observaciones: document.getElementById("adqObservaciones").value.trim(),
          foto: "",
          aprobacion: "Pendiente",
          aprobadoPor: "",
          motivoRechazo: ""
        });
      }

      await guardarElementos(elementos, usuario.rol);
      await Promise.all(elementos.map(function (elemento) {
        return registrarMovimientoActivo({
          codigoActivo: elemento.codigo,
          nombreActivo: elemento.nombre,
          tipo: "ADQUISICIÓN",
          estadoAnterior: "",
          estadoNuevo: elemento.estadoGestion,
          motivo: "Compra registrada",
          observaciones: elemento.proveedor + " · " + pesos(elemento.valorUnitario)
        }, usuario.rol);
      }));

      await pantallaActual("✔ Adquisición registrada. Se crearon: " + elementos.map(function (e) { return e.codigo; }).join(", ") + ".");
    } catch (error) {
      alert(mensajeDeError(error));
      boton.disabled = false;
      boton.textContent = "Guardar adquisición";
    }
  });
});

export const mostrarGestionarActivos = crearPantalla(function () {
  contenido.innerHTML =
    "<h2>Gestionar activos</h2>" +
    '<div class="filtros">' +
    '<input id="activoBuscar" placeholder="Buscar por código, nombre o responsable">' +
    '<select id="activoUbicacion">' + opciones(UBICACIONES, "Todas las ubicaciones") + "</select>" +
    '<select id="activoCategoria">' + opciones(CATEGORIAS, "Todas las categorías") + "</select>" +
    '<select id="activoGestion">' + opciones(ESTADOS_GESTION, "Todas las situaciones") + "</select>" +
    "</div>" +
    '<div id="detalleActivo"></div>' +
    '<div id="tablaGestionActivos"></div>';

  function redibujar() {
    const texto = normalizar(document.getElementById("activoBuscar").value);
    const ubicacion = document.getElementById("activoUbicacion").value;
    const categoria = document.getElementById("activoCategoria").value;
    const gestion = document.getElementById("activoGestion").value;

    const filtrados = inventario.filter(function (elemento) {
      return normalizar(elemento.codigo + " " + elemento.nombre + " " + (elemento.responsable || "")).includes(texto) &&
        (!ubicacion || elemento.ubicacion === ubicacion) &&
        (!categoria || elemento.categoria === categoria) &&
        (!gestion || elemento.estadoGestion === gestion);
    });

    const tabla = document.getElementById("tablaGestionActivos");
    tabla.innerHTML = tablaActivos(filtrados, true);

    tabla.querySelectorAll("[data-ver]").forEach(function (boton) {
      boton.addEventListener("click", function () {
        const elemento = inventario.find(function (e) { return e.codigo === boton.dataset.ver; });
        document.getElementById("detalleActivo").innerHTML =
          '<div class="bloque historial"><button type="button" class="cerrar" id="cerrarDetalleActivo">✕</button>' +
          "<h3>" + escapar(elemento.codigo) + " · " + escapar(elemento.nombre) + "</h3>" +
          "<p><b>Ubicación:</b> " + escapar(elemento.ubicacion) +
          " · <b>Responsable:</b> " + escapar(elemento.responsable || "—") +
          " · <b>Valor:</b> " + pesos(valorTotal(elemento)) + "</p>" +
          "<h4>Historial administrativo</h4>" + historialDelActivo(elemento.codigo) + "</div>";
        document.getElementById("cerrarDetalleActivo").addEventListener("click", function () {
          document.getElementById("detalleActivo").innerHTML = "";
        });
      });
    });

    tabla.querySelectorAll("[data-editar]").forEach(function (boton) {
      boton.addEventListener("click", function () {
        const elemento = inventario.find(function (e) { return e.codigo === boton.dataset.editar; });
        mostrarFormularioEdicion(elemento);
      });
    });
  }

  function mostrarFormularioEdicion(elemento) {
    document.getElementById("detalleActivo").innerHTML =
      '<div class="bloque historial"><button type="button" class="cerrar" id="cerrarEdicionActivo">✕</button>' +
      "<h3>Editar " + escapar(elemento.codigo) + "</h3>" +
      '<form id="formEditarActivo" class="formulario-grid">' +
      '<label>Nombre *<input id="editNombre" required maxlength="100" value="' + escapar(elemento.nombre) + '"></label>' +
      '<label>Estado físico *<select id="editEstado">' + opciones(ESTADOS) + "</select></label>" +
      '<label>Responsable<input id="editResponsable" maxlength="80" value="' + escapar(elemento.responsable || "") + '"></label>' +
      '<label class="ancho-completo">Observaciones<input id="editObservaciones" maxlength="300" value="' + escapar(elemento.observaciones || "") + '"></label>' +
      '<button type="submit" class="boton ancho-completo">Guardar cambios</button>' +
      "</form></div>";

    document.getElementById("editEstado").value = elemento.estado;
    document.getElementById("cerrarEdicionActivo").addEventListener("click", function () {
      document.getElementById("detalleActivo").innerHTML = "";
    });

    document.getElementById("formEditarActivo").addEventListener("submit", async function (evento) {
      evento.preventDefault();
      evento.target.querySelector("button").disabled = true;
      try {
        await guardarElementos([{
          codigo: elemento.codigo,
          nombre: document.getElementById("editNombre").value.trim(),
          estado: document.getElementById("editEstado").value,
          responsable: document.getElementById("editResponsable").value.trim(),
          observaciones: document.getElementById("editObservaciones").value.trim()
        }], usuario.rol);

        await registrarMovimientoActivo({
          codigoActivo: elemento.codigo,
          nombreActivo: elemento.nombre,
          tipo: "ACTUALIZACIÓN",
          estadoAnterior: elemento.estadoGestion,
          estadoNuevo: elemento.estadoGestion,
          motivo: "Actualización de datos básicos",
          observaciones: document.getElementById("editObservaciones").value.trim()
        }, usuario.rol);

        await pantallaActual("✔ Activo " + elemento.codigo + " actualizado.");
      } catch (error) {
        alert(mensajeDeError(error));
        evento.target.querySelector("button").disabled = false;
      }
    });
  }

  document.getElementById("activoBuscar").addEventListener("input", redibujar);
  for (const id of ["activoUbicacion", "activoCategoria", "activoGestion"]) {
    document.getElementById(id).addEventListener("change", redibujar);
  }
  redibujar();
});

export const mostrarSaldosBajas = crearPantalla(function () {
  const disponibles = inventario.filter(function (elemento) {
    return elemento.estadoGestion !== "De baja";
  });
  const saldos = inventario.filter(function (elemento) {
    return elemento.estadoGestion === "En lista de saldos";
  });
  const bajas = inventario.filter(function (elemento) {
    return elemento.estadoGestion === "De baja";
  });

  let opcionesActivos = '<option value="">Elige el activo...</option>';
  for (const elemento of disponibles) {
    opcionesActivos += '<option value="' + escapar(elemento.codigo) + '">' +
      escapar(elemento.codigo + " · " + elemento.nombre + " · " + elemento.ubicacion) + "</option>";
  }

  contenido.innerHTML =
    "<h2>Gestionar saldos y bajas</h2>" +
    '<p class="aviso">Los elementos en saldo pueden reutilizarse. Una baja retira el activo de la operación sin borrar su historial.</p>' +
    '<div class="bloque">' +
    '<form id="formDisposicion" class="formulario-grid">' +
    '<label>Activo *<select id="dispActivo" required>' + opcionesActivos + "</select></label>" +
    '<label>Acción *<select id="dispAccion" required><option value="">Elige...</option><option value="SALDO">Enviar a saldos</option><option value="BAJA">Dar de baja</option></select></label>' +
    '<label>Motivo *<select id="dispMotivo" required><option value="">Primero elige la acción</option></select></label>' +
    '<label>Fecha *<input id="dispFecha" type="date" max="' + hoyISO() + '" required></label>' +
    '<label class="ancho-completo">Observaciones<input id="dispObservaciones" maxlength="300" placeholder="Detalle de la decisión"></label>' +
    '<button type="submit" id="botonDisposicion" class="boton ancho-completo">Guardar decisión</button>' +
    "</form></div>" +
    "<h3>En lista de saldos (" + saldos.length + ")</h3>" + tablaActivos(saldos, false) +
    "<h3>Dados de baja (" + bajas.length + ")</h3>" + tablaActivos(bajas, false);

  document.getElementById("dispFecha").value = hoyISO();
  document.getElementById("dispAccion").addEventListener("change", function () {
    const lista = this.value === "SALDO" ? MOTIVOS_SALDO : this.value === "BAJA" ? MOTIVOS_BAJA : [];
    document.getElementById("dispMotivo").innerHTML = opciones(lista, lista.length ? "Elige el motivo..." : "Primero elige la acción");
  });

  document.getElementById("formDisposicion").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const boton = document.getElementById("botonDisposicion");
    const codigo = document.getElementById("dispActivo").value;
    const elemento = inventario.find(function (e) { return e.codigo === codigo; });
    const accion = document.getElementById("dispAccion").value;
    const nuevoEstado = accion === "SALDO" ? "En lista de saldos" : "De baja";
    const motivo = document.getElementById("dispMotivo").value;
    const observaciones = document.getElementById("dispObservaciones").value.trim();

    if (!elemento) return;
    const pregunta = accion === "BAJA"
      ? "¿Confirmas la baja definitiva de " + elemento.codigo + "? El registro y el historial se conservarán."
      : "¿Confirmas que " + elemento.codigo + " pasa a la lista de saldos?";
    if (!confirm(pregunta)) return;

    boton.disabled = true;
    boton.textContent = "Guardando...";
    try {
      await guardarElementos([{
        codigo: elemento.codigo,
        estadoGestion: nuevoEstado,
        fechaDisposicion: document.getElementById("dispFecha").value,
        motivoDisposicion: motivo,
        observacionesDisposicion: observaciones
      }], usuario.rol);

      await registrarMovimientoActivo({
        codigoActivo: elemento.codigo,
        nombreActivo: elemento.nombre,
        tipo: accion,
        estadoAnterior: elemento.estadoGestion || "",
        estadoNuevo: nuevoEstado,
        motivo: motivo,
        observaciones: observaciones
      }, usuario.rol);

      await pantallaActual("✔ " + elemento.codigo + " quedó " + nuevoEstado.toLowerCase() + ".");
    } catch (error) {
      alert(mensajeDeError(error));
      boton.disabled = false;
      boton.textContent = "Guardar decisión";
    }
  });
});

export const mostrarValoracionActivos = crearPantalla(function () {
  const activosVigentes = inventario.filter(function (elemento) {
    return elemento.estadoGestion !== "De baja";
  });
  const saldos = inventario.filter(function (elemento) {
    return elemento.estadoGestion === "En lista de saldos";
  });
  const bajas = inventario.filter(function (elemento) {
    return elemento.estadoGestion === "De baja";
  });
  const valorDe = function (lista) {
    return lista.reduce(function (suma, elemento) { return suma + valorTotal(elemento); }, 0);
  };

  const proyectos = {};
  for (const elemento of inventario) {
    const proyecto = elemento.proyecto || "Sin proyecto";
    if (!proyectos[proyecto]) proyectos[proyecto] = { cantidad: 0, valor: 0 };
    proyectos[proyecto].cantidad += 1;
    proyectos[proyecto].valor += valorTotal(elemento);
  }

  let tablaProyectos = '<div class="tabla-scroll"><table><thead><tr><th>Proyecto</th><th class="derecha">Activos</th><th class="derecha">Valor</th></tr></thead><tbody>';
  for (const proyecto of Object.keys(proyectos).sort()) {
    tablaProyectos += "<tr><td>" + escapar(proyecto) + '</td><td class="derecha">' + proyectos[proyecto].cantidad +
      '</td><td class="derecha"><b>' + pesos(proyectos[proyecto].valor) + "</b></td></tr>";
  }
  tablaProyectos += "</tbody></table></div>";

  let tablaAgrupaciones = '<div class="tabla-scroll"><table><thead><tr><th>Agrupación</th><th>Estado</th><th class="derecha">Activos</th><th class="derecha">Valor</th></tr></thead><tbody>';
  for (const agrupacion of AGRUPACIONES) {
    const lista = inventario.filter(function (elemento) { return elemento.agrupacion === agrupacion.id; });
    tablaAgrupaciones += "<tr><td>" + escapar(agrupacion.nombre) + "</td><td>" + escapar(agrupacion.estado) +
      '</td><td class="derecha">' + lista.length + '</td><td class="derecha"><b>' + pesos(valorDe(lista)) + "</b></td></tr>";
  }
  tablaAgrupaciones += "</tbody></table></div>";

  contenido.innerHTML =
    "<h2>Valoración de activos</h2>" +
    '<p class="subtitulo">Valoración operativa basada en cantidad por valor unitario. No corresponde a depreciación contable.</p>' +
    '<div class="indicadores">' +
    '<div class="indicador"><b>' + inventario.length + "</b><span>activos registrados</span></div>" +
    '<div class="indicador"><b>' + pesos(valorDe(inventario)) + "</b><span>valor total registrado</span></div>" +
    '<div class="indicador"><b>' + activosVigentes.length + "</b><span>activos vigentes</span></div>" +
    '<div class="indicador"><b>' + saldos.length + "</b><span>en lista de saldos</span><small>" + pesos(valorDe(saldos)) + "</small></div>" +
    '<div class="indicador"><b>' + bajas.length + "</b><span>dados de baja</span><small>" + pesos(valorDe(bajas)) + "</small></div>" +
    "</div>" +
    "<h3>Valor por proyecto</h3>" + tablaProyectos +
    "<h3>Valor por agrupación</h3>" + tablaAgrupaciones;
});
