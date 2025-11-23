import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, trim: true },
    
    // --- THIS IS THE KEY CHANGE ---
    // Links this Room to its parent Floor
    floor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      required: true,
    },
    // ----------------------------

    capacity: { type: Number, required: true, enum: [1, 2, 3, 4, 5] },
    type: { type: String, required: true, enum: ['AC', 'Non-AC'] },
    pricePerYear: { type: Number, required: true },
    
    isStaffRoom: { type: Boolean, default: false },
    staffRole: { type: String, enum: ['RT', 'Warden', 'Other', null], default: null },
    otherStaffDetails: { type: String, trim: true, default: '' },
    
    isOccupied: { type: Boolean, default: false },
    occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    bathroomType: { 
      type: String, 
      required: true, 
      enum: ['Attached', 'Common'] 
    },
  },
  { timestamps: true }
);

// Prevent duplicate room numbers on the same floor
roomSchema.index({ floor: 1, roomNumber: 1 }, { unique: true });

const Room = mongoose.model('Room', roomSchema);
export default Room;