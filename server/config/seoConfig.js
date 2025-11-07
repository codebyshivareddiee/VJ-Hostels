/**
 * Server-side SEO Configuration
 * 
 * This file contains Express.js middleware and configurations for SEO optimization
 * Add these to your server.js file
 */

const express = require('express');
const path = require('path');
const compression = require('compression'); // Install: npm install compression

/**
 * SEO Middleware for Express
 */

// 1. Compression Middleware - Reduces response size
function setupCompression(app) {
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6 // Compression level (0-9)
  }));
}

// 2. Security Headers Middleware
function setupSecurityHeaders(app) {
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (adjust as needed)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com"
    );
    
    next();
  });
}

// 3. Cache Control for Static Assets
function setupCaching(app) {
  // Cache static assets for 1 year
  app.use('/assets', express.static(path.join(__dirname, '../frontend/dist/assets'), {
    maxAge: '1y',
    immutable: true
  }));

  // Cache images for 1 week
  app.use('/images', express.static(path.join(__dirname, '../frontend/dist/images'), {
    maxAge: '7d'
  }));

  // Don't cache HTML files
  app.use(express.static(path.join(__dirname, '../frontend/dist'), {
    maxAge: 0,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
}

// 4. Redirect HTTP to HTTPS (for production)
function setupHTTPSRedirect(app) {
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// 5. Handle Trailing Slashes
function setupTrailingSlash(app) {
  app.use((req, res, next) => {
    if (req.path !== '/' && req.path.endsWith('/')) {
      const query = req.url.slice(req.path.length);
      res.redirect(301, req.path.slice(0, -1) + query);
    } else {
      next();
    }
  });
}

// 6. Serve robots.txt and sitemap.xml
function setupSEOFiles(app) {
  // Serve robots.txt
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, '../frontend/public/robots.txt'));
  });

  // Serve sitemap.xml
  app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, '../frontend/public/sitemap.xml'));
  });

  // Serve manifest.json
  app.get('/manifest.json', (req, res) => {
    res.type('application/json');
    res.sendFile(path.join(__dirname, '../frontend/public/manifest.json'));
  });
}

// 7. Handle SPA Routing (Send all non-API routes to index.html)
function setupSPARouting(app) {
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      return next();
    }
    
    // Send index.html for all other routes
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// 8. 404 Error Handler
function setup404Handler(app) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      res.status(404).json({ error: 'Not Found' });
    } else {
      // For non-API routes, send to React app
      res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
  });
}

// 9. Enable CORS with proper headers
function setupCORS(app) {
  app.use((req, res, next) => {
    const allowedOrigins = [
      'http://localhost:3201',
      'https://dev-hostel.vjstartup.com',
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });
}

// 10. Response Time Header (for monitoring)
function setupResponseTime(app) {
  app.use((req, res, next) => {
    const start = Date.now();
    
    // Store the original end function
    const originalEnd = res.end;
    
    // Override the end function
    res.end = function(...args) {
      const duration = Date.now() - start;
      // Set header before response is sent
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration}ms`);
      }
      // Call the original end function
      originalEnd.apply(res, args);
    };
    
    next();
  });
}

/**
 * Complete Setup Function
 * Call this in your server.js file
 */
function setupSEOMiddleware(app) {
  console.log('Setting up SEO middleware...');
  
  // Order matters! Set up in this sequence:
  setupResponseTime(app);        // 1. Track response time
  setupHTTPSRedirect(app);       // 2. Redirect to HTTPS
  setupSecurityHeaders(app);     // 3. Add security headers
  setupCompression(app);         // 4. Enable compression
  // Note: CORS is already set up in server.js, skip it here
  setupTrailingSlash(app);       // 5. Handle trailing slashes
  // Note: SEO files are served separately in server.js
  // setupCaching(app);          // 6. Caching handled by express.static
  
  // Note: Add setupSPARouting and setup404Handler at the end of your routes
  
  console.log('SEO middleware setup complete');
}

/**
 * Example Usage in server.js:
 * 
 * const express = require('express');
 * const { setupSEOMiddleware, setupSPARouting, setup404Handler } = require('./config/seoConfig');
 * 
 * const app = express();
 * 
 * // Apply SEO middleware
 * setupSEOMiddleware(app);
 * 
 * // Your API routes here
 * app.use('/api', apiRoutes);
 * 
 * // SPA routing (must be after API routes)
 * setupSPARouting(app);
 * 
 * // 404 handler (must be last)
 * setup404Handler(app);
 * 
 * app.listen(6201, () => {
 *   console.log('Server running on port 6201');
 * });
 */

module.exports = {
  setupSEOMiddleware,
  setupCompression,
  setupSecurityHeaders,
  setupCaching,
  setupHTTPSRedirect,
  setupTrailingSlash,
  setupSEOFiles,
  setupSPARouting,
  setup404Handler,
  setupCORS,
  setupResponseTime
};
