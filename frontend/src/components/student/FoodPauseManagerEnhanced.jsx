import { useState, useEffect } from 'react';
import axios from 'axios';
import useCurrentUser from '../../hooks/student/useCurrentUser';

const FoodPauseManagerEnhanced = ({ outpassData = null }) => {
    const { user } = useCurrentUser();
    const [activeTab, setActiveTab] = useState('pause');
    const [pausedMeals, setPausedMeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [pauseType, setPauseType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedMeals, setSelectedMeals] = useState([]);
    const [lastDayMeals, setLastDayMeals] = useState([]); // For custom date last day
    const [weekendMeals, setWeekendMeals] = useState([]); // For weekend Monday return day
    const [message, setMessage] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [todayDate, setTodayDate] = useState('');
    const [tomorrowDate, setTomorrowDate] = useState('');

    useEffect(() => {
        if (user?.rollNumber) {
            fetchPausedMeals();
        }
    }, [user?.rollNumber]);

    useEffect(() => {
        // Initialize today and tomorrow dates when component mounts
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tYear = tomorrow.getFullYear();
        const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const tDay = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowStr = `${tYear}-${tMonth}-${tDay}`;
        
        setTodayDate(todayStr);
        setTomorrowDate(tomorrowStr);
    }, []);

    // Deadline for changing tomorrow's meals: today 18:00 local time
    const isTomorrowDeadlinePassed = () => {
        const now = new Date();
        const deadline = new Date();
        deadline.setHours(18, 0, 0, 0); // 6:00 PM today
        return now >= deadline;
    };

    // For custom date range, minimum allowed start date
    const getMinStartDate = () => {
        // If deadline has passed, don't allow today
        if (isTomorrowDeadlinePassed()) {
            // Return tomorrow's date
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const y = tomorrow.getFullYear();
            const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const d = String(tomorrow.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        // If deadline hasn't passed, allow tomorrow onwards
        return tomorrowDate;
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        // Pre-fill from outpass data if provided
        if (outpassData) {
            setPauseType('custom');
            setStartDate(outpassData.outTime.split('T')[0]);
            setEndDate(outpassData.inTime.split('T')[0]);
            setStep(2);
        }
    }, [outpassData]);

    const mealTimings = {
        breakfast: { start: "07:00", editDeadline: "05:00" },
        lunch: { start: "12:30", editDeadline: "10:30" },
        snacks: { start: "16:30", editDeadline: "14:30" },
        dinner: { start: "19:30", editDeadline: "17:30" }
    };

    const fetchPausedMeals = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/my-pauses?studentId=${user.rollNumber}`);
            setPausedMeals(response.data);
        } catch (error) {
            console.error('Error fetching paused meals:', error);
        } finally {
            setLoading(false);
        }
    };

    const computeUpcomingFridayToMonday = () => {
        const now = new Date();
        // get upcoming Friday (5)
        const day = now.getDay(); // 0 Sun ... 5 Fri
        const daysUntilFriday = (5 - day + 7) % 7; // 0 if today is Friday
        const friday = new Date(now);
        friday.setDate(now.getDate() + daysUntilFriday);

        const monday = new Date(friday);
        monday.setDate(friday.getDate() + 3); // Friday + 3 days = Monday

        const toISODate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        return { start: toISODate(friday), end: toISODate(monday) };
    };

    const handlePauseTypeSelect = (type) => {
        // If selecting tomorrow but deadline passed, ignore selection and show message
        if (type === 'tomorrow' && isTomorrowDeadlinePassed()) {
            setMessage({ type: 'error', text: `Deadline has passed for tomorrow's meals. You can still schedule for future dates.` });
            return;
        }

        setPauseType(type);

        switch (type) {
            case 'tomorrow': {
                // Tomorrow is paused entirely (all meals)
                // User selects meals for day after tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const y = tomorrow.getFullYear();
                const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const d = String(tomorrow.getDate()).padStart(2, '0');
                const tmr = `${y}-${m}-${d}`;
                
                const dayAfterTomorrow = new Date();
                dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
                const y2 = dayAfterTomorrow.getFullYear();
                const m2 = String(dayAfterTomorrow.getMonth() + 1).padStart(2, '0');
                const d2 = String(dayAfterTomorrow.getDate()).padStart(2, '0');
                const dat = `${y2}-${m2}-${d2}`;
                
                setStartDate(tmr);
                setEndDate(dat); // End date is day after tomorrow
                break;
            }
            case 'weekend': {
                const { start, end } = computeUpcomingFridayToMonday();
                setStartDate(start);
                setEndDate(end);
                break;
            }
            case 'custom':
                setStartDate('');
                setEndDate('');
                break;
        }
        setStep(2);
    };

    const handleMealToggle = (meal, dateToCheck = null) => {
        // Check if meal is already paused for the date
        if (dateToCheck && isMealAlreadyPaused(meal, dateToCheck)) {
            return; // Don't allow toggling if already paused
        }
        
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        setSelectedMeals(prev => {
            // Check if this meal is auto-selected (not the first selected meal)
            const selectedIndices = prev.map(m => mealOrder.indexOf(m));
            if (selectedIndices.length > 0) {
                const earliestSelectedIndex = Math.min(...selectedIndices);
                const currentMealIndex = mealOrder.indexOf(meal);
                
                // If this meal is after the first selected meal, don't allow deselection
                if (currentMealIndex > earliestSelectedIndex && prev.includes(meal)) {
                    return prev; // Don't allow deselecting auto-selected meals
                }
                
                // If trying to select a meal that's before the current first meal
                if (currentMealIndex < earliestSelectedIndex && !prev.includes(meal)) {
                    // Clear all and select from this new meal
                    const mealsToSelect = mealOrder.slice(currentMealIndex);
                    return mealsToSelect;
                }
                
                // If trying to deselect the first meal, clear all selections
                if (currentMealIndex === earliestSelectedIndex && prev.includes(meal)) {
                    return [];
                }
            }
            
            // If no meals selected yet, select this meal and all after it
            if (!prev.includes(meal)) {
                const mealsToSelect = mealOrder.slice(mealIndex);
                return mealsToSelect;
            }
            
            return prev;
        });
    };

    const handleLastDayMealToggle = (meal) => {
        // Check if meal is already paused for the end date
        if (isMealAlreadyPaused(meal, endDate)) {
            return; // Don't allow toggling if already paused
        }
        
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        setLastDayMeals(prev => {
            // Check if this meal is auto-selected (not the first selected meal)
            const selectedIndices = prev.map(m => mealOrder.indexOf(m));
            if (selectedIndices.length > 0) {
                const earliestSelectedIndex = Math.min(...selectedIndices);
                const currentMealIndex = mealOrder.indexOf(meal);
                
                // If this meal is after the first selected meal, don't allow deselection
                if (currentMealIndex > earliestSelectedIndex && prev.includes(meal)) {
                    return prev; // Don't allow deselecting auto-selected meals
                }
                
                // If trying to select a meal that's before the current first meal
                if (currentMealIndex < earliestSelectedIndex && !prev.includes(meal)) {
                    // Clear all and select from this new meal
                    const mealsToSelect = mealOrder.slice(currentMealIndex);
                    return mealsToSelect;
                }
                
                // If trying to deselect the first meal, clear all selections
                if (currentMealIndex === earliestSelectedIndex && prev.includes(meal)) {
                    return [];
                }
            }
            
            // If no meals selected yet, select this meal and all after it
            if (!prev.includes(meal)) {
                const mealsToSelect = mealOrder.slice(mealIndex);
                return mealsToSelect;
            }
            
            return prev;
        });
    };

    const handleWeekendMealToggle = (meal) => {
        // Check if meal is already paused for Monday (end date)
        if (isMealAlreadyPaused(meal, endDate)) {
            return; // Don't allow toggling if already paused
        }
        
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        setWeekendMeals(prev => {
            // Check if this meal is auto-selected (not the first selected meal)
            const selectedIndices = prev.map(m => mealOrder.indexOf(m));
            if (selectedIndices.length > 0) {
                const earliestSelectedIndex = Math.min(...selectedIndices);
                const currentMealIndex = mealOrder.indexOf(meal);
                
                // If this meal is after the first selected meal, don't allow deselection
                if (currentMealIndex > earliestSelectedIndex && prev.includes(meal)) {
                    return prev; // Don't allow deselecting auto-selected meals
                }
                
                // If trying to select a meal that's before the current first meal
                if (currentMealIndex < earliestSelectedIndex && !prev.includes(meal)) {
                    // Clear all and select from this new meal
                    const mealsToSelect = mealOrder.slice(currentMealIndex);
                    return mealsToSelect;
                }
                
                // If trying to deselect the first meal, clear all selections
                if (currentMealIndex === earliestSelectedIndex && prev.includes(meal)) {
                    return [];
                }
            }
            
            // If no meals selected yet, select this meal and all after it
            if (!prev.includes(meal)) {
                const mealsToSelect = mealOrder.slice(mealIndex);
                return mealsToSelect;
            }
            
            return prev;
        });
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            
            // The UI asks the student to select meals they WILL HAVE.
            // The backend expects the list of paused meals, so compute the difference.
            const allMeals = ['breakfast', 'lunch', 'snacks', 'dinner'];
            const mealOrder = { breakfast: 0, lunch: 1, snacks: 2, dinner: 3 };
            
            // For "tomorrow" type: pause ALL meals for tomorrow (first day), 
            // and pause meals NOT selected for day after tomorrow
            if (pauseType === 'tomorrow') {
                // Step 1: Pause ALL meals for tomorrow (start date)
                const pauseDataTomorrow = {
                    studentId: user.rollNumber,
                    meals: allMeals, // ALL meals paused for tomorrow
                    pauseType,
                    startDate,
                    endDate: startDate, // Only tomorrow
                    outpassId: outpassData?._id || null
                };

                console.log(`[Pause Submit] Tomorrow - Pausing all meals for ${startDate}`);
                await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseDataTomorrow);

                // Step 2: Pause meals NOT selected for day after tomorrow (end date)
                const pausedMealsDayAfter = allMeals.filter(m => !selectedMeals.includes(m));
                
                const pauseDataDayAfter = {
                    studentId: user.rollNumber,
                    meals: pausedMealsDayAfter,
                    pauseType,
                    startDate: endDate,
                    endDate: endDate, // Only day after tomorrow
                    outpassId: outpassData?._id || null
                };

                console.log(`[Pause Submit] Day after tomorrow (${endDate}) - User will have: ${selectedMeals.join(', ')}`);
                console.log(`[Pause Submit] Day after tomorrow (${endDate}) - Paused meals: ${pausedMealsDayAfter.join(', ')}`);
                
                await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseDataDayAfter);
            }
            // For custom date range: 
            // - All middle days: pause ALL meals
            // - Last day: pause meals BEFORE the earliest selected meal (or all if none selected)
            else if (pauseType === 'custom' && startDate !== endDate) {
                // Step 1: Pause ALL meals for first day (start date)
                const pauseDataFirstDay = {
                    studentId: user.rollNumber,
                    meals: allMeals, // ALL meals paused for first day
                    pauseType,
                    startDate,
                    endDate: startDate, // Only first day
                    outpassId: outpassData?._id || null
                };

                console.log(`[Pause Submit] Custom range - First day (${startDate}) - Pausing all meals`);
                await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseDataFirstDay);

                // Step 2: Calculate days between first and last day
                const firstDate = new Date(startDate);
                const lastDate = new Date(endDate);
                const daysDiff = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));

                if (daysDiff > 1) {
                    // Step 2a: Create pauses for middle days (ALL meals paused) - only if more than 1 day difference
                    const nextDay = new Date(startDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

                    // End day is one day before the last day
                    const dayBeforeLastDay = new Date(lastDate);
                    dayBeforeLastDay.setDate(dayBeforeLastDay.getDate() - 1);
                    const dayBeforeLastDayStr = `${dayBeforeLastDay.getFullYear()}-${String(dayBeforeLastDay.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeLastDay.getDate()).padStart(2, '0')}`;

                    const pauseDataMiddleDays = {
                        studentId: user.rollNumber,
                        meals: allMeals, // ALL meals paused for middle days
                        pauseType,
                        startDate: nextDayStr,
                        endDate: dayBeforeLastDayStr,
                        outpassId: outpassData?._id || null
                    };

                    console.log(`[Pause Submit] Custom range - Middle days (${nextDayStr} to ${dayBeforeLastDayStr}) - Pausing all meals`);
                    await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseDataMiddleDays);
                }

                // Step 3: For last day, pause meals NOT selected by user
                const pausedMealsLastDay = allMeals.filter(m => !lastDayMeals.includes(m));

                if (pausedMealsLastDay.length > 0) {
                    const pauseDataLastDay = {
                        studentId: user.rollNumber,
                        meals: pausedMealsLastDay,
                        pauseType,
                        startDate: endDate,
                        endDate: endDate, // Only last day
                        outpassId: outpassData?._id || null
                    };

                    console.log(`[Pause Submit] Custom range - Last day (${endDate})`);
                    console.log(`[Pause Submit] User will have on last day: ${lastDayMeals.join(', ') || 'none'}`);
                    console.log(`[Pause Submit] Paused meals on last day: ${pausedMealsLastDay.join(', ') || 'none'}`);
                    
                    await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseDataLastDay);
                }
            } else if (pauseType === 'custom' && startDate === endDate) {
                // For single day custom pause: pause ALL meals
                const pauseData = {
                    studentId: user.rollNumber,
                    meals: allMeals, // ALL meals paused for single day
                    pauseType,
                    startDate,
                    endDate,
                    outpassId: outpassData?._id || null
                };

                console.log(`[Pause Submit] Custom single day (${startDate}) - Pausing all meals`);
                await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseData);
            } else if (pauseType === 'weekend') {
                // For Weekend: pause all meals from Friday to Sunday
                // Then pause only selected meals for Monday (return day)
                
                // Calculate Sunday (one day before Monday which is endDate)
                const mondayDate = new Date(endDate);
                const sundayDate = new Date(mondayDate);
                sundayDate.setDate(mondayDate.getDate() - 1);
                const sundayStr = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`;
                
                // Step 1: Pause ALL meals from Friday to Sunday
                const pauseDataWeekend = {
                    studentId: user.rollNumber,
                    meals: allMeals, // ALL meals paused for Friday to Sunday
                    pauseType,
                    startDate, // Friday
                    endDate: sundayStr, // Sunday
                    outpassId: outpassData?._id || null
                };

                console.log(`[Pause Submit] Weekend - Pausing all meals from ${startDate} (Friday) to ${sundayStr} (Sunday)`);
                await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseDataWeekend);

                // Step 2: Pause meals NOT selected for Monday (return day)
                const pausedMealsMonday = allMeals.filter(m => !weekendMeals.includes(m));
                
                if (pausedMealsMonday.length > 0) {
                    const pauseDataMonday = {
                        studentId: user.rollNumber,
                        meals: pausedMealsMonday,
                        pauseType,
                        startDate: endDate, // Monday
                        endDate: endDate, // Monday
                        outpassId: outpassData?._id || null
                    };

                    console.log(`[Pause Submit] Weekend - Monday (${endDate}) - User will have: ${weekendMeals.join(', ') || 'none'}`);
                    console.log(`[Pause Submit] Weekend - Monday (${endDate}) - Paused meals: ${pausedMealsMonday.join(', ')}`);
                    
                    await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause`, pauseDataMonday);
                }
            }
            
            setMessage({ type: 'success', text: 'Food pause created successfully!' });
            fetchPausedMeals();
            resetForm();
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.error || 'Failed to create pause. Please try again.' 
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelPause = async (pauseId) => {
        try {
            await axios.delete(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause/${pauseId}`);
            setMessage({ type: 'success', text: 'Pause cancelled successfully!' });
            fetchPausedMeals();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to cancel pause.' });
        }
    };

    const resetForm = () => {
        setStep(1);
        setPauseType('');
        setStartDate('');
        setEndDate('');
        setSelectedMeals([]);
        setLastDayMeals([]);
        setWeekendMeals([]);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const canEditMeal = (meal, pauseDate) => {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        
        // Get current date in local timezone (not UTC)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const currentDate = `${year}-${month}-${day}`;
        
        if (pauseDate === currentDate) {
            return currentTime < mealTimings[meal].editDeadline;
        }
        return pauseDate > currentDate;
    };

    // Check if a meal is already paused for a specific date
    const isMealAlreadyPaused = (meal, dateToCheck) => {
        if (!dateToCheck) return false;
        
        return pausedMeals.some(pause => 
            pause.meal_type === meal &&
            pause.pause_start_date <= dateToCheck &&
            pause.pause_end_date >= dateToCheck &&
            pause.is_active
        );
    };

    // Check if a meal should show "NO NEED" badge (for tomorrow scenario)
    const shouldShowNoNeed = (meal) => {
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        // Find the earliest selected meal
        const selectedIndices = selectedMeals.map(m => mealOrder.indexOf(m));
        if (selectedIndices.length === 0) return false;
        
        const earliestSelectedIndex = Math.min(...selectedIndices);
        
        // Show "NO NEED" for meals before the earliest selected meal
        return mealIndex < earliestSelectedIndex;
    };

    // Check if a meal should show "NO NEED" badge (for custom last day scenario)
    const shouldShowNoNeedLastDay = (meal) => {
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        // Find the earliest selected meal
        const selectedIndices = lastDayMeals.map(m => mealOrder.indexOf(m));
        if (selectedIndices.length === 0) return false;
        
        const earliestSelectedIndex = Math.min(...selectedIndices);
        
        // Show "NO NEED" for meals before the earliest selected meal
        return mealIndex < earliestSelectedIndex;
    };

    // Check if a meal is auto-selected and should be locked (for tomorrow scenario)
    const isAutoSelected = (meal) => {
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        const selectedIndices = selectedMeals.map(m => mealOrder.indexOf(m));
        if (selectedIndices.length === 0) return false;
        
        const earliestSelectedIndex = Math.min(...selectedIndices);
        
        // A meal is auto-selected if it's selected and comes after the first selected meal
        return selectedMeals.includes(meal) && mealIndex > earliestSelectedIndex;
    };

    // Check if a meal is auto-selected and should be locked (for custom last day scenario)
    const isAutoSelectedLastDay = (meal) => {
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        const selectedIndices = lastDayMeals.map(m => mealOrder.indexOf(m));
        if (selectedIndices.length === 0) return false;
        
        const earliestSelectedIndex = Math.min(...selectedIndices);
        
        // A meal is auto-selected if it's selected and comes after the first selected meal
        return lastDayMeals.includes(meal) && mealIndex > earliestSelectedIndex;
    };

    // Check if a meal should show "NO NEED" badge (for weekend Monday scenario)
    const shouldShowNoNeedWeekend = (meal) => {
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        // Find the earliest selected meal
        const selectedIndices = weekendMeals.map(m => mealOrder.indexOf(m));
        if (selectedIndices.length === 0) return false;
        
        const earliestSelectedIndex = Math.min(...selectedIndices);
        
        // Show "NO NEED" for meals before the earliest selected meal
        return mealIndex < earliestSelectedIndex;
    };

    // Check if a meal is auto-selected and should be locked (for weekend Monday scenario)
    const isAutoSelectedWeekend = (meal) => {
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const mealIndex = mealOrder.indexOf(meal);
        
        const selectedIndices = weekendMeals.map(m => mealOrder.indexOf(m));
        if (selectedIndices.length === 0) return false;
        
        const earliestSelectedIndex = Math.min(...selectedIndices);
        
        // A meal is auto-selected if it's selected and comes after the first selected meal
        return weekendMeals.includes(meal) && mealIndex > earliestSelectedIndex;
    };

    // Check if a paused meal can be edited (5 hours before meal time)
    const canEditPausedMeal = (meal, pauseDate) => {
        const now = new Date();
        
        // Get current date in local timezone
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const currentDate = `${year}-${month}-${day}`;
        
        // If pause date is in the future, can always edit
        if (pauseDate > currentDate) {
            return true;
        }
        
        // If pause date is today, check if we're at least 5 hours before meal time
        if (pauseDate === currentDate) {
            const mealStartTime = mealTimings[meal].start;
            const [mealHour, mealMinute] = mealStartTime.split(':').map(Number);
            
            // Calculate 5 hours before meal time
            const editDeadlineHour = mealHour - 5;
            const editDeadlineMinute = mealMinute;
            
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            
            // Convert to minutes for easy comparison
            const currentTotalMinutes = currentHour * 60 + currentMinute;
            const editDeadlineTotalMinutes = editDeadlineHour * 60 + editDeadlineMinute;
            
            return currentTotalMinutes < editDeadlineTotalMinutes;
        }
        
        // Past dates cannot be edited
        return false;
    };

    // Handle editing a paused meal (canceling the pause)
    const handleEditPausedMeal = async (meal, dateToCheck) => {
        if (!canEditPausedMeal(meal, dateToCheck)) {
            setMessage({ 
                type: 'error', 
                text: `Cannot edit ${meal}. You can only edit pauses at least 5 hours before the meal is served.` 
            });
            return;
        }

        // Find the pause entry for this meal and date
        const pauseEntry = pausedMeals.find(pause => 
            pause.meal_type === meal &&
            pause.pause_start_date <= dateToCheck &&
            pause.pause_end_date >= dateToCheck &&
            pause.is_active
        );

        if (!pauseEntry) {
            setMessage({ type: 'error', text: 'Pause entry not found.' });
            return;
        }

        try {
            await axios.delete(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/pause/${pauseEntry._id}`);
            setMessage({ type: 'success', text: `${meal} pause cancelled successfully!` });
            fetchPausedMeals();
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.error || 'Failed to cancel pause.' 
            });
        }
    };

    const categorizesPauses = () => {
        // Get current date in local timezone (not UTC)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const currentDate = `${year}-${month}-${day}`;
        
        return {
            active: pausedMeals.filter(p => p.pause_start_date <= currentDate && p.pause_end_date >= currentDate && p.is_active),
            upcoming: pausedMeals.filter(p => p.pause_start_date > currentDate && p.is_active),
            past: pausedMeals.filter(p => p.pause_end_date < currentDate || !p.is_active)
        };
    };

    // Check if a pause can still be edited (end date hasn't passed)
    const canEditPause = (pauseEndDate) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const currentDate = `${year}-${month}-${day}`;
        
        // Can edit if pause end date is today or in the future
        return pauseEndDate >= currentDate;
    };

    if (loading) {
        return (
            <div className="text-center my-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading food pause data...</p>
            </div>
        );
    }

    const { active, upcoming, past } = categorizesPauses();

    return (
        <div className="food-pause-manager">
            {/* Header */}
            <div className="mb-4">
                <div className="card border-0 shadow-sm">
                    <div className="card-body bg-gradient-primary text-white rounded">
                        <div className="d-flex align-items-center">
                            <div className="me-3">
                                <i className="bi bi-pause-circle-fill" style={{ fontSize: '2.5rem' }}></i>
                            </div>
                            <div>
                                <h3 className="mb-1">Smart Food Pause Management</h3>
                                <p className="mb-0 opacity-75">
                                    {outpassData ? 'Complete your food pause for approved outpass' : 'Manage your meal schedules efficiently'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {message && (
                <div className={`alert alert-${message.type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`}>
                    <i className={`bi bi-${message.type === 'error' ? 'exclamation-triangle' : 'check-circle'} me-2`}></i>
                    {message.text}
                    <button type="button" className="btn-close" onClick={() => setMessage(null)}></button>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="card border-0 shadow-sm mb-4">
                {/* <div className="card-header bg-light border-0">
                    <ul className="nav nav-tabs card-header-tabs">
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === 'pause' ? 'active' : ''}`}
                                onClick={() => setActiveTab('pause')}
                                style={{ color: activeTab === 'pause' ? '#0c63e4' : '#333' }}
                            >
                                <i className="bi bi-plus-circle me-2"></i>
                                Pause Meals
                            </button>
                        </li>
                    </ul>
                </div> */}

                <div className="card-body p-4">
                    {activeTab === 'pause' && (
                        <div>
                            {step === 1 && (
                                <div>
                                    <div className="text-center mb-4">
                                        <h4 className="text-primary mb-2">When do you want to pause meals?</h4>
                                        <p className="text-muted">Choose from flexible pause options</p>
                                    </div>
                                    
                                    <div className="row g-4 justify-content-center">
                                        {/* Deadline banner for Tomorrow */}
                                        <div className="col-12 mb-3">
                                            <div className="alert alert-warning" role="alert">
                                                <strong>Important Deadline</strong>
                                                <div className="mt-1">Changes for tomorrow's meals must be made before <strong>6:00 PM today</strong>. Current time: <strong>{new Date().toLocaleTimeString()}</strong></div>
                                                {isTomorrowDeadlinePassed() && (
                                                    <div className="mt-2 alert alert-danger p-2">⚠️ Deadline has passed for tomorrow's meals. You can still schedule for future dates.</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-md-4">
                                            <div 
                                                className={`card h-100 pause-option border-2 ${isTomorrowDeadlinePassed() ? 'border-secondary bg-light text-muted' : 'border-success'}`}
                                                onClick={() => !isTomorrowDeadlinePassed() && handlePauseTypeSelect('tomorrow')}
                                                style={{ cursor: isTomorrowDeadlinePassed() ? 'not-allowed' : 'pointer' }}
                                            >
                                                <div className="card-body text-center p-4">
                                                    <i className={`bi bi-calendar-plus ${isTomorrowDeadlinePassed() ? 'text-secondary' : 'text-success'} mb-3`} style={{ fontSize: '3rem' }}></i>
                                                    <h5 className={`card-title ${isTomorrowDeadlinePassed() ? 'text-secondary' : 'text-success'}`}>Tomorrow</h5>
                                                    <p className="card-text text-muted">Select what you'll have; others will be paused</p>
                                                    {isTomorrowDeadlinePassed() ? (
                                                        <small className="text-danger"><i className="bi bi-exclamation-triangle me-1"></i>Deadline passed (6 PM)</small>
                                                    ) : (
                                                        <small className="text-success"><i className="bi bi-check-circle me-1"></i>Available until 6 PM</small>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-md-4">
                                            <div 
                                                className="card h-100 pause-option border-2 border-info"
                                                onClick={() => handlePauseTypeSelect('weekend')}
                                            >
                                                <div className="card-body text-center p-4">
                                                    <i className="bi bi-umbrella-beach text-info mb-3" style={{ fontSize: '3rem' }}></i>
                                                    <h5 className="card-title text-info">Weekend</h5>
                                                    <p className="card-text text-muted">Automatic: Friday to Monday</p>
                                                    <small className="text-info">
                                                        <i className="bi bi-calendar-event me-1"></i>
                                                        We'll set the dates for you
                                                    </small>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-md-4">
                                            <div 
                                                className="card h-100 pause-option border-2 border-warning"
                                                onClick={() => handlePauseTypeSelect('custom')}
                                            >
                                                <div className="card-body text-center p-4">
                                                    <i className="bi bi-calendar-range text-warning mb-3" style={{ fontSize: '3rem' }}></i>
                                                    <h5 className="card-title text-warning">Custom Date Range</h5>
                                                    <p className="card-text text-muted">Choose start and end dates</p>
                                                    <small className="text-info">
                                                        <i className="bi bi-calendar-event me-1"></i>
                                                        Flexible duration
                                                    </small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div>
                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                        <h4 className="text-primary mb-0">Configure Meal Pause</h4>
                                        {!outpassData && (
                                            <button className="btn btn-outline-secondary" onClick={() => setStep(1)}>
                                                <i className="bi bi-arrow-left me-1"></i>Back
                                            </button>
                                        )}
                                    </div>

                                    {pauseType === 'custom' && (
                                        <div className="row mb-4">
                                            <div className="col-md-12 mb-3">
                                                <div className="alert alert-warning">
                                                    <i className="bi bi-info-circle me-2"></i>
                                                    <strong>Important:</strong> Minimum pause duration is 1 full day. All meals will be paused from start date until the day before return date.
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">Start Date (First Day of Pause)</label>
                                                <input
                                                    type="date"
                                                    className="form-control form-control-lg"
                                                    value={startDate}
                                                    onChange={(e) => {
                                                        setStartDate(e.target.value);
                                                        // Auto-adjust end date if it's not at least 1 day after start
                                                        if (endDate && endDate <= e.target.value) {
                                                            const nextDay = new Date(e.target.value);
                                                            nextDay.setDate(nextDay.getDate() + 1);
                                                            const y = nextDay.getFullYear();
                                                            const m = String(nextDay.getMonth() + 1).padStart(2, '0');
                                                            const d = String(nextDay.getDate()).padStart(2, '0');
                                                            setEndDate(`${y}-${m}-${d}`);
                                                        }
                                                    }}
                                                    min={getMinStartDate()}
                                                    disabled={!!outpassData}
                                                />
                                                {isTomorrowDeadlinePassed() && (
                                                    <small className="text-danger d-block mt-2">
                                                        <i className="bi bi-exclamation-circle me-1"></i>
                                                        Today's 6 PM deadline has passed. Minimum start date is tomorrow.
                                                    </small>
                                                )}
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold">End Date (Return Day)</label>
                                                <input
                                                    type="date"
                                                    className="form-control form-control-lg"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    min={startDate ? (() => {
                                                        const nextDay = new Date(startDate);
                                                        nextDay.setDate(nextDay.getDate() + 1);
                                                        const y = nextDay.getFullYear();
                                                        const m = String(nextDay.getMonth() + 1).padStart(2, '0');
                                                        const d = String(nextDay.getDate()).padStart(2, '0');
                                                        return `${y}-${m}-${d}`;
                                                    })() : ''}
                                                    disabled={!!outpassData || !startDate}
                                                />
                                                <small className="text-muted d-block mt-2">
                                                    <i className="bi bi-info-circle me-1"></i>
                                                    Select meals for this day below
                                                </small>
                                            </div>
                                        </div>
                                    )}

                                    {startDate && endDate && (
                                        <div>
                                            <div className="card bg-light border-0 mb-4">
                                                <div className="card-body">
                                                    <h5 className="text-primary mb-3">
                                                        <i className="bi bi-calendar-check me-2"></i>
                                                        Pause Period: {formatDate(startDate)} 
                                                        {startDate !== endDate && ` to ${formatDate(endDate)}`}
                                                    </h5>
                                                    {outpassData && (
                                                        <p className="text-info mb-0">
                                                            <i className="bi bi-info-circle me-1"></i>
                                                            Pre-filled from your approved outpass
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {pauseType === 'tomorrow' && (
                                                <div className="alert alert-info mb-4">
                                                    <h6 className="alert-heading">
                                                        <i className="bi bi-info-circle me-2"></i>
                                                    NOTE: How it works:
                                                    </h6>
                                                    <p className="mb-2"><strong>Tomorrow ({formatDate(startDate)}):</strong> All meals will be paused</p>
                                                    <p className="mb-0"><strong>Day After ({formatDate(endDate)}):</strong> Select meals you want below</p>
                                                </div>
                                            )}

                                            {pauseType !== 'weekend' && pauseType !== 'custom' && (
                                                <>
                                                    <h5 className="mb-3">
                                                        Select Your First Meal on {pauseType === 'tomorrow' ? formatDate(endDate) : 'Return Day'}
                                                    </h5>
                                                    <div className="alert alert-info mb-3">
                                                        <i className="bi bi-lightbulb-fill me-2"></i>
                                                        <strong>Smart Selection:</strong> Select your first meal when you return. All meals after it will be automatically included and locked. You can only change your first meal to adjust your plan.
                                                        <ul className="mb-0 mt-2">
                                                            <li><strong>Example:</strong> Select Breakfast → You'll have all 4 meals</li>
                                                            <li><strong>Example:</strong> Select Lunch → You'll have Lunch, Snacks & Dinner (Breakfast marked as "NO NEED")</li>
                                                        </ul>
                                                    </div>
                                                    <div className="row g-3 mb-4">
                                                        {['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => {
                                                            const isSelected = selectedMeals.includes(meal);
                                                            const isPaused = isMealAlreadyPaused(meal, endDate);
                                                            const showNoNeed = shouldShowNoNeed(meal);
                                                            const isLocked = isAutoSelected(meal);
                                                            const canEdit = isPaused && canEditPausedMeal(meal, endDate);
                                                            
                                                            return (
                                                                <div key={meal} className="col-md-6">
                                                                    <div 
                                                                        className={`card h-100 meal-card ${
                                                                            isPaused ? 'border-danger bg-danger bg-opacity-10' : 
                                                                            showNoNeed ? 'border-danger bg-danger bg-opacity-10' :
                                                                            isSelected ? 'border-success bg-success bg-opacity-10' : 
                                                                            'border-secondary'
                                                                        }`}
                                                                        onClick={() => !isPaused && !showNoNeed && !isLocked && handleMealToggle(meal, endDate)}
                                                                        style={{ 
                                                                            cursor: (isPaused || showNoNeed || isLocked) ? 'not-allowed' : 'pointer',
                                                                            opacity: (isPaused || showNoNeed) ? 0.7 : 1
                                                                        }}
                                                                    >
                                                                        <div className="card-body text-center p-3">
                                                                            <i className={`bi bi-${meal === 'breakfast' ? 'cup-hot' : meal === 'lunch' ? 'bowl' : meal === 'snacks' ? 'cookie' : 'moon'} ${
                                                                                isPaused ? 'text-danger' : 
                                                                                showNoNeed ? 'text-danger' :
                                                                                isSelected ? 'text-success' : 
                                                                                'text-secondary'
                                                                            } mb-2`} style={{ fontSize: '2rem' }}></i>
                                                                            <h6 className={`card-title text-capitalize ${
                                                                                isPaused ? 'text-danger' : 
                                                                                showNoNeed ? 'text-danger' :
                                                                                isSelected ? 'text-success' : 
                                                                                'text-secondary'
                                                                            }`}>
                                                                                {meal}
                                                                            </h6>
                                                                            <p className="card-text small text-muted mb-2">
                                                                                {mealTimings[meal].start}
                                                                            </p>
                                                                            {isPaused ? (
                                                                                <div>
                                                                                    <span className="badge bg-danger mb-2">
                                                                                        <i className="bi bi-x-circle me-1"></i>
                                                                                        PAUSED
                                                                                    </span>
                                                                                    {canEdit && (
                                                                                        <button
                                                                                            className="btn btn-sm btn-outline-danger d-block mx-auto mt-2"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleEditPausedMeal(meal, endDate);
                                                                                            }}
                                                                                            style={{ fontSize: '0.75rem' }}
                                                                                        >
                                                                                            <i className="bi bi-pencil me-1"></i>
                                                                                            Edit
                                                                                        </button>
                                                                                    )}
                                                                                    {!canEdit && (
                                                                                        <small className="text-danger d-block mt-2" style={{ fontSize: '0.7rem' }}>
                                                                                            Cannot edit (less than 5hrs)
                                                                                        </small>
                                                                                    )}
                                                                                </div>
                                                                            ) : showNoNeed ? (
                                                                                <span className="badge bg-danger">
                                                                                    <i className="bi bi-x-circle me-1"></i>
                                                                                    NO NEED
                                                                                </span>
                                                                            ) : isSelected ? (
                                                                                <div>
                                                                                    <span className="badge bg-success">
                                                                                        <i className="bi bi-check-circle me-1"></i>
                                                                                        WILL HAVE
                                                                                    </span>
                                                                                    {isLocked && (
                                                                                        <div className="mt-2">
                                                                                            <small className="text-success" style={{ fontSize: '0.7rem' }}>
                                                                                                <i className="bi bi-lock-fill me-1"></i>
                                                                                                Auto-selected
                                                                                            </small>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}

                                            {/* Weekend option - meal selection for Monday */}
                                            {pauseType === 'weekend' && (
                                                <>
                                                    <div className="alert alert-info mb-3">
                                                        <h6 className="alert-heading">
                                                            <i className="bi bi-info-circle me-2"></i>
                                                            How it works:
                                                        </h6>
                                                        <p className="mb-2"><strong>From {formatDate(startDate)} (Friday) to {(() => {
                                                            const mondayDate = new Date(endDate);
                                                            const sundayDate = new Date(mondayDate);
                                                            sundayDate.setDate(mondayDate.getDate() - 1);
                                                            return formatDate(sundayDate.toISOString().split('T')[0]);
                                                        })()} (Sunday):</strong> All meals will be paused</p>
                                                        <p className="mb-0"><strong>Return Day - {formatDate(endDate)} (Monday):</strong> Select meals you want below</p>
                                                    </div>

                                                    <div className="card border-3 border-success mb-4">
                                                        <div className="card-header bg-success bg-opacity-10 border-success border-bottom">
                                                            <h5 className="mb-0">
                                                                <i className="bi bi-calendar-check me-2"></i>
                                                                Select Your First Meal on Monday ({formatDate(endDate)})
                                                            </h5>
                                                        </div>
                                                        <div className="card-body">
                                                            <div className="alert alert-info mb-4">
                                                                <i className="bi bi-lightbulb-fill me-2"></i>
                                                                <strong>Smart Selection:</strong> Select your first meal when you return on Monday. All meals after it will be automatically included and locked.
                                                                <ul className="mb-0 mt-2">
                                                                    <li><strong>Example:</strong> Select Breakfast → You'll have all 4 meals</li>
                                                                    <li><strong>Example:</strong> Select Lunch → You'll have Lunch, Snacks & Dinner (Breakfast marked as "NO NEED")</li>
                                                                </ul>
                                                            </div>
                                                            <div className="row g-3">
                                                                {['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => {
                                                                    const isSelected = weekendMeals.includes(meal);
                                                                    const isPaused = isMealAlreadyPaused(meal, endDate);
                                                                    const showNoNeed = shouldShowNoNeedWeekend(meal);
                                                                    const isLocked = isAutoSelectedWeekend(meal);
                                                                    const canEdit = isPaused && canEditPausedMeal(meal, endDate);
                                                                    
                                                                    return (
                                                                        <div key={`weekend-${meal}`} className="col-md-6">
                                                                            <div 
                                                                                className={`card h-100 meal-card ${
                                                                                    isPaused ? 'border-danger bg-danger bg-opacity-10' : 
                                                                                    showNoNeed ? 'border-danger bg-danger bg-opacity-10' :
                                                                                    isSelected ? 'border-success bg-success bg-opacity-10' : 
                                                                                    'border-secondary'
                                                                                }`}
                                                                                onClick={() => !isPaused && !showNoNeed && !isLocked && handleWeekendMealToggle(meal)}
                                                                                style={{ 
                                                                                    cursor: (isPaused || showNoNeed || isLocked) ? 'not-allowed' : 'pointer',
                                                                                    transition: 'all 0.2s',
                                                                                    opacity: (isPaused || showNoNeed) ? 0.7 : 1
                                                                                }}
                                                                            >
                                                                                <div className="card-body text-center p-3">
                                                                                    <i className={`bi bi-${meal === 'breakfast' ? 'cup-hot' : meal === 'lunch' ? 'bowl' : meal === 'snacks' ? 'cookie' : 'moon'} ${
                                                                                        isPaused ? 'text-danger' : 
                                                                                        showNoNeed ? 'text-danger' :
                                                                                        isSelected ? 'text-success' : 
                                                                                        'text-secondary'
                                                                                    } mb-2`} style={{ fontSize: '2rem' }}></i>
                                                                                    <h6 className={`card-title text-capitalize ${
                                                                                        isPaused ? 'text-danger' : 
                                                                                        showNoNeed ? 'text-danger' :
                                                                                        isSelected ? 'text-success' : 
                                                                                        'text-secondary'
                                                                                    }`}>
                                                                                        {meal}
                                                                                    </h6>
                                                                                    <p className="card-text small text-muted mb-2">
                                                                                        {mealTimings[meal].start}
                                                                                    </p>
                                                                                    {isPaused ? (
                                                                                        <div>
                                                                                            <span className="badge bg-danger mb-2">
                                                                                                <i className="bi bi-x-circle me-1"></i>
                                                                                                PAUSED
                                                                                            </span>
                                                                                            {canEdit && (
                                                                                                <button
                                                                                                    className="btn btn-sm btn-outline-danger d-block mx-auto mt-2"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleEditPausedMeal(meal, endDate);
                                                                                                    }}
                                                                                                    style={{ fontSize: '0.75rem' }}
                                                                                                >
                                                                                                    <i className="bi bi-pencil me-1"></i>
                                                                                                    Edit
                                                                                                </button>
                                                                                            )}
                                                                                            {!canEdit && (
                                                                                                <small className="text-danger d-block mt-2" style={{ fontSize: '0.7rem' }}>
                                                                                                    Cannot edit (less than 5hrs)
                                                                                                </small>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : showNoNeed ? (
                                                                                        <span className="badge bg-danger">
                                                                                            <i className="bi bi-x-circle me-1"></i>
                                                                                            NO NEED
                                                                                        </span>
                                                                                    ) : isSelected ? (
                                                                                        <div>
                                                                                            <span className="badge bg-success">
                                                                                                <i className="bi bi-check-circle me-1"></i>
                                                                                                WILL HAVE
                                                                                            </span>
                                                                                            {isLocked && (
                                                                                                <div className="mt-2">
                                                                                                    <small className="text-success" style={{ fontSize: '0.7rem' }}>
                                                                                                        <i className="bi bi-lock-fill me-1"></i>
                                                                                                        Auto-selected
                                                                                                    </small>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : null}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Last Day Meal Selection for Custom Date Range */}
                                            {pauseType === 'custom' && startDate !== endDate && (
                                                <>
                                                    <div className="alert alert-info mb-3">
                                                        <h6 className="alert-heading">
                                                            <i className="bi bi-info-circle me-2"></i>
                                                            How it works:
                                                        </h6>
                                                        <p className="mb-2"><strong>From {formatDate(startDate)} to day before {formatDate(endDate)}:</strong> All meals will be paused</p>
                                                        <p className="mb-0"><strong>Return Day ({formatDate(endDate)}):</strong> Select meals you want below</p>
                                                    </div>

                                                    <div className="card border-3 border-success mb-4">
                                                    <div className="card-header bg-success bg-opacity-10 border-success border-bottom">
                                                        <h5 className="mb-0">
                                                            <i className="bi bi-calendar-check me-2"></i>
                                                            Select Meals You'll Have on Return Day ({formatDate(endDate)})
                                                        </h5>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="alert alert-info mb-4">
                                                            <i className="bi bi-lightbulb-fill me-2"></i>
                                                            <strong>Smart Selection:</strong> Select your first meal when you return on <strong>{formatDate(endDate)}</strong>. All meals after it will be automatically included and locked. You can only change your first meal to adjust your plan.
                                                            <ul className="mb-0 mt-2">
                                                                <li><strong>Example:</strong> Select Breakfast → You'll have all 4 meals</li>
                                                                <li><strong>Example:</strong> Select Lunch → You'll have Lunch, Snacks & Dinner (Breakfast marked as "NO NEED")</li>
                                                            </ul>
                                                        </div>
                                                        <div className="row g-3">
                                                            {['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => {
                                                                const isSelected = lastDayMeals.includes(meal);
                                                                const isPaused = isMealAlreadyPaused(meal, endDate);
                                                                const showNoNeed = shouldShowNoNeedLastDay(meal);
                                                                const isLocked = isAutoSelectedLastDay(meal);
                                                                const canEdit = isPaused && canEditPausedMeal(meal, endDate);
                                                                
                                                                return (
                                                                    <div key={`lastday-${meal}`} className="col-md-6">
                                                                        <div 
                                                                            className={`card h-100 meal-card ${
                                                                                isPaused ? 'border-danger bg-danger bg-opacity-10' : 
                                                                                showNoNeed ? 'border-danger bg-danger bg-opacity-10' :
                                                                                isSelected ? 'border-success bg-success bg-opacity-10' : 
                                                                                'border-secondary'
                                                                            }`}
                                                                            onClick={() => !isPaused && !showNoNeed && !isLocked && handleLastDayMealToggle(meal)}
                                                                            style={{ 
                                                                                cursor: (isPaused || showNoNeed || isLocked) ? 'not-allowed' : 'pointer',
                                                                                transition: 'all 0.2s',
                                                                                opacity: (isPaused || showNoNeed) ? 0.7 : 1
                                                                            }}
                                                                        >
                                                                            <div className="card-body text-center p-3">
                                                                                <i className={`bi bi-${meal === 'breakfast' ? 'cup-hot' : meal === 'lunch' ? 'bowl' : meal === 'snacks' ? 'cookie' : 'moon'} ${
                                                                                    isPaused ? 'text-danger' : 
                                                                                    showNoNeed ? 'text-danger' :
                                                                                    isSelected ? 'text-success' : 
                                                                                    'text-secondary'
                                                                                } mb-2`} style={{ fontSize: '2rem' }}></i>
                                                                                <h6 className={`card-title text-capitalize ${
                                                                                    isPaused ? 'text-danger' : 
                                                                                    showNoNeed ? 'text-danger' :
                                                                                    isSelected ? 'text-success' : 
                                                                                    'text-secondary'
                                                                                }`}>
                                                                                    {meal}
                                                                                </h6>
                                                                                <p className="card-text small text-muted mb-2">
                                                                                    {mealTimings[meal].start}
                                                                                </p>
                                                                                {isPaused ? (
                                                                                    <div>
                                                                                        <span className="badge bg-danger mb-2">
                                                                                            <i className="bi bi-x-circle me-1"></i>
                                                                                            PAUSED
                                                                                        </span>
                                                                                        {canEdit && (
                                                                                            <button
                                                                                                className="btn btn-sm btn-outline-danger d-block mx-auto mt-2"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleEditPausedMeal(meal, endDate);
                                                                                                }}
                                                                                                style={{ fontSize: '0.75rem' }}
                                                                                            >
                                                                                                <i className="bi bi-pencil me-1"></i>
                                                                                                Edit
                                                                                            </button>
                                                                                        )}
                                                                                        {!canEdit && (
                                                                                            <small className="text-danger d-block mt-2" style={{ fontSize: '0.7rem' }}>
                                                                                                Cannot edit (less than 5hrs)
                                                                                            </small>
                                                                                        )}
                                                                                    </div>
                                                                                ) : showNoNeed ? (
                                                                                    <span className="badge bg-danger">
                                                                                        <i className="bi bi-x-circle me-1"></i>
                                                                                        NO NEED
                                                                                    </span>
                                                                                ) : isSelected ? (
                                                                                    <div>
                                                                                        <span className="badge bg-success">
                                                                                            <i className="bi bi-check-circle me-1"></i>
                                                                                            WILL HAVE
                                                                                        </span>
                                                                                        {isLocked && (
                                                                                            <div className="mt-2">
                                                                                                <small className="text-success" style={{ fontSize: '0.7rem' }}>
                                                                                                    <i className="bi bi-lock-fill me-1"></i>
                                                                                                    Auto-selected
                                                                                                </small>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Show what will be paused on last day based on selection */}
                                                        {lastDayMeals.length > 0 && (
                                                            <div className="alert alert-success mt-4 mb-0">
                                                                <h6 className="alert-heading mb-2">
                                                                    <i className="bi bi-check-circle me-2"></i>
                                                                    On {formatDate(endDate)}:
                                                                </h6>
                                                                <div className="row g-2">
                                                                    <div className="col-md-6">
                                                                        <p className="mb-2">
                                                                            <strong>Your meals:</strong><br/>
                                                                            {lastDayMeals.map(meal => (
                                                                                <span key={meal} className="badge bg-success me-2 mb-1">{meal.toUpperCase()}</span>
                                                                            ))}
                                                                        </p>
                                                                    </div>
                                                                    <div className="col-md-6">
                                                                        {(() => {
                                                                            const allMeals = ['breakfast', 'lunch', 'snacks', 'dinner'];
                                                                            const pausedMeals = allMeals.filter(m => !lastDayMeals.includes(m));
                                                                            
                                                                            return (
                                                                                <p className="mb-0">
                                                                                    <strong>Paused meals:</strong><br/>
                                                                                    {pausedMeals.length > 0 ? (
                                                                                        pausedMeals.map(meal => (
                                                                                            <span key={meal} className="badge bg-danger me-2 mb-1">✕ {meal.toUpperCase()}</span>
                                                                                        ))
                                                                                    ) : (
                                                                                        <span className="badge bg-success">✓ NONE</span>
                                                                                    )}
                                                                                </p>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                </>
                                            )}

                                            <div className="d-flex gap-4 justify-content-center mb-4">
                                            </div>

                                            <div className="mt-5 text-center">
                                                <button
                                                    className="btn me-4"
                                                    onClick={handleSubmit}
                                                    disabled={submitting}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '20px',
                                                        fontWeight: '800',
                                                        fontSize: '1.3rem',
                                                        padding: '15px 40px',
                                                        boxShadow: '0 10px 25px rgba(139, 92, 246, 0.5)',
                                                        transition: 'all 0.4s ease',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1px',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!e.target.disabled) {
                                                            e.target.style.transform = 'translateY(-5px) scale(1.08)';
                                                            e.target.style.boxShadow = '0 15px 35px rgba(139, 92, 246, 0.7)';
                                                            e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!e.target.disabled) {
                                                            e.target.style.transform = 'translateY(0) scale(1)';
                                                            e.target.style.boxShadow = '0 10px 25px rgba(139, 92, 246, 0.5)';
                                                            e.target.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
                                                        }
                                                    }}
                                                >
                                                    {submitting ? (
                                                        <>
                                                            <span className="spinner-border spinner-border-sm me-3" role="status" aria-hidden="true"></span>
                                                            PROCESSING...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="bi bi-pause-fill me-3" style={{ fontSize: '1.4rem' }}></i>
                                                         SAVE 
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    
                </div>
            </div>

            <style jsx>{`
                .bg-gradient-primary {
                    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                }
                
                .pause-option {
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                
                .pause-option:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                }
                
                .meal-card {
                    transition: all 0.2s ease;
                    border: 2px solid;
                }
                
                .meal-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                
                .card {
                    border-radius: 12px;
                }
                
                .btn {
                    border-radius: 8px;
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
};

export default FoodPauseManagerEnhanced;
