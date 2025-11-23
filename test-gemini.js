import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

console.log('\n🔍 Testing Gemini API Connection...\n');
console.log('API Key:', process.env.GEMINI_API_KEY ? 'Found ✅' : 'Missing ❌');

// Try to list available models
async function listModels() {
  try {
    console.log('\n📋 Attempting to list available models...\n');
    
    // Try different model names
    const modelsToTry = [
      'gemini-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'models/gemini-pro',
      'models/gemini-1.5-flash'
    ];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Testing: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello");
        const response = await result.response;
        const text = response.text();
        console.log(`✅ ${modelName} - WORKS! Response: ${text.substring(0, 50)}...\n`);
        break; // Stop after first working model
      } catch (error) {
        console.log(`❌ ${modelName} - ${error.message.substring(0, 100)}\n`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
