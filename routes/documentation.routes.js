import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @route   GET /api/documentation/download
// @desc    Download documentation file
// @access  Public
router.get('/download', (req, res) => {
  try {
    const docPath = path.join(__dirname, '../DOCUMENTATION.md');
    
    // Check if file exists
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ message: 'Documentation file not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="HMS_Documentation.md"');
    
    // Send file
    res.sendFile(docPath);
  } catch (error) {
    console.error('Documentation download error:', error);
    res.status(500).json({ message: 'Error downloading documentation', error: error.message });
  }
});

export default router;
