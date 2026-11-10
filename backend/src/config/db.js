const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Supabase y otros PostgreSQL administrados usan TLS.
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'turnsoft_db',
    };

const pool = new Pool(poolConfig);

// Un corte de PostgreSQL no debe tumbar el proceso: las rutas responderán con
// el error de conexión y el login devolverá 503 si no puede verificar cuentas.
pool.on('error', (error) => {
  console.error('Error en el pool de PostgreSQL:', error.message);
});

pool.query('SELECT 1')
  .then(() => console.log('✅ Conectado a PostgreSQL'))
  .catch(err => console.error('❌ Error conectando a PostgreSQL:', err.message));

module.exports = pool;