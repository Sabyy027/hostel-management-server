import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import roomRoutes from './routes/room.routes.js';
import profileRoutes from './routes/profile.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import blockRoutes from './routes/block.routes.js';
import floorRoutes from './routes/floor.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import userRoutes from './routes/user.routes.js';
import queryRoutes from './routes/query.routes.js';
import reportRoutes from './routes/report.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import residentRoutes from './routes/resident.routes.js';
import serviceRoutes from './routes/service.routes.js';
import billingRoutes from './routes/billing.routes.js';
import discountRoutes from './routes/discount.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import announcementRoutes from './routes/announcement.routes.js';
import aiRoutes from './routes/ai.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:5173', // Local React development
    'http://localhost:3000', // Alternative local development port
    'https://hostel-management-system-ai.netlify.app', // Netlify production URL
    process.env.FRONTEND_URL // Environment variable fallback
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resident', residentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/billing', billingRoutes)
app.use('/api/discounts', discountRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/ai', aiRoutes);



app.get('/', (req, res) => {
  res.status(200).json({ message: 'Hostel Management API is running!' });
});


const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('Error: MONGO_URI is not defined in your .env file');
  process.exit(1); 
}

const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully.');
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1); 
  }
};

connectDB();