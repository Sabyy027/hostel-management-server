import dotenv from 'dotenv';
import { sendPasswordResetEmail } from './utils/email.js';

dotenv.config();

const TEST_EMAIL = "sabeer@giantlabs.in";
const TEST_NAME = "Diagnosis User";
const TEST_TOKEN = "test-reset-token-123";

console.log("--- Email Diagnosis Script (Utility Function) ---");

(async () => {
  try {
    console.log(`Attempting to send password reset email to ${TEST_EMAIL}...`);
    await sendPasswordResetEmail(TEST_EMAIL, TEST_NAME, TEST_TOKEN);
    console.log('✅ Email sent successfully using utility function!');
  } catch (error) {
    console.error('❌ Email failed to send.');
    console.error(error);
    if (error.response) {
      console.error('SendGrid Response Body:', JSON.stringify(error.response.body, null, 2));
    }
  }
})();
