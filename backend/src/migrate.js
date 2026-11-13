/**
 * Ejecutor de migraciones de TURNSOFT.
 *
 * Uso:
 *   npm run migrate                # aplica solo las migraciones que faltan
 *   npm run migrate -- --fresh     # crea el esquema base y luego las migraciones
 *   npm run migrate -- --baseline  # marca como aplicadas todas las migraciones
 *                                  # existentes SIN ejecutarlas
 *
 * Las migraciones aplicadas se registran en la tabla `schema_migrations`, así
 * que el comando se puede repetir sin volver a ejecutar archivos ya aplicados.
 *
 * Bases creadas antes de este control (sin `schema_migrations`): si ya tienen
 * todas las migraciones aplicadas a mano, ejecuta una sola vez
 * `npm run migrate -- --baseline` y desde ahí usa `npm run migrate`.
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

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre VARCHAR(255) PRIMARY KEY,
      aplicada_en TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  // Esta tabla es interna: no debe exponerse por la API automática de Supabase.
  await client.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');
}

async function appliedMigrations(client) {
  const result = await client.query('SELECT nombre FROM schema_migrations');
  return new Set(result.rows.map((row) => row.nombre));
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const baseline = process.argv.includes('--baseline');
  const client = await pool.connect();
  try {
    if (fresh && baseline) {
      throw new Error('--fresh y --baseline no se pueden usar juntos.');
    }

    if (fresh) {
      console.log('Creando esquema base database/schema.sql…');
      await runSqlFile(client, path.join(DATABASE_DIR, 'schema.sql'));
      // Esquema nuevo: el registro previo de migraciones ya no es válido.
      await client.query('DROP TABLE IF EXISTS schema_migrations');
    }

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.log('No hay directorio de migraciones. Nada que aplicar.');
      return;
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    await ensureTrackingTable(client);
    const applied = await appliedMigrations(client);

    if (baseline) {
      let marked = 0;
      for (const file of files) {
        if (applied.has(file)) continue;
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [file]);
        console.log(`Marcada como aplicada: ${file}`);
        marked += 1;
      }
      console.log(`Línea base lista: ${marked} migración(es) marcadas, ${applied.size} ya registradas.`);
      return;
    }

    const pending = files.filter((file) => !applied.has(file));
    if (!pending.length) {
      console.log('Base de datos al día. No hay migraciones pendientes.');
      return;
    }

    for (const file of pending) {
      console.log(`Aplicando ${file}…`);
      await runSqlFile(client, path.join(MIGRATIONS_DIR, file));
      await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [file]);
    }
    console.log(`Migraciones aplicadas: ${pending.length}.`);
  } catch (error) {
    console.error('Error aplicando migraciones:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
