# TURNSOFT

**Generador de horarios laborales para Chile, con validación normativa y enfoque multi-sector.**

TURNSOFT nació como una herramienta para guardias de seguridad privada. Hoy conserva ese nombre y su historial, pero incorpora un motor compartido que cubre cinco sectores:

- Seguridad privada
- Salud
- Minería
- Retail / comercio
- Logística y operaciones

La aplicación funciona **local-first**: la interfaz guarda escenarios, dotación y horarios en el navegador (`localStorage`) y no necesita PostgreSQL para probarse. El backend puede usar el mismo motor y persistir los resultados cuando la base de datos está disponible.

TURNSOFT opera con **cuentas multi-cliente**. En la demo, la empresa operadora **Vigo Seguridad** administra ocho clientes; cada usuario cliente queda aislado en su propia cuenta y no puede ver ni modificar escenarios, dotación o sucursales de otra. El aislamiento se aplica en la interfaz y se refuerza en el backend con el `cliente_id` del token JWT.

> **Herramienta de apoyo.** TURNSOFT no constituye asesoría legal. Antes de publicar un horario revisa el contrato de trabajo, el reglamento interno, los convenios colectivos, las autorizaciones de la Dirección del Trabajo y el calendario oficial de feriados.

---

## Qué incluye

- **Ocho escenarios demo**, uno por cliente de Vigo Seguridad, que cubren los cinco sectores: seguridad, salud, minería, retail y logística.
- **Aislamiento multi-cliente** en la interfaz y en la API: el operador puede entrar a cada cuenta; un usuario cliente solo ve la suya.
- **Motor de generación** con tres estrategias: cuadrillas 4x4, cuadrillas 7x7 y patrón semanal 5x2 con búsqueda guiada de respaldo.
- **Validador legal** que revisa jornada semanal, tope diario, descansos, domingos libres, noches consecutivas, feriados y certificaciones.
- **Grilla editable** por persona y día, con revalidación en vivo y contador de ajustes manuales.
- **Novedades laborales**: ausencia total o de medio turno, cambio de día libre y cobertura de una inasistencia, con anulación exacta y revalidación en vivo.
- **Gestión de personal, turnos y reglas** por escenario.
- **Reportes** de cobertura, horas, descansos, domingos, festivos y hallazgos.
- **Exportación** a CSV y JSON, además de impresión.
- **Base legal consultable** con fuentes, artículos y salvedades por sector.

---

## Inicio rápido

### Interfaz (sin base de datos)

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. La primera vez se cargan los ocho escenarios demo de Vigo Seguridad y la pantalla de acceso. Puedes generar, editar, validar y exportar sin backend.

Credenciales demo (todas usan la clave `demo1234`):

| Cuenta | Rol | Alcance |
|---|---|---|
| `operador@vigoseguridad.cl` | Operador | Ve y administra los ocho clientes |
| `cliente1@vigoseguridad.cl` … `cliente8@vigoseguridad.cl` | Cliente | Solo la cuenta del cliente correspondiente |

La sesión y los datos demo se guardan en `localStorage` (`turnsoft.session.v1` y `turnsoft.tenants.v3`). El operador puede usar el selector **Cliente activo** o **Todos los clientes**; un usuario cliente no tiene ese selector y queda fijado a su cuenta.

TURNSOFT **no envía correos de acceso**: las cuentas demo se escriben directamente en la pantalla de login. No hay recuperación de clave ni notificaciones por email en esta versión.

Para compilar la versión de producción:

```bash
cd frontend
npm run build
```

### Backend

```bash
cd backend
npm install
npm test
npm start
```

El backend queda en `http://localhost:3000`. Las rutas `/api/motor/*` funcionan sin PostgreSQL; las rutas que leen o escriben la base de datos requieren una instancia disponible.

### Base de datos (opcional)

```bash
docker compose up -d
cd backend
npm run migrate -- --fresh   # esquema base + migraciones
npm run seed                 # Vigo Seguridad, 8 clientes, sucursales, puestos, guardias y usuarios demo
```

El seed es idempotente y crea un usuario operador y ocho usuarios cliente (`cliente1@vigoseguridad.cl` … `cliente8@vigoseguridad.cl`), todos con clave `demo1234`. Cada cliente recibe su sucursal, puestos sectoriales y ocho guardias propios.

Si ya tienes una base creada con la versión anterior:

```bash
cd backend
npm run migrate              # aplica solo las migraciones pendientes
```

Las migraciones aplicadas se registran en la tabla `schema_migrations`, así que `npm run migrate` se puede repetir sin riesgo. Si tu base ya tiene todas las migraciones aplicadas a mano (sin ese registro), ejecuta **una sola vez** `npm run migrate -- --baseline` para marcarlas como aplicadas sin volver a ejecutarlas.

Variables de entorno del backend (`.env`):

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
NODE_ENV=development
JWT_SECRET=                 # obligatorio en producción, mínimo 32 caracteres (openssl rand -hex 48)
JWT_EXPIRES_IN=24h
SETUP_TOKEN=                # código para crear el supervisor maestro; sin él el setup queda deshabilitado en producción
ALLOW_DEMO_AUTH=false
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=turnsoft_db
```

En producción (`NODE_ENV` distinto de `development` o `test`) el servidor **no arranca** si `JWT_SECRET` falta, es un valor de ejemplo o tiene menos de 32 caracteres. El inicio de sesión, el registro, el setup y el motor tienen límites de solicitudes por conexión (y por cuenta en el login).

`ALLOW_DEMO_AUTH=true` habilita un operador demo sin base de datos y está pensado solo para desarrollo local. En producción debe quedar en `false`: si PostgreSQL no está disponible, el login responde `503` en lugar de entregar un token global.

---

## Arquitectura

TURNSOFT tiene un único motor de reglas en `shared/`, usado por la interfaz y por el backend:

```text
frontend (React + Vite)
        │
        │ import ESM
        ▼
   shared/  ──────────────►  motor + validador + presets + feriados
        ▲
        │ import() dinámico desde CommonJS
        │
backend (Express) ──► PostgreSQL (opcional, persistencia)
```

### Por qué `shared/`

- Evita duplicar reglas entre frontend y backend.
- Permite probar la lógica sin levantar la interfaz ni la base de datos.
- Los módulos se escriben como ESM para el navegador y se cargan desde Node con `import()` dinámico.

### Estructura

```text
TURNSOFT/
├── shared/                     # Motor compartido (ESM)
│   ├── dates.js                # Fechas, semanas ISO, horas de turnos
│   ├── holidays.js             # Feriados nacionales y regionales
│   ├── legal.js                # Fuentes, catálogo de reglas, hitos y disclaimers
│   ├── presets.js              # Turnos y reglas por sector
│   ├── model.js                # Cobertura, topes, certificaciones y huella
│   ├── engine.js               # Generador de horarios
│   ├── validate.js             # Validador de configuración y horario
│   ├── exceptions.js           # Ausencias, permutas de descanso y coberturas
│   ├── demo.js                 # Escenarios demo por sector
│   └── tenants.js              # Vigo Seguridad, 8 clientes, cuentas y escenarios namespaced
├── frontend/
│   └── src/
│       ├── components/         # Layout, LoginScreen, ScenarioModal y UI
│       ├── pages/              # Panel, horario, personal, turnos, reglas, legal, reportes, clientes
│       ├── store/              # AuthContext (sesión demo) y TurnsoftContext (estado multi-tenant)
│       ├── lib/                # Exportaciones CSV/JSON
│       └── styles.css          # Sistema visual propio
├── backend/
│   ├── src/
│   │   ├── services/scheduler.js   # Puente con shared/ y mapeo desde PostgreSQL
│   │   ├── middleware/tenant.js    # Alcance por empresa/cliente y permisos de operador
│   │   ├── routes/motor.js         # API multi-sector sin base de datos
│   │   ├── routes/clientes.js      # Cuentas de cliente y sucursales
│   │   ├── routes/horarios.js      # Generación, persistencia y publicación con alcance
│   │   ├── migrate.js              # Ejecutor de migraciones
│   │   └── seed.js                 # Datos demo multi-tenant para PostgreSQL
│   └── test/                       # motor.test.mjs y tenant.test.mjs
├── database/
│   ├── schema.sql                  # Esquema completo para instalación nueva
│   └── migrations/
│       ├── 002_multisector.sql
│       └── 003_clientes.sql        # Clientes, usuarios y columnas cliente_id
├── docs/api-spec.md
└── docker-compose.yml
```

---

## Cuentas y aislamiento multi-cliente

El modelo separa la **empresa operadora** de sus **clientes**. En PostgreSQL, `empresas` representa a Vigo Seguridad; `clientes` guarda cada cuenta atendida. La tabla `usuarios` tiene `rol` (`operador` o `cliente`) y `cliente_id`; la restricción de base exige que un usuario cliente siempre tenga un cliente asignado.

Reglas de alcance:

- **Operador:** puede listar y administrar todos los clientes de su empresa. Puede filtrar por `cliente_id`, pero no puede salir de su `empresa_id`.
- **Cliente:** el token fija su `cliente_id`. Cualquier intento de consultar, generar o publicar datos de otro cliente responde `403`. El frontend además normaliza la sesión y filtra el estado por `clientId`.
- **Mutaciones:** crear o editar escenarios, personal, turnos y reglas exige que el escenario pertenezca a la cuenta visible. Las cuentas cliente no pueden crear empresas ni plantillas globales.

Clientes demo de Vigo Seguridad:

| Cliente | Sector | Ciudad |
|---|---|---|
| Condominio Parque Oriente | Seguridad | Santiago |
| Clínica Los Robles | Salud | Providencia |
| Faena Atacama Norte | Minería | Copiapó |
| Mall Plaza del Sur | Retail | Concepción |
| Centro de Distribución Quilicura | Logística | Quilicura |
| Industria Cerámica Norte | Seguridad | Antofagasta |
| Tienda Costanera | Retail | Viña del Mar |
| Hospital Regional Maule | Salud | Talca |

---

## Cómo funciona el motor

1. **Normaliza el escenario**: fechas, feriados, dotación activa, turnos y reglas.
2. **Intenta una cuadrilla** cuando el patrón es 4x4 o 7x7 y la cobertura es compatible.
3. **Intenta un patrón semanal 5x2** cuando hay 7 personas, turnos cortos y jornada ordinaria.
4. **Usa búsqueda guiada** como respaldo para el resto de combinaciones.
5. **Valida el resultado** y calcula cobertura, horas, descansos, domingos, noches y hallazgos.

Cada horario guarda una **huella de configuración**. Si cambias dotación, turnos o reglas, la interfaz avisa que el horario quedó desactualizado y permite regenerarlo.

### Estrategias verificadas en los demos

| Sector | Estrategia | Cobertura | Errores |
|---|---|---:|---:|
| Seguridad | `cuadrillas-4x4` | 100% | 0 |
| Salud | `patron-semanal` | 100% | 0 |
| Minería | `cuadrillas-7x7` | 100% | 0 |
| Retail | `patron-semanal` | 100% | 0 |
| Logística | `patron-semanal` | 100% | 0 |

Los escenarios de seguridad pueden generar dos advertencias por certificaciones OS-10 que vencen dentro del período o en los 45 días posteriores. No son errores de cobertura.

### Novedades laborales

Un horario generado se puede ajustar sin perder el rastro de lo que cambió. Las novedades se registran en **Horario → Novedades** o desde el botón de calendario de cada celda, y quedan en `scenario.exceptions`. La grilla, la cobertura y las métricas se recalculan al instante.

**Ausencia total o de medio turno**

- **Día completo:** la celda pasa a `absence` y el cupo de ese turno queda descubierto hasta que se asigne una cobertura.
- **Medio turno:** la celda conserva `portion: "half"` y el tramo ausente (`first` o `second`). La persona sigue ocupando **0,5 cupos** y se le descuenta **la mitad de las horas legales** del turno. La otra mitad puede cubrirse por separado si la operación lo exige.
- Una celda con ausencia no se edita como un turno normal: primero se anula la novedad o se registra una cobertura.

**Cambio de día libre**

- Permuta únicamente una celda **Libre** con una celda **con turno** de la misma persona. No se permite usar una ausencia como origen o destino.
- Se guardan las celdas originales (`offCell` y `workCell`), por lo que la anulación restaura el horario exacto.
- Las horas totales de la persona se mantienen, pero la cobertura puede bajar en el nuevo día de descanso. El validador lo muestra para resolverlo con una cobertura o un ajuste.

**Cobertura de una inasistencia**

- La persona que cubre debe estar **Libre** ese día, activa y tener las certificaciones vigentes del turno. TURNSOFT no permite reemplazos con turno o ausencia el mismo día.
- Si la celda de la persona ausente aún no tenía una novedad, la cobertura crea una ausencia de día completo y la vincula (`absenceId`).
- La celda del reemplazo muestra una marca **C** y la cobertura del día se mantiene completa. Al anular la cobertura, el reemplazo vuelve a su estado anterior.

**Anulación y limpieza**

- Cada novedad se anula desde la lista o desde la “X” de la celda de ausencia. La anulación revierte celdas y horas exactamente al estado previo.
- Anular una ausencia también anula sus coberturas vinculadas.
- Regenerar el horario, cambiar el período o eliminar un trabajador o turno limpia las novedades que dependen de esas celdas.
- El validador expone `absences`, `halfDays` y `coverages` por persona, y hallazgos como `ausencia-registrada`, `cobertura-registrada` y `permuta-descanso`.

> Las novedades no envían correos ni notificaciones. Son cambios internos del horario y quedan en el estado local del escenario.

---

## Reglas y criterios legales

La referencia legal se mantiene en `shared/legal.js` y se muestra en la página **Base legal**.

- **Jornada ordinaria:** 42 horas semanales a la fecha de esta versión (noviembre de 2026). La Ley 21.561 fija la reducción a 40 horas desde el **26-04-2028**.
- **Turnos de 12 horas:** no son jornada ordinaria. Requieren un régimen excepcional autorizado. Para seguridad privada se usan como referencia el DS 48/2023 y la Res. Ex. 1185/2006; la autorización concreta debe estar vigente.
- **Descanso entre jornadas:** TURNSOFT usa 12 horas como parámetro contractual/reglamentario configurable. El Código del Trabajo no establece un mínimo general de 12 horas entre jornadas para todos los casos.
- **Recargo dominical:** el 30% es una referencia de comercio (art. 38). Otras actividades pueden tener un tratamiento distinto.
- **Dos domingos libres al mes:** es una regla propia del comercio. No se aplica de forma universal a seguridad, salud o minería.
- **Feriados:** se calculan para el período. Verifica siempre el calendario oficial y los feriados regionales de la operación.
- **Certificaciones:** el validador puede bloquear asignaciones cuando falta una credencial exigida o está vencida, según la configuración del escenario.

Los presets sectoriales son un punto de partida editable, no una declaración de cumplimiento automático.

---

## API

La especificación completa está en [`docs/api-spec.md`](docs/api-spec.md).

### Motor compartido (sin base de datos)

- `GET /api/motor/presets` — sectores, turnos, reglas, hitos y escenarios demo.
- `GET /api/motor/legal` — fuentes, catálogo de reglas y disclaimers.
- `POST /api/motor/generar` — genera y valida un escenario.
- `POST /api/motor/validar` — valida un horario existente.

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/motor/generar \
  -H "Content-Type: application/json" \
  -d '{"sector":"retail","startDate":"2026-11-30","days":28}'
```

### Autenticación y alcance

El login real está en `POST /api/auth/login` y valida la tabla `usuarios` con clave scrypt. Devuelve un JWT que incluye `rol`, `empresa_id` y `cliente_id`. Las rutas protegidas reciben `Authorization: Bearer <token>`.

- Un **operador** puede consultar todos los clientes de su empresa y filtrar con `cliente_id`.
- Un **usuario cliente** solo puede operar sobre su propio `cliente_id`; pedir otro devuelve `403`.

### Generación con persistencia

`POST /api/horarios/generar` requiere autenticación JWT. Acepta dos formatos:

```json
{
  "empresa_id": "UUID",
  "cliente_id": "UUID",
  "sucursal_id": "UUID opcional",
  "fecha_inicio": "2026-11-30",
  "dias": 28,
  "sector": "seguridad"
}
```

o un escenario completo:

```json
{
  "scenario": { "...": "formato de shared/demo.js" },
  "options": { "patternAttempts": 90, "greedyAttempts": 60 }
}
```

Un usuario cliente puede omitir `empresa_id` y `cliente_id`: el backend usa los del token. Si intenta indicar otro cliente, la solicitud se rechaza con `403`. El resultado incluye `schedule`, `validation`, `summary` y `persistence`; la persistencia guarda `cliente_id` y etiqueta el borrador anterior de la misma sucursal como `historico`. Si PostgreSQL no está disponible, la generación igual se devuelve y `persistence.persisted` queda en `false`.

### Clientes

- `GET /api/clientes` — clientes visibles según el token (ocho para el operador, uno para un usuario cliente).
- `GET /api/clientes/:id` — ficha de una cuenta; `403` si pertenece a otro cliente.
- `POST /api/clientes` — crea un cliente (solo operador).
- `PUT /api/clientes/:id` — actualiza un cliente (solo operador).
- `GET /api/clientes/:id/sucursales` — sucursales de la cuenta.
- `POST /api/clientes/:id/sucursales` — crea una sucursal (solo operador).

---

## Pruebas

```bash
cd backend
npm test
```

Las pruebas verifican:

- Catálogo de los cinco sectores y referencia legal.
- Generación y validación de los cinco escenarios demo con 100% de cobertura y cero errores.
- Normalización de escenarios creados desde la API.
- Conversión de asignaciones a filas persistibles en `horarios`.
- Ausencia de medio turno: descuenta media jornada y deja la cobertura fraccionaria.
- Cobertura de una inasistencia: reemplaza el cupo y registra a la persona que cubre.
- Cambio de día libre: conserva las horas y se anula restaurando las celdas exactas.
- Ocho clientes con identidad única y escenarios namespaced por `clientId`.
- Nueve cuentas demo (operador + ocho clientes) con su cliente correcto.
- Aislamiento de alcance: un cliente no puede pedir otro `cliente_id` ni otra empresa.
- Permisos de operador para cuentas y catálogos globales.
- Herencia de empresa, cliente y sector en escenarios construidos desde PostgreSQL.

También puedes validar el frontend con:

```bash
cd frontend
npm run build
```

---

## Estado y limitaciones

- La interfaz es **local-first**. La sesión y los datos demo viven en el navegador; la UI todavía no consume la API para sincronizar. El backend ya aplica autenticación real y alcance por cliente cuando se usa directamente.
- Las novedades se gestionan en la interfaz y viajan dentro del escenario (`exceptions` + celdas). El backend las valida y persiste el escenario completo, pero todavía no existe un CRUD REST dedicado para registrar o anular novedades por separado.
- El backend persiste escenarios completos en `escenarios_horario`; las filas de la tabla `horarios` solo se generan cuando los turnos provienen de puestos de la base de datos. Una ausencia parcial se guarda con 0,5 de las horas y estado `ausencia-parcial`.
- La autenticación JWT y los roles operador/cliente están implementados. Para producción faltan auditoría de cambios, recuperación de claves y una integración de sincronización entre frontend y API.
- Los feriados se calculan con las reglas incluidas. Los feriados regionales y los cambios oficiales deben verificarse antes de publicar.
- No reemplaza nómina, control de asistencia, fiscalización ni asesoría legal.

---

## Licencia

Uso interno y evaluación. Define una licencia explícita antes de distribuir el proyecto.
