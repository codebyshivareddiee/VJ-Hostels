const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via SMS to parent's mobile number
 * @param {string} parentMobileNumber - Parent's phone number with country code
 * @param {string} otp - 6-digit OTP to send
 * @param {string} studentName - Student's name for personalization
 * @param {string} reason - Reason for outpass
 * @param {Date} outTime - Time student is requesting to go out
 * @returns {Promise<boolean>} - Success or failure
 */
const sendOTPToParent = async (parentMobileNumber, otp, studentName, reason, outTime) => {
    try {
        // Validate and format phone number
        if (!parentMobileNumber) {
            throw new Error('Parent mobile number is required');
        }

        // Remove any spaces, dashes, or parentheses
        let formattedNumber = parentMobileNumber.toString().replace(/[\s\-\(\)]/g, '');

        // Check if number already starts with +
        if (!formattedNumber.startsWith('+')) {
            // If it's a 10-digit Indian number, add +91
            if (formattedNumber.length === 10) {
                formattedNumber = '+91' + formattedNumber;
            } else if (formattedNumber.length === 12 && formattedNumber.startsWith('91')) {
                // If it's 91XXXXXXXXXX, convert to +91XXXXXXXXXX
                formattedNumber = '+' + formattedNumber;
            } else {
                throw new Error(`Invalid phone number format: ${parentMobileNumber}. Expected +country_code format or 10-digit Indian number.`);
            }
        }

        console.log(`📱 Formatted phone number: ${formattedNumber} (Original: ${parentMobileNumber})`);

        // Format the out time for display
        const formattedTime = outTime.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        // Create personalized message
        const message = `VJ Hostels Outpass Verification\n\nDear Parent,\n\nYour ward ${studentName} has requested an outpass.\n\nReason: ${reason}\nOut Time: ${formattedTime}\n\nOTP: ${otp}\n\nThis OTP is valid for 5 minutes. Please do not share this OTP.\n\nVJ Hostels Team`;

        console.log(`📱 Sending OTP to parent: ${formattedNumber}`);
        console.log(`OTP: ${otp}`);

        const sms = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedNumber,
        });

        console.log(`✅ OTP sent successfully! SID: ${sms.sid}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending OTP via SMS:', error);
        throw new Error(`Failed to send OTP: ${error.message}`);
    }
};

/**
 * Send approval notification to admin
 * @param {string} studentName - Student's name
 * @param {string} reason - Reason for outpass
 * @param {Date} outTime - Out time
 * @param {Date} inTime - In time
 * @param {string} type - Outpass type
 * @param {string} adminEmail - Admin email
 */
const sendApprovalNotificationToAdmin = async (studentName, reason, outTime, inTime, type, adminEmail) => {
    try {
        const formattedOutTime = outTime.toLocaleString('en-IN');
        const formattedInTime = inTime.toLocaleString('en-IN');

        const message = `VJ Hostels Parent Approval Notification\n\nDear Admin,\n\nParent of ${studentName} has approved the outpass request.\n\nDetails:\nType: ${type}\nReason: ${reason}\nOut Time: ${formattedOutTime}\nIn Time: ${formattedInTime}\n\nPlease log in to the admin panel to review and approve/reject this request.\n\nVJ Hostels Team`;

        console.log(`📩 Notification for admin approval needed`);
        return true;
    } catch (error) {
        console.error('❌ Error sending notification:', error);
        throw error;
    }
};

/**
 * Verify if OTP matches and is not expired
 * @param {string} providedOTP - OTP entered by parent
 * @param {string} storedOTP - OTP stored in database
 * @param {Date} otpExpiry - OTP expiration time
 * @returns {object} - {valid: boolean, message: string}
 */
const verifyOTP = (providedOTP, storedOTP, otpExpiry) => {
    // Check if OTP has expired
    if (new Date() > otpExpiry) {
        return {
            valid: false,
            message: 'OTP has expired. Please request a new OTP.'
        };
    }

    // Check if OTP matches
    if (providedOTP !== storedOTP) {
        return {
            valid: false,
            message: 'Invalid OTP. Please try again.'
        };
    }

    return {
        valid: true,
        message: 'OTP verified successfully!'
    };
};

/**
 * Check if max OTP attempts have been exceeded
 * @param {number} attempts - Current attempt count
 * @param {number} maxAttempts - Maximum allowed attempts
 * @returns {boolean} - True if max attempts exceeded
 */
const isMaxAttemptsExceeded = (attempts, maxAttempts = 3) => {
    return attempts >= maxAttempts;
};

module.exports = {
    generateOTP,
    sendOTPToParent,
    sendApprovalNotificationToAdmin,
    verifyOTP,
    isMaxAttemptsExceeded
};
