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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/payment', paymentRoutes);


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