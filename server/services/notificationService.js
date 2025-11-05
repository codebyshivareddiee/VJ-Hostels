const admin = require('firebase-admin');
const twilio = require('twilio');
const AuditLog = require('../models/AuditLogModel');

class NotificationService {
  constructor() {
    this.initializeFirebase();
    this.initializeTwilio();
  }

  initializeFirebase() {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        this.fcmEnabled = true;
        console.log('Firebase Admin initialized successfully');
      } else {
        console.log('Firebase service account not configured, FCM disabled');
        this.fcmEnabled = false;
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
      this.fcmEnabled = false;
    }
  }

  initializeTwilio() {
    try {
      if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
        this.twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
        this.twilioEnabled = true;
        console.log('Twilio initialized successfully');
      } else {
        console.log('Twilio credentials not configured, SMS disabled');
        this.twilioEnabled = false;
      }
    } catch (error) {
      console.error('Twilio initialization error:', error);
      this.twilioEnabled = false;
    }
  }

  async sendOTPNotification(student, otp, visitorName, purpose) {
    const message = `Visitor OTP Request: ${visitorName} wants to visit you. Purpose: ${purpose}. OTP: ${otp}. Valid for 5 minutes.`;
    
    let fcmSent = false;
    let smsSent = false;

    // Try FCM first
    if (this.fcmEnabled && student.fcmToken) {
      try {
        await this.sendFCMNotification(student.fcmToken, {
          title: 'Visitor OTP Request',
          body: `${visitorName} wants to visit you`,
          data: {
            type: 'otp_request',
            otp: otp,
            visitorName,
            purpose,
            studentId: student._id.toString()
          }
        });
        fcmSent = true;
        console.log(`FCM notification sent to student ${student._id}`);
      } catch (error) {
        console.error('FCM notification failed:', error);
      }
    }

    // Fallback to SMS if FCM failed or not available
    if (!fcmSent) {
      const phoneNumbers = [student.phoneNumber];
      
      // Add backup contacts if primary fails
      if (student.backupContacts && student.backupContacts.length > 0) {
        phoneNumbers.push(...student.backupContacts.map(contact => contact.phone));
      }

      for (const phone of phoneNumbers) {
        if (phone && this.twilioEnabled) {
          try {
            await this.sendSMS(phone, message);
            smsSent = true;
            console.log(`SMS sent to ${phone}`);
            break; // Stop after first successful SMS
          } catch (error) {
            console.error(`SMS failed to ${phone}:`, error);
          }
        }
      }
    }

    // Log notification attempt
    await this.logNotificationAttempt(student._id, 'otp_request', {
      fcmSent,
      smsSent,
      visitorName,
      purpose
    });

    return { fcmSent, smsSent };
  }

  async sendFCMNotification(token, payload) {
    if (!this.fcmEnabled) {
      throw new Error('FCM not enabled');
    }

    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: payload.data || {}
    };

    return admin.messaging().send(message);
  }

  async sendSMS(to, message) {
    if (!this.twilioEnabled) {
      throw new Error('Twilio not enabled');
    }

    return this.twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM,
      to: to
    });
  }

  async sendOverrideNotification(warden, overrideRequest) {
    const message = `Override Request: Guard ${overrideRequest.guardId} requests approval for visitor ${overrideRequest.visitor.name} to visit student. Reason: ${overrideRequest.reason}`;
    
    if (this.fcmEnabled && warden.fcmToken) {
      try {
        await this.sendFCMNotification(warden.fcmToken, {
          title: 'Override Request',
          body: `New visitor override request`,
          data: {
            type: 'override_request',
            requestId: overrideRequest._id.toString(),
            guardId: overrideRequest.guardId.toString(),
            visitorName: overrideRequest.visitor.name
          }
        });
      } catch (error) {
        console.error('Override FCM notification failed:', error);
      }
    }

    if (warden.phone && this.twilioEnabled) {
      try {
        await this.sendSMS(warden.phone, message);
      } catch (error) {
        console.error('Override SMS notification failed:', error);
      }
    }
  }

  async sendMenuChangeAlert(date, mealType, oldValue, newValue) {
    try {
      const dateStr = new Date(date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const message = `🔔 Menu Update Alert!\n\nDate: ${dateStr}\nMeal: ${mealType.toUpperCase()}\n\nOld Menu: ${oldValue || 'Not set'}\nNew Menu: ${newValue}\n\nThis is an emergency change by the vendor. We apologize for any inconvenience.`;
      
      const title = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Menu Changed for ${dateStr}`;
      
      // Send FCM notification to all students (you'll need to fetch student tokens)
      console.log('[MENU CHANGE NOTIFICATION]');
      console.log(`Date: ${dateStr}`);
      console.log(`Meal Type: ${mealType}`);
      console.log(`Old Value: ${oldValue || 'Not set'}`);
      console.log(`New Value: ${newValue}`);
      console.log('Notification should be sent to all students');
      
      // TODO: Implement bulk notification to all active students
      // This would require fetching all student FCM tokens and sending in batches
      // For now, logging the notification
      
      await this.logNotificationAttempt('system', 'menu_change', {
        date: date,
        mealType,
        oldValue,
        newValue,
        changeTime: new Date()
      });
      
      return { success: true, message: 'Menu change notification logged' };
    } catch (error) {
      console.error('Failed to send menu change alert:', error);
      return { success: false, error: error.message };
    }
  }

  async logNotificationAttempt(studentId, type, meta) {
    try {
      await AuditLog.create({
        action: 'notification_sent',
        actorId: studentId,
        actorType: 'system',
        targetId: studentId,
        targetType: 'student',
        meta: {
          notificationType: type,
          ...meta
        }
      });
    } catch (error) {
      console.error('Failed to log notification attempt:', error);
    }
  }
}

module.exports = new NotificationService();
