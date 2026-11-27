# Registro de cambios: Administración de Activos y Adquisiciones

## Versión 1.0.0

### Estado

MVP preparado para integración y pruebas en RUTA.

### Funcionalidades agregadas

- Registro de adquisiciones con creación individual de activos.
- Generación automática de códigos con formato `EL-00000`.
- Consulta, búsqueda y filtrado de activos.
- Edición de nombre, estado físico, responsable y observaciones.
- Consulta del historial administrativo de cada activo.
- Paso de activos a la lista de saldos.
- Registro de bajas sin eliminar el activo ni su historial.
- Valoración operativa por proyecto y agrupación.
- Indicadores de activos vigentes, saldos y bajas.

### Cambios en roles

- Se conserva el identificador técnico `compras`.
- El nombre visible del rol cambia a **Administración de Activos y Adquisiciones**.
- Se agregan al menú del rol:
  - Registrar adquisición.
  - Gestionar activos.
  - Gestionar saldos y bajas.
  - Valoración de activos.
- Se conserva el acceso a inventario, solicitudes de compra y reportes.

### Cambios en datos

Se agrega la colección de Firestore:

```text
movimientos_activos
```

Tipos de movimiento permitidos:

```text
ADQUISICIÓN
ACTUALIZACIÓN
SALDO
BAJA
```

Los movimientos son inmutables para proteger la trazabilidad.

### Archivos nuevos

```text
js/activos-adquisiciones.js
css/activos-adquisiciones.css
firestore.rules
README_MODULO_ACTIVOS.md
PRUEBAS_MODULO_ACTIVOS.md
.github/PULL_REQUEST_TEMPLATE.md
CHANGELOG_MODULO_ACTIVOS.md
```

### Archivos modificados

```text
index.html
js/app.js
js/datos.js
```

### Seguridad

- El rol `compras` puede crear adquisiciones y administrar activos.
- El rol `administrador` conserva permisos administrativos.
- Vendedor, bodeguista y coordinador no reciben acceso al nuevo menú.
- Las bajas no eliminan documentos del inventario.
- Solo el administrador puede eliminar movimientos durante una limpieza autorizada.

### Limitaciones conocidas del MVP

No incluye:

- Depreciación contable.
- Venta formal de saldos.
- Facturación.
- Integración con ERP.
- Gestión tributaria.
- Asientos contables.
- Autorizaciones financieras multinivel.

### Pendiente antes de fusionar

- Publicar `firestore.rules` en Firebase Console.
- Ejecutar todas las pruebas de `PRUEBAS_MODULO_ACTIVOS.md`.
- Verificar la consola del navegador.
- Tomar evidencias de las cuatro pantallas nuevas.
- Crear Pull Request hacia `main`.
