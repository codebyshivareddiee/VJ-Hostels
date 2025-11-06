import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Google Analytics 4 Component
 * 
 * Setup Instructions:
 * 1. Get your GA4 Measurement ID from Google Analytics
 * 2. Replace 'G-XXXXXXXXXX' with your actual Measurement ID
 * 3. Add this component to your App.jsx
 * 
 * @param {string} measurementId - Your GA4 Measurement ID (e.g., 'G-XXXXXXXXXX')
 */
const GoogleAnalytics = ({ measurementId = 'G-XXXXXXXXXX' }) => {
  const location = useLocation();

  useEffect(() => {
    // Initialize GA4 script
    if (!window.gtag) {
      // Load Google Analytics script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);

      // Initialize dataLayer and gtag function
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', measurementId, {
        page_path: location.pathname + location.search,
        send_page_view: true
      });
    }
  }, [measurementId]);

  // Track page views on route change
  useEffect(() => {
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_title: document.title,
        page_location: window.location.href
      });
    }
  }, [location]);

  return null;
};

/**
 * Track custom events
 * 
 * @param {string} eventName - Name of the event
 * @param {Object} eventParams - Event parameters
 * 
 * @example
 * trackEvent('login', { method: 'google' });
 * trackEvent('outpass_submitted', { status: 'pending' });
 */
export const trackEvent = (eventName, eventParams = {}) => {
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  } else {
    console.warn('Google Analytics not initialized');
  }
};

/**
 * Track user actions
 * 
 * @param {string} category - Event category
 * @param {string} action - Event action
 * @param {string} label - Event label (optional)
 * @param {number} value - Event value (optional)
 * 
 * @example
 * trackUserAction('Engagement', 'Click', 'Submit Outpass');
 */
export const trackUserAction = (category, action, label = '', value = null) => {
  const params = {
    event_category: category,
    event_label: label,
  };
  
  if (value !== null) {
    params.value = value;
  }

  trackEvent(action, params);
};

/**
 * Track exceptions/errors
 * 
 * @param {string} description - Error description
 * @param {boolean} fatal - Whether the error is fatal
 * 
 * @example
 * trackException('API Error: Failed to fetch data', false);
 */
export const trackException = (description, fatal = false) => {
  if (window.gtag) {
    window.gtag('event', 'exception', {
      description: description,
      fatal: fatal
    });
  }
};

/**
 * Set user properties
 * 
 * @param {Object} properties - User properties to set
 * 
 * @example
 * setUserProperties({ user_role: 'student', hostel_floor: '5' });
 */
export const setUserProperties = (properties) => {
  if (window.gtag) {
    window.gtag('set', 'user_properties', properties);
  }
};

/**
 * Track conversions (goals)
 * 
 * @param {string} conversionId - Conversion ID from Google Ads
 * @param {Object} params - Conversion parameters
 * 
 * @example
 * trackConversion('AW-CONVERSION_ID', { value: 1.0, currency: 'INR' });
 */
export const trackConversion = (conversionId, params = {}) => {
  if (window.gtag) {
    window.gtag('event', 'conversion', {
      'send_to': conversionId,
      ...params
    });
  }
};

// Common event tracking functions for the hostel management system

/**
 * Track login events
 * @param {string} method - Login method (e.g., 'google', 'email')
 * @param {string} role - User role (e.g., 'student', 'admin', 'security')
 */
export const trackLogin = (method, role) => {
  trackEvent('login', {
    method: method,
    user_role: role
  });
};

/**
 * Track outpass submission
 * @param {string} type - Outpass type
 */
export const trackOutpassSubmission = (type) => {
  trackEvent('outpass_submitted', {
    outpass_type: type
  });
};

/**
 * Track complaint submission
 * @param {string} category - Complaint category
 */
export const trackComplaintSubmission = (category) => {
  trackEvent('complaint_submitted', {
    complaint_category: category
  });
};

/**
 * Track food feedback submission
 * @param {number} rating - Rating given
 */
export const trackFoodFeedback = (rating) => {
  trackEvent('food_feedback_submitted', {
    rating: rating
  });
};

/**
 * Track community post creation
 */
export const trackCommunityPost = () => {
  trackEvent('community_post_created');
};

/**
 * Track room allocation
 * @param {string} roomType - Type of room allocated
 */
export const trackRoomAllocation = (roomType) => {
  trackEvent('room_allocated', {
    room_type: roomType
  });
};

/**
 * Track visitor registration
 */
export const trackVisitorRegistration = () => {
  trackEvent('visitor_registered');
};

/**
 * Track QR code scan
 * @param {string} scanType - Type of scan (e.g., 'outpass', 'visitor')
 */
export const trackQRScan = (scanType) => {
  trackEvent('qr_code_scanned', {
    scan_type: scanType
  });
};

export default GoogleAnalytics;
