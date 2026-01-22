import { formatDateRangeLabel } from "./date-range-utils"
import { DashboardExportData } from "./export-types"

/**
 * Convert ISO country code to flag emoji
 */
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍"
  
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0))
  
  return String.fromCodePoint(...codePoints)
}

/**
 * Generate HTML export - simple style matching dashboard
 */
export async function exportToHTML(data: DashboardExportData): Promise<string> {
  const exportDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const dateRangeLabel = formatDateRangeLabel(data.dateRange)

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stealer Log Intelligence Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0a0a0c;
            --card-bg: #151518;
            --primary-red: #ff3131;
            --secondary-red: #8b0000;
            --text-main: #ffffff;
            --text-muted: #a1a1aa;
            --border-color: #27272a;
            --accent-glow: rgba(255, 49, 49, 0.15);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            padding: 2rem 1rem;
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
        }

        /* HEADER */
        header {
            border-left: 4px solid var(--primary-red);
            padding-left: 1.5rem;
            margin-bottom: 3rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            flex-wrap: wrap;
            gap: 1rem;
        }

        header h1 {
            font-size: 2.2rem;
            font-weight: 700;
            letter-spacing: -1px;
            text-transform: uppercase;
            background: linear-gradient(to right, #fff, #ff3131);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .meta {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: var(--text-muted);
            text-align: right;
        }

        .meta span {
            color: var(--primary-red);
        }

        /* STATS GRID */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .stat-card {
            background: var(--card-bg);
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .stat-card:hover {
            border-color: var(--primary-red);
            box-shadow: 0 0 20px var(--accent-glow);
            transform: translateY(-5px);
        }

        .stat-card::after {
            content: "";
            position: absolute;
            top: 0; right: 0;
            width: 40px; height: 40px;
            background: linear-gradient(135deg, transparent 50%, rgba(255, 49, 49, 0.1) 50%);
        }

        .stat-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--primary-red);
            margin-bottom: 0.25rem;
            font-family: 'JetBrains Mono', monospace;
        }

        .stat-label {
            font-size: 0.85rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* SECTIONS */
        .section {
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--border-color);
            padding: 2rem;
            margin-bottom: 2rem;
        }

        .section-title {
            font-size: 1.25rem;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-weight: 600;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1rem;
        }

        .section-title::before {
            content: "";
            width: 8px;
            height: 8px;
            background: var(--primary-red);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--primary-red);
        }

        /* PASSWORD GRID */
        .password-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 1rem;
        }

        .password-item {
            background: #1e1e22;
            padding: 1rem;
            border-radius: 8px;
            border: 1px dashed #3f3f46;
        }

        .password-text {
            font-family: 'JetBrains Mono', monospace;
            color: #fff;
            font-weight: bold;
            display: block;
            margin-bottom: 0.4rem;
            font-size: 1.1rem;
        }

        .password-count {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        /* TABLES */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        thead th {
            text-align: left;
            padding: 1rem;
            color: var(--text-muted);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 1px;
            border-bottom: 2px solid var(--border-color);
        }

        tbody td {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
        }

        tbody tr:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        tr td:first-child {
            color: var(--primary-red);
            font-weight: bold;
            font-family: 'JetBrains Mono', monospace;
        }

        /* FOOTER */
        .footer {
            margin-top: 4rem;
            text-align: center;
            padding: 2rem;
            border-top: 1px solid var(--border-color);
            color: var(--text-muted);
            font-size: 0.8rem;
        }

        .footer p:first-child {
            color: var(--text-main);
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
            header { text-align: center; border-left: none; border-bottom: 2px solid var(--primary-red); padding-left: 0; padding-bottom: 1rem; }
            .meta { text-align: center; width: 100%; }
        }

        /* Additional CSS to handle 2-column layout on desktop */
        @media (max-width: 900px) {
            .responsive-flex {
                grid-template-columns: 1fr !important;
            }
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div>
            <h1>Stealer Log Intelligence Report</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Global Exposure & Credential Landscape</p>
        </div>
        <div class="meta">
            <div>Export Date: <span>${exportDate}</span></div>
            <div>Range: <span>${dateRangeLabel}</span></div>
        </div>
    </header>

    <!-- Global Stats - 6 Cards (First 3: Devices, Credentials, Files | Last 3: Countries, Domains, URLs) -->
    <div class="stats-grid" style="margin-bottom: 2rem;">
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalDevices.toLocaleString()}</div>
            <div class="stat-label">Total Devices</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalCredentials.toLocaleString()}</div>
            <div class="stat-label">Total Credentials</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalFiles.toLocaleString()}</div>
            <div class="stat-label">Files Extracted</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.countryStats ? data.countryStats.summary.affectedCountries.toLocaleString() : '0'}</div>
            <div class="stat-label">Affected Countries</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalDomains.toLocaleString()}</div>
            <div class="stat-label">Total Domains</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalUrls.toLocaleString()}</div>
            <div class="stat-label">Total URLs</div>
        </div>
    </div>

    ${data.topPasswords.length > 0 ? `
    <div class="section">
        <h2 class="section-title">Top 5 Most Used Passwords</h2>
        <div class="password-grid">
            ${data.topPasswords.map((pwd, idx) => `
            <div class="password-item">
                <span class="password-text">${pwd.password.length > 25 ? pwd.password.substring(0, 25) + '...' : pwd.password}</span>
                <span class="password-count">#${idx + 1} - ${pwd.total_count.toLocaleString()} times</span>
            </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    ${data.countryStats && data.countryStats.topCountries.length > 0 ? `
    <!-- Country Stats - Simplified to table only -->
    <div class="section">
        <h2 class="section-title">Geographic Data Distribution</h2>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem;">Data based on geographic regions (Top 5 Most Affected).</p>
        
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Country</th>
                    <th>Devices</th>
                    <th>Credentials</th>
                </tr>
            </thead>
            <tbody>
                ${data.countryStats.topCountries.slice(0, 5).map((country, idx) => `
                <tr>
                    <td>#${idx + 1}</td>
                    <td>${getCountryFlag(country.country)} ${country.countryName}</td>
                    <td>${country.totalDevices.toLocaleString()}</td>
                    <td>${country.totalCredentials.toLocaleString()}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;" class="responsive-flex">
        ${data.topTLDs.length > 0 ? `
        <!-- TLD Stats -->
        <div class="section" style="margin-bottom: 0;">
            <h2 class="section-title">Top 10 TLDs</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>TLD</th>
                        <th>Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.topTLDs.slice(0, 10).map((tld, idx) => `
                    <tr>
                        <td>#${idx + 1}</td>
                        <td>.${tld.tld}</td>
                        <td>${Number(tld.count).toLocaleString('en-US')}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${data.browserData.length > 0 ? `
        <!-- Browser Stats -->
        <div class="section" style="margin-bottom: 0;">
            <h2 class="section-title">Top Browsers</h2>
            <table>
                <thead>
                    <tr>
                        <th>Browser</th>
                        <th>Device Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.browserData.map(browser => `
                    <tr>
                        <td>${browser.browser}</td>
                        <td>${browser.count.toLocaleString()}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
    </div>

    ${data.softwareData.length > 0 ? `
    <!-- Software Stats -->
    <div class="section">
        <h2 class="section-title">Common Software Found in Logs</h2>
        <table>
            <thead>
                <tr>
                    <th>Software</th>
                    <th>Version</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                ${data.softwareData.map(software => `
                <tr>
                    <td>${software.software_name}</td>
                    <td>${software.version || 'N/A'}</td>
                    <td>${Number(software.count).toLocaleString('en-US')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="footer">
        <p>BRON VAULT</p>
        <p>Data integrity verified as of ${exportDate}.</p>
    </div>
</div>

</body>
</html>`

  return html
}

/**
 * Generate HTML export for PDF - same template but with different section order
 * Order: Passwords -> TLDs & Browsers -> Geographic Data Distribution -> Software
 */
export async function exportToHTMLForPDF(data: DashboardExportData): Promise<string> {
  const exportDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const dateRangeLabel = formatDateRangeLabel(data.dateRange)

  // Helper function to generate sections HTML
  const generatePasswordsSection = () => data.topPasswords.length > 0 ? `
    <div class="section">
        <h2 class="section-title">Top 5 Most Used Passwords</h2>
        <div class="password-grid">
            ${data.topPasswords.map((pwd, idx) => `
            <div class="password-item">
                <span class="password-text">${pwd.password.length > 25 ? pwd.password.substring(0, 25) + '...' : pwd.password}</span>
                <span class="password-count">#${idx + 1} - ${pwd.total_count.toLocaleString()} times</span>
            </div>
            `).join('')}
        </div>
    </div>
    ` : ''

  const generateTLDsAndBrowsersSection = () => `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;" class="responsive-flex">
        ${data.topTLDs.length > 0 ? `
        <!-- TLD Stats -->
        <div class="section" style="margin-bottom: 0;">
            <h2 class="section-title">Top 10 TLDs</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>TLD</th>
                        <th>Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.topTLDs.slice(0, 10).map((tld, idx) => `
                    <tr>
                        <td>#${idx + 1}</td>
                        <td>.${tld.tld}</td>
                        <td>${Number(tld.count).toLocaleString('en-US')}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${data.browserData.length > 0 ? `
        <!-- Browser Stats -->
        <div class="section" style="margin-bottom: 0;">
            <h2 class="section-title">Top Browsers</h2>
            <table>
                <thead>
                    <tr>
                        <th>Browser</th>
                        <th>Device Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.browserData.map(browser => `
                    <tr>
                        <td>${browser.browser}</td>
                        <td>${browser.count.toLocaleString()}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
    </div>
    `

  const generateGeographicSection = () => data.countryStats && data.countryStats.topCountries.length > 0 ? `
    <!-- Country Stats - Simplified to table only -->
    <div class="section" style="margin-top: 3rem;">
        <h2 class="section-title">Geographic Data Distribution</h2>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem;">Data based on geographic regions (Top 5 Most Affected).</p>
        
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Country</th>
                    <th>Devices</th>
                    <th>Credentials</th>
                </tr>
            </thead>
            <tbody>
                ${data.countryStats.topCountries.slice(0, 5).map((country, idx) => `
                <tr>
                    <td>#${idx + 1}</td>
                    <td>${getCountryFlag(country.country)} ${country.countryName}</td>
                    <td>${country.totalDevices.toLocaleString()}</td>
                    <td>${country.totalCredentials.toLocaleString()}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''

  const generateSoftwareSection = () => data.softwareData.length > 0 ? `
    <!-- Software Stats -->
    <div class="section">
        <h2 class="section-title">Common Software Found in Logs</h2>
        <table>
            <thead>
                <tr>
                    <th>Software</th>
                    <th>Version</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                ${data.softwareData.map(software => `
                <tr>
                    <td>${software.software_name}</td>
                    <td>${software.version || 'N/A'}</td>
                    <td>${Number(software.count).toLocaleString('en-US')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stealer Log Intelligence Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0a0a0c;
            --card-bg: #151518;
            --primary-red: #ff3131;
            --secondary-red: #8b0000;
            --text-main: #ffffff;
            --text-muted: #a1a1aa;
            --border-color: #27272a;
            --accent-glow: rgba(255, 49, 49, 0.15);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            padding: 2rem 1rem;
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
        }

        /* HEADER */
        header {
            border-left: 4px solid var(--primary-red);
            padding-left: 1.5rem;
            margin-bottom: 3rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            flex-wrap: wrap;
            gap: 1rem;
        }

        header h1 {
            font-size: 2.2rem;
            font-weight: 700;
            letter-spacing: -1px;
            text-transform: uppercase;
            /* PDF: Use solid color instead of gradient for better rendering */
            background: none !important;
            -webkit-background-clip: unset !important;
            -webkit-text-fill-color: unset !important;
            color: var(--primary-white) !important;
        }

        .meta {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: var(--text-muted);
            text-align: right;
        }

        .meta span {
            color: var(--primary-red);
        }

        /* STATS GRID */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .stat-card {
            background: var(--card-bg);
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .stat-card:hover {
            border-color: var(--primary-red);
            box-shadow: 0 0 20px var(--accent-glow);
            transform: translateY(-5px);
        }

        .stat-card::after {
            content: "";
            position: absolute;
            top: 0; right: 0;
            width: 40px; height: 40px;
            background: linear-gradient(135deg, transparent 50%, rgba(255, 49, 49, 0.1) 50%);
        }

        .stat-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--primary-red);
            margin-bottom: 0.25rem;
            font-family: 'JetBrains Mono', monospace;
        }

        .stat-label {
            font-size: 0.85rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* SECTIONS */
        .section {
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--border-color);
            padding: 2rem;
            margin-bottom: 2rem;
        }

        .section-title {
            font-size: 1.25rem;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-weight: 600;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1rem;
        }

        .section-title::before {
            content: "";
            width: 8px;
            height: 8px;
            background: var(--primary-red);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--primary-red);
        }

        /* PASSWORD GRID */
        .password-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 1rem;
        }

        .password-item {
            background: #1e1e22;
            padding: 1rem;
            border-radius: 8px;
            border: 1px dashed #3f3f46;
        }

        .password-text {
            font-family: 'JetBrains Mono', monospace;
            color: #fff;
            font-weight: bold;
            display: block;
            margin-bottom: 0.4rem;
            font-size: 1.1rem;
        }

        .password-count {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        /* TABLES */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        thead th {
            text-align: left;
            padding: 1rem;
            color: var(--text-muted);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 1px;
            border-bottom: 2px solid var(--border-color);
        }

        tbody td {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
        }

        tbody tr:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        tr td:first-child {
            color: var(--primary-red);
            font-weight: bold;
            font-family: 'JetBrains Mono', monospace;
        }

        /* FOOTER */
        .footer {
            margin-top: 4rem;
            text-align: center;
            padding: 2rem;
            border-top: 1px solid var(--border-color);
            color: var(--text-muted);
            font-size: 0.8rem;
        }

        .footer p:first-child {
            color: var(--text-main);
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
            header { text-align: center; border-left: none; border-bottom: 2px solid var(--primary-red); padding-left: 0; padding-bottom: 1rem; }
            .meta { text-align: center; width: 100%; }
        }

        /* Additional CSS to handle 2-column layout on desktop */
        @media (max-width: 900px) {
            .responsive-flex {
                grid-template-columns: 1fr !important;
            }
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div>
            <h1>Stealer Log Intelligence Report</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Global Exposure & Credential Landscape</p>
        </div>
        <div class="meta">
            <div>Export Date: <span>${exportDate}</span></div>
            <div>Range: <span>${dateRangeLabel}</span></div>
        </div>
    </header>

    <!-- Global Stats - 6 Cards (First 3: Devices, Credentials, Files | Last 3: Countries, Domains, URLs) -->
    <div class="stats-grid" style="margin-bottom: 2rem;">
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalDevices.toLocaleString()}</div>
            <div class="stat-label">Total Devices</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalCredentials.toLocaleString()}</div>
            <div class="stat-label">Total Credentials</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalFiles.toLocaleString()}</div>
            <div class="stat-label">Files Extracted</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.countryStats ? data.countryStats.summary.affectedCountries.toLocaleString() : '0'}</div>
            <div class="stat-label">Affected Countries</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalDomains.toLocaleString()}</div>
            <div class="stat-label">Total Domains</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalUrls.toLocaleString()}</div>
            <div class="stat-label">Total URLs</div>
        </div>
    </div>

    ${generatePasswordsSection()}
    ${generateTLDsAndBrowsersSection()}
    ${generateGeographicSection()}
    ${generateSoftwareSection()}

    <div class="footer">
        <p>BRON VAULT</p>
        <p>Data integrity verified as of ${exportDate}.</p>
    </div>
</div>

</body>
</html>`

  return html
}

/**
 * Download HTML file
 */
export function downloadHTML(html: string, filename?: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename || `bron-vault-dashboard-${new Date().toISOString().split("T")[0]}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
