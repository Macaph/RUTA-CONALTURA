# Pruebas del módulo Administración de Activos y Adquisiciones

## 1. Objetivo

Comprobar que el módulo se integra con RUTA sin afectar el inventario, las compras, los traslados, las aprobaciones ni los reportes existentes.

## 2. Archivos que deben estar instalados

```text
RUTA-CONALTURA/
├── index.html
├── firestore.rules
├── css/
│   ├── estilos.css
│   └── activos-adquisiciones.css
└── js/
    ├── app.js
    ├── datos.js
    ├── activos-adquisiciones.js
    ├── aprobaciones.js
    ├── compras.js
    ├── firebase-config.js
    ├── inventario.js
    ├── mis-elementos.js
    ├── reportes.js
    ├── traslados.js
    └── utilidades.js
```

## 3. Preparación

1. Publicar `firestore.rules` en Firebase Console.
2. Confirmar que existe el usuario `compras@conaltura.com` en Firebase Authentication.
3. Abrir el proyecto mediante un servidor local. No abrir `index.html` con doble clic.
4. En PyCharm se puede usar un servidor local o ejecutar desde la terminal:

```bash
python -m http.server 8000
```

5. Abrir en el navegador:

```text
http://localhost:8000
```

6. Abrir las herramientas del navegador con `F12` y mantener visible la pestaña **Console**.

## 4. Prueba de inicio de sesión y menú

### PR-01. Ingreso del rol unificado

**Datos**

- Usuario: `compras`
- Contraseña: la definida en Firebase Authentication.

**Resultado esperado**

- El usuario inicia sesión.
- El nombre visible es **Administración de Activos y Adquisiciones**.
- El menú muestra:
  - Ver inventario.
  - Revisar solicitudes de compra.
  - Registrar adquisición.
  - Gestionar activos.
  - Gestionar saldos y bajas.
  - Valoración de activos.
  - Reportes.

## 5. Pruebas de registrar adquisición

### PR-02. Crear una adquisición válida

**Datos de prueba**

- Nombre: `Televisor de prueba`
- Categoría: `Tecnología`
- Cantidad: `1`
- Valor unitario: `2500000`
- Proveedor: `Proveedor de prueba`
- Fecha: fecha actual.
- Destino: una agrupación activa.
- Estado físico: `Bueno`
- Observaciones: `Registro de prueba del módulo de activos.`

**Resultado esperado**

- Se muestra un mensaje de éxito.
- Se crea un código con formato `EL-00000`.
- El activo aparece en inventario.
- El activo queda con aprobación `Pendiente`.
- Se crea un documento en `movimientos_activos` con tipo `ADQUISICIÓN`.

### PR-03. Crear varios activos

**Datos**

Usar los mismos datos de PR-02 y cantidad `2`.

**Resultado esperado**

- Se crean dos códigos consecutivos.
- Cada activo tiene cantidad `1`.
- Se crean dos movimientos de tipo `ADQUISICIÓN`.

### PR-04. Validación de campos

Intentar guardar sin nombre, categoría, proveedor, destino o valor.

**Resultado esperado**

- El navegador impide el envío.
- No se crea ningún documento en Firestore.

## 6. Pruebas de gestión de activos

### PR-05. Buscar un activo

Buscar el código creado en PR-02.

**Resultado esperado**

- Solo aparece el activo correspondiente.

### PR-06. Filtrar activos

Aplicar filtros por ubicación, categoría y situación.

**Resultado esperado**

- La tabla muestra únicamente elementos que cumplen todos los filtros activos.

### PR-07. Consultar detalle e historial

Seleccionar **Ver** en el activo creado.

**Resultado esperado**

- Se muestran código, nombre, ubicación, responsable y valor.
- El historial incluye el movimiento `ADQUISICIÓN`.

### PR-08. Editar datos básicos

Cambiar:

- Nombre: `Televisor de prueba actualizado`.
- Estado físico: `Regular`.
- Observaciones: `Actualización de prueba`.

**Resultado esperado**

- El activo se actualiza sin perder los demás campos.
- Se crea un movimiento `ACTUALIZACIÓN`.
- El historial muestra la nueva entrada.

## 7. Pruebas de saldos y bajas

### PR-09. Enviar un activo a saldos

Seleccionar el activo de prueba y usar:

- Acción: `Enviar a saldos`.
- Motivo: `Disponible para reutilización`.

**Resultado esperado**

- Se solicita confirmación.
- `estadoGestion` cambia a `En lista de saldos`.
- El activo aparece en la tabla de saldos.
- Se crea un movimiento `SALDO`.
- El activo no se elimina del inventario.

### PR-10. Dar de baja un activo

Usar otro activo de prueba:

- Acción: `Dar de baja`.
- Motivo: `Daño irreparable`.

**Resultado esperado**

- Se solicita confirmación explícita.
- `estadoGestion` cambia a `De baja`.
- El activo aparece en la tabla de bajas.
- Se crea un movimiento `BAJA`.
- El activo y su historial se conservan.

### PR-11. No procesar una baja cancelada

Iniciar una baja y pulsar **Cancelar** en la confirmación.

**Resultado esperado**

- El estado del activo no cambia.
- No se crea un movimiento.

## 8. Pruebas de valoración

### PR-12. Indicadores generales

Abrir **Valoración de activos**.

**Resultado esperado**

Se muestran:

- Activos registrados.
- Valor total registrado.
- Activos vigentes.
- Activos en lista de saldos y su valor.
- Activos dados de baja y su valor.

### PR-13. Valor por proyecto y agrupación

**Resultado esperado**

- Cada proyecto muestra cantidad y valor.
- Cada agrupación muestra estado, cantidad y valor.
- El valor corresponde a `cantidad × valorUnitario`.
- La pantalla aclara que no es depreciación contable.

## 9. Pruebas de seguridad por roles

### PR-14. Vendedor

Ingresar como `vendedor`.

**Resultado esperado**

- No aparecen opciones de Administración de Activos y Adquisiciones.
- El comportamiento previo del vendedor se conserva.

### PR-15. Bodeguista

Ingresar como `bodeguista`.

**Resultado esperado**

- No aparecen las opciones nuevas.
- Enviar y recibir traslados sigue funcionando.

### PR-16. Coordinador

Ingresar como `coordinador`.

**Resultado esperado**

- Aprobar inventario y solicitudes sigue funcionando.
- No aparecen opciones de saldos, bajas o adquisición directa.

### PR-17. Administrador

Ingresar como `administrador`.

**Resultado esperado**

- El menú administrativo anterior se conserva.
- Puede consultar compras y reportes.
- Puede eliminar datos únicamente según las reglas publicadas.

## 10. Verificación en Firebase

Después de las pruebas, revisar en Firestore:

### Colección `inventario`

Confirmar que cada activo contiene:

- `codigo`
- `nombre`
- `categoria`
- `proyecto`
- `agrupacion`
- `ubicacion`
- `estado`
- `estadoGestion`
- `valorUnitario`
- `proveedor`
- `fechaCompra`
- `responsable`
- `actualizadoPor`
- `actualizadoEn`

### Colección `movimientos_activos`

Confirmar que los movimientos contienen:

- `codigoActivo`
- `nombreActivo`
- `tipo`
- `estadoAnterior`
- `estadoNuevo`
- `motivo`
- `observaciones`
- `creadoPor`
- `creadoEn`

## 11. Criterio de aprobación final

El módulo queda aprobado cuando:

- Las 17 pruebas anteriores funcionan.
- La consola del navegador no muestra errores rojos.
- No se pierde información de activos existentes.
- Los roles anteriores conservan sus menús y funciones.
- Los movimientos de adquisición, actualización, saldo y baja quedan registrados.
- Las reglas de Firestore rechazan operaciones realizadas por roles no autorizados.
