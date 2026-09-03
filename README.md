# DRS Quick Serve — Smart Canteen Management System

DRS Quick Serve is a modern, full-stack college canteen ordering and management application designed to eliminate waiting lines and optimize counter pickup times. Built using the MERN stack (MongoDB, Express, React, Node) with real-time tracking (Socket.IO) and sandbox payments (Razorpay API).

---

## 🚀 Features

### For Students
*   **Authentication**: JWT protected registration and logins with password strength meters.
*   **Digital Menu**: Interactive Tamil food menu with Category switches, text searches, and instant quantity controls.
*   **Checkout Options**: Secure payments via cash counter (COD) or online sandbox payments (Razorpay).
*   **Live Order Tracking**: Dynamic vertical progress stepper powered by Socket.IO updates.
*   **Invoicing**: Print-friendly bill receipts with CSS print formatting layout options.
*   **Profile Management**: Update user profile details and change passwords securely.

### For Canteen Admin
*   **Analytics Overview**: Today's sales counters, revenue trend charts (Recharts), and payment distribution graphics.
*   **Real-time Order Feed**: Incoming orders trigger instant audio alerts and flash status indicators without page refreshes.
*   **Inventory Control**: Turn menu items "Available" or "Sold Out" instantly to lock cart checkouts.
*   **Menu & Category Management**: Upload items directly with Cloudinary image attachments, prices, and emojis.
*   **Promotional Coupons**: Setup active Flat or Percentage coupon codes with minimum order limits and expiry dates.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, Axios Client, Socket.IO-Client, Recharts.
*   **Backend**: Node.js, Express.js REST API, JSON Web Token (JWT) sessions, bcryptjs encryption.
*   **Database**: MongoDB Atlas, Mongoose schemas with indexing.
*   **Integrations**: Razorpay Web Sandbox Payment Checkout, Cloudinary API, Multer upload engine.

---

## 📂 Folder Structure

```text
drs-quick-serve/
├── frontend/                   # Frontend React + Vite
│   ├── src/
│   │   ├── components/         # Common layouts, protected route guards
│   │   ├── context/            # AuthContext & CartContext states
│   │   ├── pages/              # Student pages (Home, Menu, Cart, Tracker)
│   │   ├── admin/              # Admin pages (Dashboard, Live Orders, Menu)
│   │   └── services/           # Axios central API configuration
│   └── package.json
│
├── backend/                    # Backend Node + Express API
│   ├── config/                 # DB, Cloudinary, and Razorpay setup
│   ├── controllers/            # Controller business logic
│   ├── models/                 # Mongoose database models
│   ├── routes/                 # Express API endpoints
│   ├── middleware/             # Upload, Error, and Auth verifications
│   ├── scripts/                # Database seed script
│   └── package.json
│
├── package.json                # Concurrently runner scripts
└── README.md
```

---

## ⚙️ Installation & Environment Setup

### 1. Database & Local Setup
Ensure you have [Node.js](https://nodejs.org/) (v16+) and [MongoDB](https://www.mongodb.com/) installed locally, or set up a MongoDB Atlas cluster.

### 2. Environment Variables Configuration
Configure the following variables:

#### Backend configuration (`backend/.env`)
Create a `.env` file inside the `backend/` directory:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/drs_quick_serve
JWT_SECRET=supersecretjwtkeydrsquickserve12345
CLIENT_URL=http://localhost:5173

# Razorpay Keys
RAZORPAY_KEY_ID=rzp_test_SYSh7FU8tidKTo
RAZORPAY_KEY_SECRET=your_razorpay_secret_here

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
```

#### Frontend configuration (`frontend/.env`)
Create a `.env` file inside the `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## ⚡ Running Locally

### 1. Install Dependencies
Run the concurrent script at the root directory:
```bash
npm run install-all
```

### 2. Seed Initial Database
Populate database with categories, the 21 default Tamil menu items, and initial admin/user credentials:
```bash
npm run seed
```

### 3. Run Development Server
Boot both client and server servers simultaneously:
```bash
npm run dev
```
*   **Frontend**: `http://localhost:5173`
*   **Backend Server**: `http://localhost:5000`

---

## 🧑‍🍳 Default Demo Credentials

*   **Canteen Admin**:
    *   Email: `drsce232105@gmail.com`
    *   Password: `drsce@232105`
*   **Student User**:
    *   Email: `sakthivel.june03@gmail.com`
    *   Password: `123456`
