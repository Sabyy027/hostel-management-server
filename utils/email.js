import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// 1. Load environment variables
dotenv.config(); 

// Frontend URL for email links
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Debug: Check if variables are loaded (Will print to terminal)
console.log("Email User:", process.env.EMAIL_USER ? "Loaded" : "MISSING");
console.log("Email Pass:", process.env.EMAIL_PASS ? "Loaded" : "MISSING");
console.log("Frontend URL:", FRONTEND_URL);

// 2. Create Transporter (Updated for STARTTLS)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,              // <--- CHANGE THIS (Was 465)
  secure: false,          // <--- CHANGE THIS (Was true). False means use STARTTLS.
  requireTLS: true,       // <--- ADD THIS to force security
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendStaffCredentials = async (email, name, password) => {
  const mailOptions = {
    from: `"Hostel Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to HMS - Your Staff Login Credentials',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2>Welcome, ${name}!</h2>
        <p>You have been registered as a staff member.</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Login ID:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>
        <p style="color: red;">Please login and change your password immediately.</p>
        <p>Regards,<br/>Hostel Administration</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent: ${info.messageId}`);
  } catch (error) {
    console.error("❌ Email failed:", error.message);
  }
};

export const sendRegistrationAcknowledgement = async (email, name) => {
  const mailOptions = {
    from: `"Hostel Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Registration Successful - Welcome to HMS',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2>Welcome, ${name}!</h2>
        <p>Your staff registration has been completed successfully.</p>
        <p>You can now log in to the Hostel Management System using your email and password.</p>
        <p>If you have any questions, please contact the administration.</p>
        <p>Regards,<br/>Hostel Administration</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Registration acknowledgement sent: ${info.messageId}`);
  } catch (error) {
    console.error("❌ Email failed:", error.message);
  }
};

export const sendBookingConfirmation = async (email, name, pdfBuffer) => {
  const mailOptions = {
    from: `"Hostel Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Booking Confirmation - Hostel Management System',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2>Dear ${name},</h2>
        <p>Your hostel booking has been confirmed successfully!</p>
        <p>Please find your invoice attached to this email.</p>
        <p>If you have any questions, please contact the hostel administration.</p>
        <p>We look forward to welcoming you!</p>
        <p>Regards,<br/>Hostel Administration</p>
      </div>
    `,
    attachments: [
      {
        filename: 'invoice.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Booking confirmation sent: ${info.messageId}`);
  } catch (error) {
    console.error("❌ Email failed:", error.message);
    throw error; // Re-throw to handle in the route
  }
};

export const sendDueReminder = async (email, name, amount) => {
  const mailOptions = {
    from: `"Hostel Accounts" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Payment Reminder - Outstanding Dues',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #d97706;">Payment Reminder</h2>
        <p>Dear ${name},</p>
        <p>This is a friendly reminder that you have outstanding dues of <strong>₹${amount}</strong>.</p>
        <p>Please log in to your portal and clear the dues to avoid late fees.</p>
        <br/>
        <a href="${FRONTEND_URL}/login" style="background: #d97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a>
        <br/><br/>
        <p>Regards,<br/>Hostel Administration</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Reminder sent to ${email}`);
  } catch (error) {
    console.error("❌ Email failed:", error.message);
  }
};

// --- MAINTENANCE TICKET EMAILS ---

export const sendTicketCreatedEmail = async (email, name, ticketDetails) => {
  const { title, category, priority, ticketId } = ticketDetails;
  
  const priorityColors = {
    'Emergency': '#dc2626',
    'High': '#ea580c',
    'Medium': '#d97706',
    'Low': '#65a30d'
  };

  const mailOptions = {
    from: `"Hostel Maintenance" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Maintenance Ticket Created - ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #3b82f6;">Maintenance Ticket Submitted</h2>
        <p>Dear ${name},</p>
        <p>Your maintenance request has been received and will be addressed shortly.</p>
        
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${priorityColors[priority] || '#6b7280'};">
          <p style="margin: 5px 0;"><strong>Ticket ID:</strong> ${ticketId}</p>
          <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
          <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color: ${priorityColors[priority]}; font-weight: bold;">${priority}</span></p>
        </div>
        
        <p>You will receive updates via email and in-app notifications as your request progresses.</p>
        <p>Thank you for your patience!</p>
        <br/>
        <p>Regards,<br/>Hostel Maintenance Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Ticket created email sent to ${email}`);
  } catch (error) {
    console.error("❌ Ticket email failed:", error.message);
  }
};

export const sendTicketStatusUpdateEmail = async (email, name, ticketDetails) => {
  const { title, status, ticketId, assignedStaff } = ticketDetails;
  
  const statusColors = {
    'Assigned': '#3b82f6',
    'In Progress': '#f59e0b',
    'Resolved': '#10b981',
    'Pending': '#6b7280'
  };

  const statusMessages = {
    'Assigned': 'has been assigned to our maintenance staff',
    'In Progress': 'is currently being worked on',
    'Resolved': 'has been successfully resolved',
    'Pending': 'is awaiting review'
  };

  const mailOptions = {
    from: `"Hostel Maintenance" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Ticket Update: ${title} - ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: ${statusColors[status]};">Ticket Status Updated</h2>
        <p>Dear ${name},</p>
        <p>Your maintenance ticket <strong>${statusMessages[status] || 'has been updated'}</strong>.</p>
        
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColors[status]};">
          <p style="margin: 5px 0;"><strong>Ticket ID:</strong> ${ticketId}</p>
          <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColors[status]}; font-weight: bold;">${status}</span></p>
          ${assignedStaff ? `<p style="margin: 5px 0;"><strong>Assigned To:</strong> ${assignedStaff}</p>` : ''}
        </div>
        
        ${status === 'Resolved' 
          ? '<p style="color: #10b981; font-weight: bold;">✓ Your issue has been resolved. Thank you for your patience!</p>' 
          : '<p>We will keep you updated on any further progress.</p>'
        }
        
        <br/>
        <a href="${FRONTEND_URL}/student/complaints" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Ticket</a>
        <br/><br/>
        <p>Regards,<br/>Hostel Maintenance Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Status update email sent to ${email}`);
  } catch (error) {
    console.error("❌ Status update email failed:", error.message);
  }
};

export const sendTicketAssignedToStaffEmail = async (email, staffName, ticketDetails) => {
  const { title, category, priority, description, roomNumber, studentName } = ticketDetails;
  
  const priorityColors = {
    'Emergency': '#dc2626',
    'High': '#ea580c',
    'Medium': '#d97706',
    'Low': '#65a30d'
  };

  const mailOptions = {
    from: `"Hostel Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `New Ticket Assigned - ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #3b82f6;">New Maintenance Ticket Assigned</h2>
        <p>Dear ${staffName},</p>
        <p>A new maintenance ticket has been assigned to you.</p>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${priorityColors[priority]};">
          <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
          <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="color: ${priorityColors[priority]}; font-weight: bold;">${priority}</span></p>
          <p style="margin: 5px 0;"><strong>Room:</strong> ${roomNumber}</p>
          <p style="margin: 5px 0;"><strong>Student:</strong> ${studentName}</p>
          <p style="margin: 10px 0 5px 0;"><strong>Description:</strong></p>
          <p style="margin: 5px 0; padding: 10px; background: white; border-radius: 4px;">${description}</p>
        </div>
        
        <p>Please log in to the system to update the ticket status.</p>
        <br/>
        <a href="${FRONTEND_URL}/login" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Ticket</a>
        <br/><br/>
        <p>Regards,<br/>Hostel Administration</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Assignment email sent to ${email}`);
  } catch (error) {
    console.error("❌ Assignment email failed:", error.message);
  }
};

// --- SERVICE & FINE EMAILS ---

export const sendServicePurchaseEmail = async (email, name, serviceDetails, pdfAttachment = null, attachmentName = null) => {
  const { serviceName, price, period, validUntil, invoiceId, credentials, serviceType } = serviceDetails;
  
  // Build credentials section if provided
  let credentialsHtml = '';
  if (credentials) {
    credentialsHtml = `
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 5px 0; color: #92400e;"><strong>🔑 Service Credentials:</strong></p>
        <pre style="background: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; margin: 10px 0;">${credentials}</pre>
        <p style="margin: 5px 0; font-size: 11px; color: #78350f;">Keep these credentials safe and do not share with others.</p>
      </div>
    `;
  }

  // Special message for Mess service
  let specialMessage = '';
  if (serviceType === 'Mess') {
    specialMessage = `
      <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
        <p style="margin: 5px 0; color: #1e40af;"><strong>📋 Mess Pass Attached</strong></p>
        <p style="margin: 5px 0; color: #1e3a8a;">Your mess pass has been attached to this email. Please download and save it for entry to the mess facility.</p>
      </div>
    `;
  }

  const attachments = [];
  if (pdfAttachment) {
    attachments.push({
      filename: attachmentName || 'Mess_Pass.pdf',
      content: pdfAttachment,
      contentType: 'application/pdf'
    });
  }

  const mailOptions = {
    from: `"Hostel Services" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Service Activated - ${serviceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #10b981;">✓ Service Activated Successfully</h2>
        <p>Dear ${name},</p>
        <p>Your service purchase has been confirmed and activated.</p>
        
        <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
          <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ₹${price}</p>
          <p style="margin: 5px 0;"><strong>Period:</strong> ${period}</p>
          ${validUntil ? `<p style="margin: 5px 0;"><strong>Valid Until:</strong> ${validUntil}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Invoice ID:</strong> ${invoiceId}</p>
        </div>
        
        ${credentialsHtml}
        ${specialMessage}
        
        <p style="color: #10b981; font-weight: bold;">✓ Your service is now active and ready to use!</p>
        
        <br/>
        <a href="${FRONTEND_URL}/student/services" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View My Services</a>
        <br/><br/>
        <p>Regards,<br/>Hostel Services Team</p>
      </div>
    `,
    attachments: attachments
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Service purchase email sent to ${email}`);
  } catch (error) {
    console.error("❌ Service email failed:", error.message);
  }
};

export const sendFineNotificationEmail = async (email, name, fineDetails) => {
  const { description, amount, dueDate, invoiceId } = fineDetails;
  
  const mailOptions = {
    from: `"Hostel Accounts" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Fine Issued - Payment Required`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #dc2626;">⚠️ Fine Issued</h2>
        <p>Dear ${name},</p>
        <p>A fine has been issued to your account and requires payment.</p>
        
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 5px 0;"><strong>Reason:</strong> ${description}</p>
          <p style="margin: 5px 0;"><strong>Amount:</strong> <span style="color: #dc2626; font-size: 18px; font-weight: bold;">₹${amount}</span></p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>
          <p style="margin: 5px 0;"><strong>Invoice ID:</strong> ${invoiceId}</p>
        </div>
        
        <p style="color: #dc2626;">Please clear this fine before the due date to avoid additional charges.</p>
        
        <p>You can pay this fine online through your student portal.</p>
        <br/>
        <a href="${FRONTEND_URL}/student/dues" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a>
        <br/><br/>
        <p>For any queries, please contact the hostel administration.</p>
        <br/>
        <p>Regards,<br/>Hostel Accounts</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Fine notification sent to ${email}`);
  } catch (error) {
    console.error("❌ Fine email failed:", error.message);
  }
};

export const sendFinePaymentConfirmationEmail = async (email, name, paymentDetails) => {
  const { description, amount, invoiceId, paidAt } = paymentDetails;
  
  const mailOptions = {
    from: `"Hostel Accounts" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Payment Received - ${description}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #10b981;">✓ Payment Received</h2>
        <p>Dear ${name},</p>
        <p>Thank you! Your payment has been successfully processed.</p>
        
        <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>
          <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ₹${amount}</p>
          <p style="margin: 5px 0;"><strong>Invoice ID:</strong> ${invoiceId}</p>
          <p style="margin: 5px 0;"><strong>Paid On:</strong> ${paidAt}</p>
        </div>
        
        <p style="color: #10b981; font-weight: bold;">✓ Your account has been cleared.</p>
        
        <p>An invoice receipt has been attached to this email for your records.</p>
        <br/>
        <a href="${FRONTEND_URL}/student/payment-history" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Payment History</a>
        <br/><br/>
        <p>Regards,<br/>Hostel Accounts</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment confirmation sent to ${email}`);
  } catch (error) {
    console.error("❌ Payment confirmation email failed:", error.message);
  }
};

// --- PASSWORD RESET EMAILS ---

export const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;
  
  const mailOptions = {
    from: `"HMS Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request - HMS',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #3b82f6;">Password Reset Request</h2>
        <p>Dear ${name},</p>
        <p>We received a request to reset your password for your HMS account.</p>
        
        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 5px 0;">Click the button below to reset your password:</p>
          <br/>
          <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        
        <p style="color: #dc2626; font-size: 14px;">⚠️ This link will expire in 1 hour.</p>
        
        <p style="font-size: 14px; color: #6b7280;">If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
        
        <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #3b82f6; word-break: break-all;">${resetUrl}</p>
        
        <br/>
        <p>Regards,<br/>HMS Support Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error("❌ Password reset email failed:", error.message);
    throw error;
  }
};

export const sendPasswordChangedConfirmationEmail = async (email, name) => {
  const mailOptions = {
    from: `"HMS Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Changed Successfully - HMS',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #10b981;">✓ Password Changed Successfully</h2>
        <p>Dear ${name},</p>
        <p>Your password has been changed successfully.</p>
        
        <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0;">✓ Your account is now secure with your new password.</p>
          <p style="margin: 5px 0;">✓ You can now log in with your new credentials.</p>
        </div>
        
        <p style="color: #dc2626; font-size: 14px;">⚠️ If you didn't make this change, please contact support immediately.</p>
        
        <br/>
        <a href="${FRONTEND_URL}/login" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Log In Now</a>
        <br/><br/>
        <p>Regards,<br/>HMS Support Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password change confirmation sent to ${email}`);
  } catch (error) {
    console.error("❌ Password confirmation email failed:", error.message);
  }
};
