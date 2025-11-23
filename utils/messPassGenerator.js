import PDFDocument from 'pdfkit';

export const generateMessPassPDF = async (studentData, passDetails) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      // Collect PDF chunks
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // --- HEADER ---
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#10b981').text('MESS PASS', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(14).fillColor('#6b7280').text('Hostel Mess Services', { align: 'center' });
      
      // Decorative line
      doc.moveTo(50, doc.y + 20).lineTo(545, doc.y + 20).strokeColor('#10b981').lineWidth(2).stroke();
      doc.moveDown(2);

      // --- PASS NUMBER (Large, centered) ---
      doc.fontSize(16).fillColor('#374151').font('Helvetica-Bold').text('Pass Number', { align: 'center' });
      doc.fontSize(24).fillColor('#10b981').text(passDetails.passNumber, { align: 'center' });
      doc.moveDown(2);

      // --- STUDENT DETAILS BOX ---
      const boxTop = doc.y;
      doc.roundedRect(50, boxTop, 495, 180, 10).fillAndStroke('#f0fdf4', '#10b981');
      
      doc.fillColor('#374151').fontSize(12).font('Helvetica-Bold');
      
      // Student Info
      let currentY = boxTop + 20;
      doc.text('Student Name:', 70, currentY);
      doc.font('Helvetica').text(studentData.fullName, 250, currentY);
      
      currentY += 25;
      doc.font('Helvetica-Bold').text('Email:', 70, currentY);
      doc.font('Helvetica').text(studentData.email, 250, currentY);
      
      currentY += 25;
      doc.font('Helvetica-Bold').text('Room Number:', 70, currentY);
      doc.font('Helvetica').text(studentData.roomNumber || 'N/A', 250, currentY);
      
      currentY += 25;
      doc.font('Helvetica-Bold').text('Valid From:', 70, currentY);
      doc.font('Helvetica').text(passDetails.validFrom, 250, currentY);
      
      currentY += 25;
      doc.font('Helvetica-Bold').text('Valid Until:', 70, currentY);
      doc.font('Helvetica').fillColor('#dc2626').text(passDetails.validUntil, 250, currentY);
      
      currentY += 25;
      doc.font('Helvetica-Bold').fillColor('#374151').text('Amount Paid:', 70, currentY);
      doc.font('Helvetica').fillColor('#10b981').text(`₹${passDetails.amount}`, 250, currentY);

      doc.moveDown(4);

      // --- BARCODE PLACEHOLDER (Visual representation) ---
      doc.fontSize(10).fillColor('#6b7280').text('Scan this pass at the mess entrance', { align: 'center' });
      doc.moveDown(0.5);
      
      // Simple barcode-like visual
      const barcodeY = doc.y;
      const barcodeWidth = 300;
      const barcodeX = (doc.page.width - barcodeWidth) / 2;
      
      doc.rect(barcodeX, barcodeY, barcodeWidth, 60).fillAndStroke('#000000', '#000000');
      doc.fontSize(8).fillColor('#ffffff').text(passDetails.passNumber, barcodeX, barcodeY + 22, {
        width: barcodeWidth,
        align: 'center'
      });

      doc.moveDown(3);

      // --- TERMS & CONDITIONS ---
      doc.fontSize(10).fillColor('#374151').font('Helvetica-Bold').text('Terms & Conditions:', 50);
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280');
      doc.list([
        'This pass is valid only for the duration mentioned above.',
        'Pass must be presented at the mess entrance for every meal.',
        'Non-transferable - valid only for the registered student.',
        'Report immediately if lost or stolen.',
        'No refunds after purchase.',
        'Management reserves the right to revoke the pass for policy violations.'
      ], 50, doc.y);

      doc.moveDown(2);

      // --- FOOTER ---
      doc.fontSize(8).fillColor('#9ca3af').text(
        `Generated on: ${new Date().toLocaleString('en-IN')}`,
        { align: 'center' }
      );
      doc.text('For queries, contact hostel administration', { align: 'center' });

      // Finalize
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};
