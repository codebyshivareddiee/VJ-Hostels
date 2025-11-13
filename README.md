# Hostel Management System

A comprehensive web-based solution for managing hostel operations, including student management, room allocation, outpass management, complaint handling, and community features.

## Project Overview

The Hostel Management System consists of three main components:

1. **Admin Client**: A web application for hostel administrators to manage all aspects of the hostel
2. **Student Client**: A web application for students to access hostel services
3. **Server**: A backend API server that handles data processing, storage, and business logic

## Features

### Admin Portal Features

- **Authentication**: Secure admin login system
- **Dashboard**: Overview of key statistics and recent activities
- **Student Management**: 
  - Register, view, and deactivate student accounts
  - View student details including parent mobile number
  - Search and filter students by branch, name, room number, phone number, and roll number
- **Room Management**:
  - View room occupancy and vacant beds by room type
  - Automatic room allocation for new students
  - Manual room reassignment capabilities
  - Room vacancy transfers
- **Outpass Management**: 
  - Approve or reject student outpass requests
  - View parent contact information during approval
- **Complaints Management**: View and resolve student complaints
- **Announcements**: Create and manage announcements for students
- **Community Management**: 
  - Monitor student community posts
  - Real-time chat with students
  - Admin messages highlighted with admin tag
- **Food Management**:
  - Visualize student feedback
  - Manage food menu
- **Attendance Management**: Real-time attendance marking and statistics

### Student Portal Features

- **Authentication**: Secure student login system
- **Profile Management**: 
  - View and edit personal details
  - Change password
  - Upload profile photo
- **Room Information**: View assigned room details
- **Outpass Requests**: Submit and track outpass requests
- **Complaints**: Submit and track complaints
- **Announcements**: View hostel announcements
- **Community Features**:
  - Create and view community posts
  - Real-time chat with image sharing
  - View admin and student messages with profile images
- **Food Services**:
  - View food menu
  - Submit food reviews
- **Attendance Calendar**: View monthly attendance with color-coded status

### Security Portal Features

- **Authentication**: Secure security guard login
- **Attendance Marking**: Room-wise and floor-wise attendance with time-window restrictions

## Room Allocation System

The hostel has 12 floors with specific allocation rules:

- Each room should have students of the same year
- Each floor should have students of the same year only
- Floor allocation by year:
  - Floors 1-2: 1st year students
  - Floors 3-5: 3rd year students
  - Floors 6-9: 4th year students
  - Floors 10-12: 2nd year students
- Room numbering follows the pattern:
  - First floor: 101-139
  - Second floor: 201-239
  - And so on up to 12th floor: 1201-1239
- Rooms on 10th, 11th, and 12th floors follow a different pattern:
  - 10th floor: 1001, 1011, 1021, 1031, etc.
  - 11th floor: 1101, 1111, 1121, 1131, etc.
  - 12th floor: 1201, 1211, 1221, 1231, etc.
- Room capacity varies:
  - Rooms ending with 36: 2-sharing
  - Rooms ending with 37: 3-sharing
  - Rooms ending with 38: 3-sharing
  - Rooms ending with 39: 2-sharing

## Attendance System

The system includes an optimized monthly attendance tracking module with real-time marking capabilities for security guards and interactive calendar views for students. Features include time-window based marking (9 PM - 4 AM), automatic monthly record creation, and pre-computed statistics for instant reporting.

## Technology Stack

### Frontend (Admin & Student Clients)
- React 19
- React Router 6
- Bootstrap 5
- Axios for API requests
- React Hook Form for form handling
- Socket.IO Client for real-time communication

### Backend (Server)
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Socket.IO for real-time communication
- Multer for file uploads
- Bcrypt for password hashing

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local or cloud instance)

### Installation

#### Server Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=4000
   DBURL=mongodb://localhost:27017/hostel-management
   JWT_SECRET=your_jwt_secret
   CLOUD_NAME=your_cloudinary_name
   CLOUD_API_KEY=your_cloudinary_api_key
   CLOUD_API_SECRET=your_cloudinary_api_secret
   ```

4. Start the server:
   ```bash
   node server.js
   ```

#### Admin Client Setup
1. Navigate to the admin-client directory:
   ```bash
   cd admin-client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

#### Student Client Setup
1. Navigate to the student-client directory:
   ```bash
   cd student-client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Real-Time Chat Feature

The system includes a real-time chat feature using Socket.IO:

- Real-time messaging between students and administrators
- Image sharing in messages
- Admin messages highlighted with an admin tag
- Student messages display student name and profile image
- Message history persistence

## Data Generation

For testing purposes, the system can generate male student test data:
- Emails follow the pattern: [year]071a[random]@vnrvjiet.in (e.g., 23071a6685@vnrvjiet.in for 2nd year)
- Students are distributed across branches: CSE, CSE-AIML, CSE-DS, CSE-CYS, AIDS, MECH, EEE, ECE, CIVIL, AE, IT, CSBS
- Default password: 1234
- Rooms are automatically updated with allocated students

## Project Structure

### Admin Client
- `src/components`: Reusable UI components
- `src/context`: Context providers for state management
- `src/layouts`: Page layout components
- `src/pages`: Main page components
- `src/App.jsx`: Main application component with routing
- `src/main.jsx`: Application entry point

### Student Client
- Similar structure to Admin Client

### Server
- `APIs`: API route handlers
- `config`: Configuration files
- `middleware`: Express middleware
- `models`: Mongoose data models
- `uploads`: File upload storage

## License

This project is licensed under the MIT License - see the LICENSE file for details.
