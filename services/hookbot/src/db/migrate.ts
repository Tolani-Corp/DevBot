import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is missing');
    }

    const sql = postgres(connectionString, { max: 1 });
    const db = drizzle(sql);

    console.log('Running migrations...');

    // Look for migrations in 'drizzle' folder in project root
    await migrate(db, { migrationsFolder: 'drizzle' });

    console.log('Migrations completed!');

    await sql.end();
    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
