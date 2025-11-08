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

    // Get all system information from systeminformation table
    const systemInfo = (await executeQuery(
      `
      SELECT 
        device_id,
        stealer_type,
        os,
        ip_address,
        username,
        cpu,
        ram,
        computer_name,
        gpu,
        country,
        log_date,
        hwid,
        file_path,
        antivirus,
        source_file,
        created_at
      FROM systeminformation
      WHERE device_id = ?
      LIMIT 1
    `,
      [deviceId],
    )) as any[]

    if (systemInfo.length === 0) {
      return NextResponse.json({ error: "System information not found" }, { status: 404 })
    }

    const sysInfo = systemInfo[0]

    return NextResponse.json({
      deviceId: sysInfo.device_id,
      stealerType: sysInfo.stealer_type || null,
      os: sysInfo.os || null,
      ipAddress: sysInfo.ip_address || null,
      username: sysInfo.username || null,
      cpu: sysInfo.cpu || null,
      ram: sysInfo.ram || null,
      computerName: sysInfo.computer_name || null,
      gpu: sysInfo.gpu || null,
      country: sysInfo.country || null,
      logDate: sysInfo.log_date || null,
      hwid: sysInfo.hwid || null,
      filePath: sysInfo.file_path || null,
      antivirus: sysInfo.antivirus || null,
      sourceFile: sysInfo.source_file || null,
      createdAt: sysInfo.created_at || null,
    })
  } catch (error) {
    console.error("Error loading machine info:", error)
    return NextResponse.json(
      {
        error: "Failed to load machine info",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

