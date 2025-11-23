import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    
    // Financials
    totalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending'
    },

    // Lifecycle Status
    status: {
      type: String,
      // --- FIX: ADDED 'Pending' TO THIS LIST ---
      enum: ['Pending', 'Active', 'CheckedIn', 'CheckedOut', 'Cancelled'], 
      default: 'Pending',
    },

    // Dates & Details
    checkInDate: Date, 
    checkOutDate: Date,
    academicYear: { type: String, default: '2025-2026' },
    duration: String, // To store "6 months" or "1 year"

    // Resident Details (from registration form)
    residentDetails: {
      fullName: String,
      dob: Date,
      gender: { type: String, enum: ['Male', 'Female', 'Other'] },
      mobileNumber: String,
      altPhone: String,
      address: String,
      street: String,
      city: String,
      state: String,
      pincode: String
    }
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;