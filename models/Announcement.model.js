import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true 
    },
    content: { 
      type: String, 
      required: true 
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium'
    },
    category: {
      type: String,
      enum: ['General', 'Maintenance', 'Event', 'Rules', 'Emergency'],
      default: 'General'
    },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    expiryDate: { 
      type: Date 
    },
    targetAudience: {
      type: String,
      enum: ['All', 'Students', 'Staff'],
      default: 'All'
    },
    imageUrl: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Index for efficient queries
announcementSchema.index({ isActive: 1, createdAt: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);
export default Announcement;
