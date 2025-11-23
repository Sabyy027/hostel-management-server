import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g. "January Electricity Bill"
    category: { 
      type: String, 
      enum: ['Utilities', 'Staff Wages', 'Mess/Food', 'Internet', 'Maintenance', 'Other'],
      required: true 
    },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String },
    receiptUrl: { type: String } // Optional: For storing bill image later
  },
  { timestamps: true }
);

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;