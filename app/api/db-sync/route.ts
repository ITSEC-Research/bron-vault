import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeRawQuery } from "@/lib/mysql"
import {
  ALL_TABLES,
  SCHEMA_VERSION,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  SchemaDifference,
  SchemaCheckResult,
} from "@/lib/schema-definition"

// Helper to execute query and return results
async function executeQuery(sql: string): Promise<any[]> {
  return await executeRawQuery(sql) as any[]
}

// Get list of tables in database
async function getExistingTables(): Promise<string[]> {
  const result = await executeQuery("SHOW TABLES")
  return result.map((row: any) => Object.values(row)[0] as string)
}

// Get columns for a table
async function getTableColumns(tableName: string): Promise<any[]> {
  const result = await executeQuery(`DESCRIBE \`${tableName}\``)
  return result
}

// Get indexes for a table
async function getTableIndexes(tableName: string): Promise<any[]> {
  const result = await executeQuery(`SHOW INDEX FROM \`${tableName}\``)
  return result
}

// Get foreign keys for a table
async function getTableForeignKeys(tableName: string): Promise<any[]> {
  const result = await executeQuery(`
    SELECT 
      CONSTRAINT_NAME as name,
      COLUMN_NAME as column_name,
      REFERENCED_TABLE_NAME as referenced_table,
      REFERENCED_COLUMN_NAME as referenced_column
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = '${tableName}'
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `)
  return result
}

// Normalize type for comparison (handle variations like int(11) vs int)
function normalizeType(type: string): string {
  if (!type) return ''
  let normalized = type.toLowerCase().trim()
  
  // Remove display width from int types (int(11) -> int)
  normalized = normalized.replace(/int\(\d+\)/g, 'int')
  normalized = normalized.replace(/bigint\(\d+\)/g, 'bigint')
  normalized = normalized.replace(/tinyint\(\d+\)/g, 'tinyint(1)')
  
  // Normalize boolean -> tinyint(1)
  normalized = normalized.replace(/^boolean$/i, 'tinyint(1)')
  
  return normalized
}

// Compare columns
function compareColumns(
  tableName: string,
  expected: ColumnDefinition[],
  actual: any[]
): SchemaDifference[] {
  const differences: SchemaDifference[] = []
  
  const actualColumns = new Map<string, any>()
  actual.forEach(col => {
    actualColumns.set(col.Field.toLowerCase(), col)
  })
  
  const expectedNames = new Set(expected.map(c => c.name.toLowerCase()))
  
  // Check for missing columns
  for (const col of expected) {
    const actualCol = actualColumns.get(col.name.toLowerCase())
    
    if (!actualCol) {
      differences.push({
        type: 'missing_column',
        table: tableName,
        detail: `Column '${col.name}' is missing`,
        expected: `${col.type}`,
        severity: 'critical',
        fixQuery: generateAddColumnQuery(tableName, col)
      })
      continue
    }
    
    // Check type
    const expectedType = normalizeType(col.type)
    const actualType = normalizeType(actualCol.Type)
    
    if (expectedType !== actualType) {
      // Check if it's just a size difference (e.g., varchar(255) vs varchar(500))
      const expectedBase = expectedType.replace(/\(\d+\)/g, '')
      const actualBase = actualType.replace(/\(\d+\)/g, '')
      
      if (expectedBase !== actualBase) {
        differences.push({
          type: 'column_type_mismatch',
          table: tableName,
          detail: `Column '${col.name}' has wrong type`,
          expected: col.type,
          actual: actualCol.Type,
          severity: 'critical',
          fixQuery: `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${col.name}\` ${col.type}${col.nullable ? ' NULL' : ' NOT NULL'}${col.default !== undefined ? ` DEFAULT ${col.default === null ? 'NULL' : col.default}` : ''};`
        })
      }
    }
    
    // Check nullable
    const expectedNullable = col.nullable
    const actualNullable = actualCol.Null === 'YES'
    
    if (expectedNullable !== actualNullable) {
      differences.push({
        type: 'column_nullable_mismatch',
        table: tableName,
        detail: `Column '${col.name}' has wrong nullable setting`,
        expected: col.nullable ? 'NULL' : 'NOT NULL',
        actual: actualNullable ? 'NULL' : 'NOT NULL',
        severity: 'warning',
        fixQuery: `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${col.name}\` ${actualCol.Type}${col.nullable ? ' NULL' : ' NOT NULL'};`
      })
    }
  }
  
  // Check for extra columns
  for (const [colName] of actualColumns) {
    if (!expectedNames.has(colName)) {
      differences.push({
        type: 'extra_column',
        table: tableName,
        detail: `Extra column '${colName}' not in schema`,
        severity: 'info'
      })
    }
  }
  
  return differences
}

// Generate ADD COLUMN query
function generateAddColumnQuery(tableName: string, col: ColumnDefinition): string {
  let query = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.name}\` ${col.type}`
  
  if (!col.nullable) {
    query += ' NOT NULL'
  } else {
    query += ' NULL'
  }
  
  if (col.default !== undefined) {
    if (col.default === null) {
      query += ' DEFAULT NULL'
    } else if (col.default === 'CURRENT_TIMESTAMP') {
      query += ' DEFAULT CURRENT_TIMESTAMP'
    } else {
      query += ` DEFAULT ${col.default}`
    }
  }
  
  if (col.extra) {
    query += ` ${col.extra}`
  }
  
  return query + ';'
}

// Compare indexes
function compareIndexes(
  tableName: string,
  expected: IndexDefinition[],
  actual: any[]
): SchemaDifference[] {
  const differences: SchemaDifference[] = []
  
  // Group actual indexes by name
  const actualIndexes = new Map<string, { columns: string[], unique: boolean }>()
  for (const idx of actual) {
    const name = idx.Key_name
    if (!actualIndexes.has(name)) {
      actualIndexes.set(name, { columns: [], unique: idx.Non_unique === 0 })
    }
    actualIndexes.get(name)!.columns.push(idx.Column_name)
  }
  
  const expectedNames = new Set(expected.map(i => i.name.toLowerCase()))
  
  // Check for missing indexes
  for (const idx of expected) {
    const actualIdx = actualIndexes.get(idx.name)
    
    if (!actualIdx) {
      // Index missing
      const columns = idx.columns.map(c => `\`${c}\``).join(', ')
      differences.push({
        type: 'missing_index',
        table: tableName,
        detail: `Index '${idx.name}' is missing`,
        expected: `${idx.unique ? 'UNIQUE ' : ''}INDEX on (${idx.columns.join(', ')})`,
        severity: 'warning',
        fixQuery: `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX \`${idx.name}\` ON \`${tableName}\` (${columns});`
      })
    }
  }
  
  // Check for extra indexes (info only)
  for (const [idxName] of actualIndexes) {
    if (!expectedNames.has(idxName.toLowerCase())) {
      differences.push({
        type: 'extra_index',
        table: tableName,
        detail: `Extra index '${idxName}' not in schema definition`,
        severity: 'info'
      })
    }
  }
  
  return differences
}

// Compare foreign keys
function compareForeignKeys(
  tableName: string,
  expected: { name: string; column: string; referencedTable: string; referencedColumn: string }[],
  actual: any[]
): SchemaDifference[] {
  const differences: SchemaDifference[] = []
  
  const actualFKs = new Map<string, any>()
  actual.forEach(fk => {
    actualFKs.set(fk.column_name.toLowerCase(), fk)
  })
  
  // Check for missing FKs (by column, not by name since names can vary)
  for (const fk of expected) {
    const actualFK = actualFKs.get(fk.column.toLowerCase())
    
    if (!actualFK) {
      differences.push({
        type: 'missing_fk',
        table: tableName,
        detail: `Foreign key on '${fk.column}' is missing`,
        expected: `REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`,
        severity: 'warning',
        fixQuery: `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.referencedTable}\`(\`${fk.referencedColumn}\`) ON DELETE CASCADE;`
      })
    }
  }
  
  return differences
}

// Main schema check function
async function checkSchema(): Promise<SchemaCheckResult> {
  const differences: SchemaDifference[] = []
  const missingTables: string[] = []
  const extraTables: string[] = []
  
  let validTables = 0
  let totalColumns = 0
  let validColumns = 0
  let totalIndexes = 0
  let validIndexes = 0
  
  // Get existing tables
  const existingTables = await getExistingTables()
  const existingTableSet = new Set(existingTables.map(t => t.toLowerCase()))
  const expectedTableSet = new Set(ALL_TABLES.map(t => t.name.toLowerCase()))
  
  // Check for missing tables
  for (const tableDef of ALL_TABLES) {
    if (!existingTableSet.has(tableDef.name.toLowerCase())) {
      missingTables.push(tableDef.name)
      differences.push({
        type: 'missing_table',
        table: tableDef.name,
        detail: `Table '${tableDef.name}' does not exist`,
        severity: 'critical',
        fixQuery: generateCreateTableQuery(tableDef)
      })
    }
  }
  
  // Check for extra tables
  for (const tableName of existingTables) {
    if (!expectedTableSet.has(tableName.toLowerCase())) {
      extraTables.push(tableName)
      differences.push({
        type: 'extra_table',
        table: tableName,
        detail: `Table '${tableName}' exists but not in schema definition`,
        severity: 'info'
      })
    }
  }
  
  // Check each expected table that exists
  for (const tableDef of ALL_TABLES) {
    if (!existingTableSet.has(tableDef.name.toLowerCase())) {
      continue
    }
    
    let tableValid = true
    
    // Get current table structure
    const columns = await getTableColumns(tableDef.name)
    const indexes = await getTableIndexes(tableDef.name)
    const foreignKeys = await getTableForeignKeys(tableDef.name)
    
    totalColumns += tableDef.columns.length
    totalIndexes += tableDef.indexes.length
    
    // Compare columns
    const columnDiffs = compareColumns(tableDef.name, tableDef.columns, columns)
    if (columnDiffs.length > 0) {
      tableValid = false
      differences.push(...columnDiffs)
    } else {
      validColumns += tableDef.columns.length
    }
    
    // Compare indexes
    const indexDiffs = compareIndexes(tableDef.name, tableDef.indexes, indexes)
    if (indexDiffs.some(d => d.type === 'missing_index')) {
      tableValid = false
    }
    differences.push(...indexDiffs)
    validIndexes += tableDef.indexes.length - indexDiffs.filter(d => d.type === 'missing_index').length
    
    // Compare foreign keys
    const fkDiffs = compareForeignKeys(tableDef.name, tableDef.foreignKeys, foreignKeys)
    if (fkDiffs.some(d => d.type === 'missing_fk')) {
      tableValid = false
    }
    differences.push(...fkDiffs)
    
    if (tableValid) {
      validTables++
    }
  }
  
  const criticalIssues = differences.filter(d => d.severity === 'critical').length
  const warnings = differences.filter(d => d.severity === 'warning').length
  
  return {
    isValid: criticalIssues === 0 && missingTables.length === 0,
    schemaVersion: SCHEMA_VERSION,
    differences,
    missingTables,
    extraTables,
    summary: {
      totalTables: ALL_TABLES.length,
      validTables,
      totalColumns,
      validColumns,
      totalIndexes,
      validIndexes,
      criticalIssues,
      warnings
    }
  }
}

// Generate CREATE TABLE query
function generateCreateTableQuery(table: TableDefinition): string {
  const columns = table.columns.map(col => {
    let def = `  \`${col.name}\` ${col.type}`
    if (!col.nullable) def += ' NOT NULL'
    if (col.default !== undefined) {
      if (col.default === null) {
        def += ' DEFAULT NULL'
      } else if (col.default === 'CURRENT_TIMESTAMP') {
        def += ' DEFAULT CURRENT_TIMESTAMP'
      } else {
        def += ` DEFAULT ${col.default}`
      }
    }
    if (col.extra) def += ` ${col.extra.toUpperCase()}`
    if (col.comment) def += ` COMMENT '${col.comment}'`
    return def
  })
  
  // Add primary key
  const primaryCols = table.columns.filter(c => c.key === 'PRI')
  if (primaryCols.length > 0) {
    columns.push(`  PRIMARY KEY (${primaryCols.map(c => `\`${c.name}\``).join(', ')})`)
  }
  
  // Add unique constraints
  const uniqueCols = table.columns.filter(c => c.key === 'UNI')
  for (const col of uniqueCols) {
    columns.push(`  UNIQUE KEY \`${col.name}\` (\`${col.name}\`)`)
  }
  
  // Add indexes (non-primary, non-unique)
  for (const idx of table.indexes) {
    if (idx.name === 'PRIMARY' || idx.unique) continue
    const cols = idx.columns.map(c => `\`${c}\``).join(', ')
    columns.push(`  INDEX \`${idx.name}\` (${cols})`)
  }
  
  // Add foreign keys
  for (const fk of table.foreignKeys) {
    columns.push(`  CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.referencedTable}\`(\`${fk.referencedColumn}\`) ON DELETE ${fk.onDelete}`)
  }
  
  let query = `CREATE TABLE IF NOT EXISTS \`${table.name}\` (\n${columns.join(',\n')}\n)`
  
  if (table.engine) query += ` ENGINE=${table.engine}`
  if (table.charset) query += ` DEFAULT CHARSET=${table.charset}`
  if (table.collate) query += ` COLLATE=${table.collate}`
  if (table.comment) query += ` COMMENT='${table.comment}'`
  
  return query + ';'
}

// GET - Check schema status
export async function GET() {
  try {
    const result = await checkSchema()
    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("Schema check error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to check database schema",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// POST - Execute schema sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    if (action !== 'sync') {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid action. Use 'sync' to sync schema." 
      }, { status: 400 })
    }
    
    // Get current differences
    const checkResult = await checkSchema()
    
    if (checkResult.isValid) {
      return NextResponse.json({
        success: true,
        message: "Schema is already up to date",
        executed: 0
      })
    }
    
    // Execute fixes for critical and warning issues only
    const fixQueries: string[] = []
    const executed: string[] = []
    const failed: { query: string; error: string }[] = []
    
    // Sort differences: missing_table first, then missing_column, then others
    const sortedDiffs = [...checkResult.differences].sort((a, b) => {
      const priority = { 'missing_table': 0, 'missing_column': 1, 'column_type_mismatch': 2, 'missing_index': 3, 'missing_fk': 4 }
      return (priority[a.type as keyof typeof priority] ?? 99) - (priority[b.type as keyof typeof priority] ?? 99)
    })
    
    for (const diff of sortedDiffs) {
      if (diff.fixQuery && (diff.severity === 'critical' || diff.severity === 'warning')) {
        fixQueries.push(diff.fixQuery)
      }
    }
    
    // Execute each fix query
    for (const query of fixQueries) {
      try {
        await executeQuery(query)
        executed.push(query)
      } catch (error) {
        failed.push({
          query,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }
    
    // Recheck schema
    const recheckResult = await checkSchema()
    
    return NextResponse.json({
      success: recheckResult.isValid,
      message: recheckResult.isValid 
        ? "Schema synced successfully" 
        : "Some issues could not be fixed automatically",
      executed: executed.length,
      failed: failed.length,
      executedQueries: executed,
      failedQueries: failed,
      currentStatus: recheckResult
    })
  } catch (error) {
    console.error("Schema sync error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to sync database schema",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
