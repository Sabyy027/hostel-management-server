import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Link to a booking if applicable
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },

    // Invoice ID for reference
    invoiceId: { type: String },

    // Items array for services (optional for room bookings)
    items: [{
      description: { type: String },
      amount: { type: Number }
    }],

    totalAmount: { type: Number, required: true },
    
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Overdue'],
      default: 'Pending'
    },

    // Payment Date (for reporting)
    paidAt: Date,
    
    // Due Date (for pending payments)
    dueDate: Date,
  },
  { timestamps: true }
);

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;