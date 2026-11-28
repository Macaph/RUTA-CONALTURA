# Administración de Activos y Adquisiciones

## 1. Resumen del cambio

Este Pull Request integra en RUTA el módulo **Administración de Activos y Adquisiciones**, asociado al identificador técnico de rol `compras`.

El módulo cubre el ciclo administrativo básico de los activos sin añadir contabilidad avanzada:

- Registro de adquisiciones.
- Consulta y actualización de activos.
- Gestión de saldos.
- Gestión de bajas.
- Trazabilidad administrativa.
- Valoración operativa por proyecto y agrupación.

## 2. Tipo de cambio

Marca con una `x` las opciones aplicables:

- [x] Nueva funcionalidad.
- [x] Modificación de funcionalidad existente.
- [x] Reglas de seguridad de Firestore.
- [x] Estilos de interfaz.
- [x] Documentación.
- [ ] Corrección de error.
- [ ] Cambio incompatible con versiones anteriores.

## 3. Archivos nuevos

- [x] `js/activos-adquisiciones.js`
- [x] `css/activos-adquisiciones.css`
- [x] `firestore.rules`
- [x] `README_MODULO_ACTIVOS.md`
- [x] `PRUEBAS_MODULO_ACTIVOS.md`

## 4. Archivos modificados

- [x] `index.html`
- [x] `js/app.js`
- [x] `js/datos.js`

## 5. Funcionalidades incorporadas

### Registrar adquisición

- [x] Registra nombre, categoría, cantidad y valor unitario.
- [x] Registra proveedor y fecha de compra.
- [x] Asigna proyecto, agrupación y ubicación.
- [x] Genera un código individual por unidad.
- [x] Crea el activo con aprobación pendiente.
- [x] Registra movimiento de tipo `ADQUISICIÓN`.

### Gestionar activos

- [x] Busca por código, nombre o responsable.
- [x] Filtra por ubicación, categoría y estado de gestión.
- [x] Muestra el detalle del activo.
- [x] Permite editar información básica.
- [x] Registra movimiento de tipo `ACTUALIZACIÓN`.
- [x] Muestra el historial administrativo.

### Gestionar saldos y bajas

- [x] Permite enviar activos a lista de saldos.
- [x] Registra motivo, fecha y observaciones.
- [x] Permite dar de baja sin eliminar el activo.
- [x] Solicita confirmación antes de procesar la decisión.
- [x] Registra movimientos `SALDO` y `BAJA`.

### Valoración de activos

- [x] Muestra cantidad total de activos.
- [x] Muestra valor total registrado.
- [x] Muestra activos vigentes.
- [x] Muestra cantidad y valor de activos en saldos.
- [x] Muestra cantidad y valor de activos dados de baja.
- [x] Agrupa valoración por proyecto.
- [x] Agrupa valoración por agrupación.
- [x] Aclara que la valoración no corresponde a depreciación contable.

## 6. Seguridad y permisos

- [x] Se conserva el identificador técnico `compras`.
- [x] El nombre visible cambia a **Administración de Activos y Adquisiciones**.
- [x] Los demás roles conservan sus menús.
- [x] La colección `movimientos_activos` solo permite creación desde `compras` o `administrador`.
- [x] Los movimientos administrativos son inmutables.
- [x] Solo el administrador puede eliminar movimientos durante una limpieza autorizada.
- [x] Las bajas no eliminan documentos del inventario.

## 7. Colecciones de Firestore afectadas

- `inventario`
- `movimientos_activos`

Las colecciones existentes `compras` y `traslados` conservan su funcionamiento.

## 8. Pruebas ejecutadas

Completar antes de solicitar revisión:

- [ ] Inicio de sesión con `compras@conaltura.com`.
- [ ] Visualización correcta del menú del rol.
- [ ] Registro de una adquisición individual.
- [ ] Registro de adquisición con varias unidades.
- [ ] Validación de campos obligatorios.
- [ ] Búsqueda por código y nombre.
- [ ] Filtros de activos.
- [ ] Edición de información básica.
- [ ] Consulta del historial.
- [ ] Paso de un activo a saldos.
- [ ] Baja de un activo.
- [ ] Cancelación de una baja.
- [ ] Valoración general.
- [ ] Valoración por proyecto.
- [ ] Valoración por agrupación.
- [ ] Verificación de permisos por rol.
- [ ] Verificación de datos en Firestore.
- [ ] Consola del navegador sin errores rojos.

Documento de pruebas utilizado:

```text
PRUEBAS_MODULO_ACTIVOS.md
```

## 9. Evidencias

Agregar capturas de las siguientes pantallas:

1. Inicio del rol Administración de Activos y Adquisiciones.
2. Formulario Registrar adquisición.
3. Tabla Gestionar activos.
4. Historial de un activo.
5. Gestión de saldos y bajas.
6. Valoración de activos.
7. Colección `movimientos_activos` en Firestore.

## 10. Validación de integración

- [ ] El login continúa funcionando.
- [ ] El menú hamburguesa continúa funcionando.
- [ ] El botón Atrás continúa funcionando.
- [ ] Ver inventario continúa funcionando.
- [ ] Revisar solicitudes de compra continúa funcionando.
- [ ] Traslados continúa funcionando para los roles autorizados.
- [ ] Aprobaciones continúa funcionando para coordinador y administrador.
- [ ] Reportes continúa funcionando.
- [ ] La interfaz se visualiza correctamente en computador.
- [ ] La interfaz se visualiza correctamente en celular.

## 11. Riesgos conocidos

- Las reglas de `firestore.rules` deben publicarse antes de probar escrituras del módulo.
- El usuario `compras@conaltura.com` debe existir en Firebase Authentication.
- El proyecto debe ejecutarse mediante HTTP, no abriendo `index.html` con doble clic.
- La valoración usa `cantidad × valorUnitario`; no calcula depreciación, impuestos ni valor en libros.

## 12. Exclusiones del MVP

Este Pull Request no incluye:

- Depreciación contable.
- Integración con ERP.
- Facturación.
- Gestión tributaria.
- Asientos contables.
- Flujo avanzado de autorización financiera.
- Venta formal de saldos.

## 13. Revisión solicitada

### Revisor funcional

Validar que el flujo responda a las necesidades de adquisiciones, activos, saldos y bajas.

### Revisor técnico

Validar:

- Importaciones de módulos.
- Escrituras y lecturas de Firestore.
- Reglas de seguridad.
- Ausencia de errores en consola.
- Conservación de funciones anteriores.

## 14. Resultado esperado

Después de aprobar y fusionar este Pull Request, RUTA debe permitir que el rol `compras` gestione el ciclo administrativo básico de los activos, manteniendo trazabilidad y sin afectar las funciones existentes de inventario, compras, traslados, aprobaciones y reportes.
