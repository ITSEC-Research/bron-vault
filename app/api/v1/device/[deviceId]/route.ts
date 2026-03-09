/**
 * Device API v1 - Device Detail & Credentials Endpoint
 *
 * GET /api/v1/device/:deviceId
 * GET /api/v1/device/:deviceId?include=credentials&page=1&limit=100
 * GET /api/v1/device/:deviceId?include=credentials,software,files
 *
 * Returns device summary including:
 * - Device info (name, upload date, batch)
 * - System/host information (OS, IP, country, CPU, RAM, GPU, stealer, HWID, antivirus, etc)
 * - Statistics (credentials count, software count, files count)
 * - Top passwords, top domains, browser distribution, file statistics
 *
 * Optional includes via ?include= (comma-separated):
 * - credentials: All compromised credentials (paginated)
 * - software: All installed software list
 * - files: Full file tree
 *
 * Available for all API key roles (admin & analyst)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const startTime = Date.now()

  // Validate API key
  const auth = await withApiKeyAuth(request)
  if (auth.response) {
    return auth.response
  }

  const { payload } = auth
  const { deviceId } = await params

  if (!deviceId) {
    return NextResponse.json(
      { success: false, error: "Device ID is required" },
      { status: 400 }
    )
  }

  try {
    // Verify device exists
    const deviceCheck = (await executeClickHouseQuery(
      "SELECT device_id, device_name, upload_batch, upload_date, total_credentials, total_domains, total_urls, total_files FROM devices WHERE device_id = {deviceId:String}",
      { deviceId }
    )) as any[]

    if (deviceCheck.length === 0) {
      const duration = Date.now() - startTime
      logApiRequest({
        apiKeyId: payload.keyId,
        endpoint: `/api/v1/device/${deviceId}`,
        method: "GET",
        statusCode: 404,
        duration,
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      })
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      )
    }

    const device = deviceCheck[0]

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const includeParam = searchParams.get("include") || ""
    const includes = includeParam.split(",").map((s) => s.trim().toLowerCase())
    const includeCredentials = includes.includes("credentials")
    const includeSoftware = includes.includes("software")
    const includeFiles = includes.includes("files")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)))
    const offset = (page - 1) * limit

    // Run summary queries in parallel
    const summaryResults = await Promise.allSettled([
      // 1. System/host information (all fields)
      executeClickHouseQuery(
        `SELECT os, computer_name, ip_address, country, username, cpu, ram, gpu,
                stealer_type, log_date, hwid, file_path, antivirus, source_file, created_at
         FROM systeminformation
         WHERE device_id = {deviceId:String}
         LIMIT 1`,
        { deviceId }
      ),

      // 2. Credentials count
      executeClickHouseQuery(
        "SELECT count() as count FROM credentials WHERE device_id = {deviceId:String}",
        { deviceId }
      ),

      // 3. Software count
      executeClickHouseQuery(
        "SELECT count() as count FROM software WHERE device_id = {deviceId:String}",
        { deviceId }
      ),

      // 4. Files count
      executeClickHouseQuery(
        "SELECT count() as count FROM files WHERE device_id = {deviceId:String}",
        { deviceId }
      ),

      // 5. Top domains
      executeClickHouseQuery(
        `SELECT 
          trimBoth(
            coalesce(
              domain(url),
              replaceRegexpOne(
                replaceRegexpOne(
                  replaceRegexpOne(url, '^https?://', ''),
                  '/.*$', ''
                ),
                ':.*$', ''
              )
            )
          ) as extracted_host,
          count() as count
        FROM credentials 
        WHERE device_id = {deviceId:String} 
          AND url IS NOT NULL 
          AND url != ''
          AND url != 'null'
        GROUP BY extracted_host 
        HAVING extracted_host IS NOT NULL 
          AND extracted_host != ''
          AND extracted_host != 'null'
          AND length(extracted_host) >= 3
          AND extracted_host LIKE '%.%'
          AND extracted_host NOT LIKE '.%'
          AND extracted_host NOT LIKE '%.'
        ORDER BY count DESC 
        LIMIT 10`,
        { deviceId }
      ),

      // 6. Browser distribution
      executeClickHouseQuery(
        `SELECT 
          coalesce(browser, 'Unknown') as browser,
          count() as count
        FROM credentials 
        WHERE device_id = {deviceId:String}
        GROUP BY browser 
        ORDER BY count DESC`,
        { deviceId }
      ),

      // 7. Top passwords (top 10)
      executeClickHouseQuery(
        `SELECT 
          password,
          count() as count
        FROM credentials 
        WHERE device_id = {deviceId:String} 
          AND password IS NOT NULL 
          AND password != ''
        GROUP BY password 
        ORDER BY count DESC 
        LIMIT 10`,
        { deviceId }
      ),

      // 8. File size distribution
      executeClickHouseQuery(
        `SELECT 
          multiIf(
            file_size IS NULL OR file_size = 0, 'Unknown',
            file_size < 1024, '< 1 KB',
            file_size >= 1024 AND file_size < 10240, '1 KB - 10 KB',
            file_size >= 10240 AND file_size < 102400, '10 KB - 100 KB',
            file_size >= 102400 AND file_size < 1048576, '100 KB - 1 MB',
            file_size >= 1048576 AND file_size < 10485760, '1 MB - 10 MB',
            file_size >= 10485760, '> 10 MB',
            'Other'
          ) as size_category,
          count() as count
        FROM files 
        WHERE device_id = {deviceId:String}
          AND is_directory = 0
          AND file_size IS NOT NULL
          AND file_size > 0
        GROUP BY size_category 
        ORDER BY 
          multiIf(
            size_category = '< 1 KB', 0,
            size_category = '1 KB - 10 KB', 1,
            size_category = '10 KB - 100 KB', 2,
            size_category = '100 KB - 1 MB', 3,
            size_category = '1 MB - 10 MB', 4,
            size_category = '> 10 MB', 5,
            6
          )`,
        { deviceId }
      ),

      // 9. Directory count
      executeClickHouseQuery(
        `SELECT count() as count FROM files WHERE device_id = {deviceId:String} AND is_directory = 1`,
        { deviceId }
      ),

      // 10. Txt files count
      executeClickHouseQuery(
        `SELECT count() as count FROM files WHERE device_id = {deviceId:String} AND is_directory = 0 AND file_name ilike '%.txt'`,
        { deviceId }
      ),
    ])

    // Extract results with fallbacks
    const systemInfoResult =
      summaryResults[0].status === "fulfilled"
        ? (summaryResults[0].value as any[])
        : []
    const credCountResult =
      summaryResults[1].status === "fulfilled"
        ? (summaryResults[1].value as any[])
        : []
    const softCountResult =
      summaryResults[2].status === "fulfilled"
        ? (summaryResults[2].value as any[])
        : []
    const fileCountResult =
      summaryResults[3].status === "fulfilled"
        ? (summaryResults[3].value as any[])
        : []
    const topDomainsResult =
      summaryResults[4].status === "fulfilled"
        ? (summaryResults[4].value as any[])
        : []
    const browserResult =
      summaryResults[5].status === "fulfilled"
        ? (summaryResults[5].value as any[])
        : []
    const topPasswordsResult =
      summaryResults[6].status === "fulfilled"
        ? (summaryResults[6].value as any[])
        : []
    const fileSizeResult =
      summaryResults[7].status === "fulfilled"
        ? (summaryResults[7].value as any[])
        : []
    const dirCountResult =
      summaryResults[8].status === "fulfilled"
        ? (summaryResults[8].value as any[])
        : []
    const txtCountResult =
      summaryResults[9].status === "fulfilled"
        ? (summaryResults[9].value as any[])
        : []

    // Build device info
    const deviceInfo = {
      deviceId: device.device_id,
      deviceName: device.device_name,
      uploadBatch: device.upload_batch || null,
      uploadDate: device.upload_date || null,
    }

    // Build host info (all fields from systeminformation)
    const sysInfo = systemInfoResult.length > 0 ? systemInfoResult[0] : null
    const hostInfo = sysInfo
      ? {
          os: sysInfo.os || null,
          computerName: sysInfo.computer_name || null,
          ipAddress: sysInfo.ip_address || null,
          country: sysInfo.country || null,
          username: sysInfo.username || null,
          cpu: sysInfo.cpu || null,
          ram: sysInfo.ram || null,
          gpu: sysInfo.gpu || null,
          stealerType: sysInfo.stealer_type || null,
          logDate: sysInfo.log_date || null,
          hwid: sysInfo.hwid || null,
          filePath: sysInfo.file_path || null,
          antivirus: sysInfo.antivirus || null,
          sourceFile: sysInfo.source_file || null,
          createdAt: sysInfo.created_at || null,
        }
      : null

    // Build summary stats
    const totalCredentials =
      credCountResult.length > 0
        ? Number(credCountResult[0].count) || 0
        : 0
    const summary = {
      totalCredentials,
      totalSoftware:
        softCountResult.length > 0
          ? Number(softCountResult[0].count) || 0
          : 0,
      totalFiles:
        fileCountResult.length > 0
          ? Number(fileCountResult[0].count) || 0
          : 0,
      totalDomains: Number(device.total_domains) || 0,
      totalUrls: Number(device.total_urls) || 0,
    }

    // Build top domains
    const topDomains = topDomainsResult.map((item: any) => ({
      domain: item.extracted_host,
      count: Number(item.count) || 0,
    }))

    // Build browser distribution
    const browserDistribution = browserResult.map((item: any) => ({
      browser: item.browser,
      count: Number(item.count) || 0,
    }))

    // Build top passwords
    const topPasswords = topPasswordsResult.map((item: any) => ({
      password: item.password,
      count: Number(item.count) || 0,
    }))

    // Build file statistics
    const totalFilesCount = summary.totalFiles
    const totalDirectories =
      dirCountResult.length > 0 ? Number(dirCountResult[0].count) || 0 : 0
    const totalTxtFiles =
      txtCountResult.length > 0 ? Number(txtCountResult[0].count) || 0 : 0
    const totalOtherFiles = Math.max(
      0,
      totalFilesCount - totalDirectories - totalTxtFiles
    )

    const fileStatistics = {
      totalFiles: totalFilesCount,
      totalDirectories,
      totalTxtFiles,
      totalOtherFiles,
      bySize: fileSizeResult.map((item: any) => ({
        category: item.size_category,
        count: Number(item.count) || 0,
      })),
    }

    // Build result
    const result: any = {
      success: true,
      device: deviceInfo,
      hostInfo,
      summary,
      topPasswords,
      topDomains,
      browserDistribution,
      fileStatistics,
    }

    // Optionally include credentials
    if (includeCredentials) {
      const credentials = (await executeClickHouseQuery(
        `SELECT 
          coalesce(browser, 'Unknown') as browser,
          coalesce(url, '') as url,
          coalesce(domain, '') as domain,
          coalesce(username, '') as username,
          coalesce(password, '') as password,
          file_path
        FROM credentials 
        WHERE device_id = {deviceId:String}
        ORDER BY url, username
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
        { deviceId, limit, offset }
      )) as any[]

      result.credentials = {
        data: credentials.map((cred: any) => ({
          browser: cred.browser === "Unknown" ? null : cred.browser,
          url: cred.url || "",
          domain: cred.domain || "",
          username: cred.username || "",
          password: cred.password || "",
          filePath: cred.file_path || "",
        })),
        pagination: {
          page,
          limit,
          total: totalCredentials,
          totalPages: Math.ceil(totalCredentials / limit),
          hasMore: offset + limit < totalCredentials,
        },
      }
    }

    // Optionally include software list
    if (includeSoftware) {
      const software = (await executeClickHouseQuery(
        `SELECT 
          coalesce(software_name, 'Unknown') as software_name,
          coalesce(version, '') as version,
          coalesce(source_file, '') as source_file
        FROM software 
        WHERE device_id = {deviceId:String} 
        ORDER BY software_name, version`,
        { deviceId }
      )) as any[]

      result.software = software.map((sw: any) => ({
        name: sw.software_name || "Unknown",
        version: sw.version || "",
        sourceFile: sw.source_file || "",
      }))
    }

    // Optionally include files list
    if (includeFiles) {
      const files = (await executeClickHouseQuery(
        `SELECT 
          file_path,
          file_name,
          coalesce(parent_path, '') as parent_path,
          is_directory,
          coalesce(file_size, 0) as file_size,
          if(local_file_path IS NOT NULL, 1, 0) as has_content
        FROM files 
        WHERE device_id = {deviceId:String} 
        ORDER BY file_path`,
        { deviceId }
      )) as any[]

      result.files = files.map((file: any) => ({
        filePath: file.file_path || "",
        fileName: file.file_name || "",
        parentPath: file.parent_path || "",
        isDirectory: file.is_directory || false,
        fileSize: Number(file.file_size) || 0,
        hasContent: Boolean(file.has_content && file.has_content !== 0),
      }))
    }

    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/device/${deviceId}`,
      method: "GET",
      statusCode: 200,
      duration,
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    const response = NextResponse.json(result)
    addRateLimitHeaders(response, payload)
    return response
  } catch (error) {
    console.error("Device API error:", error)

    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/device/${deviceId}`,
      method: "GET",
      statusCode: 500,
      duration,
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load device data",
        details:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
