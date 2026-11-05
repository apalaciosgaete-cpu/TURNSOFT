# TURNSOFT - Especificación de la API

Base URL: `http://localhost:3000/api`

---

## Empresas

### Listar empresas
`GET /empresas`

### Crear empresa
`POST /empresas`
Body:
```json
{
  "razon_social": "Seguridad Protectora Ltda.",
  "rut_empresa": "76.123.456-7",
  "jornada_maxima_semanal": 44,
  "descanso_minimo_entre_turnos": 12,
  "horas_extras_max_diarias": 2,
  "recargo_dominical_festivo": 50.00
}
```

### Obtener configuración legal
`GET /empresas/:id/configuracion-legal`

### Actualizar configuración legal
`PUT /empresas/:id/configuracion-legal`

---

## Guardias

### Listar guardias
`GET /guardias?empresa_id=UUID`

### Crear guardia
`POST /guardias`
Body:
```json
{
  "empresa_id": "UUID",
  "nombre_completo": "Juan Pérez",
  "rut": "12.345.678-9",
  "email": "juan@empresa.cl",
  "telefono": "+56912345678",
  "fecha_contrato": "2024-01-15",
  "horas_semanales_max": 44
}
```

### Certificación OS-10
`GET /guardias/:id/certificacion-os10`
`POST /guardias/:id/certificacion-os10`
Body:
```json
{
  "numero_certificado": "OS10-123456",
  "fecha_vencimiento": "2026-12-31"
}
```

---

## Puestos y turnos

### Listar plantillas de turno
`GET /turno-plantillas`

### Crear plantilla de turno
`POST /turno-plantillas`
Body:
```json
{
  "nombre": "Turno 12x12",
  "duracion_horas": 12,
  "hora_inicio": "06:00",
  "hora_fin": "18:00",
  "requiere_colacion": true,
  "es_nocturno": false
}
```

---

## Horarios

### Generar horarios (motor de reglas)
`POST /horarios/generar`
Body:
```json
{
  "empresa_id": "UUID",
  "sucursal_id": "UUID",
  "fecha_inicio": "2026-11-09",
  "fecha_fin": "2026-11-15"
}
```

### Obtener horarios semanales
`GET /horarios/semanal?empresa_id=UUID&semana=2026-W45`

### Obtener horarios mensuales
`GET /horarios/mensual?empresa_id=UUID&mes=2026-11`

### Publicar horarios
`POST /horarios/publicar`
Body:
```json
{
  "horario_ids": ["UUID", "UUID"]
}
```

---

## Reportes

### Reporte de cumplimiento legal
`GET /reportes/cumplimiento?empresa_id=UUID&mes=2026-11&formato=excel`

---

## Solicitudes

### Listar solicitudes
`GET /solicitudes?empresa_id=UUID`

### Crear solicitud
`POST /solicitudes`
Body:
```json
{
  "guardia_id": "UUID",
  "fecha_inicio": "2026-12-01",
  "fecha_fin": "2026-12-10",
  "tipo": "vacaciones",
  "motivo": "Vacaciones anuales"
}
```