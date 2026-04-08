import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { generateReportHTML } from "@/lib/report-template"

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const { deviceId } = await request.json()

    if (!deviceId) {
      return new NextResponse("Device ID is required", { status: 400 })
    }

    // Run summary queries in parallel
    const [systemInfo, software, credentials, deviceInfo] = await Promise.all([
      executeClickHouseQuery(
        `SELECT os, computer_name, ip_address, country, username, cpu, ram, gpu,
                stealer_type, log_date, hwid, file_path, antivirus, source_file, created_at
         FROM systeminformation
         WHERE device_id = {deviceId:String}
         LIMIT 1`,
        { deviceId }
      ) as Promise<any[]>,
      executeClickHouseQuery(
        `SELECT software_name, version, source_file
         FROM software 
         WHERE device_id = {deviceId:String} 
         ORDER BY software_name`,
        { deviceId }
      ) as Promise<any[]>,
      executeClickHouseQuery(
        `SELECT 
          coalesce(url, '') as url,
          coalesce(password, '') as password
        FROM credentials 
        WHERE device_id = {deviceId:String}`,
        { deviceId }
      ) as Promise<any[]>,
      executeClickHouseQuery(
        `SELECT device_name FROM devices WHERE device_id = {deviceId:String} LIMIT 1`,
        { deviceId }
      ) as Promise<any[]>
    ]);

    const sysInfo = systemInfo.length > 0 ? systemInfo[0] : null;
    const deviceName = deviceInfo.length > 0 ? deviceInfo[0].device_name : deviceId;

    // Process domains, passwords, subdomains
    const domainCounts: Record<string, number> = {};
    const passwordCounts: Record<string, number> = {};
    const subdomainDomainCounts: Record<string, { subdomain: string, domain: string, count: number }> = {};

    for (const cred of credentials) {
      if (cred.password) {
        passwordCounts[cred.password] = (passwordCounts[cred.password] || 0) + 1;
      }
      if (cred.url) {
        let host = '';
        try {
          let urlStr = cred.url;
          if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
            urlStr = 'http://' + urlStr;
          }
          host = new URL(urlStr).hostname;
        } catch (_e) {
          host = cred.url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
        }
        host = host.trim();
        if (host && host.includes('.') && host.length >= 3) {
          const parts = host.split('.');
          const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : host;
          domainCounts[rootDomain] = (domainCounts[rootDomain] || 0) + 1;
          const key = host + '|' + rootDomain;
          if (!subdomainDomainCounts[key]) {
            subdomainDomainCounts[key] = { subdomain: host, domain: rootDomain, count: 0 };
          }
          subdomainDomainCounts[key].count++;
        }
      }
    }

    const sortedDomains = Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);

    const sortedPasswords = Object.entries(passwordCounts)
      .map(([password, count]) => ({ password, count }))
      .sort((a, b) => b.count - a.count);

    const sortedSubdomains = Object.values(subdomainDomainCounts)
      .sort((a, b) => b.count - a.count);

    // Deduplicate Software
    const softwareSet = new Map();
    for (const sw of software) {
      const name = sw.software_name || 'Unknown';
      const version = sw.version || '-';
      const key = `${name}||${version}`;
      if (!softwareSet.has(key)) {
        softwareSet.set(key, { name, version });
      }
    }
    const uniqueSoftware = Array.from(softwareSet.values());

    // Generate executive report HTML
    const html = generateReportHTML({
      deviceName,
      deviceId,
      sysInfo,
      sortedDomains,
      sortedPasswords,
      sortedSubdomains,
      uniqueSoftware,
      totalCredentials: credentials.length
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="Report_${deviceName || deviceId}.html"`
      }
    });

  } catch (error) {
    console.error("Error generating report:", error);
    return new NextResponse("Failed to generate report", { status: 500 });
  }
}
