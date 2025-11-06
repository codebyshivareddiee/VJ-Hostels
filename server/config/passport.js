const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Student = require('../models/StudentModel.js');
const Admin = require('../models/AdminModel.js');
const Guard = require('../models/GuardModel.js');

// Get authorized emails from environment
const ADMIN_EMAILS = process.env.ADMIN_EMAIL 
    ? process.env.ADMIN_EMAIL.split(',').map(email => email.trim()) 
    : [];
const SECURITY_EMAILS = process.env.SECURITY_EMAIL 
    ? process.env.SECURITY_EMAIL.split(',').map(email => email.trim()) 
    : [];
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'vnrvjiet.in';

// Helper to check if email is institutional
function isInstitutionalEmail(email) {
    return typeof email === 'string' && email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

// Helper to check if email is an admin email
function isAdminEmail(email) {
    return ADMIN_EMAILS.some(adminEmail => 
        adminEmail.toLowerCase() === email.toLowerCase()
    );
}

// Helper to check if email is a security email
function isSecurityEmail(email) {
    return SECURITY_EMAILS.some(securityEmail => 
        securityEmail.toLowerCase() === email.toLowerCase()
    );
}

// Helper to extract roll number from email
function extractRollNumber(email) {
    if (!email) return null;
    const match = email.match(/^([^@]+)@/);
    // Return the extracted roll number as-is (we'll do case-insensitive matching in DB query)
    return match ? match[1] : null;
}

// Unified Google OAuth Strategy
passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL}/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        console.log('🔐 Google OAuth callback - Email:', email);

        // Check if email matches any Admin email
        if (isAdminEmail(email)) {
            console.log('✅ Admin email detected:', email);
            
            // Try to find admin by email, googleId, or username
            let admin = await Admin.findOne({ 
                $or: [
                    { email: email },
                    { googleId: profile.id },
                    { username: profile.displayName }
                ]
            });
            
            if (!admin) {
                // Create new admin with unique username (email prefix + timestamp to ensure uniqueness)
                const uniqueUsername = `${email.split('@')[0]}_${Date.now()}`;
                admin = await Admin.create({
                    googleId: profile.id,
                    username: uniqueUsername,
                    name: profile.displayName,
                    email: email,
                    role: 'admin',
                });
                console.log('✨ New admin created:', admin._id);
            } else {
                // Update existing admin with Google OAuth details
                let updated = false;
                if (!admin.googleId) {
                    admin.googleId = profile.id;
                    updated = true;
                }
                if (admin.email !== email) {
                    admin.email = email;
                    updated = true;
                }
                if (updated) {
                    await admin.save();
                    console.log('🔄 Admin updated with Google OAuth details');
                }
            }
            
            return done(null, { ...admin.toObject(), role: 'admin' });
        }

        // Check if email matches Security
        if (isSecurityEmail(email)) {
            console.log('✅ Security email detected:', email);
            
            // Try to find guard by email or googleId
            let guard = await Guard.findOne({ 
                $or: [
                    { email: email },
                    { googleId: profile.id }
                ]
            });
            
            if (!guard) {
                guard = await Guard.create({
                    googleId: profile.id,
                    name: profile.displayName,
                    email: email,
                    role: 'security',
                    phoneNumber: 'N/A',
                    shift: 'day',
                    isActive: true,
                });
                console.log('✨ New security guard created:', guard._id);
            } else {
                // Update existing guard with Google OAuth details
                let updated = false;
                if (!guard.googleId) {
                    guard.googleId = profile.id;
                    updated = true;
                }
                if (guard.email !== email) {
                    guard.email = email;
                    updated = true;
                }
                if (updated) {
                    await guard.save();
                    console.log('🔄 Guard updated with Google OAuth details');
                }
            }
            
            return done(null, { ...guard.toObject(), role: 'security' });
        }

        // Check if email is institutional (student)
        if (isInstitutionalEmail(email)) {
            console.log('🎓 Student institutional email detected:', email);
            const rollNumber = extractRollNumber(email);
            console.log('📝 Extracted roll number:', rollNumber);

            // Check if student exists in database by roll number (case-insensitive)
            let student = await Student.findOne({ 
                rollNumber: { $regex: new RegExp(`^${rollNumber}$`, 'i') }
            });
            
            if (!student) {
                console.warn('❌ Student with roll number not found in database:', rollNumber);
                console.warn('💡 Hint: Make sure the roll number exists in the Student collection');
                return done(null, false, { 
                    message: 'Please use your official hostel email to log in. Contact admin if you believe this is an error.' 
                });
            }

            console.log('✅ Student found in database:', {
                id: student._id,
                rollNumber: student.rollNumber,
                email: student.email,
                name: student.name
            });

            // Update student with Google OAuth details if not already set
            if (!student.googleId) {
                student.googleId = profile.id;
                student.email = email;
                await student.save();
                console.log('🔄 Student updated with Google OAuth details');
            }

            console.log('✅ Student authenticated successfully:', student._id);
            return done(null, { ...student.toObject(), role: 'student' });
        }

        // Email doesn't match any authorized pattern
        console.warn('❌ Unauthorized email attempted login:', email);
        return done(null, false, { 
            message: 'Unauthorized email. Please use your official institutional email or contact administrator.' 
        });

    } catch (err) {
        console.error('❌ Google OAuth error:', err);
        return done(err, null);
    }
}));


passport.serializeUser((user, done) => {
  done(null, { id: user.id, role: user.role || 'student' }); 
});

passport.deserializeUser(async (data, done) => {
  try {
    let user;
    if (data.role === 'admin') {
      user = await Admin.findById(data.id);
    } else if (data.role === 'security') {
      user = await Guard.findById(data.id);
    } else {
      user = await Student.findById(data.id);
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
