import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'path';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // __dirname is src/db (dev) or dist/db (prod); ../../drizzle resolves to the project root
  const migrationsFolder = path.join(__dirname, '../../drizzle');

  console.log('Running migrations from', migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
