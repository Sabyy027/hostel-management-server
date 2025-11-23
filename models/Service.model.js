import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Premium Wifi"
  description: { type: String },
  price: { type: Number, required: true },
  period: { type: String, enum: ['One-Time', 'Monthly'], default: 'One-Time' },
  
  // Credentials field for services like WiFi (ID/Password)
  credentials: { type: String },
  
  // Flag for predefined services like Mess
  isPredefined: { type: Boolean, default: false },
  
  // Service type for special handling (Mess gets a pass)
  serviceType: { type: String, enum: ['General', 'Mess', 'WiFi'], default: 'General' }
});

const Service = mongoose.model('Service', serviceSchema);
export default Service;