# TURNSOFT · Especificación de la API

Base URL: `http://localhost:3000/api`

El backend expone dos familias de rutas:

- **Motor compartido** (`/motor/*`): funciona sin PostgreSQL y usa exactamente el mismo motor que el frontend.
- **Gestión y persistencia**: requiere PostgreSQL y, en la mayoría de los casos, un token JWT.

Todas las respuestas son JSON. Los errores usan el formato:

```json
{ "error": "Descripción del problema" }
```

---

## Autenticación

### Iniciar sesión

`POST /auth/login`

```json
{
  "email": "operador@vigoseguridad.cl",
  "password": "demo1234"
}
```

Respuesta:

```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "UUID",
    "email": "operador@vigoseguridad.cl",
    "nombre": "Vigo Seguridad",
    "rol": "operador",
    "empresa_id": "UUID",
    "cliente_id": null,
    "cliente_nombre": null,
    "empresa_nombre": "Vigo Seguridad"
  }
}
```

El login valida la tabla `usuarios` y la clave almacenada con scrypt. Las cuentas demo son:

| Rol | Correo | Cliente | Clave |
|---|---|---|---|
| Operador | `operador@vigoseguridad.cl` | — | `demo1234` |
| Cliente | `cliente1@vigoseguridad.cl` … `cliente8@vigoseguridad.cl` | Uno por cuenta | `demo1234` |

Si PostgreSQL no está disponible, el login responde `503`; no se entrega un token de operador global. Para desarrollo local se puede activar `ALLOW_DEMO_AUTH=true`, pero debe quedar desactivado en producción.

En las rutas protegidas envía:

```http
Authorization: Bearer <token>
```

### Alcance multi-tenant

El JWT incluye `rol`, `empresa_id` y `cliente_id`. El backend vuelve a aplicar ese alcance en cada consulta:

- **Operador** (`rol: "operador"`, `cliente_id: null`): ve todos los clientes de su empresa. Puede filtrar con `cliente_id`; no puede consultar otra empresa (`403`).
- **Cliente** (`rol: "cliente"`, `cliente_id: UUID`): queda forzado a su propio cliente. Cualquier intento de leer, generar o publicar datos de otro cliente responde `403`.
- **Catálogos globales:** solo el operador puede crear empresas, clientes y plantillas de turno.

### Sesión actual

`GET /auth/me` devuelve el usuario y el alcance contenidos en el token.

---

## Motor compartido (sin base de datos)

### Catálogo de presets

`GET /motor/presets`

Devuelve:

- `app`, `legalVersion`, `disclaimer`
- `milestones` (hitos de jornada)
- `sectors`: metadatos, turnos por defecto, reglas y preset del motor
- `demos`: los cinco escenarios demo completos, sin horario generado

### Base legal

`GET /motor/legal`

Devuelve `sources`, `rules`, `milestones`, `sectors` y el disclaimer.

### Generar y validar un escenario

`POST /motor/generar`

**Opción A — sector demo**

```json
{
  "sector": "salud",
  "startDate": "2026-11-30",
  "days": 28,
  "options": {
    "patternAttempts": 90,
    "greedyAttempts": 60
  }
}
```

Los sectores válidos son `seguridad`, `salud`, `mineria`, `retail` y `logistica`. Si no envías dotación, turnos ni reglas, se usa el escenario demo del sector. Puedes sobrescribir `name`, `company`, `location`, `employees`, `shifts`, `rules`, `holidays` y `regions`.

**Opción B — escenario completo**

```json
{
  "scenario": {
    "id": "sc-propio",
    "name": "Mi operación",
    "company": "Empresa SpA",
    "sector": "retail",
    "startDate": "2026-11-30",
    "days": 28,
    "employees": [],
    "shifts": [],
    "rules": {},
    "holidays": [],
    "regions": [],
    "exceptions": []
  },
  "options": { "patternAttempts": 90, "greedyAttempts": 60 }
}
```

Respuesta:

```json
{
  "scenario": { "...": "escenario con schedule" },
  "schedule": {
    "id": "sch_...",
    "startDate": "2026-11-30",
    "days": 28,
    "cells": {
      "emp-1": {
        "2026-11-30": { "type": "shift", "shiftId": "ret-a" },
        "2026-12-01": { "type": "off" }
      }
    },
    "meta": {
      "engine": "turnsoft-v2",
      "strategy": "patron-semanal",
      "attempts": 1,
      "fingerprint": "abc123",
      "requiredSlots": 132,
      "filledSlots": 132,
      "coveragePct": 100,
      "generatedAt": "2026-11-06T04:00:00.000Z"
    }
  },
  "validation": {
    "metrics": {
      "coveragePct": 100,
      "requiredSlots": 132,
      "filledSlots": 132,
      "errors": 0,
      "warnings": 0,
      "score": 100
    },
    "findings": [],
    "coverage": [],
    "employeeMetrics": [],
    "weeks": [],
    "holidays": []
  },
  "configFindings": [],
  "summary": { "...": "copia de validation.metrics" }
}
```

`configFindings` son hallazgos de configuración previos a la generación (por ejemplo, régimen excepcional sin autorización). Se repiten dentro de `validation.findings`.

### Validar un horario

`POST /motor/validar`

```json
{
  "scenario": { "...": "escenario" },
  "schedule": { "...": "horario opcional" }
}
```

Si omites `schedule`, se valida `scenario.schedule`. Respuesta:

```json
{
  "scenarioId": "sc-propio",
  "hasSchedule": true,
  "validation": { "...": "reporte completo" },
  "summary": {
    "coveragePct": 100,
    "errors": 0,
    "warnings": 0,
    "score": 100
  }
}
```

---

## Novedades del horario

Las novedades se guardan en `scenario.exceptions` y se reflejan directamente en `schedule.cells`. No existen endpoints CRUD dedicados: viajan dentro del escenario completo. Para validarlas, envía el escenario con `schedule` y `exceptions` coherentes a `POST /motor/validar`. La interfaz local-first las administra desde **Horario → Novedades**.

### Forma de las celdas

```json
{ "type": "shift", "shiftId": "seg-d12" }
{ "type": "off" }
{
  "type": "absence",
  "portion": "half",
  "halfPeriod": "first",
  "shiftId": "seg-d12",
  "exceptionId": "exc-7f3a",
  "reason": "Trámite personal"
}
```

- `portion`: `full` o `half`.
- `halfPeriod`: `first` o `second` cuando la ausencia es parcial; vacío en una ausencia de día completo.
- `shiftId`: turno original al que se refiere la novedad.

### Ausencia

```json
{
  "id": "exc-7f3a",
  "type": "absence",
  "employeeId": "emp-1",
  "date": "2026-11-30",
  "portion": "half",
  "halfPeriod": "first",
  "shiftId": "seg-d12",
  "previousCell": { "type": "shift", "shiftId": "seg-d12" },
  "reason": "Trámite personal",
  "createdAt": "2026-11-07T12:00:00.000Z",
  "createdBy": "Vigo Seguridad"
}
```

Semántica:

- `full`: la celda ocupa **0 cupos** y **0 horas** efectivas. El cupo queda descubierto hasta que exista una cobertura.
- `half`: la celda ocupa **0,5 cupos** y suma **la mitad de `shiftLegalHours(shift)`**. La fracción restante también queda sujeta a cobertura.
- `previousCell` guarda el turno original para que la anulación sea exacta.

### Cambio de día libre

```json
{
  "id": "exc-9c21",
  "type": "swap",
  "employeeId": "emp-2",
  "offDate": "2026-12-01",
  "workDate": "2026-12-02",
  "offCell": { "type": "off" },
  "workCell": { "type": "shift", "shiftId": "seg-d12" },
  "reason": "Solicitud de la persona",
  "createdAt": "2026-11-07T12:00:00.000Z"
}
```

Solo se permite entre una celda `off` y una celda `shift` de la misma persona. Los snapshots `offCell` y `workCell` permiten revertir la permuta. Las horas totales se conservan, pero la cobertura puede bajar en el nuevo día de descanso.

### Cobertura de una inasistencia

```json
{
  "id": "cov-2b81",
  "type": "coverage",
  "employeeId": "emp-1",
  "replacementId": "emp-3",
  "date": "2026-11-30",
  "shiftId": "seg-d12",
  "absenceId": "exc-7f3a",
  "previousCell": { "type": "off" },
  "reason": "Inasistencia imprevista",
  "createdAt": "2026-11-07T12:00:00.000Z"
}
```

- `employeeId` es la persona ausente; `replacementId` es quien cubre.
- El reemplazo debe estar activo, **libre** ese día, ser distinto del ausente y tener las certificaciones vigentes del turno.
- Si no existía una ausencia, la cobertura crea una `absence` de día completo y la vincula con `absenceId`.
- La celda del reemplazo pasa a `{ "type": "shift", "shiftId": "..." }`.

### Anulación

La función compartida `undoException` revierte la novedad y sus efectos:

- **Ausencia:** restaura `previousCell` y anula todas las coberturas vinculadas, devolviendo a cada reemplazo su `previousCell`.
- **Cobertura:** restaura únicamente la celda del reemplazo.
- **Permuta:** restaura `offCell` y `workCell`.

Regenerar el horario, cambiar el período o eliminar un trabajador o turno limpia las novedades que dependen de las celdas afectadas.

### Validación y métricas

- `metrics.exceptions`, `metrics.absences`, `metrics.partialAbsences`, `metrics.swaps` y `metrics.coverages` resumen las novedades del escenario.
- `employeeMetrics[]` agrega `absences`, `halfDays` y `coverages`. `hours` y `daysWorked` usan fracciones de 0,5.
- La cobertura del día suma fracciones de cupo; una ausencia parcial deja `assigned` en 3,5 sobre 4, por ejemplo.
- Hallazgos informativos: `ausencia-registrada`, `cobertura-registrada` y `permuta-descanso`.
- Hallazgos de advertencia: `novedad-fuera-periodo`, `novedad-desincronizada`, `cobertura-desincronizada`, `novedad-sin-trabajador`, `novedad-duplicada` y `novedad-desconocida`.

### Persistencia

- `escenarios_horario` guarda el escenario completo en JSONB, incluidas `exceptions` y la grilla.
- `assignmentsToRows` convierte una ausencia `half` en una fila de horario con **0,5 de las horas legales** y estado `ausencia-parcial`; una ausencia `full` no genera fila.
- `POST /motor/generar` y `POST /horarios/generar` regeneran la grilla. No reaplican novedades previas: para conservarlas hay que validar o persistir el escenario con su `schedule` ya ajustado. La interfaz todavía no sincroniza este estado con PostgreSQL.

---

## Horarios con persistencia

Todas las rutas de esta sección requieren `Authorization: Bearer <token>` y respetan el alcance por empresa/cliente descrito arriba.

### Generar horario

`POST /horarios/generar`

**Desde PostgreSQL**

```json
{
  "empresa_id": "UUID",
  "cliente_id": "UUID",
  "sucursal_id": "UUID opcional",
  "fecha_inicio": "2026-11-30",
  "fecha_fin": "2026-12-27",
  "dias": 28,
  "sector": "seguridad",
  "notes": "Observaciones de la operación",
  "options": { "patternAttempts": 90, "greedyAttempts": 60 }
}
```

Reglas:

- `empresa_id` y `fecha_inicio` son obligatorios. Para un usuario cliente, `empresa_id` y `cliente_id` se toman del token si se omiten; si se envían, deben coincidir con el token o la solicitud responde `403`.
- Puedes enviar `fecha_fin` o `dias`, no ambos. El período permitido es de 1 a 120 días.
- Si no envías `sucursal_id`, se usa la primera sucursal que pertenezca al cliente (o a la empresa si no se filtró por cliente).
- Los puestos se convierten en turnos; su plantilla aporta horario, colación, color y certificaciones.
- Los guardias activos se filtran por `empresa_id` y `cliente_id`; la certificación OS-10 se toma de `certificaciones_os10`.
- La configuración legal de la empresa sobrescribe el preset sectorial solo en los campos definidos.
- Al persistir, el escenario guarda `empresa_id`, `cliente_id` y `sucursal_id`. El borrador anterior de la misma cuenta y sucursal pasa a `historico`; nunca se modifica otro cliente.

**Desde un escenario completo**

```json
{
  "scenario": { "...": "formato shared" },
  "options": { "patternAttempts": 90, "greedyAttempts": 60 }
}
```

En este modo no se necesitan datos en PostgreSQL. Si la base no está disponible, la generación se devuelve igual y `persistence.persisted` es `false`.

Respuesta (resumida):

```json
{
  "message": "Horario generado y validado con el motor TURNSOFT.",
  "scenario": { "...": "escenario con clientId y clienteId" },
  "schedule": { "...": "horario" },
  "validation": { "...": "reporte" },
  "configFindings": [],
  "summary": { "coveragePct": 100, "errors": 0, "warnings": 2 },
  "persistence": {
    "persisted": true,
    "escenarioId": "UUID",
    "clienteId": "UUID",
    "assignments": 128
  }
}
```

Cuando falla la persistencia:

```json
{
  "persisted": false,
  "reason": "base_de_datos_no_disponible",
  "detail": "connect ECONNREFUSED 127.0.0.1:5432"
}
```

### Listar escenarios guardados

`GET /horarios/escenarios?empresa_id=UUID&cliente_id=UUID`

Devuelve metadatos, `cliente_nombre` y `metricas` (el bloque `validation.metrics`). Un usuario cliente ve solo sus filas aunque no envíe `cliente_id`; si envía otro, recibe `403`.

### Obtener un escenario guardado

`GET /horarios/escenarios/:id?empresa_id=UUID&cliente_id=UUID`

Devuelve configuración, horario, validación y estado. El escenario debe pertenecer a la empresa/cliente del token.

### Publicar un escenario

`POST /horarios/escenarios/:id/publicar`

Cambia el escenario a `publicado` y publica sus filas en `horarios`. La actualización también está acotada por `empresa_id` y `cliente_id`; un escenario ajeno responde `404`/`403`.

### Horarios semanales (tabla legacy)

`GET /horarios/semanal?empresa_id=UUID&cliente_id=UUID&escenario_id=UUID`

Filtra las filas de `horarios` con estado `borrador`, por empresa, cliente y escenario visibles para el token.

### Publicar horarios por ID

`POST /horarios/publicar`

```json
{ "horario_ids": ["UUID", "UUID"], "cliente_id": "UUID opcional" }
```

Solo publica filas cuya guardia pertenezca a la empresa/cliente del token.

---

## Clientes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/clientes` | Lista los clientes visibles (8 para el operador, 1 para un cliente) |
| GET | `/clientes/:id` | Obtiene la ficha de un cliente |
| POST | `/clientes` | Crea un cliente (solo operador) |
| PUT | `/clientes/:id` | Actualiza un cliente (solo operador) |
| GET | `/clientes/:id/sucursales` | Lista sucursales de la cuenta |
| POST | `/clientes/:id/sucursales` | Crea una sucursal (solo operador) |

```json
{
  "empresa_id": "UUID",
  "nombre": "Condominio Parque Oriente",
  "razon_social": "Comunidad Edificio Parque Oriente",
  "rut": "76.100.100-1",
  "sector": "seguridad",
  "contacto": "María José Rivas",
  "email": "administracion@parqueoriente.cl",
  "telefono": "+56 9 1111 1111",
  "direccion": "Av. Las Condes 11200",
  "ciudad": "Santiago",
  "color": "#0f766e",
  "activo": true
}
```

Un usuario cliente que pida `/clientes/:id` de otra cuenta recibe `403` antes de leer la base.

## Empresas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/empresas` | Lista la empresa del token (el operador puede filtrar por `empresa_id`) |
| POST | `/empresas` | Crea empresa (solo operador) |
| GET | `/empresas/:id` | Obtiene empresa; `403` si es de otra empresa |
| PUT | `/empresas/:id/configuracion-legal` | Actualiza configuración legal (solo operador) |

`POST /empresas`:

```json
{
  "razon_social": "Vigía Austral SpA",
  "rut_empresa": "76.543.210-8",
  "sector": "seguridad",
  "regimen_jornada": "excepcional",
  "autorizacion_excepcional": true,
  "referencia_autorizacion": "Res. Ex. 1185/2006",
  "jornada_maxima_semanal": 42,
  "descanso_minimo_entre_turnos": 12,
  "recargo_dominical_festivo": 30.0
}
```

Valores por defecto: jornada **42 h**, descanso configurable **12 h** y recargo dominical de referencia **30%** (comercio, art. 38).

`PUT /empresas/:id/configuracion-legal` acepta los campos de `configuracion_legal`, incluidos:

- `max_daily_hours`
- `max_exceptional_daily_hours`
- `max_exceptional_average_weekly_hours`
- `max_consecutive_work_days`
- `block_rest_days`
- `min_sundays_off_per_month`
- `max_consecutive_night_shifts`
- `allow_sunday_work`
- `allow_holiday_work`
- `require_certifications`
- `require_full_coverage`
- `recargo_festivo`

Los campos nuevos son opcionales: si quedan en `NULL`, se usa el preset del sector.

---

## Guardias

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/guardias?empresa_id=UUID&cliente_id=UUID` | Lista guardias y su OS-10 según el alcance |
| POST | `/guardias` | Crea guardia |
| PUT | `/guardias/:id` | Actualiza guardia |
| POST | `/guardias/:id/certificacion-os10` | Registra certificación |

```json
{
  "empresa_id": "UUID",
  "cliente_id": "UUID",
  "nombre_completo": "Camila Rojas",
  "rut": "11.111.111-1",
  "email": "camila@empresa.cl",
  "telefono": "+56911112222",
  "fecha_contrato": "2025-03-01",
  "horas_semanales_max": 42,
  "cargo": "Guardia de seguridad"
}
```

Un usuario cliente no puede crear ni consultar guardias de otro `cliente_id`; el backend fuerza el alcance del token o responde `403`.

Certificación OS-10:

```json
{
  "numero_certificado": "OS10-001",
  "fecha_vencimiento": "2027-12-31",
  "emitido_por": "OS-10 Carabineros de Chile"
}
```

---

## Puestos y plantillas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/puestos?sucursal_id=UUID` | Lista puestos de una sucursal visible |
| POST | `/puestos` | Crea puesto |
| GET | `/turno-plantillas` | Lista plantillas |
| POST | `/turno-plantillas` | Crea plantilla (solo operador) |

Para que el motor pueda generar horarios desde PostgreSQL, cada puesto debe tener:

- `turno_plantilla_id` con una plantilla que defina `hora_inicio`, `hora_fin`, colación y nocturnidad.
- `cobertura_semanal` como arreglo de 7 enteros (lunes a domingo). Si es `NULL`, se usa la cobertura de la plantilla.
- Opcionalmente, `certificaciones_requeridas` como arreglo de textos.

Ejemplo de plantilla:

```json
{
  "nombre": "Día 12 h",
  "codigo": "D12",
  "duracion_horas": 12,
  "hora_inicio": "08:00",
  "hora_fin": "20:00",
  "requiere_colacion": true,
  "minutos_colacion": 60,
  "es_nocturno": false,
  "color": "#0f766e",
  "cobertura_semanal": [2, 2, 2, 2, 2, 2, 2],
  "certificaciones_requeridas": ["OS-10"]
}
```

> Los turnos de 12 h requieren régimen excepcional autorizado. La plantilla no reemplaza la autorización.

---

## Solicitudes y reportes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/solicitudes?empresa_id=UUID&cliente_id=UUID&guardia_id=UUID` | Lista solicitudes según el alcance |
| POST | `/solicitudes` | Crea solicitud para una guardia visible |
| PUT | `/solicitudes/:id` | Actualiza estado |
| GET | `/reportes/cumplimiento?empresa_id=UUID&cliente_id=UUID&mes=2026-11` | Reporte mensual filtrado por cliente |

El reporte incluye `empresa_id` y `cliente_id` efectivos en la respuesta y solo agrega guardias/horarios de esa cuenta. Un usuario cliente que envíe otro `cliente_id` recibe `403`.

---

## Salud del servicio

`GET /health`

```json
{
  "status": "ok",
  "service": "TURNSOFT Backend",
  "engine": "turnsoft-v2",
  "sectors": ["seguridad", "salud", "mineria", "retail", "logistica"],
  "timestamp": "2026-11-06T04:00:00.000Z"
}
```

---

## Modelo de persistencia

- `empresas`: empresa operadora (Vigo Seguridad), sector, régimen, autorización excepcional y configuración base.
- `clientes`: cuentas atendidas por la operadora; cada una tiene sector, contacto, ubicación y color.
- `usuarios`: acceso con `rol` (`operador`/`cliente`), `empresa_id`, `cliente_id` y hash scrypt.
- `configuracion_legal`: overrides legales por empresa.
- `turno_plantillas`: catálogo global de horario, colación, color, cobertura y certificaciones.
- `puestos`: ubicación operativa, plantilla asociada y cobertura propia.
- `guardias`: dotación, contrato, cargo y `cliente_id` al que pertenece.
- `certificaciones_os10`: credenciales con vencimiento.
- `sucursales`: locales de la empresa, opcionalmente asociados a un cliente.
- `escenarios_horario`: configuración, grilla y validación completas en JSONB, con `empresa_id`, `cliente_id` y `sucursal_id`.
- `horarios`: asignaciones individuales publicables, vinculadas opcionalmente a un escenario.

Las migraciones están en `database/migrations/`. `002_multisector.sql` y `003_clientes.sql` son idempotentes. `003_clientes.sql` crea `clientes`/`usuarios`, agrega `cliente_id` a `sucursales`, `guardias`, `escenarios_horario` y `solicitudes`, y ajusta la restricción de rol de usuario. La tabla `horarios` hereda el cliente a través de `guardias` y `escenarios_horario`.
