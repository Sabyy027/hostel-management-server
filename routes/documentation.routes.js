import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @route   GET /api/documentation/download
// @desc    Download documentation PDF file
// @access  Public
router.get('/download', (req, res) => {
  try {
    const pdfPath = path.join(__dirname, '../DOCUMENTATION.pdf');
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'Documentation PDF not found' });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="HMS_Documentation.pdf"');
    
    // Send PDF file
    res.sendFile(pdfPath);
  } catch (error) {
    console.error('Documentation download error:', error);
    res.status(500).json({ 
      message: 'Error downloading documentation', 
      error: error.message 
    });
  }
});

export default router;
