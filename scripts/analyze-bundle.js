#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the Next.js bundle and provides optimization recommendations
 */

const fs = require('fs')
const path = require('path')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function analyzePackageJson() {
  log('\n📦 Analyzing package.json dependencies...', 'cyan')
  
  const packagePath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(packagePath)) {
    log('❌ package.json not found', 'red')
    return
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  // Check for potentially unused dependencies
  const potentiallyUnused = [
    'crypto', // Built-in Node.js module
    'fs', // Built-in Node.js module  
    'path', // Built-in Node.js module
    'util', // Built-in Node.js module
  ]

  const unusedDeps = Object.keys(dependencies).filter(dep => 
    potentiallyUnused.includes(dep)
  )

  if (unusedDeps.length > 0) {
    log('⚠️  Potentially unused dependencies found:', 'yellow')
    unusedDeps.forEach(dep => {
      log(`   - ${dep} (built-in Node.js module)`, 'yellow')
    })
    log('   Consider removing these from package.json', 'yellow')
  }

  // Check for large dependencies
  const largeDependencies = [
    'moment', // Use date-fns instead
    'lodash', // Use individual functions
    'axios', // Use fetch API
    'jquery', // Use vanilla JS or React
  ]

  const foundLargeDeps = Object.keys(dependencies).filter(dep => 
    largeDependencies.includes(dep)
  )

  if (foundLargeDeps.length > 0) {
    log('📊 Large dependencies found:', 'yellow')
    foundLargeDeps.forEach(dep => {
      log(`   - ${dep} (consider alternatives)`, 'yellow')
    })
  }

  log(`✅ Total dependencies: ${Object.keys(dependencies).length}`, 'green')
  log(`✅ Total devDependencies: ${Object.keys(devDependencies).length}`, 'green')
}

function analyzeImports() {
  log('\n🔍 Analyzing import patterns...', 'cyan')
  
  const srcDirs = ['app', 'components', 'lib', 'hooks']
  const issues = []

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return

    const files = fs.readdirSync(dir, { withFileTypes: true })
    
    files.forEach(file => {
      if (file.isDirectory()) {
        scanDirectory(path.join(dir, file.name))
      } else if (file.name.match(/\.(ts|tsx|js|jsx)$/)) {
        analyzeFile(path.join(dir, file.name))
      }
    })
  }

  function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // Check for unused imports (basic detection)
      const importMatch = line.match(/import\s+{([^}]+)}\s+from/)
      if (importMatch) {
        const imports = importMatch[1].split(',').map(i => i.trim())
        imports.forEach(importName => {
          const cleanImport = importName.replace(/\s+as\s+\w+/, '').trim()
          if (cleanImport && !content.includes(cleanImport.split(' ')[0])) {
            // This is a basic check - might have false positives
            issues.push({
              file: filePath,
              line: index + 1,
              issue: `Potentially unused import: ${cleanImport}`,
              type: 'unused-import'
            })
          }
        })
      }

      // Check for default imports of large libraries
      if (line.includes('import * as')) {
        issues.push({
          file: filePath,
          line: index + 1,
          issue: 'Wildcard import found - consider importing only what you need',
          type: 'wildcard-import'
        })
      }

      // Check for console.log statements
      if (line.includes('console.log') && !line.includes('//')) {
        issues.push({
          file: filePath,
          line: index + 1,
          issue: 'console.log statement found',
          type: 'console-log'
        })
      }
    })
  }

  srcDirs.forEach(scanDirectory)

  // Group issues by type
  const groupedIssues = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = []
    acc[issue.type].push(issue)
    return acc
  }, {})

  Object.entries(groupedIssues).forEach(([type, typeIssues]) => {
    log(`\n${getTypeIcon(type)} ${getTypeLabel(type)} (${typeIssues.length} found):`, 'yellow')
    typeIssues.slice(0, 10).forEach(issue => { // Show max 10 per type
      log(`   ${path.relative(process.cwd(), issue.file)}:${issue.line}`, 'yellow')
    })
    if (typeIssues.length > 10) {
      log(`   ... and ${typeIssues.length - 10} more`, 'yellow')
    }
  })

  if (Object.keys(groupedIssues).length === 0) {
    log('✅ No obvious import issues found!', 'green')
  }
}

function getTypeIcon(type) {
  const icons = {
    'unused-import': '📦',
    'wildcard-import': '🌟',
    'console-log': '🖨️'
  }
  return icons[type] || '⚠️'
}

function getTypeLabel(type) {
  const labels = {
    'unused-import': 'Potentially unused imports',
    'wildcard-import': 'Wildcard imports',
    'console-log': 'Console.log statements'
  }
  return labels[type] || type
}

function generateRecommendations() {
  log('\n💡 Optimization Recommendations:', 'cyan')
  
  const recommendations = [
    '1. Remove unused dependencies from package.json',
    '2. Use dynamic imports for large components',
    '3. Implement code splitting with Next.js dynamic imports',
    '4. Use tree-shaking friendly imports (import { specific } from "library")',
    '5. Remove console.log statements from production code',
    '6. Consider using Next.js Image component for optimized images',
    '7. Implement proper bundle analysis with @next/bundle-analyzer',
    '8. Use React.lazy() for component-level code splitting'
  ]

  recommendations.forEach(rec => {
    log(`   ${rec}`, 'green')
  })

  log('\n🔧 Next steps:', 'cyan')
  log('   1. Run: npm install --save-dev @next/bundle-analyzer', 'blue')
  log('   2. Add to next.config.mjs: const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: process.env.ANALYZE === "true" })', 'blue')
  log('   3. Run: ANALYZE=true npm run build', 'blue')
  log('   4. Review the generated bundle analysis report', 'blue')
}

function main() {
  log('🚀 Bundle Size Optimization Analysis', 'bright')
  log('=====================================', 'bright')
  
  analyzePackageJson()
  analyzeImports()
  generateRecommendations()
  
  log('\n✨ Analysis complete!', 'green')
}

if (require.main === module) {
  main()
}

module.exports = { analyzePackageJson, analyzeImports, generateRecommendations }
