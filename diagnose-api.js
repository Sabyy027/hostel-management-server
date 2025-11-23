import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

console.log('\n🔑 Gemini API Key Diagnosis\n');
console.log('=' .repeat(50));
console.log(`\nAPI Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 4) : 'NOT FOUND'}`);
console.log(`Length: ${API_KEY?.length || 0} characters`);

// Test API key by listing models
async function testApiKey() {
  if (!API_KEY) {
    console.log('\n❌ No API key found in .env file');
    return;
  }

  console.log('\n📡 Testing API connection...\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Key is valid!\n');
      console.log('📋 Available models:\n');
      
      if (data.models && data.models.length > 0) {
        data.models.forEach(model => {
          console.log(`   - ${model.name}`);
          if (model.supportedGenerationMethods?.includes('generateContent')) {
            console.log('     ✅ Supports generateContent');
          }
        });
        
        // Find the recommended model
        const recommendedModel = data.models.find(m => 
          m.supportedGenerationMethods?.includes('generateContent')
        );
        
        if (recommendedModel) {
          console.log(`\n💡 Recommended model: ${recommendedModel.name}`);
          console.log(`   Use this in your code: "${recommendedModel.name.replace('models/', '')}"`);
        }
      } else {
        console.log('⚠️  No models available');
      }
    } else {
      const error = await response.text();
      console.log(`❌ API Key Error: ${response.status} ${response.statusText}`);
      console.log(`Details: ${error.substring(0, 200)}`);
      
      if (response.status === 400) {
        console.log('\n💡 Possible issues:');
        console.log('   1. API key is invalid or expired');
        console.log('   2. API key needs to be regenerated');
        console.log('   3. Gemini API is not enabled for this key');
        console.log('\n🔧 Solutions:');
        console.log('   1. Visit: https://makersuite.google.com/app/apikey');
        console.log('   2. Generate a new API key');
        console.log('   3. Replace GEMINI_API_KEY in .env file');
      }
    }
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
  }
}

testApiKey();
