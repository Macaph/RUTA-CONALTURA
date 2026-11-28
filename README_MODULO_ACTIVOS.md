# Módulo Administración de Activos y Adquisiciones

## RUTA - Registro Unificado de Traslados y Activos

Este módulo amplía RUTA para cubrir el ciclo administrativo básico de los activos: adquisición, consulta, actualización, paso a saldos, baja y valoración operativa.

## 1. Alcance del módulo

El rol interno `compras` conserva su identificador técnico para no alterar Firebase Authentication, pero su nombre visible cambia a:

**Administración de Activos y Adquisiciones**

El módulo incorpora cuatro funciones principales:

1. Registrar adquisición.
2. Gestionar activos.
3. Gestionar saldos y bajas.
4. Consultar valoración de activos.

También conserva el acceso a:

- Ver inventario.
- Revisar solicitudes de compra.
- Reportes.

## 2. Archivos nuevos

### `js/activos-adquisiciones.js`

Contiene la interfaz y la lógica funcional del módulo:

- Registro de adquisiciones.
- Búsqueda y filtros.
- Edición de activos.
- Consulta de historial.
- Gestión de saldos.
- Gestión de bajas.
- Valoración por proyecto y agrupación.

### `css/activos-adquisiciones.css`

Contiene los estilos específicos del módulo:

- Formularios.
- Tablas.
- Filtros.
- Indicadores.
- Línea de tiempo.
- Diseño adaptable para computador y celular.

### `PRUEBAS_MODULO_ACTIVOS.md`

Contiene las pruebas funcionales, de integración y de seguridad que deben ejecutarse antes de subir los cambios al repositorio principal.

## 3. Archivos modificados

### `js/datos.js`

Agrega la colección:

```text
movimientos_activos
```

También agrega:

```javascript
leerMovimientosActivos()
registrarMovimientoActivo()
```

### `js/app.js`

- Importa el módulo nuevo.
- Cambia el nombre visible del rol `compras`.
- Agrega las opciones del módulo al menú.
- Conecta cada opción con su pantalla.

### `index.html`

Agrega el archivo de estilos:

```html
<link rel="stylesheet" href="css/activos-adquisiciones.css">
```

### `firestore.rules`

- Autoriza al rol `compras` para administrar activos.
- Protege la colección `movimientos_activos`.
- Mantiene los movimientos como registros inmutables.
- Conserva las reglas existentes de inventario, compras y traslados.

## 4. Estructura final

```text
RUTA-CONALTURA/
├── index.html
├── firestore.rules
├── README_MODULO_ACTIVOS.md
├── PRUEBAS_MODULO_ACTIVOS.md
├── css/
│   ├── estilos.css
│   └── activos-adquisiciones.css
└── js/
    ├── activos-adquisiciones.js
    ├── app.js
    ├── datos.js
    └── ...archivos existentes
```

## 5. Instalación paso a paso

### Paso 1. Crear una rama de trabajo

Desde la terminal de PyCharm:

```bash
git pull origin main
git switch -c modulo-activos-adquisiciones
```

Si la rama ya existe:

```bash
git switch modulo-activos-adquisiciones
```

### Paso 2. Copiar los archivos nuevos

Copiar:

```text
activos-adquisiciones.js
```

en:

```text
js/activos-adquisiciones.js
```

Copiar:

```text
activos-adquisiciones.css
```

en:

```text
css/activos-adquisiciones.css
```

Copiar en la raíz:

```text
README_MODULO_ACTIVOS.md
PRUEBAS_MODULO_ACTIVOS.md
firestore.rules
```

### Paso 3. Reemplazar archivos modificados

Reemplazar completamente:

```text
index.html
js/app.js
js/datos.js
```

No mezclar fragmentos de versiones anteriores.

### Paso 4. Publicar las reglas de Firestore

1. Abrir Firebase Console.
2. Entrar al proyecto de RUTA.
3. Abrir **Firestore Database**.
4. Seleccionar **Reglas**.
5. Reemplazar el contenido por `firestore.rules`.
6. Pulsar **Publicar**.

### Paso 5. Ejecutar localmente

Desde la raíz del proyecto:

```bash
python -m http.server 8000
```

Abrir:

```text
http://localhost:8000
```

No abrir `index.html` con doble clic, porque los módulos JavaScript necesitan un servidor HTTP.

## 6. Usuario de prueba

El usuario autenticado debe conservar el correo:

```text
compras@conaltura.com
```

El identificador técnico del rol sigue siendo:

```text
compras
```

Solo cambia el nombre que aparece en pantalla.

## 7. Colecciones de Firestore

El sistema utiliza:

```text
inventario
traslados
compras
movimientos_activos
```

### Documento de inventario

Ejemplo:

```javascript
{
  codigo: "EL-00001",
  nombre: "Televisor 55 pulgadas",
  categoria: "Tecnología",
  cantidad: 1,
  valorUnitario: 2500000,
  proveedor: "Proveedor Tecnología 01",
  fechaCompra: "2026-11-26",
  proyecto: "PRY-B",
  agrupacion: "AGR-B-SV",
  ubicacion: "Proyecto B · Sala de ventas",
  espacio: "",
  estado: "Bueno",
  estadoGestion: "Asignado",
  responsable: "Vendedor",
  reparaciones: 0,
  observaciones: "",
  foto: "",
  aprobacion: "Pendiente",
  aprobadoPor: "",
  motivoRechazo: ""
}
```

### Documento de movimiento

Ejemplo:

```javascript
{
  codigoActivo: "EL-00001",
  nombreActivo: "Televisor 55 pulgadas",
  tipo: "ADQUISICIÓN",
  estadoAnterior: "",
  estadoNuevo: "Asignado",
  motivo: "Compra registrada",
  observaciones: "Proveedor Tecnología 01 · $ 2.500.000",
  creadoPor: "compras",
  creadoEn: "ServerTimestamp"
}
```

## 8. Tipos de movimiento permitidos

```text
ADQUISICIÓN
ACTUALIZACIÓN
SALDO
BAJA
```

Los movimientos no se editan después de guardarse. Esto protege la trazabilidad del activo.

## 9. Flujo funcional

```text
Solicitud de compra
        ↓
Revisión de existencia para reutilización
        ↓
Registro de adquisición
        ↓
Creación del activo en inventario
        ↓
Gestión y consulta del activo
        ↓
Paso a saldos o baja
        ↓
Valoración e historial
```

## 10. Criterios de operación

- Cada activo tiene un código único.
- Una compra de varias unidades crea un código por unidad.
- Los activos adquiridos quedan pendientes de aprobación.
- Una baja no elimina el activo.
- Un activo en saldos puede conservarse para reutilización.
- Toda adquisición, actualización, saldo o baja genera trazabilidad.
- La valoración es operativa, no contable.
- No se calculan depreciación, impuestos ni asientos financieros.

## 11. Verificación antes del commit

Ejecutar todas las pruebas de:

```text
PRUEBAS_MODULO_ACTIVOS.md
```

Además, revisar:

```bash
git status
```

Los cambios esperados son:

```text
modified: index.html
modified: js/app.js
modified: js/datos.js
new file: css/activos-adquisiciones.css
new file: js/activos-adquisiciones.js
new file: firestore.rules
new file: README_MODULO_ACTIVOS.md
new file: PRUEBAS_MODULO_ACTIVOS.md
```

## 12. Commit y subida

Después de aprobar las pruebas:

```bash
git add index.html js/app.js js/datos.js js/activos-adquisiciones.js css/activos-adquisiciones.css firestore.rules README_MODULO_ACTIVOS.md PRUEBAS_MODULO_ACTIVOS.md
git commit -m "Agregar modulo de administracion de activos y adquisiciones"
git push -u origin modulo-activos-adquisiciones
```

Después se crea un Pull Request en GitHub desde:

```text
modulo-activos-adquisiciones
```

hacia:

```text
main
```

## 13. No hacer todavía

- No ejecutar `git push origin main` directamente.
- No borrar colecciones de Firestore.
- No cambiar el identificador técnico `compras`.
- No crear un segundo usuario o rol para finanzas en esta versión.
- No agregar depreciación contable al MVP.
- No mezclar estos cambios con modificaciones no relacionadas.
