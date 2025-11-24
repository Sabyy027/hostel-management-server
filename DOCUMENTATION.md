# Hostel Management System - Complete Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Admin & Test Credentials](#admin--test-credentials)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Features Overview](#features-overview)
6. [API Endpoints](#api-endpoints)
7. [Testing Instructions](#testing-instructions)
8. [Technology Stack](#technology-stack)

---

## Introduction

Welcome to the **Hostel Management System (HMS)** - A comprehensive solution for managing hostel operations including student bookings, room management, complaints, payments, and AI-powered assistance.

This system is designed to streamline hostel administration and provide students with a seamless experience for managing their accommodation, payments, and daily needs.

---

## System Architecture

### Frontend
- **Framework**: React.js with Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **Routing**: React Router DOM v6
- **Forms**: Formik + Yup validation
- **Icons**: Lucide React
- **AI Chat**: Integrated Gemini AI chatbot

### Backend
- **Framework**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) + bcrypt
- **File Upload**: Multer + Cloudinary
- **Payment Integration**: Razorpay
- **AI Integration**: Google Gemini AI API
- **Email**: Nodemailer

---

## Admin & Test Credentials

### 🔐 Admin/Warden Login
```
Email: admin@hostel.com
Password: admin123
Role: Admin/Warden
```

**Admin Capabilities:**
- Full system access
- Manage blocks, floors, and rooms
- View all residents and occupancy
- Manage staff and assign tasks
- Create announcements
- View financial reports
- Handle complaints and maintenance
- Access analytics dashboard

### 👨‍🏫 Resident Tutor Login
```
Email: rt@hostel.com
Password: rt123
Role: Staff (Resident Tutor)
```

### 🧹 Staff Login
```
Email: staff@hostel.com
Password: staff123
Role: Staff (Maintenance)
```

### 🎓 Student Login
```
Email: student@hostel.com
Password: student123
Role: Student
```

**Student Capabilities:**
- Book hostel rooms
- Make payments
- Raise complaints
- View mess menu
- Check dues
- Update profile
- AI chatbot assistance

---

## User Roles & Permissions

### 1. **Admin/Warden**
- Complete system control
- User management (CRUD operations)
- Property management (blocks, floors, rooms)
- Financial oversight
- Report generation
- Announcement creation
- Staff assignment

### 2. **Resident Tutor (RT)**
- Assigned to specific floors
- Monitor student welfare
- Handle floor-specific queries
- View assigned students
- Update student information

### 3. **Staff**
- Receive maintenance assignments
- Update task status
- View assigned complaints
- Mark tasks as complete

### 4. **Student**
- Self-service portal
- Room booking and payment
- Complaint registration
- Service requests
- Profile management
- AI assistance

---

## Features Overview

### 🏠 Property Management
- **Multi-level Structure**: Blocks → Floors → Rooms
- **Flexible Configuration**: AC/Non-AC rooms
- **Dynamic Pricing**: Multiple pricing plans
- **Capacity Management**: 1-6 person rooms
- **Discount System**: Seasonal offers

### 💳 Payment System
- **Razorpay Integration**: Secure payment gateway
- **Invoice Generation**: Automatic PDF invoices
- **Payment History**: Complete transaction records
- **Dues Tracking**: Pending payment alerts
- **Reminder System**: Automated email reminders

### 🎫 Complaint Management
- **Category-based**: Electrical, Plumbing, Furniture, Cleaning
- **Priority Levels**: Emergency, High, Medium, Low
- **Staff Assignment**: Route to appropriate personnel
- **Status Tracking**: Pending → Assigned → In Progress → Resolved
- **Image Upload**: Visual documentation support

### 📢 Announcements
- **Multi-channel**: Notice board system
- **Priority Marking**: Urgent, High, Medium, Low
- **Target Audience**: All, Students, Staff
- **Image Support**: Visual announcements
- **Expiry Dates**: Auto-hide expired notices

### 🤖 AI Chatbot (HostelBot)
- **24/7 Support**: Always available assistance
- **Context-aware**: Understands hostel-specific queries
- **Multi-lingual**: Natural language processing
- **Quick Actions**: Pre-defined common questions
- **Smart Suggestions**: Role-based assistance

**Sample Queries:**
- "What's on the mess menu today?"
- "Show my pending dues"
- "What are the hostel rules?"
- "Gate timings?"
- "How do I raise a complaint?"

### 🍽️ Services Management
- **Mess Pass**: Digital mess cards
- **WiFi Access**: Credential management
- **Laundry Service**: Booking and tracking
- **Additional Services**: Customizable offerings

---

## API Endpoints

### Authentication
```
POST /api/auth/register - Student registration
POST /api/auth/login - User login
GET /api/auth/me - Get current user
```

### Rooms & Booking
```
GET /api/rooms/structure - Get hostel structure
POST /api/rooms/add - Add new room (Admin)
GET /api/rooms/available - Get available rooms
POST /api/booking/create - Create booking
```

### Payments
```
POST /api/payment/checkout - Initialize payment
POST /api/payment/verify - Verify payment
GET /api/payment/invoice/:id - Download invoice
GET /api/resident/my-invoices - Get user invoices
```

### Complaints
```
POST /api/query/raise - Raise complaint
GET /api/query/my-tickets - Get user tickets
PUT /api/query/assign/:id - Assign to staff (Admin)
PATCH /api/query/status/:id - Update status
```

### AI Chat
```
POST /api/ai/chat - Send message to AI
```

### Announcements
```
GET /api/announcements - Get all announcements
POST /api/announcements - Create announcement (Admin)
DELETE /api/announcements/:id - Delete announcement
```

---

## Testing Instructions

### 🚀 Quick Start Guide

#### 1. **Initial Setup**
```bash
# Clone repository
git clone <repository-url>

# Install dependencies
cd hostel-management
npm install

# Start backend server
cd server
npm start

# Start frontend (new terminal)
cd client
npm run dev
```

#### 2. **Database Setup**
- Ensure MongoDB is running
- Connection string in `.env` file
- Initial data will be seeded on first run

#### 3. **Environment Variables**
Create `.env` files in both client and server directories:

**Server `.env`:**
```env
MONGODB_URI=mongodb://localhost:27017/hostel_db
JWT_SECRET=your_secret_key
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_gemini_api_key
```

#### 4. **Testing Workflow**

**A. Admin Flow:**
1. Login with admin credentials
2. Navigate to Hostel Manager
3. Create a new block/property
4. Add floors and rooms
5. View occupancy dashboard
6. Create test announcement
7. Assign staff to complaints

**B. Student Flow:**
1. Register new student account
2. Complete profile
3. Browse available rooms
4. Book a room and make payment
5. Raise a test complaint
6. Chat with AI bot
7. View payment history

**C. Payment Testing:**
- Use Razorpay test mode
- Test card: 4111 1111 1111 1111
- CVV: Any 3 digits
- Expiry: Any future date

#### 5. **AI Chatbot Testing**
- Click chatbot button (bottom right)
- Try sample queries:
  - "What's the mess menu?"
  - "Show my dues"
  - "Hostel rules"
  - "Gate timings"

---

## Technology Stack

### Frontend Technologies
- **React 18.3+**: Component-based UI
- **Tailwind CSS**: Utility-first styling
- **React Router v6**: Client-side routing
- **Formik**: Form management
- **Yup**: Schema validation
- **Axios**: HTTP client
- **Lucide React**: Icon library
- **Recharts**: Data visualization

### Backend Technologies
- **Express.js**: Web framework
- **MongoDB**: NoSQL database
- **Mongoose**: ODM
- **JWT**: Authentication
- **Bcrypt**: Password hashing
- **Multer**: File upload
- **Cloudinary**: Cloud storage
- **Nodemailer**: Email service
- **Razorpay**: Payment gateway
- **Google Gemini AI**: Chatbot

### Development Tools
- **Vite**: Build tool
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Git**: Version control
- **Postman**: API testing

---

## Additional Features

### 📊 Analytics & Reports
- Occupancy trends
- Revenue analysis
- Complaint statistics
- Student demographics
- Payment reports

### 🔔 Notification System
- Real-time updates
- Email notifications
- In-app alerts
- Payment reminders

### 📱 Responsive Design
- Mobile-first approach
- Tablet optimization
- Desktop enhancement
- Cross-browser compatibility

### 🔒 Security Features
- JWT authentication
- Password encryption
- Role-based access control
- Input validation
- XSS protection
- CORS configuration

---

## Support & Contact

For any queries or issues:
- **Documentation**: This file
- **AI Assistant**: Use HostelBot for instant help
- **Email Support**: admin@hostel.com

---

## License & Credits

**Developed by**: GUVI Capstone Project
**Framework**: MERN Stack
**AI Integration**: Google Gemini AI
**Version**: 1.0.0
**Last Updated**: November 2025

---

## Notes for Testers/Reviewers

1. **System Requirements**: Node.js 16+, MongoDB 5+
2. **Browser Support**: Chrome, Firefox, Safari, Edge (latest versions)
3. **Network**: Internet required for payment gateway and AI features
4. **Credentials**: Use provided test credentials above
5. **Data Reset**: Contact admin to reset test data if needed

**Thank you for testing the Hostel Management System!** 🎉
