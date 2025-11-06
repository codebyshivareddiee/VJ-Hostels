@echo off
REM SEO Setup Script for VNR Hostel Management System (Windows)
REM This script installs necessary dependencies and sets up SEO features

echo ================================================
echo VNR Hostel Management System - SEO Setup
echo ================================================
echo.

REM Check if we're in the right directory
if not exist "frontend" (
    echo Error: Please run this script from the project root directory
    exit /b 1
)
if not exist "server" (
    echo Error: Please run this script from the project root directory
    exit /b 1
)

echo Installing server dependencies...
cd server
call npm install compression --save
if %errorlevel% neq 0 (
    echo Failed to install server dependencies
    exit /b 1
)
echo Server dependencies installed successfully
cd ..

echo.
echo Setup complete!
echo.
echo ================================================
echo Next Steps:
echo ================================================
echo.
echo 1. Update domain references:
echo    - Replace 'vnrhostel.com' with your actual domain in:
echo      * frontend/index.html
echo      * frontend/public/sitemap.xml
echo      * server/config/seoConfig.js
echo.
echo 2. Add Google Analytics:
echo    - Get your GA4 Measurement ID
echo    - Add to App.jsx: ^<GoogleAnalytics measurementId='G-XXXXXXXXXX' /^>
echo.
echo 3. Optimize images:
echo    - Create 192x192 and 512x512 icons
echo    - Add optimized OG image (1200x630px)
echo.
echo 4. Add SEO to pages:
echo    - Import and use SEO component in all major pages
echo    - See SEO_IMPLEMENTATION_SUMMARY.md for examples
echo.
echo 5. Test your implementation:
echo    - Run 'npm run build' in frontend
echo    - Test with Lighthouse in Chrome DevTools
echo    - Validate with Google Search Console
echo.
echo Documentation:
echo    - frontend/SEO_GUIDE.md
echo    - frontend/SEO_IMPLEMENTATION_SUMMARY.md
echo.
echo ================================================
echo Happy optimizing! 🚀
echo ================================================

pause
