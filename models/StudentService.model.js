import mongoose from 'mongoose';

const studentServiceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    
    // Purchase details
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    purchaseDate: { type: Date, default: Date.now },
    
    // Validity tracking
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    
    // Service credentials (WiFi ID/Pass, Mess Pass ID, etc.)
    credentials: { type: String },
    
    // Status
    status: { type: String, enum: ['Active', 'Expired', 'Cancelled'], default: 'Active' },
    
    // For Mess Pass - unique pass number
    passNumber: { type: String }
  },
  { timestamps: true }
);

// Generate unique pass number for Mess services
studentServiceSchema.pre('save', function(next) {
  if (!this.passNumber && this.isNew) {
    this.passNumber = `PASS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  next();
});

const StudentService = mongoose.model('StudentService', studentServiceSchema);
export default StudentService;
