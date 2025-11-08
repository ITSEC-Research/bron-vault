import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
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

    // Verify device exists
    const deviceCheck = (await executeQuery("SELECT device_id, device_name, upload_batch, upload_date FROM devices WHERE device_id = ?", [
      deviceId,
    ])) as any[]

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
      const credentialsCountResult = (await executeQuery(
        "SELECT COUNT(*) as count FROM credentials WHERE device_id = ?",
        [deviceId]
      )) as any[]
      credentialsCount = credentialsCountResult && credentialsCountResult.length > 0 ? credentialsCountResult[0] : { count: 0 }
    } catch (error) {
      console.error("Error getting credentials count:", error)
    }

    try {
      const softwareCountResult = (await executeQuery(
        "SELECT COUNT(*) as count FROM software WHERE device_id = ?",
        [deviceId]
      )) as any[]
      softwareCount = softwareCountResult && softwareCountResult.length > 0 ? softwareCountResult[0] : { count: 0 }
    } catch (error) {
      console.error("Error getting software count:", error)
    }

    try {
      const filesCountResult = (await executeQuery(
        "SELECT COUNT(*) as count FROM files WHERE device_id = ?",
        [deviceId]
      )) as any[]
      filesCount = filesCountResult && filesCountResult.length > 0 ? filesCountResult[0] : { count: 0 }
    } catch (error) {
      console.error("Error getting files count:", error)
    }

    // 2. Get top passwords (most frequently used)
    try {
      topPasswords = (await executeQuery(
        `SELECT 
          password,
          COUNT(*) as count
        FROM credentials 
        WHERE device_id = ? 
          AND password IS NOT NULL 
          AND password != ''
        GROUP BY password 
        ORDER BY count DESC 
        LIMIT 10`,
        [deviceId]
      )) as any[]
    } catch (error) {
      console.error("Error getting top passwords:", error)
      topPasswords = []
    }

    // 3. Get browser distribution
    try {
      browserDistribution = (await executeQuery(
        `SELECT 
          COALESCE(browser, 'Unknown') as browser,
          COUNT(*) as count
        FROM credentials 
        WHERE device_id = ?
        GROUP BY browser 
        ORDER BY count DESC`,
        [deviceId]
      )) as any[]
    } catch (error) {
      console.error("Error getting browser distribution:", error)
      browserDistribution = []
    }

    // 4. Get top domains - extract from url column with proper domain validation
    try {
      // Extract domain from URL with better logic that filters out TLD-only results
      // We'll extract the full hostname and validate it's a proper domain (not just TLD)
      topDomains = (await executeQuery(
        `SELECT 
          CASE 
            WHEN url LIKE 'http://%' OR url LIKE 'https://%' THEN
              TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(url, 'http://', ''), 'https://', ''), '/', 1), ':', 1))
            WHEN url LIKE '%://%' THEN
              TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(url, '://', -1), '/', 1), ':', 1))
            ELSE
              TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(url, '/', 1), ':', 1))
          END as extracted_host,
          COUNT(*) as count
        FROM credentials 
        WHERE device_id = ? 
          AND url IS NOT NULL 
          AND url != ''
          AND url != 'null'
          AND LENGTH(url) > 0
        GROUP BY extracted_host 
        HAVING extracted_host IS NOT NULL 
          AND extracted_host != ''
          AND extracted_host != 'null'
          AND LENGTH(extracted_host) > 0
          -- Filter out TLD-only results (like "com.my", "co.id", etc.)
          -- A valid domain should have at least one dot AND not be just TLD
          -- Common TLD patterns to exclude: com.XX, co.XX, net.XX, org.XX, edu.XX, gov.XX, ac.XX, sch.XX, mil.XX
          -- This regex matches patterns like "com.my", "co.id" but NOT "example.com.my"
          AND extracted_host NOT REGEXP '^(com|co|net|org|edu|gov|ac|sch|mil|info|biz|name|pro|asia|tel|mobi|jobs|travel|xxx|aero|museum|coop|int|post|arpa|test|local|localhost)\\.[a-z]{2,3}$'
          -- Must have at least one dot (to be a domain, not just a word)
          AND extracted_host LIKE '%.%'
          -- Must not start with a dot
          AND extracted_host NOT LIKE '.%'
          -- Must not end with a dot
          AND extracted_host NOT LIKE '%.'
          -- Must have at least 3 characters (minimum for a valid domain)
          AND LENGTH(extracted_host) >= 3
          -- Additional validation: must have at least 2 parts separated by dot (e.g., "example.com" not just "com")
          AND (LENGTH(extracted_host) - LENGTH(REPLACE(extracted_host, '.', ''))) >= 1
        ORDER BY count DESC 
        LIMIT 8`,
        [deviceId]
      )) as any[]

      // Rename the column to 'domain' for consistency
      topDomains = topDomains.map((item: any) => ({
        domain: item.extracted_host,
        count: item.count,
      }))

      // If no results from URL extraction, try domain column but filter TLD-only
      if (topDomains.length === 0) {
        const domainsFromColumn = (await executeQuery(
          `SELECT 
            domain,
            COUNT(*) as count
          FROM credentials 
          WHERE device_id = ? 
            AND domain IS NOT NULL 
            AND domain != ''
            AND domain != 'null'
            -- Filter out TLD-only results (like "com.my", "co.id", etc.)
            AND domain NOT REGEXP '^(com|co|net|org|edu|gov|ac|sch|mil|info|biz|name|pro|asia|tel|mobi|jobs|travel|xxx|aero|museum|coop|int|post|arpa|test|local|localhost)\\.[a-z]{2,3}$'
            AND domain LIKE '%.%'
            AND domain NOT LIKE '.%'
            AND domain NOT LIKE '%.'
            AND LENGTH(domain) >= 3
            -- Additional validation: must have at least 2 parts separated by dot
            AND (LENGTH(domain) - LENGTH(REPLACE(domain, '.', ''))) >= 1
          GROUP BY domain 
          ORDER BY count DESC 
          LIMIT 8`,
          [deviceId]
        )) as any[]
        topDomains = domainsFromColumn
        console.log(`📊 Found ${topDomains.length} top domains from domain column (filtered) for device ${deviceId}`)
      } else {
        console.log(`📊 Found ${topDomains.length} top domains extracted from url (filtered) for device ${deviceId}`)
      }

      if (topDomains.length > 0) {
        console.log(`📊 Sample domains:`, topDomains.slice(0, 3).map((d: any) => ({ domain: d.domain, count: d.count })))
      } else {
        // Debug: check if there are any URLs at all
        const urlCheck = (await executeQuery(
          `SELECT COUNT(*) as total, 
           COUNT(CASE WHEN url IS NOT NULL AND url != '' AND url != 'null' THEN 1 END) as with_url
          FROM credentials 
          WHERE device_id = ?`,
          [deviceId]
        )) as any[]
        console.log(`📊 URL check for device ${deviceId}:`, urlCheck[0])
      }
    } catch (error) {
      console.error("Error getting top domains:", error)
      topDomains = []
    }

    // 5. Get file size distribution (breakdown by file size categories)
    // Also get total directories and total .txt files for summary
    try {
      const fileSizeStats = (await executeQuery(
        `SELECT 
          CASE 
            WHEN file_size IS NULL OR file_size = 0 THEN 'Unknown'
            WHEN file_size < 1024 THEN '< 1 KB'
            WHEN file_size >= 1024 AND file_size < 10240 THEN '1 KB - 10 KB'
            WHEN file_size >= 10240 AND file_size < 102400 THEN '10 KB - 100 KB'
            WHEN file_size >= 102400 AND file_size < 1048576 THEN '100 KB - 1 MB'
            WHEN file_size >= 1048576 AND file_size < 10485760 THEN '1 MB - 10 MB'
            WHEN file_size >= 10485760 THEN '> 10 MB'
            ELSE 'Other'
          END as size_category,
          COUNT(*) as count
        FROM files 
        WHERE device_id = ?
          AND is_directory = 0
          AND file_size IS NOT NULL
          AND file_size > 0
        GROUP BY size_category 
        ORDER BY 
          CASE size_category
            WHEN '< 1 KB' THEN 0
            WHEN '1 KB - 10 KB' THEN 1
            WHEN '10 KB - 100 KB' THEN 2
            WHEN '100 KB - 1 MB' THEN 3
            WHEN '1 MB - 10 MB' THEN 4
            WHEN '> 10 MB' THEN 5
            ELSE 6
          END`,
        [deviceId]
      )) as any[]
      
      // Get total directories
      const directoriesCount = (await executeQuery(
        `SELECT COUNT(*) as count
        FROM files 
        WHERE device_id = ? AND is_directory = 1`,
        [deviceId]
      )) as any[]
      
      // Get total .txt files
      const txtFilesCount = (await executeQuery(
        `SELECT COUNT(*) as count
        FROM files 
        WHERE device_id = ? 
          AND is_directory = 0
          AND (file_name LIKE '%.txt' OR file_name LIKE '%.TXT')`,
        [deviceId]
      )) as any[]
      
      // Get total "Other" files (all files minus directories minus .txt files)
      // This is simpler and more reliable than checking all extensions
      const totalDirectories = directoriesCount.length > 0 ? directoriesCount[0].count : 0
      const totalTxtFiles = txtFilesCount.length > 0 ? txtFilesCount[0].count : 0
      const totalFiles = filesCount?.count || 0
      const totalOtherFiles = Math.max(0, totalFiles - totalDirectories - totalTxtFiles)
      
      fileStatistics = {
        totalFiles: totalFiles,
        bySize: fileSizeStats.map((item: any) => ({
          category: item.size_category,
          count: item.count,
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

    // 6. Get host information (summary)
    try {
      const systemInfo = (await executeQuery(
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
        WHERE device_id = ?
        LIMIT 1`,
        [deviceId]
      )) as any[]
      hostInfo = systemInfo.length > 0 ? systemInfo[0] : null
    } catch (error) {
      console.error("Error getting host info:", error)
      hostInfo = null
    }

    return NextResponse.json({
      summary: {
        totalCredentials: credentialsCount?.count || 0,
        totalSoftware: softwareCount?.count || 0,
        totalFiles: filesCount?.count || 0,
        uploadDate: device.upload_date || null,
        uploadBatch: device.upload_batch || null,
      },
      topPasswords: topPasswords.map((item: any) => ({
        password: item.password,
        count: item.count,
      })),
      browserDistribution: browserDistribution.map((item: any) => ({
        browser: item.browser,
        count: item.count,
      })),
      topDomains: topDomains.map((item: any) => ({
        domain: item.domain,
        count: item.count,
      })),
      fileStatistics: fileStatistics || {
        totalFiles: filesCount?.count || 0,
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

