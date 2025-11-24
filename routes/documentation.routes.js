import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { mdToPdf } from 'md-to-pdf';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @route   GET /api/documentation/download
// @desc    Download documentation file as PDF
// @access  Public
router.get('/download', async (req, res) => {
  try {
    const docPath = path.join(__dirname, '../DOCUMENTATION.md');
    
    // Check if file exists
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ message: 'Documentation file not found' });
    }

    // Convert markdown to PDF
    const pdf = await mdToPdf(
      { path: docPath },
      {
        dest: path.join(__dirname, '../temp_documentation.pdf'),
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          },
          displayHeaderFooter: true,
          headerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Hostel Management System - Documentation</div>',
          footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        },
        stylesheet_encoding: 'utf-8',
        launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
      }
    );

    const pdfPath = pdf.filename;

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="HMS_Documentation.pdf"');
    
    // Send PDF file
    res.sendFile(pdfPath, (err) => {
      // Delete temp PDF after sending
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      if (err) {
        console.error('Error sending PDF:', err);
      }
    });

  } catch (error) {
    console.error('Documentation PDF generation error:', error);
    res.status(500).json({ 
      message: 'Error generating PDF documentation', 
      error: error.message 
    });
  }
});

export default router;
