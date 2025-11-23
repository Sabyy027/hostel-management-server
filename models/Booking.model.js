import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    // Link to the student (User)
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // A student can only have one active booking
    },
    // Link to the room
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    checkInDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOutDate: {
      type: Date,
      // You could make this required or optional
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'checked-out'],
      default: 'active',
    },
    // This is important: We'll also mark the room as occupied
    // We can handle this logic in the API route
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;