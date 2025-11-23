#!/usr/bin/env node

/**
 * AI Chatbot Setup Verification Script
 * Run this to check if everything is configured correctly
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

console.log('\n🤖 AI Chatbot Setup Verification\n');
console.log('='.repeat(50));

let allChecks = true;

// Check 1: Environment Variables
console.log('\n📋 Checking Environment Variables...');
const geminiKey = process.env.GEMINI_API_KEY;
if (geminiKey) {
  console.log('   ✅ GEMINI_API_KEY: Found');
  console.log(`   📝 Key Preview: ${geminiKey.substring(0, 10)}...${geminiKey.substring(geminiKey.length - 4)}`);
} else {
  console.log('   ❌ GEMINI_API_KEY: Missing in .env file');
  console.log('   💡 Get your key from: https://makersuite.google.com/app/apikey');
  allChecks = false;
}

// Check 2: Knowledge Base File
console.log('\n📚 Checking Knowledge Base...');
const knowledgeBasePath = path.join(__dirname, 'knowledgebase.txt');
if (fs.existsSync(knowledgeBasePath)) {
  const content = fs.readFileSync(knowledgeBasePath, 'utf-8');
  const lines = content.split('\n').length;
  const size = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2);
  
  console.log('   ✅ knowledgebase.txt: Found');
  console.log(`   📊 Lines: ${lines}, Size: ${size} KB`);
  
  // Check for key sections
  if (content.includes('HOSTEL OFFICIAL RULEBOOK')) {
    console.log('   ✅ Rulebook section: Present');
  } else {
    console.log('   ⚠️  Rulebook section: Missing');
  }
  
  if (content.includes('MESS MENU')) {
    console.log('   ✅ Mess Menu section: Present');
  } else {
    console.log('   ⚠️  Mess Menu section: Missing');
  }
} else {
  console.log('   ❌ knowledgebase.txt: Not found');
  console.log(`   📍 Expected location: ${knowledgeBasePath}`);
  allChecks = false;
}

// Check 3: AI Routes File
console.log('\n🛣️  Checking AI Routes...');
const aiRoutesPath = path.join(__dirname, 'routes', 'ai.routes.js');
if (fs.existsSync(aiRoutesPath)) {
  console.log('   ✅ ai.routes.js: Found');
} else {
  console.log('   ❌ ai.routes.js: Not found');
  allChecks = false;
}

// Check 4: Required Packages
console.log('\n📦 Checking Node Packages...');
try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8')
  );
  
  if (packageJson.dependencies['@google/generative-ai']) {
    console.log('   ✅ @google/generative-ai: Installed');
  } else {
    console.log('   ❌ @google/generative-ai: Not installed');
    console.log('   💡 Run: npm install @google/generative-ai');
    allChecks = false;
  }
  
  if (packageJson.dependencies['express']) {
    console.log('   ✅ express: Installed');
  }
} catch (error) {
  console.log('   ❌ package.json: Error reading file');
  allChecks = false;
}

// Check 5: Server Index
console.log('\n🚀 Checking Server Configuration...');
const indexPath = path.join(__dirname, 'index.js');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  
  if (indexContent.includes("import aiRoutes from './routes/ai.routes.js'")) {
    console.log('   ✅ AI routes imported in index.js');
  } else {
    console.log('   ⚠️  AI routes not imported in index.js');
    console.log('   💡 Add: import aiRoutes from \'./routes/ai.routes.js\'');
  }
  
  if (indexContent.includes("app.use('/api/ai', aiRoutes)")) {
    console.log('   ✅ AI routes mounted at /api/ai');
  } else {
    console.log('   ⚠️  AI routes not mounted');
    console.log('   💡 Add: app.use(\'/api/ai\', aiRoutes)');
  }
}

// Final Summary
console.log('\n' + '='.repeat(50));
if (allChecks) {
  console.log('\n✅ All checks passed! Your AI Chatbot is ready to use.');
  console.log('\n🚀 Next Steps:');
  console.log('   1. Start the server: npm run dev');
  console.log('   2. Login as a student');
  console.log('   3. Click the chat icon (bottom-right)');
  console.log('   4. Try asking: "What\'s for dinner today?"');
} else {
  console.log('\n❌ Some checks failed. Please fix the issues above.');
  console.log('\n📖 Refer to AI_CHATBOT_GUIDE.md for detailed setup instructions.');
}

console.log('\n' + '='.repeat(50) + '\n');
