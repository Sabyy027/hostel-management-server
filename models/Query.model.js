import mongoose from 'mongoose';

const querySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    
    category: { type: String, required: true }, // e.g. Electrical, Plumbing, etc.
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Emergency'], default: 'Medium' },
    
    // --- ASSIGNMENT FIELD ---
    assignedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', // Link to Staff User
      default: null 
    },
    
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'],
      default: 'Pending'
    },
    
    // --- IMAGE ATTACHMENT ---
    imageUrl: {
      type: String,
      default: null
    },
    
    adminComment: String,
    resolvedDate: Date
  },
  { timestamps: true }
);

const Query = mongoose.model('Query', querySchema);
export default Query;