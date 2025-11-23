import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Merit Scholarship"
  description: { type: String },
  
  // How much to cut?
  type: { type: String, enum: ['Percentage', 'Fixed'], required: true }, // 10% vs ₹500
  value: { type: Number, required: true }, // 10 or 500
  
  // What does this apply to?
  targetCategory: { 
    type: String, 
    enum: ['Room', 'Fine', 'Service', 'All'], 
    required: true 
  },
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Discount = mongoose.model('Discount', discountSchema);
export default Discount;