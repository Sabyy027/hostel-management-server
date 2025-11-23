import mongoose from 'mongoose';

// Sub-schema for a pricing plan
const pricingPlanSchema = new mongoose.Schema({
  duration: { type: Number, required: true }, // e.g., 1, 3, 6, 12
  unit: { type: String, enum: ['months', 'year'], default: 'months' },
  price: { type: Number, required: true } // Total price for this duration
}, { _id: true }); // Keep _id so we can select a specific plan

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, trim: true },
    floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
    capacity: { type: Number, required: true, enum: [1, 2, 3, 4, 5] },
    type: { type: String, required: true, enum: ['AC', 'Non-AC'] },
    bathroomType: { type: String, required: true, enum: ['Attached', 'Common'] },
    
    // --- NEW PRICING STRUCTURE ---
    // Replaces 'pricePerYear'
    pricingPlans: [pricingPlanSchema], 
    // -----------------------------

    isStaffRoom: { type: Boolean, default: false },
    staffRole: { type: String, enum: ['RT', 'Warden', 'Other', null], default: null },
    otherStaffDetails: { type: String, trim: true, default: '' },
    
    isOccupied: { type: Boolean, default: false },
    occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    activeDiscount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discount',
      default: null
    },
  },
  { timestamps: true }
);

roomSchema.index({ floor: 1, roomNumber: 1 }, { unique: true });
const Room = mongoose.model('Room', roomSchema);
export default Room;