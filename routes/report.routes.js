import express from 'express';
import Booking from '../models/Booking.model.js';
import Room from '../models/Room.model.js';
import Invoice from '../models/Invoice.model.js';
import Expense from '../models/Expense.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
};

// Middleware for Admin, Warden, and RT
const managerOnly = (req, res, next) => {
  const isAdmin = req.user.role === 'admin';
  const isWarden = req.user.role === 'warden';
  const isRT = req.user.role === 'rt';
  
  if (!isAdmin && !isWarden && !isRT) {
    return res.status(403).json({ message: 'Access denied. Managers only.' });
  }
  next();
};

// Download PDF Report
router.post('/download-report', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    // Fetch transactions and expenses within date range
    const transactions = await Invoice.find({
      status: 'Paid',
      paidAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).populate('student', 'name email');

    const expenses = await Expense.find({
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });

    // Calculate totals
    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    // Import PDFDocument
    const PDFDocument = (await import('pdfkit')).default;
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Financial-Report-${startDate}-to-${endDate}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Financial Report', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary Section
    doc.fontSize(14).font('Helvetica-Bold').text('Financial Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Revenue: ₹${totalRevenue.toLocaleString()}`);
    doc.text(`Total Expenses: ₹${totalExpenses.toLocaleString()}`);
    doc.text(`Net Profit: ₹${netProfit.toLocaleString()}`, { 
      color: netProfit >= 0 ? '#10b981' : '#ef4444' 
    });
    doc.moveDown(2);

    // Transactions Section
    doc.fontSize(14).font('Helvetica-Bold').text('Revenue Transactions');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    transactions.forEach((t, index) => {
      doc.text(`${index + 1}. ${t.invoiceId} - ${t.student?.name || 'N/A'} - ₹${t.totalAmount} - ${new Date(t.paidAt).toLocaleDateString()}`);
    });
    
    if (transactions.length === 0) {
      doc.text('No transactions found');
    }
    
    doc.moveDown(2);

    // Expenses Section
    doc.fontSize(14).font('Helvetica-Bold').text('Expenses');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    expenses.forEach((e, index) => {
      doc.text(`${index + 1}. ${e.category} - ${e.description} - ₹${e.amount} - ${new Date(e.date).toLocaleDateString()}`);
    });
    
    if (expenses.length === 0) {
      doc.text('No expenses found');
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

router.get('/dashboard-stats', [authMiddleware, managerOnly], async (req, res) => {
  try {
    // 1. Occupancy Stats (Bed-Based Calculation)
    const rooms = await Room.find({ isStaffRoom: false }); // Exclude staff rooms
    
    // Calculate total bed capacity (sum of all room capacities)
    const totalBeds = rooms.reduce((sum, room) => sum + room.capacity, 0);
    
    // Calculate occupied beds (sum of all occupants across rooms)
    const occupiedBeds = rooms.reduce((sum, room) => sum + room.occupants.length, 0);
    
    const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : 0;

    // 2. INCOME AGGREGATION (By Month)
    const incomeData = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } }, total: { $sum: "$totalAmount" } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 3. EXPENSE AGGREGATION (By Month)
    const expenseData = await Expense.aggregate([
      { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" } }, total: { $sum: "$amount" } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 4. EXPENSE BREAKDOWN (By Category) - For Pie Chart
    const expenseByCategory = await Expense.aggregate([
      { $group: { _id: "$category", value: { $sum: "$amount" } } }
    ]);

    // 5. Merge Data for "Profit/Loss" Chart
    // We need a list of months (e.g., "Jan 2025", "Feb 2025") containing both Income and Expense
    const chartData = [];
    const allMonths = new Set([
        ...incomeData.map(i => `${i._id.year}-${i._id.month}`),
        ...expenseData.map(e => `${e._id.year}-${e._id.month}`)
    ]);

    allMonths.forEach(key => {
        const [year, month] = key.split('-').map(Number);
        const inc = incomeData.find(i => i._id.year === year && i._id.month === month)?.total || 0;
        const exp = expenseData.find(e => e._id.year === year && e._id.month === month)?.total || 0;
        
        chartData.push({
            name: new Date(year, month - 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
            Income: inc,
            Expense: exp,
            Profit: inc - exp // Net Profit
        });
    });

    // Sort chronologically (simple sort based on string won't work perfectly for years, but fine for MVP)
    chartData.sort((a, b) => new Date(a.name) - new Date(b.name));

    // Calculate Grand Totals
    const totalRevenue = incomeData.reduce((acc, curr) => acc + curr.total, 0);
    const totalExpenses = expenseData.reduce((acc, curr) => acc + curr.total, 0);
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      occupancy: { rate: occupancyRate, occupied: occupiedBeds, total: totalBeds },
      financials: { totalRevenue, totalExpenses, netProfit },
      chartData,
      expensePie: expenseByCategory.map(e => ({ name: e._id, value: e.value }))
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating reports' });
  }
});

export default router;