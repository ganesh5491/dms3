import mammoth from "mammoth";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";
import { type Document } from "@shared/schema";

export interface ControlCopyInfo {
  userId: string;
  userFullName: string;
  controlCopyNumber: number;
  date: string;
}

export class PDFService {
  private uploadsDir = path.join(process.cwd(), "uploads");
  private pdfsDir = path.join(process.cwd(), "pdfs");

  constructor() {
    // Directories will be initialized via initialize() method
  }

  async initialize(): Promise<void> {
    await this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.pdfsDir, { recursive: true });
  }

  async convertWordToPDF(
    wordFilePath: string,
    document: Document,
    controlCopyInfo?: ControlCopyInfo
  ): Promise<string> {
    // Try the main conversion method first, fallback if it fails
    try {
      console.log('Attempting PDF conversion with Puppeteer...');
      return await this.convertWordToPDFWithPuppeteer(wordFilePath, document, controlCopyInfo);
    } catch (puppeteerError: any) {
      console.error('Puppeteer conversion failed, trying alternative method:', puppeteerError.message);
      
      // Use fallback method
      try {
        console.log('Using alternative PDF conversion method...');
        return await this.convertWordToPDFAlternative(wordFilePath, document, controlCopyInfo);
      } catch (fallbackError: any) {
        console.error('Both PDF conversion methods failed:', fallbackError.message);
        throw new Error(`PDF conversion failed: ${fallbackError.message}`);
      }
    }
  }

  private async convertWordToPDFWithPuppeteer(
    wordFilePath: string,
    document: Document,
    controlCopyInfo?: ControlCopyInfo
  ): Promise<string> {
    let browser;
    try {
      // Validate input file exists
      await fs.access(wordFilePath);
      
      console.log('Converting Word to PDF with Puppeteer for:', wordFilePath);
      
      const wordBuffer = await fs.readFile(wordFilePath);
      const result = await mammoth.convertToHtml({ buffer: wordBuffer });
      const htmlContent = result.value;

      if (!htmlContent.trim()) {
        throw new Error('Empty or invalid Word document content');
      }

      const fullHtml = this.buildFullHtml(document, htmlContent, controlCopyInfo);

      console.log('Launching Puppeteer...');
      
      // Enhanced Puppeteer configuration for Windows
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-software-rasterizer',
          '--remote-debugging-port=0', // Use random port
          '--disable-web-security',
          '--allow-running-insecure-content'
        ],
        timeout: 60000, // 60 second timeout
        protocolTimeout: 60000,
        ignoreDefaultArgs: ['--disable-extensions'], // Don't disable extensions twice
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false
      });

      console.log('Browser launched successfully');

      try {
        console.log('Creating new page...');
        const page = await browser.newPage();
        
        // Set a reasonable timeout and viewport
        page.setDefaultTimeout(45000);
        page.setDefaultNavigationTimeout(45000);
        
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log('Setting HTML content...');
        await page.setContent(fullHtml, { 
          waitUntil: ['load', 'domcontentloaded'],
          timeout: 45000
        });

        // Wait a bit for any dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pdfFileName = controlCopyInfo 
          ? `${document.docNumber}_v${document.revisionNo}_cc${controlCopyInfo.controlCopyNumber}.pdf`
          : `${document.docNumber}_v${document.revisionNo}.pdf`;
        
        const pdfPath = path.join(this.pdfsDir, pdfFileName);

        console.log('Generating PDF:', pdfPath);
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '80px',
            bottom: '100px',
            left: '40px',
            right: '40px'
          },
          timeout: 45000,
          preferCSSPageSize: true
        });

        // Write the PDF buffer to file
        await fs.writeFile(pdfPath, pdfBuffer);

        // Verify the PDF was created and has content
        const stats = await fs.stat(pdfPath);
        if (stats.size === 0) {
          throw new Error('Generated PDF file is empty');
        }

        console.log('PDF generated successfully:', pdfPath, 'Size:', stats.size);
        return pdfPath;
        
      } catch (pageError) {
        console.error('Page operation failed:', pageError);
        throw pageError;
      }
    } catch (error: any) {
      console.error('Error in convertWordToPDFWithPuppeteer:', error);
      // Re-throw the original error to allow fallback handling
      throw error;
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('Browser closed successfully');
        } catch (closeError) {
          console.warn('Error closing browser:', closeError);
        }
      }
    }
  }

  private async convertWordToPDFAlternative(
    wordFilePath: string,
    document: Document,
    controlCopyInfo?: ControlCopyInfo
  ): Promise<string> {
    console.log('Using alternative PDF conversion method');
    
    try {
      // Read the Word document and try to get both HTML and text
      const wordBuffer = await fs.readFile(wordFilePath);
      
      // Try to get HTML content first
      let content = '';
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer: wordBuffer });
        content = htmlResult.value;
        
        // If HTML is empty or just whitespace, try extracting raw text
        if (!content || content.trim().length === 0 || content.trim() === '<p></p>') {
          const textResult = await mammoth.extractRawText({ buffer: wordBuffer });
          content = textResult.value;
        }
      } catch (htmlError) {
        console.warn('HTML extraction failed, trying text extraction:', htmlError);
        const textResult = await mammoth.extractRawText({ buffer: wordBuffer });
        content = textResult.value;
      }

      // If still no content, use document metadata
      if (!content || content.trim().length === 0) {
        content = `Document: ${document.docName}\n\nThis document appears to be empty or the content could not be extracted.\n\nDocument Details:\n- Document Number: ${document.docNumber}\n- Revision: ${document.revisionNo}\n- Status: ${document.status}\n- Created: ${new Date(document.createdAt || new Date()).toLocaleDateString()}`;
      }

      const pdfFileName = controlCopyInfo 
        ? `${document.docNumber}_v${document.revisionNo}_cc${controlCopyInfo.controlCopyNumber}.pdf`
        : `${document.docNumber}_v${document.revisionNo}.pdf`;
      
      const pdfPath = path.join(this.pdfsDir, pdfFileName);

      // Create a PDF using pdf-lib
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const { width, height } = page.getSize();
      
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 12;
      const titleFontSize = 16;
      const margin = 50;
      const lineHeight = fontSize * 1.5;
      
      let yPosition = height - margin;
      
      // Add header
      page.drawText(document.docName || 'Document', {
        x: margin,
        y: yPosition,
        size: titleFontSize,
        font: boldFont,
        color: rgb(0, 0, 0.8),
      });
      yPosition -= 30;
      
      page.drawText(`Doc No: ${document.docNumber} | Rev: ${document.revisionNo} | Date: ${new Date(document.dateOfIssue || new Date()).toLocaleDateString()}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 40;
      
      // Process content - Clean up unicode characters that can't be encoded
      const textContent = String(content);
      // Remove or replace problematic unicode characters
      const cleanedContent = textContent
        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
        .replace(/→/g, '->')  // Replace arrow with ASCII equivalent
        .replace(/—/g, '--')  // Replace em dash
        .replace(/'/g, "'")   // Replace curly quotes
        .replace(/"/g, '"')   // Replace curly quotes
        .replace(/…/g, '...') // Replace ellipsis
        .trim();
      
      const lines = cleanedContent.split('\n'); // Remove HTML tags if any
      
      for (const line of lines) {
        if (yPosition < margin + 50) {
          // Add new page
          page = pdfDoc.addPage([595.28, 841.89]);
          yPosition = height - margin;
        }
        
        if (line.trim() === '') {
          yPosition -= lineHeight / 2; // Smaller gap for empty lines
          continue;
        }
        
        // Clean the line of any problematic characters
        const cleanLine = line
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
          .trim();
        
        if (!cleanLine) {
          yPosition -= lineHeight / 2;
          continue;
        }
        
        // Wrap long lines
        const maxWidth = width - 2 * margin;
        const words = cleanLine.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          const cleanWord = word.replace(/[^\x00-\x7F]/g, ''); // Clean each word
          const testLine = currentLine + (currentLine ? ' ' : '') + cleanWord;
          
          let textWidth = 0;
          try {
            textWidth = font.widthOfTextAtSize(testLine, fontSize);
          } catch (encodingError: any) {
            console.warn('Encoding error for text:', testLine, encodingError?.message || 'Unknown encoding error');
            // Skip this word if it can't be encoded
            continue;
          }
          
          if (textWidth > maxWidth && currentLine) {
            // Draw current line
            try {
              page.drawText(currentLine, {
                x: margin,
                y: yPosition,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
              });
            } catch (drawError: any) {
              console.warn('Error drawing text:', currentLine, drawError?.message || 'Unknown draw error');
            }
            yPosition -= lineHeight;
            currentLine = cleanWord;
            
            // Check if we need a new page
            if (yPosition < margin + 50) {
              page = pdfDoc.addPage([595.28, 841.89]);
              yPosition = height - margin;
            }
          } else {
            currentLine = testLine;
          }
        }
        
        // Draw remaining text
        if (currentLine && yPosition >= margin + 50) {
          try {
            page.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
          } catch (drawError: any) {
            console.warn('Error drawing remaining text:', currentLine, drawError?.message || 'Unknown draw error');
          }
          yPosition -= lineHeight;
        }
      }
      
      // Add control copy info if provided
      if (controlCopyInfo) {
        // Ensure we have space for the control copy info
        if (yPosition < margin + 30) {
          page = pdfDoc.addPage([595.28, 841.89]);
          yPosition = height - margin;
        }
        
        yPosition = margin + 20; // Position near bottom
        page.drawRectangle({
          x: margin - 5,
          y: yPosition - 15,
          width: width - 2 * margin + 10,
          height: 25,
          borderColor: rgb(1, 0.8, 0),
          borderWidth: 2,
          color: rgb(1, 0.95, 0.8),
        });
        
        page.drawText(`CONTROLLED COPY - User: ${controlCopyInfo.userId} | Copy: ${controlCopyInfo.controlCopyNumber} | Date: ${controlCopyInfo.date}`, {
          x: margin,
          y: yPosition,
          size: 8,
          font: boldFont,
          color: rgb(0.8, 0, 0),
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(pdfPath, pdfBytes);
      
      console.log('Alternative PDF generated successfully:', pdfPath, 'Size:', pdfBytes.length);
      return pdfPath;
      
    } catch (error: any) {
      console.error('Error in alternative PDF conversion:', error);
      throw new Error(`Alternative PDF conversion failed: ${error.message}`);
    }
  }

  private buildFullHtml(
    document: Document,
    bodyContent: string,
    controlCopyInfo?: ControlCopyInfo
  ): string {
    const headerHtml = this.buildHeader(document);
    const footerHtml = this.buildFooter(document, controlCopyInfo);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 0;
      size: A4;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      background: white;
      color: black;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      min-height: 100vh;
      padding: 100px 40px 120px 40px;
      position: relative;
    }
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 80px;
      background: #f8f9fa;
      border-bottom: 2px solid #007bff;
      padding: 10px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 100px;
      background: #f8f9fa;
      border-top: 2px solid #007bff;
      padding: 10px 40px;
      font-size: 10pt;
      z-index: 1000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .content {
      position: relative;
      z-index: 1;
      background: white;
      min-height: 500px;
      padding: 20px 0;
    }
    .content p {
      margin-bottom: 10px;
    }
    .content h1, .content h2, .content h3 {
      margin-bottom: 15px;
      margin-top: 20px;
    }
    .control-copy-watermark {
      background: #fff3cd;
      border: 2px dashed #ffc107;
      padding: 8px;
      margin-top: 5px;
      font-weight: bold;
      color: #856404;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-info, .footer-info {
      font-size: 10pt;
      color: #333;
    }
    .doc-title {
      font-size: 14pt;
      font-weight: bold;
      color: #007bff;
    }
    /* Ensure content is visible */
    .content * {
      color: black !important;
      background: transparent !important;
    }
    /* Handle tables and lists */
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .content table td, .content table th {
      border: 1px solid #ccc;
      padding: 8px;
      text-align: left;
    }
    .content ul, .content ol {
      margin: 10px 0;
      padding-left: 30px;
    }
    .content li {
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${headerHtml}
    </div>
    
    <div class="content">
      ${bodyContent || '<p>No content available in this document.</p>'}
    </div>
    
    <div class="footer">
      ${footerHtml}
    </div>
  </div>
</body>
</html>
    `;
  }

  private buildHeader(document: Document): string {
    return `
      <div>
        <div class="doc-title">${document.docName}</div>
        <div class="header-info">
          <strong>Doc No:</strong> ${document.docNumber} | 
          <strong>Rev:</strong> ${document.revisionNo} | 
          <strong>Date:</strong> ${new Date(document.dateOfIssue || new Date()).toLocaleDateString()}
        </div>
        ${document.headerInfo ? `<div class="header-info">${this.escapeHtml(document.headerInfo)}</div>` : ''}
      </div>
    `;
  }

  private buildFooter(document: Document, controlCopyInfo?: ControlCopyInfo): string {
    let footerContent = `
      <div class="footer-info">
        ${document.footerInfo ? `<div>${this.escapeHtml(document.footerInfo)}</div>` : ''}
      </div>
    `;

    if (controlCopyInfo) {
      footerContent += `
        <div class="control-copy-watermark">
          CONTROLLED COPY - NOT FOR DISTRIBUTION<br/>
          User ID: ${controlCopyInfo.userId} | 
          Control Copy No: ${controlCopyInfo.controlCopyNumber} | 
          Date: ${controlCopyInfo.date}
        </div>
      `;
    }

    return footerContent;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  async saveUploadedFile(fileBuffer: Buffer, originalName: string, documentId: string): Promise<string> {
    await this.ensureDirectories();
    const fileName = `${documentId}_${Date.now()}_${originalName}`;
    const filePath = path.join(this.uploadsDir, fileName);
    await fs.writeFile(filePath, fileBuffer);
    return filePath;
  }

  async getDocumentVersions(docNumber: string): Promise<string[]> {
    const files = await fs.readdir(this.pdfsDir);
    return files.filter(f => f.startsWith(docNumber));
  }

  async extractHeaderFooterFromWord(fileBuffer: Buffer): Promise<{ headerInfo: string, footerInfo: string }> {
    try {
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      const htmlContent = result.value;
      
      const lines = htmlContent.split('</p>').map(line => {
        const text = line.replace(/<[^>]*>/g, '').trim();
        return text;
      }).filter(line => line.length > 0);
      
      let headerInfo = '';
      let footerInfo = '';
      
      if (lines.length > 0) {
        headerInfo = lines.slice(0, Math.min(2, lines.length)).join(' ');
      }
      
      if (lines.length > 2) {
        footerInfo = lines.slice(-2).join(' ');
      } else {
        footerInfo = 'Standard Footer';
      }
      
      return {
        headerInfo: headerInfo || 'Document Header',
        footerInfo: footerInfo || 'Document Footer'
      };
    } catch (error) {
      console.error('Error extracting header/footer:', error);
      return {
        headerInfo: 'Document Header',
        footerInfo: 'Document Footer'
      };
    }
  }
}

export const pdfService = new PDFService();
