import PDFDocument from 'pdfkit';

export const generateInvoicePDF = (invoiceData, studentData, roomData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // --- HEADER ---
    doc.fontSize(20).text('HOSTEL MANAGEMENT SYSTEM', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(roomData ? 'Room Booking Receipt' : 'Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.text('------------------------------------------------------------------');
    doc.moveDown();

    // --- BILL TO SECTION ---
    doc.fontSize(10);
    doc.text(`Invoice ID: ${invoiceData.invoiceId}`, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    
    doc.text(`BILL TO:`, { underline: true });
    
    // SAFETY CHECKS HERE: Use defaults if data is missing
    const name = studentData.fullName || studentData.username || 'Valued Resident';
    const email = studentData.email || '';
    const phone = studentData.mobileNumber || studentData.phone || '';
    const addr = studentData.address || {}; 

    doc.text(`Name: ${name}`);
    doc.text(`Email: ${email}`);
    if (phone) doc.text(`Mobile: ${phone}`);
    
    // Only try to print address if it actually exists
    if (addr.street || addr.city) {
        doc.text(`Address: ${addr.street || ''}, ${addr.city || ''}`);
        doc.text(`${addr.state || ''} - ${addr.pincode || addr.zipCode || ''}`);
    }
    doc.moveDown();

    // --- BOOKING DETAILS (Conditional) ---
    // Only show this section if it is a Room Booking (roomData exists)
    if (roomData) {
        doc.text(`BOOKING DETAILS:`, { underline: true });
        doc.text(`Room Number: ${roomData.roomNumber}`);
        doc.text(`Type: ${roomData.type} (${roomData.capacity} Sharing)`);
        if(invoiceData.checkInDate) {
            doc.text(`Check-in Date: ${new Date(invoiceData.checkInDate).toLocaleDateString()}`);
        }
        doc.moveDown();
    }

    // --- TABLE LAYOUT ---
    const tableTop = 350;
    const itemCodeX = 50;
    const descriptionX = 100;
    const priceX = 400;

    doc.font('Helvetica-Bold');
    doc.text('Item', itemCodeX, tableTop);
    doc.text('Description', descriptionX, tableTop);
    doc.text('Amount (INR)', priceX, tableTop);
    doc.font('Helvetica');
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Row 1
    doc.text('1', itemCodeX, tableTop + 30);
    
    // Dynamic Description based on transaction type
    const desc = roomData 
        ? `Hostel Fee (${invoiceData.duration})` 
        : invoiceData.description || 'Add-on Service';

    doc.text(desc, descriptionX, tableTop + 30);
    doc.text(invoiceData.amount.toFixed(2), priceX, tableTop + 30);

    // --- TOTALS ---
    doc.moveTo(50, tableTop + 50).lineTo(550, tableTop + 50).stroke();
    
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Total Paid:`, 300, tableTop + 70);
    doc.text(`Rs. ${invoiceData.amount.toFixed(2)}`, priceX, tableTop + 70);
    
    doc.fontSize(10).font('Helvetica');
    doc.text('Payment Method: Razorpay (Verified)', 300, tableTop + 90);

    // --- FOOTER ---
    doc.text('This is a computer-generated invoice.', 50, 700, { align: 'center' });

    doc.end();
  });
};