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
const roomSyncService = require('./services/roomSyncService');
const roomChangeStreamWatcher = require('./services/roomChangeStreamWatcher');

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
    // Allow custom headers used by frontend (x-access-role etc.) plus common CORS headers
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-access-role', 'x-requested-with'],
    exposedHeaders: ['set-cookie', 'Access-Control-Allow-Origin'], // Expose cookies and origin info to frontend
}));

// Also add a simple OPTIONS handler to respond to preflight requests and echo allowed headers
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-access-role, x-requested-with');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(204);
});

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
    .then(async () => {
        console.log("MongoDB connection successful!");
        
        // ✅ AUTO-SYNC: Sync all rooms on server startup
        // This ensures rooms are always in sync, even after direct DB changes
        try {
            console.log('🔄 Running room sync on server startup...');
            const syncResult = await roomSyncService.syncStudentsToRooms();
            console.log(`✅ Startup sync complete: ${syncResult.roomsUpdated} rooms updated, ${syncResult.studentsProcessed} students processed`);
        } catch (syncError) {
            console.error('⚠️  Warning: Failed to sync rooms on startup:', syncError);
            // Don't crash server if sync fails
        }
        
        // ✅ REAL-TIME SYNC: Start MongoDB Change Stream watcher
        // This watches the Student collection and automatically syncs rooms on ANY database change
        // Works for: API changes, MongoDB Compass edits, bulk imports, etc.
        try {
            console.log('🚀 Starting real-time room sync watcher...');
            roomChangeStreamWatcher.startRoomChangeStreamWatcher();
            console.log('✅ Real-time sync active - rooms will sync automatically on any student data change!');
        } catch (watcherError) {
            console.error('⚠️  Warning: Failed to start change stream watcher:', watcherError);
            console.log('💡 Falling back to scheduled sync only');
        }
        
        // ✅ SCHEDULED SYNC: Run daily at 2 AM as backup (in case change stream fails)
        try {
            const { scheduleRoomSync } = require('./jobs/roomSyncScheduler');
            scheduleRoomSync();
        } catch (scheduleError) {
            console.error('⚠️  Warning: Failed to schedule room sync job:', scheduleError);
        }
            
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

// SMS endpoint - MUST be before static file serve
const twilio = require('twilio');

// Validate credentials before creating client
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  console.error('❌ CRITICAL: Twilio credentials are not configured!');
  console.error('Missing:');
  if (!process.env.TWILIO_ACCOUNT_SID) console.error('  - TWILIO_ACCOUNT_SID');
  if (!process.env.TWILIO_AUTH_TOKEN) console.error('  - TWILIO_AUTH_TOKEN');
  if (!process.env.TWILIO_PHONE_NUMBER) console.error('  - TWILIO_PHONE_NUMBER');
  console.error('Please add these to your server/.env file');
}

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.post('/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;

    // Validate input
    if (!to || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: to and message' 
      });
    }

    // Validate Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      console.error('❌ Twilio credentials not configured at request time');
      return res.status(500).json({ 
        success: false, 
        error: 'Twilio credentials not configured. Please check server environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER' 
      });
    }

    // Log the attempt (without exposing full credentials)
    console.log(`📱 SMS Request:`);
    console.log(`  To: ${to}`);
    console.log(`  From: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log(`  Message length: ${message.length} characters`);
    console.log(`  Using Account: ${process.env.TWILIO_ACCOUNT_SID.substring(0, 5)}...`);

    // Send SMS
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });

    console.log(`✅ SMS sent successfully!`);
    console.log(`  SID: ${sms.sid}`);
    console.log(`  Status: ${sms.status}`);
    
    res.status(200).json({ success: true, sid: sms.sid });
  } catch (error) {
    console.error('❌ Twilio SMS Error:');
    console.error('Error Type:', error.constructor.name);
    console.error('Status Code:', error.status);
    console.error('Error Code:', error.code);
    console.error('Message:', error.message);
    console.error('Full Error:', error);
    
    // Provide helpful error messages based on error code
    let userFriendlyError = 'Failed to send SMS';
    
    if (error.code === 20003) {
      userFriendlyError = 'Authentication failed: Invalid Twilio credentials. Please verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in server/.env';
    } else if (error.code === 21211) {
      userFriendlyError = 'Invalid phone number format. Please use format like +919876543210';
    } else if (error.code === 21603) {
      userFriendlyError = 'Invalid phone number. Please verify the phone number is correct.';
    } else if (error.code === 21606) {
      userFriendlyError = 'Account not authorized to send SMS to this number. For trial accounts, verify the number in Twilio Console.';
    } else if (error.code === 21609) {
      userFriendlyError = 'Insufficient credits. Please check your Twilio account balance.';
    }
    
    res.status(error.status || 500).json({ 
      success: false, 
      error: userFriendlyError,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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

// Graceful shutdown - Close change stream when server stops
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    try {
        // Stop change stream watcher
        await roomChangeStreamWatcher.stopRoomChangeStreamWatcher();
        
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
        
        // Close HTTP server
        server.close(() => {
            console.log('✅ HTTP server closed');
            process.exit(0);
        });
        
        // Force close after 10 seconds
        setTimeout(() => {
            console.error('⚠️  Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    
    try {
        await roomChangeStreamWatcher.stopRoomChangeStreamWatcher();
        await mongoose.connection.close();
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

