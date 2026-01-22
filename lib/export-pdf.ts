import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { formatDateRangeLabel } from "./date-range-utils"
import { DashboardExportData } from "./export-types"
import { exportToHTMLForPDF } from "./export-html"

/**
 * Wait for fonts to load
 */
function waitForFonts(): Promise<void> {
  return new Promise((resolve) => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        // Additional delay to ensure fonts are fully rendered
        setTimeout(resolve, 500)
      })
    } else {
      // Fallback if fonts API not available
      setTimeout(resolve, 1000)
    }
  })
}

/**
 * Export dashboard to PDF using the same HTML template as HTML export
 */
export async function exportToPDF(
  _elementId: string,
  data: DashboardExportData
): Promise<void> {
  // Show loading indicator
  const loadingIndicator = document.createElement("div")
  loadingIndicator.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 1rem 2rem;
    border-radius: 8px;
    z-index: 10000;
  `
  loadingIndicator.textContent = "Generating PDF..."
  document.body.appendChild(loadingIndicator)

  // Create hidden container for HTML rendering
  const container = document.createElement("div")
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 1100px;
    background: #0a0a0c;
  `
  document.body.appendChild(container)

  try {
    // Generate HTML using PDF-specific template with different section order
    const htmlString = await exportToHTMLForPDF(data)
    
    // Create iframe to render HTML with proper isolation
    const iframe = document.createElement("iframe")
    iframe.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1100px;
      border: none;
      background: #0a0a0c;
    `
    container.appendChild(iframe)

    // Wait for iframe to be ready
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve()
      iframe.src = "about:blank"
    })

    // Write HTML to iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      throw new Error("Failed to access iframe document")
    }

    iframeDoc.open()
    iframeDoc.write(htmlString)
    iframeDoc.close()

    // Wait for fonts and images to load
    await waitForFonts()
    
    // Additional wait for images
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Get the body element from iframe
    const iframeBody = iframeDoc.body
    if (!iframeBody) {
      throw new Error("Failed to access iframe body")
    }

    // Capture iframe content as canvas
    const canvas = await html2canvas(iframeBody, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#0a0a0c",
      width: iframeBody.scrollWidth,
      height: iframeBody.scrollHeight,
      windowWidth: 1100,
      windowHeight: iframeBody.scrollHeight,
    })

    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF("p", "mm", "a4")

    const imgWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    let position = 0

    // Add first page
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // Add metadata
    const dateRangeLabel = formatDateRangeLabel(data.dateRange)

    pdf.setProperties({
      title: "Bron Vault Dashboard Report",
      subject: `Dashboard Export - ${dateRangeLabel}`,
      author: "Bron Vault",
      creator: "Bron Vault Dashboard",
    })

    // Save PDF
    const filename = `bron-vault-dashboard-${new Date().toISOString().split("T")[0]}.pdf`
    pdf.save(filename)
  } catch (error) {
    console.error("Error generating PDF:", error)
    throw error
  } finally {
    // Cleanup
    document.body.removeChild(loadingIndicator)
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  }
}
