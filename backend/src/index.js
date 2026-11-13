require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rutas
app.use('/api/empresas', require('./routes/empresas'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/guardias', require('./routes/guardias'));
app.use('/api/turno-plantillas', require('./routes/turnoPlantillas'));
app.use('/api/puestos', require('./routes/puestos'));
app.use('/api/motor', require('./routes/motor'));
app.use('/api/horarios', require('./routes/horarios'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/soporte', require('./routes/soporte'));
app.use('/api/master', require('./routes/master'));
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TURNSOFT Backend',
    engine: 'turnsoft-v2',
    sectors: ['seguridad', 'salud', 'mineria', 'retail', 'logistica'],
    timestamp: new Date(),
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 TURNSOFT Backend corriendo en http://localhost:${PORT}`);
});

module.exports = app;