import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // Block names must be unique
      trim: true,
      uppercase: true, // Force "a" to become "A"
    },
    
    type: {
      type: String,
      enum: ['Boys', 'Girls', 'Co-ed'],
      default: 'Boys'
    }
  },
  { timestamps: true }
);

const Block = mongoose.model('Block', blockSchema);
export default Block;