import mongoose from 'mongoose';

const floorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Floor'
    },
    number: {
      type: Number,
      required: true,
      min: 0, // 0 for Ground Floor
    },
    // This links the Floor to its parent Block
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
      required: true,
    },
    // Optional details you can add
    type: { 
      type: String, 
      enum: ['AC', 'Non-AC'], 
      default: 'Non-AC' 
    },
    commonToilets: { type: Number, default: 2 }
  },
  { timestamps: true }
);

// Prevent duplicate floor numbers in the same block
floorSchema.index({ block: 1, number: 1 }, { unique: true });

const Floor = mongoose.model('Floor', floorSchema);
export default Floor;