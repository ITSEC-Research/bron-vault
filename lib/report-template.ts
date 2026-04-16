import * as fs from 'fs'
import * as path from 'path'

export interface ReportData {
  deviceName: string
  deviceId: string
  sysInfo: Record<string, string> | null
  sortedDomains: { domain: string; count: number }[]
  sortedPasswords: { password: string; count: number }[]
  sortedSubdomains: { subdomain: string; domain: string; count: number }[]
  uniqueSoftware: { name: string; version: string }[]
  totalCredentials: number
}

function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public/images/logo.png')
    const buf = fs.readFileSync(logoPath)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return ''
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getStyles(): string {
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#09090b;color:#fafafa;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1200px;margin:0 auto;padding:0 32px 60px}

/* Header */
.report-header{background:linear-gradient(135deg,#0c0c0e 0%,#1a0a0a 50%,#0c0c0e 100%);border-bottom:1px solid #303038;padding:40px 0 32px;margin-bottom:32px}
.header-inner{max-width:1200px;margin:0 auto;padding:0 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
.header-brand{display:flex;align-items:center;gap:16px}
.header-brand img{height:36px;opacity:.9}
.header-title{font-size:1.75rem;font-weight:600;color:#fafafa;letter-spacing:-.02em}
.header-sub{font-size:.8rem;color:#71717a;margin-top:2px}
.header-meta{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:.7rem;font-weight:500;text-transform:uppercase;letter-spacing:.08em;padding:5px 12px;border-radius:6px}
.badge-red{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}
.badge-zinc{background:rgba(161,161,170,.08);color:#a1a1aa;border:1px solid rgba(161,161,170,.15)}
.header-date{font-size:.75rem;color:#52525b}

/* KPI Cards */
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
@media(max-width:800px){.kpi-row{grid-template-columns:repeat(2,1fr)}}
.kpi{background:#111113;border:1px solid #303038;border-radius:12px;padding:20px 24px;position:relative;overflow:hidden;transition:border-color .2s}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--kpi-accent,#ef4444);opacity:.6}
.kpi-val{font-size:2rem;font-weight:700;color:#fafafa;letter-spacing:-.03em;line-height:1.1}
.kpi-label{font-size:.75rem;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
.kpi-icon{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(239,68,68,.08)}
.kpi-icon svg{width:16px;height:16px;stroke:#ef4444;fill:none;stroke-width:2}

/* Sections */
.section{background:#111113;border:1px solid #303038;border-radius:12px;padding:24px;margin-bottom:20px}
.section-title{font-size:1.1rem;font-weight:600;color:#fafafa;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.section-title::before{content:'';width:3px;height:20px;background:#ef4444;border-radius:2px;flex-shrink:0}
.section-desc{font-size:.8rem;color:#71717a;margin-top:-10px;margin-bottom:16px;padding-left:13px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:800px){.grid-2{grid-template-columns:1fr}}

/* System Info Cards */
.info-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.info-card{background:#0c0c0e;border:1px solid #2a2a30;border-radius:8px;padding:14px 16px}
.info-label{font-size:.65rem;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.info-val{font-size:.82rem;color:#e4e4e7;word-break:break-all}

/* Tables */
.tbl-wrap{border:1px solid #2a2a30;border-radius:8px;overflow:hidden;overflow-x:hidden}
.tbl-scroll{max-height:460px;overflow-y:auto}
.tbl-scroll::-webkit-scrollbar{width:5px}
.tbl-scroll::-webkit-scrollbar-track{background:transparent}
.tbl-scroll::-webkit-scrollbar-thumb{background:#27272a;border-radius:3px}
table{width:100%;border-collapse:collapse;font-size:.82rem;table-layout:fixed}
thead{position:sticky;top:0;z-index:5}
th{background:#0c0c0e;color:#71717a;font-weight:500;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;padding:10px 14px;text-align:left;border-bottom:1px solid #303038}
td{padding:8px 14px;border-bottom:1px solid rgba(48,48,56,.7);color:#d4d4d8;overflow:hidden;text-overflow:ellipsis;word-break:break-all}
tr:nth-child(even){background:rgba(255,255,255,.015)}
tr:hover{background:rgba(239,68,68,.03)}
td.num{color:#71717a;font-size:.75rem;width:40px;text-align:center}
td.count{font-weight:600;color:#f87171;font-variant-numeric:tabular-nums}
td.pw{font-family:'SF Mono',Monaco,Consolas,monospace;font-size:.78rem;color:#a1a1aa}

/* Collapsible */
details{margin-top:0}
details>summary{cursor:pointer;padding:10px 14px;font-size:.8rem;color:#71717a;background:#0c0c0e;border-top:1px solid #2a2a30;list-style:none;display:flex;align-items:center;gap:6px;transition:color .2s}
details>summary:hover{color:#fafafa}
details>summary::before{content:'▸';font-size:.7rem;transition:transform .2s}
details[open]>summary::before{transform:rotate(90deg)}
details>summary::-webkit-details-marker{display:none}



/* Radial Chart */
.radial-wrap{padding:10px 0}
.pw-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
.pw-stat{background:#0c0c0e;border:1px solid #2a2a30;border-radius:8px;padding:12px;text-align:center}
.pw-stat-val{font-size:1.3rem;font-weight:700;color:#fafafa;line-height:1.1}
.pw-stat-label{font-size:.65rem;color:#52525b;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}

/* Software Grid */
.software-container{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;border:1px solid #2a2a30;border-radius:8px;padding:8px 14px;max-height:500px;overflow-y:auto}
.software-container::-webkit-scrollbar{width:5px}
.software-container::-webkit-scrollbar-track{background:transparent}
.software-container::-webkit-scrollbar-thumb{background:#27272a;border-radius:3px}
@media(max-width:800px){.software-container{grid-template-columns:1fr}}
.software-item{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(48,48,56,.7);gap:12px}
.software-item:hover{background:rgba(239,68,68,.03);margin:0 -14px;padding:9px 14px}
.sw-name{color:#d4d4d8;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sw-ver{font-size:.72rem;color:#ef4444;background:rgba(239,68,68,.08);padding:2px 8px;border-radius:4px;font-family:'SF Mono',Monaco,Consolas,monospace;white-space:nowrap;flex-shrink:0}
@media print{.software-container{max-height:none!important;overflow:visible!important}}

/* Footer */
.report-footer{text-align:center;padding:28px 0 0;margin-top:40px;border-top:1px solid #303038}
.footer-conf{font-size:.7rem;color:#ef4444;text-transform:uppercase;letter-spacing:.12em;font-weight:500;margin-bottom:6px}
.footer-text{font-size:.75rem;color:#3f3f46}

/* Print */
@media print{
  body{background:#fff;color:#09090b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .report-header{background:#f4f4f5!important;border-bottom:2px solid #e4e4e7}
  .header-title,.section-title,.kpi-val{color:#09090b!important}
  .kpi,.section,.info-card{border-color:#e4e4e7!important;background:#fff!important}
  .kpi::before{opacity:1}
  th{background:#f4f4f5!important;color:#52525b!important}
  td{color:#27272a!important}
  .tbl-scroll{max-height:none!important;overflow:visible!important}
  details{open:true}
  details>summary{display:none}
  .section{page-break-inside:avoid}
}
`
}

function renderHeader(data: ReportData, logo: string): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `
<div class="report-header">
  <div class="header-inner">
    <div>
      <div class="header-brand">
        ${logo ? `<img src="${logo}" alt="Bron Vault">` : ''}
      </div>
      <div style="margin-top:12px">
        <div class="header-title">Device Intelligence Report</div>
        <div class="header-sub">${esc(data.deviceName || data.deviceId)}</div>
      </div>
    </div>
    <div class="header-meta">
      <span class="badge badge-red">CONFIDENTIAL</span>
      <span class="header-date">${dateStr} at ${timeStr}</span>
    </div>
  </div>
</div>`
}

function renderKPIs(data: ReportData): string {
  const items = [
    { val: data.totalCredentials, label: 'Total Credentials', icon: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>' },
    { val: data.sortedPasswords.length, label: 'Unique Passwords', icon: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
    { val: data.sortedDomains.length, label: 'Unique Domains', icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    { val: data.uniqueSoftware.length, label: 'Installed Software', icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' }
  ]
  return `<div class="kpi-row">${items.map(i => `
    <div class="kpi">
      <div class="kpi-icon"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${i.icon}</svg></div>
      <div class="kpi-val">${i.val.toLocaleString()}</div>
      <div class="kpi-label">${i.label}</div>
    </div>`).join('')}
  </div>`
}

function renderSystemInfo(data: ReportData): string {
  if (!data.sysInfo) return `<div class="section"><div class="section-title">System Overview</div><p style="color:#52525b;font-size:.85rem">No system information available.</p></div>`
  const fields = [
    { l: 'Computer Name', k: 'computer_name' }, { l: 'Username', k: 'username' },
    { l: 'IP Address', k: 'ip_address' }, { l: 'Country', k: 'country' },
    { l: 'Operating System', k: 'os' }, { l: 'Stealer Type', k: 'stealer_type' },
    { l: 'CPU', k: 'cpu' }, { l: 'RAM', k: 'ram' },
    { l: 'GPU', k: 'gpu' }, { l: 'Antivirus', k: 'antivirus' },
    { l: 'HWID', k: 'hwid' }, { l: 'Log Date', k: 'log_date' }
  ]
  return `<div class="section">
    <div class="section-title">System Overview</div>
    <div class="info-grid">${fields.map(f => `
      <div class="info-card">
        <div class="info-label">${f.l}</div>
        <div class="info-val">${esc(String(data.sysInfo![f.k] || '—'))}</div>
      </div>`).join('')}
    </div>
  </div>`
}


function renderCollapsibleTable(
  title: string,
  desc: string,
  headers: string[],
  rows: string[][],
  threshold = 50
): string {
  if (rows.length === 0) {
    return `<div class="section"><div class="section-title">${title}</div><p style="color:#52525b;font-size:.85rem">No data available.</p></div>`
  }
  const visible = rows.slice(0, threshold)
  const hidden = rows.slice(threshold)
  const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`
  const mapRow = (r: string[]) => `<tr>${r.map((c, ci) => {
    if (ci === 0 && c.match(/^\d+$/)) return `<td class="num">${c}</td>`
    const cls = headers[ci]?.toLowerCase() === 'count' ? 'count' : headers[ci]?.toLowerCase() === 'password' ? 'pw' : ''
    return `<td${cls ? ` class="${cls}"` : ''}>${c}</td>`
  }).join('')}</tr>`

  // Build colgroup for proper column sizing with table-layout:fixed
  const colgroup = headers.map(h => {
    const lower = h.toLowerCase()
    if (lower === '#') return '<col style="width:50px">'
    if (lower === 'count') return '<col style="width:70px">'
    return '<col>'
  }).join('')

  return `<div class="section">
    <div class="section-title">${title}</div>
    ${desc ? `<div class="section-desc">${desc}</div>` : ''}
    <div class="tbl-wrap"><div class="tbl-scroll">
      <table>
        <colgroup>${colgroup}</colgroup>
        <thead>${headerRow}</thead>
        <tbody>
          ${visible.map(mapRow).join('')}
        </tbody>
      </table>
      ${hidden.length > 0 ? `<details>
        <summary>Show ${hidden.length.toLocaleString()} more items…</summary>
        <table>
          <colgroup>${colgroup}</colgroup>
          <tbody>${hidden.map(r => mapRow(r)).join('')}</tbody>
        </table>
      </details>` : ''}
    </div></div>
  </div>`
}

function renderSoftware(data: ReportData): string {
  if (data.uniqueSoftware.length === 0) {
    return `<div class="section"><div class="section-title">Installed Software</div><p style="color:#52525b;font-size:.85rem">No software data available.</p></div>`
  }
  const renderItem = (sw: { name: string; version: string }) =>
    `<div class="software-item"><span class="sw-name">${esc(sw.name)}</span><span class="sw-ver">${esc(sw.version)}</span></div>`

  const threshold = 80
  const visible = data.uniqueSoftware.slice(0, threshold)
  const hidden = data.uniqueSoftware.slice(threshold)

  return `<div class="section">
    <div class="section-title">Installed Software</div>
    <div class="software-container">
      ${visible.map(renderItem).join('')}
    </div>
    ${hidden.length > 0 ? `<details style="margin-top:8px">
      <summary>Show ${hidden.length.toLocaleString()} more software…</summary>
      <div class="software-container" style="margin-top:8px;border-top:none;border-top-left-radius:0;border-top-right-radius:0">
        ${hidden.map(renderItem).join('')}
      </div>
    </details>` : ''}
  </div>`
}

function renderPasswordAnalytics(passwords: { password: string; count: number }[], totalCredentials: number): string {
  if (passwords.length === 0) {
    return `<div class="section"><div class="section-title">Password Analytics</div><p style="color:#52525b;font-size:.85rem">No password data available.</p></div>`
  }

  const total = passwords.length
  const topPw = passwords[0]
  const reused = passwords.filter(p => p.count > 1).length
  const weak = passwords.filter(p => p.password.length < 8).length

  // Radial polar bar chart — top 7 most reused passwords
  const top = passwords.slice(0, 7)
  const max = top[0].count
  const cx = 115, cy = 115
  const ringW = 10, ringGap = 3
  const outerR = 105
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

  const rings = top.map((p, i) => {
    const r = outerR - i * (ringW + ringGap)
    const circ = 2 * Math.PI * r
    const trackLen = 0.75 * circ
    const valLen = (p.count / max) * trackLen
    return [
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="#2a2a30" stroke-width="${ringW}" stroke-dasharray="${trackLen.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(135 ${cx} ${cy})"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${colors[i]}" stroke-width="${ringW}" stroke-linecap="round" stroke-dasharray="${valLen.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(135 ${cx} ${cy})"/>`
    ].join('')
  })



  // Subtitle — centered below chart, above legend
  const subtitleY = 238
  const subtitle = `<text x="${cx}" y="${subtitleY}" text-anchor="middle" fill="#52525b" font-size="9" letter-spacing=".04em" font-family="'Inter',sans-serif">Top ${top.length} reused passwords</text>`

  // Legend on the right side — truncate long passwords to prevent overlap
  const legendX = 242
  const countX = 440
  const maxPwLen = 22
  const labels = top.map((p, i) => {
    const y = 26 + i * 28
    const displayPw = p.password.length > maxPwLen ? p.password.slice(0, maxPwLen) + '…' : p.password
    return [
      `<rect x="${legendX}" y="${y - 6}" width="8" height="8" rx="2" fill="${colors[i]}"/>`,
      `<text x="${legendX + 14}" y="${y + 2}" fill="#a1a1aa" font-size="10" font-family="'Inter',sans-serif" clip-path="url(#pw-clip)" style="cursor:default"><title>${esc(p.password)}</title>${esc(displayPw)}</text>`,
      `<text x="${countX}" y="${y + 2}" fill="#fafafa" font-size="10" font-weight="600" font-family="'Inter',sans-serif" text-anchor="end" font-variant-numeric="tabular-nums">${p.count}\u00d7</text>`
    ].join('')
  })

  const svgH = Math.max(subtitleY + 10, 26 + top.length * 28 + 5)
  const svgW = countX + 8

  return `<div class="section">
    <div class="section-title">Password Analytics</div>
    <div class="radial-wrap">
      <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" preserveAspectRatio="xMidYMid meet">
        <defs><clipPath id="pw-clip"><rect x="${legendX + 14}" y="0" width="${countX - legendX - 14 - 40}" height="${svgH}"/></clipPath></defs>
        ${rings.join('')}
        ${subtitle}
        ${labels.join('')}
      </svg>
    </div>
    <div class="pw-stats" style="margin-top:6px">
      <div class="pw-stat"><div class="pw-stat-val">${reused} / ${total}</div><div class="pw-stat-label">Reused Passwords</div></div>
      <div class="pw-stat"><div class="pw-stat-val">${weak}</div><div class="pw-stat-label">Weak (&lt;8 chr)</div></div>
      <div class="pw-stat"><div class="pw-stat-val">${topPw.count}\u00d7</div><div class="pw-stat-label">Most Reused</div></div>
      <div class="pw-stat"><div class="pw-stat-val">${totalCredentials}</div><div class="pw-stat-label">Total Entries</div></div>
    </div>
  </div>`
}

function renderFooter(): string {
  const now = new Date()
  return `<div class="report-footer">
    <div class="footer-conf">⬥ CONFIDENTIAL — For Authorized Personnel Only ⬥</div>
    <div class="footer-text">Generated on ${now.toLocaleString()} by Bron Vault Intelligence Platform</div>
  </div>`
}

export function generateReportHTML(data: ReportData): string {
  const logo = getLogoBase64()

  // Prepare table data
  const subRows = data.sortedSubdomains.map((s, i) => [
    String(i + 1), esc(s.subdomain), esc(s.domain), s.count.toLocaleString()
  ])
  const domainRows = data.sortedDomains.map((d, i) => [
    String(i + 1), esc(d.domain), d.count.toLocaleString()
  ])
  const pwRows = data.sortedPasswords.map((p, i) => [
    String(i + 1), esc(p.password), p.count.toLocaleString()
  ])

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Device Intelligence Report — ${esc(data.deviceName || data.deviceId)}</title>
  <style>${getStyles()}</style>
</head>
<body>
  ${renderHeader(data, logo)}
  <div class="wrap">
    ${renderKPIs(data)}
    ${renderSystemInfo(data)}
    <div class="grid-2">
      ${renderCollapsibleTable('All Passwords', '', ['#', 'Password', 'Count'], pwRows)}
      ${renderPasswordAnalytics(data.sortedPasswords, data.totalCredentials)}
    </div>
    <div class="grid-2">
      ${renderCollapsibleTable('Domain Access Frequency', 'All unique root domains sorted by access count.', ['#', 'Domain', 'Count'], domainRows)}
      ${renderCollapsibleTable('Top Access Subdomains', 'Grouped by subdomain and root domain context.', ['#', 'Subdomain (Hostname)', 'Root Domain', 'Count'], subRows)}
    </div>
    ${renderSoftware(data)}
    ${renderFooter()}
  </div>
</body>
</html>`
}
