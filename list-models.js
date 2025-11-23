import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

console.log('\n🔍 Listing Available Gemini Models...\n');

async function listModels() {
  try {
    // Try to find a working model
    console.log('🧪 Testing models...\n');
    const modelsToTest = [
      'gemini-pro',
      'gemini-1.5-pro', 
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.0-flash-exp',
      'models/gemini-pro',
      'models/gemini-1.5-flash'
    ];
    
    for (const modelName of modelsToTest) {
      try {
        console.log(`Testing: ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: "Say hi",
        });
        console.log(`✅ ${modelName} WORKS!`);
        console.log(`   Response: ${response.text.substring(0, 50)}...\n`);
        console.log(`\n💡 USE THIS MODEL IN YOUR CODE: "${modelName}"\n`);
        break;
      } catch (error) {
        const shortError = error.message.substring(0, 100);
        console.log(`❌ ${modelName} - ${shortError}...\n`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
