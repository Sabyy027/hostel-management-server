import mongoose from 'mongoose';
import 'dotenv/config';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...'.cyan.underline);
  } catch (err) {
    console.error(`Error: ${err.message}`.red.bold);
    process.exit(1); 
  }
};

export default connectDB;