/**
 * Ejecutor de migraciones de TURNSOFT.
 *
 * Uso:
 *   npm run migrate            # aplica database/migrations/*.sql en orden
 *   npm run migrate -- --fresh # crea el esquema base y luego las migraciones
 *
 * En una base existente creada con la versión anterior de schema.sql usa solo
 * `npm run migrate`: la migración 002 es idempotente.
 */
const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

const DATABASE_DIR = path.resolve(__dirname, '../../database');
const MIGRATIONS_DIR = path.join(DATABASE_DIR, 'migrations');

async function runSqlFile(client, file) {
  const sql = fs.readFileSync(file, 'utf8');
  await client.query(sql);
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const client = await pool.connect();
  try {
    if (fresh) {
      console.log('Creando esquema base database/schema.sql…');
      await runSqlFile(client, path.join(DATABASE_DIR, 'schema.sql'));
    }

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('No hay directorio de migraciones. Nada que aplicar.');
      return;
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Aplicando ${file}…`);
      await runSqlFile(client, path.join(MIGRATIONS_DIR, file));
    }
    console.log(`Migraciones aplicadas: ${files.length}.`);
  } catch (error) {
    console.error('Error aplicando migraciones:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
