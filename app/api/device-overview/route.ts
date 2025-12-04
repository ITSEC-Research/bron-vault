import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    // Verify device exists (ClickHouse)
    const deviceCheck = (await executeClickHouseQuery(
      "SELECT device_id, device_name, upload_batch, upload_date FROM devices WHERE device_id = {deviceId:String}",
      { deviceId }
    )) as any[]

    if (deviceCheck.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const device = deviceCheck[0]

    // 1. Get summary statistics
    let credentialsCount = { count: 0 }
    let softwareCount = { count: 0 }
    let filesCount = { count: 0 }
    let topPasswords: any[] = []
    let browserDistribution: any[] = []
    let topDomains: any[] = []
    let fileStatistics: any = null
    let hostInfo: any = null

    try {
      const credentialsCountResult = (await executeClickHouseQuery(
        "SELECT count() as count FROM credentials WHERE device_id = {deviceId:String}",
        { deviceId }
      )) as any[]
      // PENTING: Cast count() ke Number (ClickHouse return String)
      const rawCount = credentialsCountResult && credentialsCountResult.length > 0 ? credentialsCountResult[0]?.count : 0
      credentialsCount = { count: Number(rawCount) || 0 }
    } catch (error) {
      console.error("Error getting credentials count:", error)
    }

    try {
      const softwareCountResult = (await executeClickHouseQuery(
        "SELECT count() as count FROM software WHERE device_id = {deviceId:String}",
        { deviceId }
      )) as any[]
      // PENTING: Cast count() ke Number (ClickHouse return String)
      const rawCount = softwareCountResult && softwareCountResult.length > 0 ? softwareCountResult[0]?.count : 0
      softwareCount = { count: Number(rawCount) || 0 }
    } catch (error) {
      console.error("Error getting software count:", error)
    }

    try {
      const filesCountResult = (await executeClickHouseQuery(
        "SELECT count() as count FROM files WHERE device_id = {deviceId:String}",
        { deviceId }
      )) as any[]
      // PENTING: Cast count() ke Number (ClickHouse return String)
      const rawCount = filesCountResult && filesCountResult.length > 0 ? filesCountResult[0]?.count : 0
      filesCount = { count: Number(rawCount) || 0 }
    } catch (error) {
      console.error("Error getting files count:", error)
    }

    // 2. Get top passwords (most frequently used) - ClickHouse
    try {
      const topPasswordsRaw = (await executeClickHouseQuery(
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
      )) as any[]
      // PENTING: Cast count() ke Number (ClickHouse return String)
      topPasswords = topPasswordsRaw.map((item: any) => ({
        password: item.password,
        count: Number(item.count) || 0,
      }))
    } catch (error) {
      console.error("Error getting top passwords:", error)
      topPasswords = []
    }

    // 3. Get browser distribution - ClickHouse
    try {
      const browserDistributionRaw = (await executeClickHouseQuery(
        `SELECT 
          coalesce(browser, 'Unknown') as browser,
          count() as count
        FROM credentials 
        WHERE device_id = {deviceId:String}
        GROUP BY browser 
        ORDER BY count DESC`,
        { deviceId }
      )) as any[]
      // PENTING: Cast count() ke Number (ClickHouse return String)
      browserDistribution = browserDistributionRaw.map((item: any) => ({
        browser: item.browser,
        count: Number(item.count) || 0,
      }))
    } catch (error) {
      console.error("Error getting browser distribution:", error)
      browserDistribution = []
    }

    // 4. Get top domains - extract from url column with proper domain validation
    try {
      // Extract domain from URL - menggunakan domain() native ClickHouse untuk performa optimal
      // ClickHouse: domain() function adalah native function yang lebih cepat dan elegan
      // Fallback: Jika domain() tidak bisa extract (misal format URL tidak standar), gunakan regex sederhana
      topDomains = (await executeClickHouseQuery(
        `SELECT 
          trimBoth(
            coalesce(
              domain(url),  -- Native ClickHouse function, lebih cepat dan elegan
              -- Fallback: regex sederhana jika domain() return null
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
          AND length(url) > 0
        GROUP BY extracted_host 
        HAVING extracted_host IS NOT NULL 
          AND extracted_host != ''
          AND extracted_host != 'null'
          AND length(extracted_host) > 0
          -- Filter out TLD-only results (ClickHouse: REGEXP -> match)
          AND NOT match(extracted_host, '^(com|co|net|org|edu|gov|ac|sch|mil|info|biz|name|pro|asia|tel|mobi|jobs|travel|xxx|aero|museum|coop|int|post|arpa|test|local|localhost)\\.[a-z]{2,3}$')
          -- Must have at least one dot
          AND extracted_host LIKE '%.%'
          -- Must not start with a dot
          AND extracted_host NOT LIKE '.%'
          -- Must not end with a dot
          AND extracted_host NOT LIKE '%.'
          -- Must have at least 3 characters
          AND length(extracted_host) >= 3
          -- Additional validation: must have at least 2 parts separated by dot
          AND (length(extracted_host) - length(replaceAll(extracted_host, '.', ''))) >= 1
        ORDER BY count DESC 
        LIMIT 7`,
        { deviceId }
      )) as any[]

      // Rename the column to 'domain' for consistency
      // PENTING: Cast count() ke Number (ClickHouse return String)
      topDomains = topDomains.map((item: any) => ({
        domain: item.extracted_host,
        count: Number(item.count) || 0,
      }))

      // If no results from URL extraction, try domain column but filter TLD-only (ClickHouse)
      if (topDomains.length === 0) {
        const domainsFromColumn = (await executeClickHouseQuery(
          `SELECT 
            domain,
            count() as count
          FROM credentials 
          WHERE device_id = {deviceId:String} 
            AND domain IS NOT NULL 
            AND domain != ''
            AND domain != 'null'
            -- Filter out TLD-only results (ClickHouse: REGEXP -> match)
            AND NOT match(domain, '^(com|co|net|org|edu|gov|ac|sch|mil|info|biz|name|pro|asia|tel|mobi|jobs|travel|xxx|aero|museum|coop|int|post|arpa|test|local|localhost)\\.[a-z]{2,3}$')
            AND domain LIKE '%.%'
            AND domain NOT LIKE '.%'
            AND domain NOT LIKE '%.'
            AND length(domain) >= 3
            -- Additional validation: must have at least 2 parts separated by dot
            AND (length(domain) - length(replaceAll(domain, '.', ''))) >= 1
          GROUP BY domain 
          ORDER BY count DESC 
          LIMIT 7`,
          { deviceId }
        )) as any[]
        // PENTING: Cast count() ke Number (ClickHouse return String)
        topDomains = domainsFromColumn.map((item: any) => ({
          domain: item.domain,
          count: Number(item.count) || 0,
        }))
        console.log(`📊 Found ${topDomains.length} top domains from domain column (filtered) for device ${deviceId}`)
      } else {
        console.log(`📊 Found ${topDomains.length} top domains extracted from url (filtered) for device ${deviceId}`)
      }

      if (topDomains.length > 0) {
        console.log(`📊 Sample domains:`, topDomains.slice(0, 3).map((d: any) => ({ domain: d.domain, count: d.count })))
      } else {
        // Debug: check if there are any URLs at all (ClickHouse)
        const urlCheck = (await executeClickHouseQuery(
          `SELECT count() as total, 
           countIf(url IS NOT NULL AND url != '' AND url != 'null') as with_url
          FROM credentials 
          WHERE device_id = {deviceId:String}`,
          { deviceId }
        )) as any[]
        // PENTING: Cast count() ke Number untuk logging
        if (urlCheck.length > 0) {
          console.log(`📊 URL check for device ${deviceId}:`, {
            total: Number(urlCheck[0].total) || 0,
            with_url: Number(urlCheck[0].with_url) || 0,
          })
        }
      }
    } catch (error) {
      console.error("❌ Error getting top domains:", error)
      console.error("❌ Error type:", typeof error)
      console.error("❌ Error message:", error instanceof Error ? error.message : String(error))
      console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace")
      topDomains = []
    }

    // 5. Get file size distribution (breakdown by file size categories)
    // Also get total directories and total .txt files for summary
    try {
      // ClickHouse: Convert CASE statements to multiIf
      const fileSizeStats = (await executeClickHouseQuery(
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
      )) as any[]
      
      // Get total directories (ClickHouse)
      const directoriesCount = (await executeClickHouseQuery(
        `SELECT count() as count
        FROM files 
        WHERE device_id = {deviceId:String} AND is_directory = 1`,
        { deviceId }
      )) as any[]
      
      // Get total .txt files (ClickHouse: Use ilike for case-insensitive)
      const txtFilesCount = (await executeClickHouseQuery(
        `SELECT count() as count
        FROM files 
        WHERE device_id = {deviceId:String} 
          AND is_directory = 0
          AND (file_name ilike '%.txt')`,
        { deviceId }
      )) as any[]
      
      // Get total "Other" files (all files minus directories minus .txt files)
      // This is simpler and more reliable than checking all extensions
      // PENTING: Cast count() ke Number (ClickHouse return String)
      const totalDirectories = directoriesCount.length > 0 ? Number(directoriesCount[0].count) || 0 : 0
      const totalTxtFiles = txtFilesCount.length > 0 ? Number(txtFilesCount[0].count) || 0 : 0
      const totalFiles = Number(filesCount?.count) || 0
      const totalOtherFiles = Math.max(0, totalFiles - totalDirectories - totalTxtFiles)
      
      fileStatistics = {
        totalFiles: totalFiles,
        bySize: fileSizeStats.map((item: any) => ({
          category: item.size_category,
          count: Number(item.count) || 0, // PENTING: Cast count() ke Number
        })),
        totalDirectories: totalDirectories,
        totalTxtFiles: totalTxtFiles,
        totalOtherFiles: totalOtherFiles,
      }
      console.log(`📊 File size distribution for device ${deviceId}:`, fileStatistics)
    } catch (error) {
      console.error("Error getting file size distribution:", error)
      fileStatistics = {
        totalFiles: filesCount?.count || 0,
        bySize: [],
        totalDirectories: 0,
        totalTxtFiles: 0,
        totalOtherFiles: 0,
      }
    }

    // 6. Get host information (summary) - ClickHouse
    try {
      const systemInfo = (await executeClickHouseQuery(
        `SELECT 
          os,
          computer_name,
          ip_address,
          country,
          username,
          cpu,
          ram,
          gpu
        FROM systeminformation
        WHERE device_id = {deviceId:String}
        LIMIT 1`,
        { deviceId }
      )) as any[]
      hostInfo = systemInfo.length > 0 ? systemInfo[0] : null
    } catch (error) {
      console.error("Error getting host info:", error)
      hostInfo = null
    }

    return NextResponse.json({
      summary: {
        totalCredentials: Number(credentialsCount?.count) || 0, // PENTING: Cast ke Number
        totalSoftware: Number(softwareCount?.count) || 0, // PENTING: Cast ke Number
        totalFiles: Number(filesCount?.count) || 0, // PENTING: Cast ke Number
        uploadDate: device.upload_date || null,
        uploadBatch: device.upload_batch || null,
      },
      topPasswords: topPasswords, // Already mapped with Number casting above
      browserDistribution: browserDistribution, // Already mapped with Number casting above
      topDomains: topDomains, // Already mapped with Number casting above
      fileStatistics: fileStatistics || {
        totalFiles: Number(filesCount?.count) || 0, // PENTING: Cast ke Number
        bySize: [],
        totalDirectories: 0,
        totalTxtFiles: 0,
        totalOtherFiles: 0,
      },
      hostInfo: hostInfo ? {
        os: hostInfo.os || null,
        computerName: hostInfo.computer_name || null,
        ipAddress: hostInfo.ip_address || null,
        country: hostInfo.country || null,
        username: hostInfo.username || null,
        cpu: hostInfo.cpu || null,
        ram: hostInfo.ram || null,
        gpu: hostInfo.gpu || null,
      } : null,
    })
  } catch (error) {
    console.error("Error loading device overview:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        error: "Failed to load device overview",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

