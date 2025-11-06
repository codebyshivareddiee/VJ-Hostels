#!/bin/bash

# SEO Setup Script for VNR Hostel Management System
# This script installs necessary dependencies and sets up SEO features

echo "================================================"
echo "VNR Hostel Management System - SEO Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "server" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}Installing server dependencies...${NC}"
cd server
npm install compression --save
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to install server dependencies${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "================================================"
echo "Next Steps:"
echo "================================================"
echo ""
echo "1. Update domain references:"
echo "   - Replace 'vnrhostel.com' with your actual domain in:"
echo "     • frontend/index.html"
echo "     • frontend/public/sitemap.xml"
echo "     • server/config/seoConfig.js"
echo ""
echo "2. Add Google Analytics:"
echo "   - Get your GA4 Measurement ID"
echo "   - Add to App.jsx: <GoogleAnalytics measurementId='G-XXXXXXXXXX' />"
echo ""
echo "3. Optimize images:"
echo "   - Create 192x192 and 512x512 icons"
echo "   - Add optimized OG image (1200x630px)"
echo ""
echo "4. Add SEO to pages:"
echo "   - Import and use SEO component in all major pages"
echo "   - See SEO_IMPLEMENTATION_SUMMARY.md for examples"
echo ""
echo "5. Test your implementation:"
echo "   - Run 'npm run build' in frontend"
echo "   - Test with Lighthouse in Chrome DevTools"
echo "   - Validate with Google Search Console"
echo ""
echo "📚 Documentation:"
echo "   - frontend/SEO_GUIDE.md"
echo "   - frontend/SEO_IMPLEMENTATION_SUMMARY.md"
echo ""
echo "================================================"
echo -e "${GREEN}Happy optimizing! 🚀${NC}"
echo "================================================"
