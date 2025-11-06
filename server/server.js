const exp = require('express');
const app = exp();
const http = require('http');
const server = http.createServer(app);
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const Message = require('./models/MessageModel');
const passport = require('passport');
const session = require('express-session');
require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const securityRoutes = require('./routes/securityRoutes');

const adminApp = require('./APIs/adminAPI');
const studentApp = require('./APIs/studentAPI');
const messageApp = require('./APIs/messageAPI');
const foodApp = require('./APIs/foodAPI');
const adminVisitorApp = require('./APIs/adminVisitorAPI');
const outpassApp = require('./APIs/outpassAPI');
const otpRoutes = require('./routes/otpRoutes');
// const complaintApp = require('./APIs/complaintAPI');

// Import SEO configuration
const { setupSEOMiddleware } = require('./config/seoConfig');

// middleware
// Apply SEO middleware (compression, security headers, etc.)
setupSEOMiddleware(app);

// CORS Configuration - Allow frontend origin with credentials support
app.use(cors({
  origin: [
    'http://localhost:5173',  // Default Vite port
    'http://localhost:5174',  // Alternative Vite port
    'http://localhost:3101',  // Previous frontend port
    'http://localhost:3201',  // Current frontend port (React on 3201)
    'https://dev-hostel.vjstartup.com', // Production domain
  ],
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed request headers
  exposedHeaders: ['set-cookie'], // Expose cookies to frontend
}));

// body parser middleware
app.use(exp.json());

// Serve static files from uploads directory
app.use('/uploads', exp.static('uploads'));

app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());


// Api connection - Define routes before Socket.IO initialization
app.use('/student-api', studentApp);
app.use('/admin-api', adminApp);
app.use('/message-api', messageApp);
app.use('/food-api', foodApp);
app.use('/api/admin/visitors', adminVisitorApp);
app.use('/outpass-api', outpassApp);
app.use('/api/otp', otpRoutes);
app.use('/security-api', securityRoutes);
// app.use('/complaint-api',complaintApp);
app.use('/auth', authRoutes);

const port = process.env.PORT || 4000;

// Initialize Socket.IO after routes are defined
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"]
    }
});

// Make io available to routes
app.set('io', io);

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Log all connected clients
    const connectedClients = io.sockets.adapter.rooms.get('community')?.size || 0;
    console.log(`Total connected clients in community room: ${connectedClients}`);

    // Join community room
    socket.join('community');
    console.log(`Socket ${socket.id} joined community room`);

    // Handle new message
    socket.on('sendMessage', async (messageData) => {
        try {
            console.log(`Received message from ${socket.id}:`, messageData);

            // Create new message in database
            const newMessage = new Message(messageData);
            await newMessage.save();
            console.log(`Message saved to database with ID: ${newMessage._id}`);

            // Broadcast message to all clients in the room
            io.to('community').emit('newMessage', newMessage);
            console.log('Message broadcasted to community room');
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Handle image upload in message
    socket.on('sendImageMessage', async (messageData) => {
        try {
            console.log(`Received image message from ${socket.id}`);

            // Create new message with image in database
            const newMessage = new Message(messageData);
            await newMessage.save();
            console.log(`Image message saved to database with ID: ${newMessage._id}`);

            // Broadcast message to all clients in the room
            io.to('community').emit('newMessage', newMessage);
            console.log('Image message broadcasted to community room');
        } catch (error) {
            console.error('Error saving image message:', error);
        }
    });

    // Log all events for debugging
    socket.onAny((event, ...args) => {
        console.log(`Socket ${socket.id} event: ${event}`, args);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
        const remainingClients = io.sockets.adapter.rooms.get('community')?.size || 0;
        console.log(`Remaining clients in community room: ${remainingClients}`);
    });
});

// DB connection
console.log("Attempting to connect to MongoDB...");

// Start the server without waiting for MongoDB connection
server.listen(port, () => {
    console.log(`Server listening on port ${port}...`);

    // Try to connect to MongoDB after server is started
    mongoose.connect(process.env.DBURL)
    .then(() => {
        console.log("MongoDB connection successful!");
            // Start scheduled jobs that depend on DB
            // try {
            //     const { scheduleDailyCleanup } = require('./jobs/foodPauseCleanup');
            //     scheduleDailyCleanup();
            //     console.log('Scheduled food pause cleanup job started');
            // } catch (err) {
            //     console.error('Failed to start scheduled jobs:', err);
            // }
    })
    .catch(err => {
        console.error("Error in DB connection:", err);
        console.log("Server will continue running, but database features will not work.");
    });
});

// Fallback route to handle undefined API routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: 'API route not found'
    });
  }
  next();
});

// Serve SEO files (robots.txt, sitemap.xml, manifest.json)
const seoConfig = require('./config/seoConfig');
seoConfig.setupSEOFiles(app);

// Serve frontend for all other routes
const path = require('path');
app.use(exp.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// error handler
app.use((err,req,res,next)=>{
    console.log("err object in express error handler :",err)
    res.send({message:err.message})
})