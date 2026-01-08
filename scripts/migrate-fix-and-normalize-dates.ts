/**
 * Migration Script: Fix invalid log_date values and normalize all dates
 * 
 * This script performs two operations:
 * 1. Fix invalid log_date values (2000-01-01) by using created_at date
 * 2. Normalize all log_date values to YYYY-MM-DD format and extract time to log_time column
 * 
 * Usage:
 *   npm run migrate:dates              # Run migration
 *   npm run migrate:dates:dry-run      # Preview changes (no updates)
 *   BATCH_SIZE=500 npm run migrate:dates  # Custom batch size
 * 
 * Prerequisites:
 *   - .env.local or .env file with MYSQL_* credentials
 *   - Database must be running and accessible
 *   - Backup database before running!
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Load .env.local or .env
async function loadEnv() {
  // Try .env.local first, then fallback to .env
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');
  
  let finalEnvPath: string;
  if (existsSync(envLocalPath)) {
    finalEnvPath = envLocalPath;
  } else if (existsSync(envPath)) {
    finalEnvPath = envPath;
  } else {
    console.error('❌ Environment file not found!');
    console.error('   Please create .env.local or .env with MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE');
    process.exit(1);
  }

  const content = await readFile(finalEnvPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  }
  
  // Verify required env vars
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error(`   Please check your ${finalEnvPath.includes('.env.local') ? '.env.local' : '.env'} file`);
    process.exit(1);
  }
  
  console.log(`✅ Environment variables loaded from ${finalEnvPath.includes('.env.local') ? '.env.local' : '.env'}`);
}

/**
 * Step 1: Fix invalid log_date values (2000-01-01) with created_at date
 */
async function fixInvalidLogDates() {
  const { executeQuery } = await import('../lib/mysql');
  console.log('🚀 Step 1: Fixing invalid log_date values (2000-01-01)...\n');

  const DRY_RUN = process.env.DRY_RUN === 'true';
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Get total count
  const totalCountResult = await executeQuery(
    `SELECT COUNT(*) as total 
     FROM systeminformation 
     WHERE log_date = '2000-01-01'`
  ) as any[];
  
  const totalRecords = totalCountResult[0]?.total || 0;
  console.log(`📊 Found ${totalRecords} records with log_date = '2000-01-01'\n`);

  if (totalRecords === 0) {
    console.log('✅ No invalid dates to fix. Moving to next step...\n');
    return { updated: 0, failed: 0 };
  }

  // Process with pagination
  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10);
  let updated = 0;
  let failed = 0;
  let offset = 0;

  console.log(`📦 Processing in batches of ${BATCH_SIZE} records...\n`);

  while (true) {
    const records = await executeQuery(
      `SELECT id, device_id, log_date, created_at
       FROM systeminformation 
       WHERE log_date = '2000-01-01'
       LIMIT ${BATCH_SIZE} OFFSET ${offset}`
    ) as any[];

    if (records.length === 0) {
      break;
    }

    console.log(`📊 Processing batch: ${offset + 1} to ${offset + records.length} of ${totalRecords}`);

    if (!DRY_RUN) {
      try {
        const recordIds = records.map(r => r.id);
        const placeholders = recordIds.map(() => '?').join(',');
        
        const updateResult = await executeQuery(
          `UPDATE systeminformation 
           SET log_date = DATE(created_at)
           WHERE id IN (${placeholders}) AND log_date = '2000-01-01'`,
          recordIds
        ) as any;
        
        const affectedRows = (updateResult as any)?.affectedRows || 0;
        updated += affectedRows;
        
        if (updated % 100 === 0) {
          console.log(`   📊 Progress: ${updated}/${totalRecords} records updated`);
        }
      } catch (error) {
        console.error(`   ❌ Error updating batch:`, error);
        // Fallback: update one by one
        for (const record of records) {
          try {
            await executeQuery(
              `UPDATE systeminformation 
               SET log_date = DATE(created_at)
               WHERE id = ? AND log_date = '2000-01-01'`,
              [record.id]
            );
            updated++;
          } catch (error) {
            console.error(`   ❌ Error fixing record ${record.id}:`, error);
            failed++;
          }
        }
      }
    } else {
      // DRY RUN: Count records that would be updated
      for (const record of records) {
        try {
          const dateFromCreatedAt = await executeQuery(
            `SELECT DATE(created_at) as date_value
             FROM systeminformation 
             WHERE id = ?`,
            [record.id]
          ) as any[];

          const newDate = dateFromCreatedAt[0]?.date_value || null;
          if (newDate) {
            updated++;
            if (updated % 100 === 0) {
              console.log(`   📊 Progress: ${updated}/${totalRecords} records would be updated`);
            }
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`   ❌ Error checking record ${record.id}:`, error);
          failed++;
        }
      }
    }

    offset += BATCH_SIZE;
    console.log(`   📊 Batch complete. Progress: ${updated} ${DRY_RUN ? 'would be ' : ''}updated, ${failed} failed\n`);
  }

  console.log(`✅ Step 1 ${DRY_RUN ? 'preview' : 'complete'}:`);
  console.log(`   - ${updated} ${DRY_RUN ? 'would be ' : ''}updated`);
  console.log(`   - ${failed} failed\n`);

  return { updated, failed };
}

/**
 * Step 2: Normalize all log_date values to YYYY-MM-DD format
 */
async function normalizeAllDates() {
  const { executeQuery } = await import('../lib/mysql');
  const { normalizeDateTime } = await import('../lib/system-information-parser/date-normalizer');
  console.log('🚀 Step 2: Normalizing all log_date values...\n');

  const DRY_RUN = process.env.DRY_RUN === 'true';
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Check if log_time column exists
  let logTimeColumnExists = false;
  try {
    const columnCheck = await executeQuery(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'systeminformation'
        AND COLUMN_NAME = 'log_time'
    `) as any[];
    
    logTimeColumnExists = columnCheck[0]?.count > 0;
  } catch (error) {
    console.log('⚠️ Could not check for log_time column:', error);
  }

  // Add log_time column if not exists
  if (!logTimeColumnExists) {
    if (DRY_RUN) {
      console.log('📋 Would create log_time column (VARCHAR(8) NOT NULL DEFAULT \'00:00:00\')');
      logTimeColumnExists = false;
    } else {
      try {
        await executeQuery(`
          ALTER TABLE systeminformation 
          ADD COLUMN log_time VARCHAR(8) NOT NULL DEFAULT '00:00:00'
          COMMENT 'Normalized time in HH:mm:ss format (always string, default 00:00:00)' 
          AFTER log_date
        `);
        console.log('✅ Added log_time column with NOT NULL DEFAULT');
        logTimeColumnExists = true;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('Duplicate column name') || errorMsg.includes('already exists')) {
          console.log('✅ log_time column already exists');
          logTimeColumnExists = true;
        } else {
          console.log('⚠️ Could not add log_time column:', errorMsg);
          throw error;
        }
      }
    }
  } else {
    console.log('✅ log_time column already exists');
    
    // Update schema if not yet NOT NULL DEFAULT
    if (!DRY_RUN) {
      try {
        await executeQuery(`
          ALTER TABLE systeminformation 
          MODIFY COLUMN log_time VARCHAR(8) NOT NULL DEFAULT '00:00:00'
        `);
        console.log('✅ Updated log_time column to NOT NULL DEFAULT');
      } catch (updateError) {
        console.log('⚠️ Could not update log_time column (might already be correct):', updateError);
      }
    }
  }

  // Get total count
  const totalCountResult = await executeQuery(
    'SELECT COUNT(*) as total FROM systeminformation WHERE log_date IS NOT NULL'
  ) as any[];
  const totalRecords = totalCountResult[0]?.total || 0;
  console.log(`📊 Found ${totalRecords} records to normalize\n`);

  if (totalRecords === 0) {
    console.log('✅ No records to normalize. Migration complete!');
    return { updated: 0, skipped: 0, failed: 0 };
  }

  // Normalize each date & time with pagination
  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10);
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  let offset = 0;

  console.log(`📦 Processing in batches of ${BATCH_SIZE} records...\n`);

  while (true) {
    const logTimeSelect = logTimeColumnExists ? ', log_time' : '';
    const records = await executeQuery(
      `SELECT id, device_id, log_date${logTimeSelect}
       FROM systeminformation 
       WHERE log_date IS NOT NULL 
       LIMIT ${BATCH_SIZE} OFFSET ${offset}`
    ) as any[];

    if (records.length === 0) {
      break;
    }

    console.log(`📊 Processing batch: ${offset + 1} to ${offset + records.length} of ${totalRecords}`);

    for (const record of records) {
      try {
        const normalized = normalizeDateTime(record.log_date);
        const currentLogTime = record.log_time || '00:00:00';
        
        // Handle special values (like "Disabled") that return null date
        if (normalized.date === null) {
          if (record.log_date !== null && record.log_date.toLowerCase() !== 'null') {
            if (!DRY_RUN) {
              await executeQuery(
                'UPDATE systeminformation SET log_date = NULL, log_time = ? WHERE id = ?',
                ['00:00:00', record.id]
              );
            }
            updated++;
            if (updated % 100 === 0) {
              console.log(`   📊 Progress: ${updated}/${totalRecords} records ${DRY_RUN ? 'would be ' : ''}updated`);
            }
          } else {
            skipped++;
          }
        }
        // Normal date normalization
        else if (normalized.date) {
          const needsUpdate =
            normalized.date !== record.log_date ||
            (normalized.time && normalized.time !== '00:00:00' && currentLogTime !== normalized.time);

          if (needsUpdate) {
            if (!DRY_RUN) {
              await executeQuery(
                'UPDATE systeminformation SET log_date = ?, log_time = ? WHERE id = ?',
                [normalized.date, normalized.time || '00:00:00', record.id]
              );
            }
            updated++;

            if (updated % 100 === 0) {
              console.log(`   📊 Progress: ${updated}/${totalRecords} records ${DRY_RUN ? 'would be ' : ''}updated`);
            }
          } else {
            skipped++;
          }
        }
        else {
          console.warn(`   ⚠️ Failed to normalize date for record ${record.id}: ${record.log_date}`);
          failed++;
        }
      } catch (error) {
        console.error(`   ❌ Error normalizing record ${record.id}:`, error);
        failed++;
      }
    }

    offset += BATCH_SIZE;
    console.log(`   📊 Batch complete. Progress: ${updated} ${DRY_RUN ? 'would be ' : ''}updated, ${skipped} skipped, ${failed} failed\n`);
  }

  console.log(`✅ Step 2 ${DRY_RUN ? 'preview' : 'complete'}:`);
  console.log(`   - ${updated} ${DRY_RUN ? 'would be ' : ''}updated`);
  console.log(`   - ${skipped} skipped (already normalized)`);
  console.log(`   - ${failed} failed`);

  // Update log_date column size after normalizing all data
  if (!DRY_RUN && updated > 0) {
    console.log('\n📋 Attempting to update log_date column size to VARCHAR(10)...');
    try {
      const longDateCheck = await executeQuery(`
        SELECT COUNT(*) as count
        FROM systeminformation
        WHERE log_date IS NOT NULL
          AND LENGTH(log_date) > 10
      `) as any[];
      
      const longDates = longDateCheck[0]?.count || 0;
      
      if (longDates === 0) {
        await executeQuery(`
          ALTER TABLE systeminformation 
          MODIFY COLUMN log_date VARCHAR(10) NULL 
          COMMENT 'Normalized date in YYYY-MM-DD format'
        `);
        console.log('✅ Updated log_date column size to VARCHAR(10)');
      } else {
        console.log(`⚠️  Found ${longDates} records with log_date > 10 characters. Skipping column size modification.`);
        
        // Show sample of problematic records
        try {
          const sampleRecords = await executeQuery(`
            SELECT id, device_id, log_date, LENGTH(log_date) as date_length
            FROM systeminformation
            WHERE log_date IS NOT NULL
              AND LENGTH(log_date) > 10
            LIMIT 5
          `) as any[];
          
          if (sampleRecords.length > 0) {
            console.log('\n   Sample records with long log_date:');
            sampleRecords.forEach(record => {
              console.log(`   - ID ${record.id}: "${record.log_date}" (${record.date_length} chars)`);
            });
            if (longDates > 5) {
              console.log(`   ... and ${longDates - 5} more records`);
            }
          }
        } catch (_sampleError) {
          // Ignore error when showing samples
        }
      }
    } catch (error) {
      console.log('⚠️  Could not modify log_date column size:', error);
      console.log('   This is not critical - data is already normalized.');
    }
  }

  return { updated, skipped, failed };
}

/**
 * Main migration function that runs both steps
 */
async function runMigration() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Broń Vault - Date Migration Script');
  console.log('═══════════════════════════════════════════════════════════\n');

  const DRY_RUN = process.env.DRY_RUN === 'true';
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made to the database\n');
  }

  // Step 1: Fix invalid dates
  const step1Result = await fixInvalidLogDates();

  // Step 2: Normalize all dates
  const step2Result = await normalizeAllDates();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Step 1 - Fix Invalid Dates:');
  console.log(`  - ${step1Result.updated} ${DRY_RUN ? 'would be ' : ''}updated`);
  console.log(`  - ${step1Result.failed} failed`);
  console.log('\nStep 2 - Normalize All Dates:');
  console.log(`  - ${step2Result.updated} ${DRY_RUN ? 'would be ' : ''}updated`);
  console.log(`  - ${step2Result.skipped} skipped (already normalized)`);
  console.log(`  - ${step2Result.failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (DRY_RUN && (step1Result.updated > 0 || step2Result.updated > 0)) {
    console.log(`💡 Run without DRY_RUN=true to execute the migration`);
  }
}

// Run migration
if (require.main === module) {
  (async () => {
    try {
      console.log('📋 Loading environment variables...');
      await loadEnv();
      
      // Debug: Show loaded env vars (hide password)
      console.log(`   MYSQL_HOST: ${process.env.MYSQL_HOST}`);
      console.log(`   MYSQL_PORT: ${process.env.MYSQL_PORT || '3306'}`);
      console.log(`   MYSQL_USER: ${process.env.MYSQL_USER}`);
      console.log(`   MYSQL_PASSWORD: ${process.env.MYSQL_PASSWORD ? '***' : 'NOT SET!'}`);
      console.log(`   MYSQL_DATABASE: ${process.env.MYSQL_DATABASE}\n`);
      
      await runMigration();
      console.log('\n✅ Migration script completed');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    }
  })();
}

export { runMigration, fixInvalidLogDates, normalizeAllDates };

