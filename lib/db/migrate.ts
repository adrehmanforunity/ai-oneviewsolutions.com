/**
 * Database Migration Runner
 * Executes database migrations in order
 * 
 * Usage:
 *   npx ts-node lib/db/migrate.ts
 *   or
 *   node -r ts-node/register lib/db/migrate.ts
 */

import { executeMigration, tableExists, closePool } from './index';

const MIGRATIONS = [
  '001_initial_schema.sql',
];

/**
 * Run all pending migrations
 */
async function runMigrations(): Promise<void> {
  console.log('Starting database migrations...\n');

  try {
    for (const migration of MIGRATIONS) {
      console.log(`Executing migration: ${migration}`);
      await executeMigration(migration);
      console.log(`✓ ${migration} completed\n`);
    }

    console.log('All migrations completed successfully!');
    console.log('\nVerifying schema...');

    // Verify all tables were created
    const tables = [
      'providers',
      'provider_models',
      'provider_voices',
      'api_keys',
      'key_sharing',
      'tenant_rotation_strategy',
      'tenant_voice_config',
      'activity_log',
      'cost_records',
    ];

    for (const table of tables) {
      const exists = await tableExists(table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    }

    console.log('\nSchema verification complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
