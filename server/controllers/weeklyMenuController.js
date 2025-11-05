const expressAsyncHandler = require('express-async-handler');
const { FoodMenu, WeeklyFoodMenu } = require('../models/FoodModel');
const notificationService = require('../services/notificationService');

// Epoch for rotation (choose a Monday so week boundaries align). You can change this later.
const ROTATION_EPOCH_UTC = new Date(Date.UTC(2025, 0, 6)); // 2025-01-06 (Monday)

function getRotationWeekIndex(date = new Date()) {
    // normalize date to UTC midnight
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceEpoch = Math.floor((d - ROTATION_EPOCH_UTC) / msPerWeek);
    const idx = ((weeksSinceEpoch % 4) + 4) % 4; // ensure positive
    return idx + 1; // 1..4
}

/**
 * Get template menu data (returns the 4 rotation templates)
 */
const getMonthlyMenu = expressAsyncHandler(async (req, res) => {
    try {
        // Fetch all 4 templates (week 1..4)
        const weeklyMenus = await WeeklyFoodMenu.find({}).sort({ week: 1 });
        
        res.status(200).json({
            success: true,
            data: weeklyMenus
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update day menu
 */
const updateDayMenu = expressAsyncHandler(async (req, res) => {
    try {
        const { date, week, day, breakfast, lunch, snacks, dinner } = req.body;
        
        // LOGGING REQUEST DATA
        console.log('\n========================================');
        console.log('📥 MENU UPDATE REQUEST RECEIVED');
        console.log('========================================');
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
        console.log('Date provided:', date);
        console.log('Week provided:', week);
        console.log('Day provided:', day);
        console.log('========================================\n');
        
        let dateObj;
        
        // If date is provided, use it directly
        if (date) {
            dateObj = new Date(date);
            dateObj.setHours(0, 0, 0, 0);
            
            // Validate menu freeze deadline with 10 AM cutoff rule
            const now = new Date();
            const currentHour = now.getHours();
            const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            currentDate.setHours(0, 0, 0, 0);
            
            const tomorrow = new Date(currentDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const dayAfterTomorrow = new Date(currentDate);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
            dayAfterTomorrow.setHours(0, 0, 0, 0);
            
            // Calculate cutoff date based on current time
            // Before 10 AM: Can update tomorrow onwards
            // After 10 AM: Can only update day after tomorrow onwards (tomorrow is frozen)
            const cutoffDate = currentHour >= 10 ? dayAfterTomorrow : tomorrow;
            
            // DEBUG LOGGING
            console.log('========================================');
            console.log('MENU UPDATE REQUEST - VALIDATION CHECK');
            console.log('========================================');
            console.log('Current Server Time:', now.toISOString());
            console.log('Current Hour:', currentHour);
            console.log('Current Date (normalized):', currentDate.toISOString());
            console.log('Tomorrow Date:', tomorrow.toISOString());
            console.log('Day After Tomorrow:', dayAfterTomorrow.toISOString());
            console.log('Cutoff Date (earliest allowed):', cutoffDate.toISOString());
            console.log('Requested Date (from request):', date);
            console.log('Requested Date (parsed):', dateObj.toISOString());
            console.log('---');
            console.log('Cutoff Date timestamp:', cutoffDate.getTime());
            console.log('Requested Date timestamp:', dateObj.getTime());
            console.log('---');
            console.log('Comparison: dateObj.getTime() < cutoffDate.getTime()');
            console.log('Result:', dateObj.getTime() < cutoffDate.getTime());
            console.log('Should BLOCK:', dateObj.getTime() < cutoffDate.getTime() ? 'YES ❌' : 'NO ✅');
            console.log('========================================');
            
            // STRICT RULE: Menu must be updated before 10 AM on the previous day
            // Before 10 AM today: Can update tomorrow onwards
            // After 10 AM today: Can only update day after tomorrow onwards
            if (dateObj.getTime() < cutoffDate.getTime()) {
                console.log('🚫 REQUEST BLOCKED - Menu is frozen!');
                console.log('========================================\n');
                
                const requestedDateFormatted = dateObj.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                const cutoffDateFormatted = cutoffDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                // Format current time
                const currentMinutes = now.getMinutes().toString().padStart(2, '0');
                const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
                const amPm = currentHour >= 12 ? 'PM' : 'AM';
                const currentTimeFormatted = `${displayHour}:${currentMinutes} ${amPm}`;
                
                // Create detailed message based on time
                let timeRuleMessage;
                if (currentHour >= 10) {
                    timeRuleMessage = `⏰ It is currently ${currentTimeFormatted}.\n\n🚫 Menu updates for tomorrow must be completed before 10:00 AM today.\n\nSince it's past 10:00 AM, you can no longer update tomorrow's menu.`;
                } else {
                    timeRuleMessage = `⏰ It is currently ${currentTimeFormatted}.\n\n✅ You can still update tomorrow's menu until 10:00 AM today.\n\nHowever, today's menu should have been set yesterday.`;
                }
                
                return res.status(403).json({ 
                    success: false,
                    type: 'MENU_FROZEN',
                    alertType: 'error',
                    alertTitle: '⚠️ Menu Update Blocked',
                    alertMessage: `You cannot update the menu for ${requestedDateFormatted}!\n\n${timeRuleMessage}\n\n📋 MENU UPDATE RULE:\nMenus must be updated before 10:00 AM on the previous day.`,
                    error: 'Menu is frozen! This date\'s menu cannot be changed.',
                    currentDate: currentDate.toISOString().split('T')[0],
                    currentTime: currentTimeFormatted,
                    currentHour: currentHour,
                    requestedDate: dateObj.toISOString().split('T')[0],
                    minimumAllowedDate: cutoffDate.toISOString().split('T')[0],
                    message: `📅 Menu for ${requestedDateFormatted} is frozen.\n\n✅ You can update menu for ${cutoffDateFormatted} and onwards.\n\n💡 Tip: Always update menus before 10:00 AM on the previous day!`,
                    suggestion: `Please update the menu for ${cutoffDateFormatted} or future dates. Remember: Updates must be done before 10:00 AM on the day before.`
                });
            }
            
            console.log('✅ REQUEST ALLOWED - Date is valid for update');
            console.log('========================================\n');
        }
        // If week and day are provided, calculate the date from rotation
        else if (week && day) {
            console.log('🔄 Template update detected - Checking if it affects today\'s menu...');
            
            // This is a template update for the weekly rotation
            const weekNumber = parseInt(week.toString().replace('week', ''));
            
            if (!weekNumber || isNaN(weekNumber) || weekNumber < 1 || weekNumber > 4) {
                return res.status(400).json({ success: false, error: 'Invalid week number' });
            }
            
            const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const dayLower = day.toString().toLowerCase();
            
            if (!validDays.includes(dayLower)) {
                return res.status(400).json({ success: false, error: 'Invalid day' });
            }
            
            // CHECK IF THIS TEMPLATE UPDATE AFFECTS TODAY'S OR TOMORROW'S MENU (based on 10 AM cutoff)
            const now = new Date();
            const currentHour = now.getHours();
            const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            currentDate.setHours(0, 0, 0, 0);
            
            const tomorrow = new Date(currentDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            // Get current rotation week
            const currentRotationWeek = getRotationWeekIndex(currentDate);
            const tomorrowRotationWeek = getRotationWeekIndex(tomorrow);
            
            // Get current day name and tomorrow's day name
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDayName = dayNames[currentDate.getDay()];
            const tomorrowDayName = dayNames[tomorrow.getDay()];
            
            console.log('Current Rotation Week:', currentRotationWeek);
            console.log('Tomorrow Rotation Week:', tomorrowRotationWeek);
            console.log('Today\'s Day:', currentDayName);
            console.log('Tomorrow\'s Day:', tomorrowDayName);
            console.log('Template Week:', weekNumber);
            console.log('Template Day:', dayLower);
            console.log('Current Hour:', currentHour);
            
            // BLOCK if trying to update today's active template
            if (weekNumber === currentRotationWeek && dayLower === currentDayName) {
                console.log('🚫 BLOCKED - This template update affects TODAY\'S menu!');
                console.log('========================================\n');
                
                const todayFormatted = currentDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                // Format current time
                const currentMinutes = now.getMinutes().toString().padStart(2, '0');
                const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
                const amPm = currentHour >= 12 ? 'PM' : 'AM';
                const currentTimeFormatted = `${displayHour}:${currentMinutes} ${amPm}`;
                
                return res.status(403).json({
                    success: false,
                    type: 'MENU_FROZEN',
                    alertType: 'error',
                    alertTitle: '⚠️ Menu Update Blocked',
                    alertMessage: `You cannot update the menu right now!\n\nToday's menu (${todayFormatted}) should have been updated YESTERDAY before 10:00 AM.\n\n⏰ Current time: ${currentTimeFormatted}\n\n📋 MENU UPDATE RULE:\nMenus must be updated before 10:00 AM on the previous day.`,
                    error: 'Menu is FROZEN! This template affects today\'s menu and cannot be changed.',
                    currentDate: currentDate.toISOString().split('T')[0],
                    currentRotationWeek: currentRotationWeek,
                    currentDay: currentDayName,
                    attemptedWeek: weekNumber,
                    attemptedDay: dayLower,
                    message: `📅 Today's menu for ${todayFormatted} is frozen.\n\n✅ You can update tomorrow's menu (${tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}) and onwards.\n\n💡 Tip: Always plan and set menus at least 1 day ahead!`,
                    minimumAllowedDate: tomorrow.toISOString().split('T')[0],
                    suggestion: 'Please update the menu for tomorrow or future dates.'
                });
            }
            
            // BLOCK if trying to update tomorrow's menu after 10 AM
            if (currentHour >= 10 && weekNumber === tomorrowRotationWeek && dayLower === tomorrowDayName) {
                console.log('🚫 BLOCKED - This template update affects TOMORROW\'S menu and it\'s past 10 AM!');
                console.log('========================================\n');
                
                const tomorrowFormatted = tomorrow.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                const dayAfterTomorrow = new Date(tomorrow);
                dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
                const dayAfterTomorrowFormatted = dayAfterTomorrow.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                // Format current time
                const currentMinutes = now.getMinutes().toString().padStart(2, '0');
                const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
                const amPm = currentHour >= 12 ? 'PM' : 'AM';
                const currentTimeFormatted = `${displayHour}:${currentMinutes} ${amPm}`;
                
                return res.status(403).json({
                    success: false,
                    type: 'MENU_FROZEN',
                    alertType: 'error',
                    alertTitle: '⚠️ Menu Update Blocked - 10 AM Deadline Passed',
                    alertMessage: `You cannot update tomorrow's menu (${tomorrowFormatted})!\n\n⏰ Current time: ${currentTimeFormatted}\n\n🚫 Menu updates for tomorrow must be completed before 10:00 AM today.\n\nSince it's past 10:00 AM, tomorrow's menu is now frozen.\n\n📋 MENU UPDATE RULE:\nMenus must be updated before 10:00 AM on the previous day.`,
                    error: 'Menu is FROZEN! Tomorrow\'s menu deadline (10 AM) has passed.',
                    currentDate: currentDate.toISOString().split('T')[0],
                    currentTime: currentTimeFormatted,
                    currentHour: currentHour,
                    tomorrowDate: tomorrow.toISOString().split('T')[0],
                    currentRotationWeek: tomorrowRotationWeek,
                    currentDay: tomorrowDayName,
                    attemptedWeek: weekNumber,
                    attemptedDay: dayLower,
                    message: `📅 Tomorrow's menu for ${tomorrowFormatted} is frozen (10 AM deadline passed).\n\n✅ You can update menu for ${dayAfterTomorrowFormatted} and onwards.\n\n💡 Remember: Always update menus before 10:00 AM on the previous day!`,
                    minimumAllowedDate: dayAfterTomorrow.toISOString().split('T')[0],
                    suggestion: `Please update the menu for ${dayAfterTomorrowFormatted} or future dates. Remember: Updates must be done before 10:00 AM on the day before.`
                });
            }
            
            console.log('✅ Template update allowed - Does not affect today\'s or frozen menus');
            console.log('========================================\n');
            
            // Update the weekly rotation template instead
            const emptyWeekStructure = {
                monday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                tuesday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                wednesday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                thursday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                friday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                saturday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                sunday: { breakfast: '', lunch: '', snacks: '', dinner: '' }
            };
            
            let weeklyMenu = await WeeklyFoodMenu.findOne({
                week: weekNumber
            });
            
            if (!weeklyMenu) {
                weeklyMenu = new WeeklyFoodMenu({
                    week: weekNumber,
                    days: emptyWeekStructure
                });
            }
            
            weeklyMenu.days[dayLower] = {
                breakfast: breakfast || '',
                lunch: lunch || '',
                snacks: snacks || '',
                dinner: dinner || ''
            };
            
            await weeklyMenu.save();
            
            return res.status(200).json({
                success: true,
                message: 'Menu template updated successfully',
                data: weeklyMenu.days[dayLower]
            });
        }
        else {
            return res.status(400).json({ success: false, error: 'Either date or (week and day) are required' });
        }
        
        // Update the daily menu (if date was provided)
        const updated = await FoodMenu.findOneAndUpdate(
            { date: dateObj },
            {
                breakfast: breakfast || '',
                lunch: lunch || '',
                snacks: snacks || '',
                dinner: dinner || '',
                lastModified: new Date(),
                modificationReason: 'Regular menu update'
            },
            { new: true, upsert: true }
        );
        
        res.status(200).json({
            success: true,
            message: 'Menu updated successfully',
            data: updated
        });
        
    } catch (error) {
        console.error('Error updating day menu:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update menu',
            error: error.message
        });
    }
});

// Get current week number
const getCurrentWeek = expressAsyncHandler(async (req, res) => {
    try {
        const now = new Date();
        const dayOfWeek = now.getDay();
        
        // Calculate week start (Sunday = 0)
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        const menus = await FoodMenu.find({
            date: {
                $gte: weekStart,
                $lt: weekEnd
            }
        }).sort({ date: 1 });
        
        res.status(200).json({
            success: true,
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            menus: menus
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// Create or update entire week menu
const updateWeekMenu = expressAsyncHandler(async (req, res) => {
    try {
        const { weekData } = req.body;
        
        if (!weekData || !Array.isArray(weekData)) {
            return res.status(400).json({ success: false, error: 'Week data array is required' });
        }
        
        const now = new Date();
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentDate.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(currentDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const updatedMenus = [];
        const rejectedDates = [];
        
        console.log('========================================');
        console.log('BULK MENU UPDATE - VALIDATION CHECK');
        console.log('========================================');
        console.log('Current Date:', currentDate.toISOString());
        console.log('Tomorrow Date:', tomorrow.toISOString());
        console.log('Number of dates to process:', weekData.length);
        console.log('========================================');
        
        for (const dayMenu of weekData) {
            const dateObj = new Date(dayMenu.date);
            dateObj.setHours(0, 0, 0, 0);
            
            console.log(`\nProcessing date: ${dayMenu.date}`);
            console.log(`Parsed: ${dateObj.toISOString()}`);
            console.log(`Comparison: ${dateObj.getTime()} <= ${currentDate.getTime()}`);
            console.log(`Result: ${dateObj.getTime() <= currentDate.getTime() ? 'BLOCKED ❌' : 'ALLOWED ✅'}`);
            
            // Validate: menu must be set at least 1 day before (cannot update today)
            // Can only update tomorrow onwards
            if (dateObj.getTime() <= currentDate.getTime()) {
                console.log(`🚫 Date ${dayMenu.date} REJECTED`);
                rejectedDates.push({
                    date: dateObj.toISOString().split('T')[0],
                    reason: 'Menu is frozen! Today\'s menu cannot be changed. It should have been set yesterday.'
                });
                continue;
            }
            
            console.log(`✅ Date ${dayMenu.date} ACCEPTED`);
            
            const updated = await FoodMenu.findOneAndUpdate(
                { date: dateObj },
                {
                    breakfast: dayMenu.breakfast || '',
                    lunch: dayMenu.lunch || '',
                    snacks: dayMenu.snacks || '',
                    dinner: dayMenu.dinner || '',
                    lastModified: new Date(),
                    isEmergencyChange: false,
                    modificationReason: 'Regular menu update'
                },
                { new: true, upsert: true }
            );
            
            updatedMenus.push(updated);
        }
        
        if (rejectedDates.length > 0 && updatedMenus.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'All dates rejected due to freeze deadline',
                rejectedDates: rejectedDates,
                minimumAllowedDate: dayAfterTomorrow.toISOString().split('T')[0]
            });
        }
        
        res.status(200).json({
            success: true,
            message: updatedMenus.length > 0 
                ? `Week menu updated successfully. ${updatedMenus.length} day(s) updated.` 
                : 'No menus updated',
            menus: updatedMenus,
            rejectedDates: rejectedDates.length > 0 ? rejectedDates : undefined
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = {
    getMonthlyMenu,
    updateDayMenu,
    getCurrentWeek,
    updateWeekMenu
};
