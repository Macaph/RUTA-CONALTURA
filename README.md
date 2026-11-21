# RUTA · Registro Unificado de Traslados y Activos

> **Cada elemento con su ruta.**

Solución al **Reto 19 de EstudIA**: Conaltura necesita controlar el inventario de sus salas de ventas, apartamentos modelo y bodegas (mobiliario, decoración, electrodomésticos, tecnología y material publicitario).

## Ver la página publicada
👉 **https://macaph.github.io/RUTA-CONALTURA/** (GitHub Pages)

## ¿Cómo se abre en el computador?
La página usa **Firebase** (base de datos en la nube de Google), así que **no abre con doble clic**. Hay dos formas:
- **En VS Code:** instala la extensión **Live Server**, clic derecho sobre `index.html` → *Open with Live Server*.
- **En internet:** desde GitHub Pages (cuando lo publiquemos).

Se necesita internet, porque los datos viven en Firebase y no en el computador. Así todos los roles ven la misma información desde cualquier equipo.

## Demo rápida del inventario
1. Entra como `bodeguista` (o `vendedor`) → **Registrar elementos** → **Cargar Excel** → elige `ejemplos/inventario_inicial_ejemplo.xlsx`.
2. Mira el resultado: 18 agregados y 2 filas rechazadas (tienen errores a propósito).
3. Ve a **Ver inventario**: filtra por ubicación o estado y dale **Descargar Excel**.

## Usuarios
Hay una cuenta por rol. En la página se escribe solo el rol (`vendedor`); el sistema completa el correo (`vendedor@conaltura.com`).

| Usuario | Correo en Firebase |
|---|---|
| vendedor | vendedor@conaltura.com |
| bodeguista | bodeguista@conaltura.com |
| administrador | administrador@conaltura.com |
| compras | compras@conaltura.com |
| coordinador | coordinador@conaltura.com |

🔒 **Las contraseñas no se publican aquí**: este repositorio es público. Pídeselas al equipo.

Las contraseñas tampoco están en el código: las revisa Firebase Authentication. El rol sale del correo (lo que va antes de la @).

## Seguridad
- **Firebase Authentication** valida usuario y contraseña en los servidores de Google.
- **Reglas de seguridad** (`firestore.rules`): aunque alguien modifique el JavaScript, el servidor no lo deja hacer lo que su rol no permite. Por ejemplo, el Vendedor no puede registrar en la Bodega central y solo el Administrador puede borrar.
- Todo lo que se escribe (o viene en un Excel) se muestra como texto, así que no se puede inyectar código en la página.

## ¿De qué está hecho?
| Archivo | ¿Para qué sirve? | Comparación |
|---|---|---|
| `index.html` | La estructura: títulos, botones, listas | El esqueleto de la casa |
| `css/estilos.css` | Cómo se ve: colores, tamaños | La pintura y la decoración |
| `js/app.js` | Ingreso, roles y menú | La electricidad |
| `js/inventario.js` | Pantallas del inventario y el Excel | El cuarto útil de la casa |
| `js/aprobaciones.js` | Pantalla para aprobar o rechazar el inventario | La oficina del coordinador |
| `js/traslados.js` | Solicitudes, envíos, recibos e historial | El camión de mudanzas |
| `js/compras.js` | Novedades, solicitudes de compra y reutilización | La oficina de compras |
| `js/reportes.js` | Reportes, gráficas y tabla de permisos | El tablero de control |
| `js/utilidades.js` | Funciones pequeñas que usan varios archivos | La caja de herramientas |
| `js/datos.js` | El único archivo que habla con la base de datos | El mensajero |
| `js/firebase-config.js` | Los datos para conectarse a nuestro proyecto de Firebase | La dirección de la bodega |
| `firestore.rules` | Reglas de seguridad (se pegan en la consola de Firebase) | El celador |
| `js/lib/xlsx.full.min.js` | Librería SheetJS para leer y crear Excel (no se toca) | Una herramienta prestada |
| `ejemplos/inventario_inicial_ejemplo.xlsx` | Excel de prueba con 20 elementos | |

Los datos se guardan en **Cloud Firestore** (Firebase), en la colección `inventario`. Cada elemento es un documento cuyo nombre es su código (ej: `RUTA-001`). No hay que programar un servidor (backend).

## Solicitudes y traslados
Resuelve otra parte del reto: *"los traslados entre salas o hacia la bodega no siempre se documentan"*.

| Paso | Quién | Dónde en el menú | Estado |
|---|---|---|---|
| 1. Pide un elemento (de otra sala o de la bodega) | Vendedor | Solicitar elementos | 📝 Solicitado |
| 2. Aprueba o rechaza (con motivo) | Coordinador | Aprobar solicitudes | ✅ Aprobado / ❌ Rechazado |
| 3. Lo despacha | Bodeguista | Enviar / Recibir traslados | 🚚 En tránsito |
| 4. Confirma que llegó → **el elemento cambia de ubicación solo** | Bodeguista | Enviar / Recibir traslados | 📦 Recibido |

- Solo se pueden pedir elementos **aprobados** y que no estén ya en otro traslado.
- En **Ver inventario**, el botón **🕓 Ver** muestra el **historial** del elemento: por dónde ha pasado, quién lo pidió, quién aprobó, quién lo envió y quién lo recibió, con fechas.
- **Informar traslados** (Bodeguista) y **Traslados** (Administrador) muestran todos los traslados con filtro y se pueden descargar a Excel.
- **Solo el Coordinador** aprueba o rechaza traslados (ni siquiera el Administrador). El Administrador puede solicitar, enviar y recibir.

## Novedades, compras y reportes
Resuelve las partes del reto *"se pierden o se deterioran elementos sin que nadie lo note"* y *"se compran artículos que ya existen en otra sala"*.

- **Reportar novedad (Vendedor):** si algo se daña, se reporta su nuevo estado y vuelve a quedar pendiente para que el Coordinador lo confirme. Con un clic se puede pedir la reposición (solicitud de compra).
- **Revisar solicitudes de compra (Compras):** antes de comprar, RUTA **busca en el inventario elementos parecidos disponibles** (misma categoría y nombre parecido, primero los de la bodega). Compras decide:
  - **♻️ Reutilizar** → no se compra (compra evitada); quien la pidió solicita el traslado.
  - **✅ Aprobar compra** o **❌ Rechazar** (con motivo).
- **Registrar compra (Compras):** se anota el valor y los elementos nuevos entran solos al inventario (pendientes de aprobación del Coordinador).
- **Reportes (Compras, Coordinador y Administrador):** indicadores (total, disponibles para reutilizar, en mal estado, traslados, **compras evitadas**, **total gastado**), gráficas por ubicación y categoría, tabla de estado por ubicación y listas de lo que está en mal estado y lo que se puede reutilizar. Se descarga en Excel con 6 hojas.
- **Usuarios (Administrador):** tabla de qué puede hacer cada rol y cómo crear usuarios en la consola de Firebase.

## Diseño
Usa los colores del logo de Conaltura: **azul petróleo `#124E60`** y **verde lima `#9CD818`**, con letras redondeadas parecidas a las de la marca (**Comfortaa** para títulos y **Nunito** para el texto, de Google Fonts). Toda la interfaz usa solo los colores de Conaltura. La navegación es un menú tipo hamburguesa (☰) con botón **← Atrás**.

## Roles (según la cartelera)
- **Vendedor:** sube el inventario de su sala o apartamento modelo, solicita elementos y reporta novedades.
- **Bodeguista:** gestiona la bodega, envía, recibe e informa traslados.
- **Administrador:** acceso completo y control, reportes y usuarios.
- **Compras:** compra, revisa, solicita y hace reportes.
- **Coordinador:** está a cargo de la sala, aprueba el inventario y las solicitudes, y hace reportes.

## Aprobación del inventario
Resuelve una parte del reto: *"no hay un proceso formal para aprobar el inventario"*.

1. El **Vendedor** o el **Bodeguista** registran (a mano o con Excel) → queda **⏳ Pendiente**.
2. El **Coordinador** (o el Administrador) entra a **Aprobar inventario** → **✅ Aprueba** o **❌ Rechaza** con un motivo.
3. Si se rechaza, quien lo registró ve el motivo, lo corrige y lo vuelve a subir → queda Pendiente otra vez.

Lo que registra el **Administrador** queda aprobado de una. La idea es que **quien registra no se aprueba a sí mismo** (separación de funciones), y las reglas de Firebase lo hacen cumplir.

## Pendiente
- [ ] Conectar RUTA a su **propio proyecto de Firebase**.
- [ ] Logo de RUTA.
- [ ] Cambios del equipo.
