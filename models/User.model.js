import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true }, // Acts as Name
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    
    role: {
      type: String,
      enum: ['student', 'admin', 'warden', 'rt', 'staff'],
      default: 'student',
    },
    
    // --- STAFF DETAILS (for staff/warden/rt) ---
    designation: { type: String, default: null }, // Electrician, Plumber, Carpenter, Cleaner, etc.
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: null },
    age: { type: Number },
    phoneNumber: { type: String },
    altPhoneNumber: { type: String },
    address: { type: String },
    photoUrl: { type: String }, // We'll store a URL string for now
    isFirstLogin: { 
      type: Boolean, 
      default: false 
    },
    // --- PASSWORD RESET ---
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // --- RT FLOOR ASSIGNMENT ---
    assignedFloors: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Floor' 
    }]
    // -------------------------
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;