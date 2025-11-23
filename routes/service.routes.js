import express from 'express';
import Service from '../models/Service.model.js';
import StudentService from '../models/StudentService.model.js';
import authMiddleware from '../middleware/auth.middleware.js';
import Invoice from '../models/Invoice.model.js';
import Booking from '../models/Booking.model.js';
import { generateMessPassPDF } from '../utils/messPassGenerator.js';

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
};

// GET ALL SERVICES (Public for students to see)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const services = await Service.find();
    
    // Get User's Active StudentService records
    const userServices = await StudentService.find({
      student: req.user.userId,
      status: 'Active'
    }).populate('service');

    const servicesWithStatus = services.map(svc => {
      // Check if user has purchased this service
      const purchasedService = userServices.find(us => 
        us.service._id.toString() === svc._id.toString()
      );

      let isBought = false;
      let validityText = null;
      let studentServiceId = null;
      let credentials = null;
      let passNumber = null;

      if (purchasedService) {
        const now = new Date();
        
        if (svc.period === 'One-Time') {
          isBought = true;
          validityText = `Purchased: ${new Date(purchasedService.purchaseDate).toLocaleDateString()}`;
        } else if (svc.period === 'Monthly') {
          const expiryDate = new Date(purchasedService.validUntil);
          
          if (expiryDate > now) {
            isBought = true;
            validityText = `Valid until ${expiryDate.toLocaleDateString()}`;
          } else {
            // Service expired - mark as expired
            purchasedService.status = 'Expired';
            purchasedService.save();
          }
        }

        if (isBought) {
          studentServiceId = purchasedService._id;
          credentials = purchasedService.credentials;
          passNumber = purchasedService.passNumber;
        }
      }

      return { 
        ...svc.toObject(), 
        isBought, 
        validityText,
        studentServiceId,
        userCredentials: credentials, // Don't expose template credentials
        passNumber
      };
    });

    res.json(servicesWithStatus);

  } catch (err) {
    console.error("Service Route Error:", err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// CREATE SERVICE (Admin)
router.post('/', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const service = new Service(req.body);
    await service.save();
    res.status(201).json(service);
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// UPDATE SERVICE (Admin) - For updating price, validity, credentials
router.put('/:id', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!service) return res.status(404).json({ message: 'Service not found' });
    
    res.json({ message: 'Service updated successfully', service });
  } catch (err) {
    console.error('Service update error:', err);
    res.status(500).json({ message: 'Error updating service' });
  }
});

// DELETE SERVICE (Admin)
router.delete('/:id', [authMiddleware, adminOnly], async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

router.post('/purchase/:id', authMiddleware, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    // Create an Invoice for this service
    const invoiceId = `SVC-${Date.now()}`;
    
    const newInvoice = new Invoice({
      student: req.user.userId,
      invoiceId: invoiceId,
      items: [{ description: `Service: ${service.name} (${service.period})`, amount: service.price }],
      totalAmount: service.price,
      status: 'Pending', // User must pay this later in "My Bills"
      dueDate: new Date()
    });

    await newInvoice.save();
    res.json({ message: 'Service requested. Please check My Bills to pay.' });

  } catch (err) {
    res.status(500).json({ message: 'Purchase failed' });
  }
});

// DOWNLOAD MESS PASS (Student)
router.get('/download-pass/:studentServiceId', authMiddleware, async (req, res) => {
  try {
    const studentService = await StudentService.findById(req.params.studentServiceId)
      .populate('student', 'username email')
      .populate('service', 'name serviceType');

    if (!studentService) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Security check: Only the owner can download
    if (studentService.student._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only Mess service has passes
    if (studentService.service.serviceType !== 'Mess') {
      return res.status(400).json({ message: 'Only Mess service has downloadable passes' });
    }

    // Get student's room number
    const booking = await Booking.findOne({ 
      student: req.user.userId, 
      status: { $in: ['Active', 'active', 'Pending', 'CheckedIn', 'Paid'] } 
    }).populate('room', 'roomNumber');

    // Generate Mess Pass PDF
    const pdfBuffer = await generateMessPassPDF(
      {
        fullName: studentService.student.username,
        email: studentService.student.email,
        roomNumber: booking?.room?.roomNumber || 'Not Assigned'
      },
      {
        passNumber: studentService.passNumber,
        validFrom: new Date(studentService.validFrom).toLocaleDateString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        validUntil: studentService.validUntil 
          ? new Date(studentService.validUntil).toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          : 'N/A',
        amount: studentService.service.price || 0
      }
    );

    // Send PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Mess_Pass_${studentService.passNumber}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error('Download pass error:', err);
    res.status(500).json({ message: 'Error generating pass' });
  }
});

// INITIALIZE PREDEFINED MESS SERVICE (One-time setup - can be called by admin)
router.post('/init-mess', [authMiddleware, adminOnly], async (req, res) => {
  try {
    // Check if Mess service already exists
    const existingMess = await Service.findOne({ serviceType: 'Mess' });
    
    if (existingMess) {
      return res.json({ message: 'Mess service already exists', service: existingMess });
    }

    // Create predefined Mess service
    const messService = new Service({
      name: 'Hostel Mess',
      description: 'Monthly hostel mess facility with breakfast, lunch, and dinner',
      price: 3000, // Default price - admin can update
      period: 'Monthly',
      serviceType: 'Mess',
      isPredefined: true,
      credentials: null // Mess doesn't need credentials
    });

    await messService.save();
    res.status(201).json({ message: 'Mess service created successfully', service: messService });

  } catch (err) {
    console.error('Init mess error:', err);
    res.status(500).json({ message: 'Error creating mess service' });
  }
});

export default router;