# TURNSOFT

Sistema generador de horarios para guardias de seguridad privada, basado en la legislación chilena.

> **Estado:** Desarrollo local. Listo para subir a GitHub una vez validado.

---

## 📋 Tabla de contenidos

- [Sobre el proyecto](#sobre-el-proyecto)
- Marco legal chileno
- [Arquitectura](#arquitectura)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Requisitos previos](#requisitos-previos)
- [Instalación local](#instalación-local)
- [Base de datos](#base-de-datos)
- [Backend](#backend)
- [Frontend](#frontend)
- [Motor de reglas](#motor-de-reglas)
- [Endpoints API](#endpoints-api)
- [Despliegue a GitHub](#despliegue-a-github)
- [Licencia](#licencia)

---

## 🇨🇱 Sobre el proyecto

TURNSOFT es una aplicación web para empresas de seguridad privada en Chile que genera automáticamente horarios de trabajo para guardias, respetando la normativa laboral vigente:

- **Código del Trabajo:** descanso semanal de 24h (art. 37), descanso entre jornadas de 12h (art. 38), colación, horas extras.
- **Ley 21.561 (40 Horas):** reducción gradual de jornada semanal (44 → 42 → 40 horas).
- **Ley 19.938:** certificación OS-10 de Carabineros de Chile.
- **Ley 21.719:** protección de datos personales (entrada en vigencia plena esperada para 2027).

---

## ⚖️ Marco legal chileno incorporado

| Norma | Qué regula | Cómo se implementa en TURNSOFT |
|-------|------------|-------------------------------|
| Código del Trabajo (art. 37) | Descanso semanal 24h corridas, preferentemente domingo | Regla dura del motor: cada guardia debe tener al menos 1 descanso semanal |
| Código del Trabajo (art. 38) | Descanso mínimo 12h entre el fin de una jornada y el inicio de la siguiente | Regla dura: no se puede programar turno con menos de 12h de diferencia |
| Código del Trabajo | Colación ≥30 min (no computa como jornada) | Campo configurable por plantilla de turno |
| Ley 21.561 | Jornada semanal máxima 44/42/40 hs según etapa vigente | Tabla `configuracion_legal` por empresa, parametrizable |
| Código del Trabajo | Límite de horas extras: 2 hs/día (salvo excepción) | Validación en el generador y reporte de cumplimiento |
| Código del Trabajo | Recargo 50% por domingo y festivo | Campo `tipo_turno` en horarios y reporte de costos |
| Ley 19.938 | Certificación OS-10 de Carabineros de Chile | Entidad `certificaciones_os10` con fecha de vencimiento |
| Ley 21.719 | Protección de datos personales (vigente plena 2027) | Privacidad por diseño, consentimiento, auditoría de acceso |

---

## 🏗️ Arquitectura

```
Frontend (React/Vue)  →  API REST (Node.js/Python)  →  PostgreSQL
       ↓                                                    ↑
Vista de calendario                      Motor de reglas   Esquema SQL
y publicación de                         (generador de      (migrations)
horarios                                 horarios)
```

---

## 📁 Estructura de carpetas

```
TURNSOFT/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/          # Motor de reglas y generador de horarios
│   │   ├── middleware/        # Auth, validación, auditoría
│   │   └── utils/
│   ├── tests/
│   ├── migrations/
│   ├── seeders/
│   ├── .env.example
│   ├── package.json / pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── utils/
│   ├── .env.example
│   └── package.json
├── database/
│   └── schema.sql
├── docs/
│   ├── analisis_legal.md
│   └── api-spec.md
├── docker-compose.yml
├── .gitignore
├── README.md
└── LICENSE
```

---

## 🔧 Requisitos previos

- **Node.js 18+** o **Python 3.11+** (según el backend que elijan)
- **PostgreSQL 15+** (local o vía Docker)
- **Git**
- **Docker y Docker Compose** (opcional, para levantar la base de datos fácilmente)

---

## 🚀 Instalación local

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/TURNSOFT.git
cd TURNSOFT
```

### 2. Levantar la base de datos (con Docker)

```bash
docker-compose up -d
```

Esto iniciará PostgreSQL en el puerto `5432`.

### 3. Configurar variables de entorno

Copia los archivos de ejemplo y ajusta los valores:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

### 4. Ejecutar el esquema de la base de datos

```bash
psql -h localhost -U postgres -d turnsoft_db -f database/schema.sql
```

O si usas Docker:

```bash
docker exec -i turnsoft_db psql -U postgres -d turnsoft_db < database/schema.sql
```

### 5. Instalar dependencias y correr el backend

```bash
# Ejemplo con Node.js
cd backend
npm install
npm run dev

# Ejemplo con Python
# cd backend
# pip install -r requirements.txt
# uvicorn main:app --reload
```

### 6. Instalar dependencias y correr el frontend

```bash
cd frontend
npm install
npm run dev
```

La app estará disponible en `http://localhost:5173` (Vite) o `http://localhost:3000` (según configuración).

---

## 🗄️ Base de datos

El esquema completo está en `database/schema.sql`. Incluye:

- `empresas` — Multitenant, cada empresa tiene su propia configuración legal.
- `sucursales` — Dependientes de una empresa.
- `puestos` — Puestos de vigilancia (perímetro, recepción, CCTV, etc.).
- `turno_plantillas` — Plantillas de turno (8h, 12h, 24h, etc.).
- `guardias` — Datos del guardia, contrato, disponibilidad.
- `certificaciones_os10` — Certificación OS-10 de Carabineros de Chile con fecha de vencimiento.
- `disponibilidad_guardias` — Días y horas que el guardia puede o no trabajar.
- `horarios` — Resultado generado por el motor de reglas.
- `descansos` — Descansos semanales, compensatorios, entre turnos.
- `solicitudes` — Vacaciones, permisos, cambios de turno.
- `configuracion_legal` — Jornada máxima semanal, descanso mínimo, horas extras, recargos.
- `auditoria` — Quién modificó qué y cuándo (importante para inspección del Trabajo).

---

## ⚙️ Motor de reglas (servicios)

Ubicado en `backend/services/`. Implementa las siguientes reglas:

### Reglas duras (no negociables)
1. Jornada semanal ≤ `configuracion_legal.jornada_maxima_semanal`
2. Descanso entre turnos ≥ 12 horas
3. Descanso semanal ≥ 24h corridas
4. Certificación OS-10 vigente
5. Guardia no tiene solicitud aprobada en esas fechas

### Reglas blandas (preferencias con advertencia)
- Distribución justa de fines de semana y nocturnos
- Preferencias de disponibilidad del guardia
- Equidad en horas totales por guardia

---

## 🔌 Endpoints API (principales)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/empresas` | Listar empresas |
| `POST` | `/api/empresas` | Crear empresa |
| `GET` | `/api/empresas/:id/configuracion-legal` | Configuración legal de la empresa |
| `PUT` | `/api/empresas/:id/configuracion-legal` | Actualizar configuración legal |
| `GET` | `/api/guardias` | Listar guardias |
| `POST` | `/api/guardias` | Crear guardia |
| `GET` | `/api/guardias/:id/certificacion-os10` | Certificación OS-10 |
| `POST` | `/api/guardias/:id/certificacion-os10` | Registrar OS-10 |
| `GET` | `/api/turno-plantillas` | Listar plantillas de turno |
| `POST` | `/api/turno-plantillas` | Crear plantilla de turno |
| `POST` | `/api/horarios/generar` | Ejecutar motor de reglas |
| `GET` | `/api/horarios/semanal` | Horarios semanales |
| `GET` | `/api/horarios/mensual` | Horarios mensuales |
| `POST` | `/api/horarios/publicar` | Publicar horarios |
| `GET` | `/api/reportes/cumplimiento` | Reporte de cumplimiento legal |
| `POST` | `/api/solicitudes` | Crear solicitud (vacaciones, permiso) |

---

## 📤 Despliegue a GitHub

Una vez validado el código localmente:

```bash
git init
git add .
git commit -m "feat: versión inicial de TURNSOFT"
git branch -M main
git remote add origin https://github.com/tu-usuario/TURNSOFT.git
git push -u origin main
```

**Importante:** El archivo `.env` y `node_modules/` están en `.gitignore` y no se suben a GitHub.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Véase el archivo `LICENSE` para más detalles.

---

**Equipo de desarrollo TURNSOFT** — App generadora de horarios para guardias de seguridad (Chile)