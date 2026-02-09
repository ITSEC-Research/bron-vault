/**
 * Domain Monitoring Library
 * 
 * Handles CRUD operations for domain monitors and webhooks,
 * credential matching logic, and webhook delivery for alerts.
 */

import { pool } from "@/lib/mysql"
import crypto from "crypto"

/**
 * Helper: run a query using pool.query() (not prepared statements)
 * to avoid mysql2 "Incorrect arguments to mysqld_stmt_execute" errors
 * with dynamic SQL and LIMIT/OFFSET parameters.
 */
async function query(sql: string, params: any[] = []): Promise<any[]> {
  const [results] = await pool.query(sql, params)
  return results as any[]
}

/**
 * Helper: run a mutation query (INSERT/UPDATE/DELETE) using pool.query()
 */
async function mutate(sql: string, params: any[] = []): Promise<any> {
  const [results] = await pool.query(sql, params)
  return results
}

// ===========================================
// TYPES
// ===========================================

export interface DomainMonitor {
  id: number
  name: string
  domains: string[]     // Parsed from JSON
  match_mode: 'credential' | 'url' | 'both'
  is_active: boolean
  created_by: number | null
  last_triggered_at: string | null
  total_alerts: number
  created_at: string
  updated_at: string
  // Joined fields
  webhook_count?: number
  webhooks?: MonitorWebhook[]
}

export interface MonitorWebhook {
  id: number
  name: string
  url: string
  secret: string | null
  headers: Record<string, string> | null  // Parsed from JSON
  is_active: boolean
  created_by: number | null
  last_triggered_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  monitor_count?: number
}

export interface MonitorAlert {
  id: number
  monitor_id: number
  webhook_id: number
  device_id: string | null
  upload_batch: string | null
  matched_domain: string
  match_type: 'credential_email' | 'url' | 'both'
  credential_match_count: number
  url_match_count: number
  payload_sent: string | null
  status: 'success' | 'failed' | 'retrying'
  http_status: number | null
  error_message: string | null
  retry_count: number
  created_at: string
  // Joined fields
  monitor_name?: string
  webhook_name?: string
  webhook_url?: string
}

export interface CredentialMatch {
  found_at: string
  url: string
  login: string
  password: string
  browser: string
}

export interface WebhookPayload {
  monitor_name: string
  matched_domain: string
  device: {
    target_machine_name: string
    target_ip: string
    username: string
    hwid: string
    country: string
    os: string
    log_date: string
  }
  credential_matches: CredentialMatch[]
  url_matches: CredentialMatch[]
  summary: {
    total_credential_matches: number
    total_url_matches: number
    upload_batch: string
  }
}

// ===========================================
// MONITOR CRUD
// ===========================================

export async function createMonitor(data: {
  name: string
  domains: string[]
  match_mode: 'credential' | 'url' | 'both'
  webhook_ids: number[]
  created_by?: number
}): Promise<number> {
  const result = await mutate(
    `INSERT INTO domain_monitors (name, domains, match_mode, created_by)
     VALUES (?, ?, ?, ?)`,
    [data.name, JSON.stringify(data.domains), data.match_mode, data.created_by || null]
  ) as any

  const monitorId = result.insertId

  // Link webhooks
  if (data.webhook_ids.length > 0) {
    const placeholders = data.webhook_ids.map(() => '(?, ?)').join(', ')
    const params: any[] = []
    for (const wid of data.webhook_ids) {
      params.push(monitorId, wid)
    }
    await query(
      `INSERT INTO monitor_webhook_map (monitor_id, webhook_id) VALUES ${placeholders}`,
      params
    )
  }

  return monitorId
}

export async function updateMonitor(id: number, data: {
  name?: string
  domains?: string[]
  match_mode?: 'credential' | 'url' | 'both'
  is_active?: boolean
  webhook_ids?: number[]
}): Promise<void> {
  const updates: string[] = []
  const params: any[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    params.push(data.name)
  }
  if (data.domains !== undefined) {
    updates.push('domains = ?')
    params.push(JSON.stringify(data.domains))
  }
  if (data.match_mode !== undefined) {
    updates.push('match_mode = ?')
    params.push(data.match_mode)
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?')
    params.push(data.is_active ? 1 : 0)
  }

  if (updates.length > 0) {
    params.push(id)
    await query(
      `UPDATE domain_monitors SET ${updates.join(', ')} WHERE id = ?`,
      params
    )
  }

  // Update webhook links if provided
  if (data.webhook_ids !== undefined) {
    await query('DELETE FROM monitor_webhook_map WHERE monitor_id = ?', [id])
    if (data.webhook_ids.length > 0) {
      const placeholders = data.webhook_ids.map(() => '(?, ?)').join(', ')
      const linkParams: any[] = []
      for (const wid of data.webhook_ids) {
        linkParams.push(id, wid)
      }
      await query(
        `INSERT INTO monitor_webhook_map (monitor_id, webhook_id) VALUES ${placeholders}`,
        linkParams
      )
    }
  }
}

export async function deleteMonitor(id: number): Promise<void> {
  await query('DELETE FROM domain_monitors WHERE id = ?', [id])
}

export async function getMonitor(id: number): Promise<DomainMonitor | null> {
  const rows = await query(
    `SELECT dm.*, 
            (SELECT COUNT(*) FROM monitor_webhook_map mwm WHERE mwm.monitor_id = dm.id) as webhook_count
     FROM domain_monitors dm WHERE dm.id = ?`,
    [id]
  ) as any[]

  if (rows.length === 0) return null

  const row = rows[0]
  const monitor = parseMonitorRow(row)

  // Get linked webhooks
  const webhooks = await query(
    `SELECT mw.* FROM monitor_webhooks mw
     INNER JOIN monitor_webhook_map mwm ON mwm.webhook_id = mw.id
     WHERE mwm.monitor_id = ?`,
    [id]
  ) as any[]

  monitor.webhooks = webhooks.map(parseWebhookRow)
  return monitor
}

export async function listMonitors(options?: {
  activeOnly?: boolean
  limit?: number
  offset?: number
}): Promise<{ monitors: DomainMonitor[], total: number }> {
  const conditions: string[] = []
  const params: any[] = []

  if (options?.activeOnly) {
    conditions.push('dm.is_active = 1')
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await query(
    `SELECT COUNT(*) as total FROM domain_monitors dm ${where}`,
    [...params]
  ) as any[]
  const total = countResult[0].total

  const limit = options?.limit || 50
  const offset = options?.offset || 0

  const rows = await query(
    `SELECT dm.*, 
            (SELECT COUNT(*) FROM monitor_webhook_map mwm WHERE mwm.monitor_id = dm.id) as webhook_count
     FROM domain_monitors dm ${where}
     ORDER BY dm.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]

  return {
    monitors: rows.map(parseMonitorRow),
    total
  }
}

export async function getActiveMonitors(): Promise<DomainMonitor[]> {
  const rows = await query(
    `SELECT dm.* FROM domain_monitors dm WHERE dm.is_active = 1`,
    []
  ) as any[]

  return rows.map(parseMonitorRow)
}

// ===========================================
// WEBHOOK CRUD
// ===========================================

export async function createWebhook(data: {
  name: string
  url: string
  secret?: string
  headers?: Record<string, string>
  created_by?: number
}): Promise<number> {
  const result = await mutate(
    `INSERT INTO monitor_webhooks (name, url, secret, headers, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.name,
      data.url,
      data.secret || null,
      data.headers ? JSON.stringify(data.headers) : null,
      data.created_by || null
    ]
  ) as any

  return result.insertId
}

export async function updateWebhook(id: number, data: {
  name?: string
  url?: string
  secret?: string | null
  headers?: Record<string, string> | null
  is_active?: boolean
}): Promise<void> {
  const updates: string[] = []
  const params: any[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    params.push(data.name)
  }
  if (data.url !== undefined) {
    updates.push('url = ?')
    params.push(data.url)
  }
  if (data.secret !== undefined) {
    updates.push('secret = ?')
    params.push(data.secret)
  }
  if (data.headers !== undefined) {
    updates.push('headers = ?')
    params.push(data.headers ? JSON.stringify(data.headers) : null)
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?')
    params.push(data.is_active ? 1 : 0)
  }

  if (updates.length > 0) {
    params.push(id)
    await query(
      `UPDATE monitor_webhooks SET ${updates.join(', ')} WHERE id = ?`,
      params
    )
  }
}

export async function deleteWebhook(id: number): Promise<void> {
  await query('DELETE FROM monitor_webhooks WHERE id = ?', [id])
}

export async function getWebhook(id: number): Promise<MonitorWebhook | null> {
  const rows = await query(
    `SELECT mw.*,
            (SELECT COUNT(*) FROM monitor_webhook_map mwm WHERE mwm.webhook_id = mw.id) as monitor_count
     FROM monitor_webhooks mw WHERE mw.id = ?`,
    [id]
  ) as any[]

  if (rows.length === 0) return null
  return parseWebhookRow(rows[0])
}

export async function listWebhooks(options?: {
  activeOnly?: boolean
  limit?: number
  offset?: number
}): Promise<{ webhooks: MonitorWebhook[], total: number }> {
  const conditions: string[] = []
  const params: any[] = []

  if (options?.activeOnly) {
    conditions.push('mw.is_active = 1')
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await query(
    `SELECT COUNT(*) as total FROM monitor_webhooks mw ${where}`,
    [...params]
  ) as any[]
  const total = countResult[0].total

  const limit = options?.limit || 50
  const offset = options?.offset || 0

  const rows = await query(
    `SELECT mw.*,
            (SELECT COUNT(*) FROM monitor_webhook_map mwm WHERE mwm.webhook_id = mw.id) as monitor_count
     FROM monitor_webhooks mw ${where}
     ORDER BY mw.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]

  return {
    webhooks: rows.map(parseWebhookRow),
    total
  }
}

// ===========================================
// ALERT LOG
// ===========================================

export async function listAlerts(options?: {
  monitorId?: number
  webhookId?: number
  status?: 'success' | 'failed' | 'retrying'
  limit?: number
  offset?: number
}): Promise<{ alerts: MonitorAlert[], total: number }> {
  const conditions: string[] = []
  const params: any[] = []

  if (options?.monitorId) {
    conditions.push('ma.monitor_id = ?')
    params.push(options.monitorId)
  }
  if (options?.webhookId) {
    conditions.push('ma.webhook_id = ?')
    params.push(options.webhookId)
  }
  if (options?.status) {
    conditions.push('ma.status = ?')
    params.push(options.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await query(
    `SELECT COUNT(*) as total FROM monitor_alerts ma ${where}`,
    [...params]
  ) as any[]
  const total = countResult[0].total

  const limit = options?.limit || 50
  const offset = options?.offset || 0

  const rows = await query(
    `SELECT ma.*, 
            dm.name as monitor_name,
            mw.name as webhook_name,
            mw.url as webhook_url
     FROM monitor_alerts ma
     LEFT JOIN domain_monitors dm ON dm.id = ma.monitor_id
     LEFT JOIN monitor_webhooks mw ON mw.id = ma.webhook_id
     ${where}
     ORDER BY ma.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  ) as any[]

  return {
    alerts: rows.map(parseAlertRow),
    total
  }
}

export async function getAlertStats(): Promise<{
  total: number
  today: number
  success: number
  failed: number
}> {
  const rows = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM monitor_alerts
  `, []) as any[]

  return {
    total: rows[0].total || 0,
    today: rows[0].today || 0,
    success: rows[0].success || 0,
    failed: rows[0].failed || 0,
  }
}

// ===========================================
// DOMAIN MATCHING LOGIC
// ===========================================

/**
 * Check newly inserted credentials against all active monitors.
 * Called after credentials are bulk-inserted for a device.
 * 
 * @param deviceId - The device that was just processed
 * @param uploadBatch - The upload batch identifier
 */
export async function checkMonitorsForDevice(
  deviceId: string,
  uploadBatch: string,
  logFn?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
): Promise<void> {
  const log = logFn || (() => {})

  try {
    // Get all active monitors
    const monitors = await getActiveMonitors()
    if (monitors.length === 0) {
      return
    }

    log(`🔔 Checking ${monitors.length} active domain monitors for device ${deviceId}`, 'info')

    // Collect all unique domains across all monitors
    const allDomains = new Set<string>()
    const needsCredentialMatch = new Set<string>()
    const needsUrlMatch = new Set<string>()
    
    for (const monitor of monitors) {
      for (const domain of monitor.domains) {
        const d = domain.toLowerCase()
        allDomains.add(d)
        if (monitor.match_mode === 'credential' || monitor.match_mode === 'both') {
          needsCredentialMatch.add(d)
        }
        if (monitor.match_mode === 'url' || monitor.match_mode === 'both') {
          needsUrlMatch.add(d)
        }
      }
    }

    // Run at most 2 queries total (credential match + URL match) instead of per-domain
    const credentialMatchesByDomain = new Map<string, CredentialMatch[]>()
    const urlMatchesByDomain = new Map<string, CredentialMatch[]>()

    // Get device info once
    const [sysInfoRows, deviceRows] = await Promise.all([
      query(`SELECT computer_name, ip_address, username, hwid, country, os, log_date FROM systeminformation WHERE device_id = ?`, [deviceId]),
      query(`SELECT device_name FROM devices WHERE device_id = ?`, [deviceId]),
    ])
    const deviceInfo = (sysInfoRows as any[]).length > 0 ? (sysInfoRows as any[])[0] : {}
    const deviceName = (deviceRows as any[]).length > 0 ? (deviceRows as any[])[0].device_name : deviceId

    // 1) Credential match: single query fetching all credentials with email-like usernames
    if (needsCredentialMatch.size > 0) {
      const credRows = await query(
        `SELECT url, username, password, browser, created_at FROM credentials WHERE device_id = ? AND username IS NOT NULL AND username != ''`,
        [deviceId]
      ) as any[]

      // Match in-memory against domains (much faster than N LIKE queries)
      for (const row of credRows) {
        const username = (row.username || '').toLowerCase()
        const atIdx = username.lastIndexOf('@')
        if (atIdx === -1) continue
        
        const emailDomain = username.substring(atIdx + 1)
        
        for (const domain of needsCredentialMatch) {
          if (emailDomain === domain || emailDomain.endsWith('.' + domain)) {
            if (!credentialMatchesByDomain.has(domain)) {
              credentialMatchesByDomain.set(domain, [])
            }
            credentialMatchesByDomain.get(domain)!.push({
              found_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              url: row.url || '',
              login: row.username || '',
              password: row.password || '',
              browser: row.browser || '',
            })
          }
        }
      }
    }

    // 2) URL match: single query fetching all credentials with domain info
    if (needsUrlMatch.size > 0) {
      const urlRows = await query(
        `SELECT url, username, password, browser, domain, created_at FROM credentials WHERE device_id = ? AND domain IS NOT NULL AND domain != ''`,
        [deviceId]
      ) as any[]

      for (const row of urlRows) {
        const credDomain = (row.domain || '').toLowerCase()
        
        for (const domain of needsUrlMatch) {
          if (credDomain === domain || credDomain.endsWith('.' + domain)) {
            // Deduplicate against credential matches
            const existingCreds = credentialMatchesByDomain.get(domain) || []
            const isDuplicate = existingCreds.some(
              cm => cm.url === (row.url || '') && cm.login === (row.username || '')
            )
            if (!isDuplicate) {
              if (!urlMatchesByDomain.has(domain)) {
                urlMatchesByDomain.set(domain, [])
              }
              urlMatchesByDomain.get(domain)!.push({
                found_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
                url: row.url || '',
                login: row.username || '',
                password: row.password || '',
                browser: row.browser || '',
              })
            }
          }
        }
      }
    }

    // 3) Process each monitor using in-memory results
    for (const monitor of monitors) {
      try {
        const monitorCredentials: CredentialMatch[] = []
        const monitorUrls: CredentialMatch[] = []
        const matchedDomains: string[] = []

        for (const domain of monitor.domains) {
          const d = domain.toLowerCase()
          const creds = credentialMatchesByDomain.get(d) || []
          const urls = urlMatchesByDomain.get(d) || []
          
          if (creds.length > 0 || urls.length > 0) {
            matchedDomains.push(d)
          }
          if (monitor.match_mode === 'credential' || monitor.match_mode === 'both') {
            monitorCredentials.push(...creds)
          }
          if (monitor.match_mode === 'url' || monitor.match_mode === 'both') {
            monitorUrls.push(...urls)
          }
        }

        if (monitorCredentials.length === 0 && monitorUrls.length === 0) continue

        const totalMatches = monitorCredentials.length + monitorUrls.length
        log(`🔔 Monitor "${monitor.name}" matched ${totalMatches} credentials for device ${deviceId}`, 'success')

        // Build payload
        const payload: WebhookPayload = {
          monitor_name: monitor.name,
          matched_domain: matchedDomains.join(', '),
          device: {
            target_machine_name: deviceInfo.computer_name || deviceName,
            target_ip: deviceInfo.ip_address || '',
            username: deviceInfo.username || '',
            hwid: deviceInfo.hwid || '',
            country: deviceInfo.country || '',
            os: deviceInfo.os || '',
            log_date: deviceInfo.log_date || '',
          },
          credential_matches: monitorCredentials,
          url_matches: monitorUrls,
          summary: {
            total_credential_matches: monitorCredentials.length,
            total_url_matches: monitorUrls.length,
            upload_batch: uploadBatch,
          }
        }

        // Get webhooks for this monitor
        const webhookRows = await query(
          `SELECT mw.* FROM monitor_webhooks mw
           INNER JOIN monitor_webhook_map mwm ON mwm.webhook_id = mw.id
           WHERE mwm.monitor_id = ? AND mw.is_active = 1`,
          [monitor.id]
        ) as any[]

        if (webhookRows.length === 0) {
          log(`⚠️ Monitor "${monitor.name}" has no active webhooks configured`, 'warning')
          continue
        }

        // Determine match type
        let matchType: 'credential_email' | 'url' | 'both' = 'both'
        if (monitorCredentials.length > 0 && monitorUrls.length === 0) {
          matchType = 'credential_email'
        } else if (monitorCredentials.length === 0 && monitorUrls.length > 0) {
          matchType = 'url'
        }

        // Fire webhooks (non-blocking)
        for (const webhookRow of webhookRows) {
          const webhook = parseWebhookRow(webhookRow)
          deliverWebhook(webhook, payload, monitor.id, deviceId, uploadBatch, matchedDomains.join(', '), matchType, monitorCredentials.length, monitorUrls.length, log)
            .catch(err => log(`❌ Webhook delivery error for "${webhook.name}": ${err}`, 'error'))
        }

        // Update monitor stats
        await mutate(
          `UPDATE domain_monitors SET last_triggered_at = NOW(), total_alerts = total_alerts + ? WHERE id = ?`,
          [webhookRows.length, monitor.id]
        )
      } catch (monitorError) {
        log(`❌ Error processing monitor "${monitor.name}": ${monitorError}`, 'error')
      }
    }
  } catch (error) {
    log(`❌ Error checking domain monitors: ${error}`, 'error')
  }
}

// ===========================================
// WEBHOOK DELIVERY
// ===========================================

async function deliverWebhook(
  webhook: MonitorWebhook,
  payload: WebhookPayload,
  monitorId: number,
  deviceId: string,
  uploadBatch: string,
  matchedDomain: string,
  matchType: 'credential_email' | 'url' | 'both',
  credentialMatchCount: number,
  urlMatchCount: number,
  log: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void,
  retryCount: number = 0
): Promise<void> {
  const MAX_RETRIES = 3
  const payloadJson = JSON.stringify(payload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'BronVault-DomainMonitor/1.0',
  }

  // Add custom headers if configured
  if (webhook.headers) {
    Object.assign(headers, webhook.headers)
  }

  // Add HMAC signature if secret is configured
  if (webhook.secret) {
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadJson)
      .digest('hex')
    headers['X-Webhook-Signature'] = `sha256=${signature}`
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    // Log alert
    await query(
      `INSERT INTO monitor_alerts 
       (monitor_id, webhook_id, device_id, upload_batch, matched_domain, match_type, 
        credential_match_count, url_match_count, payload_sent, status, http_status, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        monitorId,
        webhook.id,
        deviceId,
        uploadBatch,
        matchedDomain,
        matchType,
        credentialMatchCount,
        urlMatchCount,
        payloadJson,
        response.ok ? 'success' : 'failed',
        response.status,
        retryCount,
      ]
    )

    // Update webhook last triggered
    await query(
      `UPDATE monitor_webhooks SET last_triggered_at = NOW() WHERE id = ?`,
      [webhook.id]
    )

    if (response.ok) {
      log(`✅ Webhook "${webhook.name}" delivered successfully (HTTP ${response.status})`, 'success')
    } else {
      const errorBody = await response.text().catch(() => 'Unknown error')
      log(`❌ Webhook "${webhook.name}" failed (HTTP ${response.status}): ${errorBody.substring(0, 200)}`, 'error')

      // Retry on 5xx errors
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000
        log(`🔄 Retrying webhook "${webhook.name}" in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`, 'warning')
        await new Promise(resolve => setTimeout(resolve, delay))
        return deliverWebhook(webhook, payload, monitorId, deviceId, uploadBatch, matchedDomain, matchType, credentialMatchCount, urlMatchCount, log, retryCount + 1)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log(`❌ Webhook "${webhook.name}" delivery error: ${errorMessage}`, 'error')

    // Log failed alert
    await query(
      `INSERT INTO monitor_alerts 
       (monitor_id, webhook_id, device_id, upload_batch, matched_domain, match_type,
        credential_match_count, url_match_count, payload_sent, status, error_message, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
      [
        monitorId,
        webhook.id,
        deviceId,
        uploadBatch,
        matchedDomain,
        matchType,
        credentialMatchCount,
        urlMatchCount,
        payloadJson,
        errorMessage,
        retryCount,
      ]
    )

    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000
      log(`🔄 Retrying webhook "${webhook.name}" in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`, 'warning')
      await new Promise(resolve => setTimeout(resolve, delay))
      return deliverWebhook(webhook, payload, monitorId, deviceId, uploadBatch, matchedDomain, matchType, credentialMatchCount, urlMatchCount, log, retryCount + 1)
    }
  }
}

/**
 * Test a webhook by sending a sample payload
 */
export async function testWebhook(webhookId: number): Promise<{
  success: boolean
  statusCode?: number
  error?: string
}> {
  const webhook = await getWebhook(webhookId)
  if (!webhook) {
    return { success: false, error: 'Webhook not found' }
  }

  const testPayload: WebhookPayload = {
    monitor_name: '[TEST] Sample Monitor',
    matched_domain: 'example.com',
    device: {
      target_machine_name: 'TEST-MACHINE',
      target_ip: '192.168.1.1',
      username: 'testuser',
      hwid: 'HWID-TEST-1234567890',
      country: 'US',
      os: 'Windows 10 Pro',
      log_date: new Date().toISOString().split('T')[0],
    },
    credential_matches: [
      {
        found_at: new Date().toISOString(),
        url: 'https://login.example.com/auth',
        login: 'user@example.com',
        password: 'test_password_123',
        browser: 'Chrome',
      }
    ],
    url_matches: [
      {
        found_at: new Date().toISOString(),
        url: 'https://api.example.com/v1/auth',
        login: 'admin@gmail.com',
        password: 'another_password',
        browser: 'Firefox',
      }
    ],
    summary: {
      total_credential_matches: 1,
      total_url_matches: 1,
      upload_batch: 'TEST_BATCH_' + Date.now(),
    }
  }

  const payloadJson = JSON.stringify(testPayload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'BronVault-DomainMonitor/1.0',
    'X-Webhook-Test': 'true',
  }

  if (webhook.headers) {
    Object.assign(headers, webhook.headers)
  }

  if (webhook.secret) {
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadJson)
      .digest('hex')
    headers['X-Webhook-Signature'] = `sha256=${signature}`
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      success: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}: ${await response.text().catch(() => 'Unknown')}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ===========================================
// HELPERS
// ===========================================

function parseMonitorRow(row: any): DomainMonitor {
  let domains: string[] = []
  try {
    domains = typeof row.domains === 'string' ? JSON.parse(row.domains) : row.domains
  } catch {
    domains = []
  }

  return {
    id: row.id,
    name: row.name,
    domains,
    match_mode: row.match_mode,
    is_active: Boolean(row.is_active),
    created_by: row.created_by,
    last_triggered_at: row.last_triggered_at,
    total_alerts: row.total_alerts || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    webhook_count: row.webhook_count,
  }
}

function parseWebhookRow(row: any): MonitorWebhook {
  let headers: Record<string, string> | null = null
  try {
    headers = row.headers ? (typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers) : null
  } catch {
    headers = null
  }

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    headers,
    is_active: Boolean(row.is_active),
    created_by: row.created_by,
    last_triggered_at: row.last_triggered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    monitor_count: row.monitor_count,
  }
}

function parseAlertRow(row: any): MonitorAlert {
  return {
    id: row.id,
    monitor_id: row.monitor_id,
    webhook_id: row.webhook_id,
    device_id: row.device_id,
    upload_batch: row.upload_batch,
    matched_domain: row.matched_domain,
    match_type: row.match_type,
    credential_match_count: row.credential_match_count || 0,
    url_match_count: row.url_match_count || 0,
    payload_sent: row.payload_sent,
    status: row.status,
    http_status: row.http_status,
    error_message: row.error_message,
    retry_count: row.retry_count || 0,
    created_at: row.created_at,
    monitor_name: row.monitor_name,
    webhook_name: row.webhook_name,
    webhook_url: row.webhook_url,
  }
}
