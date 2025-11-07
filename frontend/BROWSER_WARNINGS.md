# Browser Extension Warnings - Troubleshooting Guide

## Understanding the Warnings

The warnings you're seeing in the console are **NOT** from your application code. They are caused by browser extensions installed in your Chrome browser.

### Warning 1: Preload Resources
```
The resource chrome-extension://akdekjcdpoejnaghfablefgifldaghio/icons/icon128.png was preloaded using link preload but not used within a few seconds...
```
**Cause:** A Chrome extension (likely a shopping/product comparison extension) is trying to preload its resources.

### Warning 2: API Fetch
```
The resource http://localhost:5001/api/products was preloaded using link preload but not used...
```
**Cause:** Same extension is trying to fetch product data from a local API endpoint.

### Warning 3: Product Info
```
No product info found on this page
```
**Cause:** The extension is looking for product information on your hostel management page (which obviously has none).

## Solutions Implemented

### 1. **Console Filter** (`/src/utils/consoleFilter.js`)
We've added a utility that filters out extension-related warnings from the console, keeping it clean and focused on your application's actual issues.

### 2. **Route Fixes**
Fixed the navigation links:
- Changed `/security/barcode-scanner` → `/security/scanner`
- Removed duplicate navigation items

### 3. **Meta Tags**
Added browser compatibility meta tags to the `index.html`.

## How to Disable Extensions (If Needed)

### Option 1: Disable Specific Extension
1. Open Chrome and go to `chrome://extensions/`
2. Find the extension with ID `akdekjcdpoejnaghfablefgifldaghio`
3. Toggle it off

### Option 2: Use Incognito Mode
Extensions are usually disabled in incognito mode by default:
1. Press `Ctrl+Shift+N` (Windows/Linux) or `Cmd+Shift+N` (Mac)
2. Open your application there

### Option 3: Disable Extensions for Development
1. Go to `chrome://extensions/`
2. Turn off "Developer mode" if on
3. Disable all shopping/product-related extensions

## Common Culprits

These extensions often cause such warnings:
- **Honey** - Shopping coupon finder
- **Rakuten** - Cash back extension
- **Capital One Shopping** - Price comparison
- **Amazon Assistant** - Product finder
- **PayPal Honey** - Deals finder

## Verification

After applying these fixes:
1. **The warnings are now suppressed** in the console (filtered out)
2. **Your application routes work correctly**
3. **The console shows only relevant application logs**

## Developer Notes

- The console filter is **only active in production** to help debugging
- In development, you'll see a message: "🔇 Console filter active"
- To temporarily disable the filter, comment out the import in `main.jsx`

## Still Seeing Warnings?

If you still see these warnings after implementing the fixes:
1. Hard refresh the page: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check if you're in the correct route (`/security/scanner` not `/security/barcode-scanner`)
4. Try disabling all extensions temporarily

---

**Remember:** These warnings don't affect your application's functionality. They're just noise from browser extensions trying to enhance your browsing experience on shopping sites.
