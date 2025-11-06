import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import useCurrentUser from '../../hooks/student/useCurrentUser';

const FoodScheduleViewer = () => {
    const { user, loading: userLoading } = useCurrentUser();
    const [studentStatus, setStudentStatus] = useState(null);
    const [foodSchedule, setFoodSchedule] = useState([]);
    const [pausedRecords, setPausedRecords] = useState([]);
    const [weekDates, setWeekDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const mobileSelectRef = useRef(null);

    useEffect(() => {
        if (user?.rollNumber) {
            console.log(`[FOODSCHEDULE] Initializing for student: ${user.rollNumber}`);
            fetchStudentStatus();
            fetchFoodSchedule();
            fetchStudentPauses();
            generateWeekDates();
        }
    }, [user?.rollNumber]);

    useEffect(() => {
        const mq = () => window.innerWidth <= 768;
        const onResize = () => setIsMobile(mq());
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Close mobile dropdown on outside click or Escape
    useEffect(() => {
        const onDocClick = (e) => {
            if (!mobileOpen) return;
            if (mobileSelectRef.current && !mobileSelectRef.current.contains(e.target)) {
                setMobileOpen(false);
            }
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setMobileOpen(false);
        };
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [mobileOpen]);

    const fetchStudentStatus = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/student-status?studentId=${user.rollNumber}`);
            setStudentStatus(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFoodSchedule = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/student/menu/weekly-schedule-structured`);
            console.log('[FOOD SCHEDULE] API Response:', res.data);
            setFoodSchedule(res.data);
        } catch (err) {
            console.error('[FOOD SCHEDULE] Error:', err);
            // Fallback to the original endpoint if the new one fails
            try {
                const fallbackRes = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/student/menu/weekly-schedule`);
                console.log('[FOOD SCHEDULE] Fallback API Response:', fallbackRes.data);
                setFoodSchedule(fallbackRes.data);
            } catch (fallbackErr) {
                console.error('[FOOD SCHEDULE] Fallback Error:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentPauses = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/enhanced/my-pauses?studentId=${user.rollNumber}`);
            // Keep only active pauses (server returns all)
            const activePauses = (res.data || []).filter(p => p.is_active);
            console.log('[PAUSES] Fetched active pauses:', activePauses);
            activePauses.forEach(p => {
                console.log(`[PAUSES] Record: meal=${p.meal_type}, start=${p.pause_start_date}, end=${p.pause_end_date}, active=${p.is_active}`);
            });
            setPausedRecords(activePauses);
        } catch (err) {
            console.error('[PAUSES] Error fetching student pauses:', err);
            setPausedRecords([]);
        }
    };

    const generateWeekDates = () => {
        const today = new Date();
        
        // Generate 7 dates starting from today (next 7 days)
        const dates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            // Format as YYYY-MM-DD in local timezone (not UTC)
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${date}`;
        });
        setWeekDates(dates);
        
        // Set selected date to today (first date in the array)
        setSelectedDate(dates[0]);
    };

    const getMealsForDate = (dateString) => {
        // Weekly schedule always shows all 4 meals - this is a schedule viewer, not a pause manager
        return ['breakfast', 'lunch', 'snacks', 'dinner'];
    };

    const getMealStatusForDate = (dateString) => {
        // Build paused meals list from enhanced pauses (per-meal records)
        if (!pausedRecords || pausedRecords.length === 0) return { isPaused: false, pausedMeals: [] };

        const pausedMealsForDate = pausedRecords
            .filter(p => {
                // Ensure dates are in the same format (YYYY-MM-DD) for comparison
                const pStartDate = p.pause_start_date ? String(p.pause_start_date).trim() : '';
                const pEndDate = p.pause_end_date ? String(p.pause_end_date).trim() : '';
                const cDate = String(dateString).trim();
                
                // Check if meal is active and date is within range
                const isInRange = p.is_active && pStartDate <= cDate && pEndDate >= cDate;
                
                // Log for debugging
                if (isInRange) {
                    console.log(`[PAUSE CHECK] Meal ${p.meal_type} paused on ${cDate}: range ${pStartDate} to ${pEndDate}`);
                }
                
                return isInRange;
            })
            .map(p => p.meal_type);

        const uniquePaused = Array.from(new Set(pausedMealsForDate));
        return { isPaused: uniquePaused.length > 0, pausedMeals: uniquePaused };
    };

    const getMenuForDate = (dateString) => {
        // foodSchedule contains menu objects with dateStr field matching our date format
        return foodSchedule.find(item => item.dateStr === dateString || item.date === dateString) || null;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        
        // Get today's date in local timezone (not UTC)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // Get tomorrow's date in local timezone
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowYear = tomorrow.getFullYear();
        const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;

        if (dateString === todayStr) return 'Today';
        if (dateString === tomorrowStr) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
    };

    const getDayOfWeek = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    const getDayOfMonth = (dateString) => {
        const date = new Date(dateString);
        return date.getDate();
    };

    const getMonthShort = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short' });
    };

    const getMealIcon = (meal) => {
        const icons = { breakfast:'🍳', lunch:'🍛', snacks:'☕', dinner:'🌙' };
        return icons[meal] || '🍽️';
    };

    const getMealTime = (meal) => {
        const times = { breakfast:'7:30 - 10:00 AM', lunch:'12:00 - 2:00 PM', snacks:'4:00 - 6:00 PM', dinner:'7:30 - 9:30 PM' };
        return times[meal] || '';
    };

    const getMealColor = (meal) => {
        const colors = { 
            breakfast: '#3b82f6',
            lunch: '#047857',
            snacks: '#b45309',
            dinner: '#4c1d95'
        };
        return colors[meal] || '#3b82f6';
    };

    if (userLoading || loading || !user) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
                <div className="text-center">
                    <div className="spinner-border mb-3" role="status" style={{ width: '3.5rem', height: '3.5rem', borderWidth: '4px', color: '#3b82f6' }}>
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <h5 style={{ color: '#475569' }}>Loading your meal schedule...</h5>
                </div>
            </div>
        );
    }

    const dayMenu = getMenuForDate(selectedDate);
    const meals = getMealsForDate(selectedDate);
    const mealStatus = getMealStatusForDate(selectedDate);
    
    // console.log(`[RENDER] Selected date: ${selectedDate}, Paused meals for this date:`, mealStatus.pausedMeals);
    
    // Get today's date in local timezone (not UTC)
    const todayDate = new Date();
    const todayYear = todayDate.getFullYear();
    const todayMonth = String(todayDate.getMonth() + 1).padStart(2, '0');
    const todayDay = String(todayDate.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    return (
        <div className="weekly-schedule-root" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: window.innerWidth <= 768 ? '0.5rem' : '2rem' }}>
            <div className="container-fluid" style={{ maxWidth: window.innerWidth <= 768 ? '100%' : '1400px', padding: window.innerWidth <= 768 ? '0' : 'inherit' }}>
                {/* Header */}
                <div className="mb-4">
                    <h1 className="fw-bold mb-2" style={{ fontSize: '2rem', color: '#0f172a' }}>
                        Weekly Meal Schedule
                    </h1>
                    <p className="mb-0" style={{ color: '#64748b', fontSize: '1rem' }}>
                        View and plan your meals for the week
                    </p>
                </div>

                <div className="row g-3">
                    {/* Left Side - Date Selection (narrower, smaller) */}
                    <div className="col-12 col-lg-2">
                        {/* Dates column: desktop shows full stack; mobile shows a dropdown */}
                        <div>
                            {/* Mobile dropdown (CSS will show/hide based on viewport) */}
                            <div className="mobile-date-dropdown" ref={mobileSelectRef}>
                                <button
                                    type="button"
                                    className="mobile-select-button"
                                    aria-haspopup="listbox"
                                    aria-expanded={mobileOpen}
                                    onClick={() => setMobileOpen(!mobileOpen)}
                                >
                                    <span className="mobile-select-label">
                                        {selectedDate ? `${getDayOfMonth(selectedDate)} ${getMonthShort(selectedDate)} — ${getDayOfWeek(selectedDate)}` : 'Select date'}
                                    </span>
                                    <span className={`mobile-select-chevron ${mobileOpen ? 'open' : ''}`}>▾</span>
                                </button>

                                <ul className={`mobile-select-list ${mobileOpen ? 'open' : ''}`} role="listbox" aria-activedescendant={selectedDate} tabIndex={-1}>
                                    {weekDates.map(date => (
                                        <li
                                            key={date}
                                            id={date}
                                            role="option"
                                            aria-selected={date === selectedDate}
                                            className={`mobile-select-item ${date === selectedDate ? 'selected' : ''}`}
                                            onClick={() => { setSelectedDate(date); setMobileOpen(false); }}
                                        >
                                            <div className="mobile-select-item-left">
                                                <div className="mobile-select-day">{getDayOfMonth(date)} <small className="mobile-select-month">{getMonthShort(date)}</small></div>
                                                <div className="mobile-select-week">{getDayOfWeek(date)}</div>
                                            </div>
                                            <div className="mobile-select-right">
                                                {date === todayStr && <span className="today-badge">TODAY</span>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Desktop stacked dates (hidden on small screens via CSS) */}
                            <div className="desktop-date-stack d-flex flex-column gap-2">
                                {weekDates.map(date => {
                                    const isToday = date === todayStr;
                                    const isSelected = date === selectedDate;
                                    return (
                                        <button
                                            key={date}
                                            className="btn text-start border position-relative"
                                            onClick={() => setSelectedDate(date)}
                                            style={{
                                                backgroundColor: isSelected ? '#3b82f6' : '#ffffff',
                                                color: isSelected ? '#ffffff' : '#334155',
                                                borderColor: isSelected ? '#3b82f6' : '#e2e8f0',
                                                padding: '0.9rem 0.9rem',
                                                borderRadius: '10px',
                                                transition: 'all 0.15s ease',
                                                fontWeight: isSelected ? '600' : '500',
                                                borderWidth: '2px',
                                                minWidth: 'unset'
                                            }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="text-center" style={{ minWidth: '40px' }}>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: '700', lineHeight: 1 }}>{getDayOfMonth(date)}</div>
                                                        <div style={{ fontSize: '0.65rem', opacity: 0.75, marginTop: '2px' }}>{getMonthShort(date)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>{getDayOfWeek(date)}</div>
                                                        {isToday && (
                                                            <div style={{ fontSize: '0.65rem', fontWeight: '600', opacity: 0.8, marginTop: '2px' }}>TODAY</div>
                                                        )}
                                                    </div>
                                                </div>
                                                {isSelected && <div style={{ fontSize: '1.35rem', color: '#3b82f6', fontWeight: 700 }}>→</div>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Meals Display (wider) */}
                    <div className="col-12 col-lg-10">
                        <div className="weekly-panel" style={{ 
                            backgroundColor: '#ffffff', 
                            borderRadius: window.innerWidth <= 768 ? '12px' : '16px', 
                            padding: window.innerWidth <= 768 ? '1rem' : '2rem',
                            border: '1px solid #e2e8f0',
                            minHeight: window.innerWidth <= 768 ? '750px' : '520px',
                            margin: '0'
                        }}>
                            <div className="d-flex align-items-center justify-content-between mb-4 pb-3" style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <div>
                                    <h3 className="fw-bold mb-1" style={{ color: '#0f172a', fontSize: '1.5rem' }}>
                                        {formatDate(selectedDate)}
                                    </h3>
                                    <p className="mb-0" style={{ color: '#64748b', fontSize: '0.95rem' }}>
                                        {meals.length} {meals.length === 1 ? 'meal' : 'meals'} scheduled
                                    </p>
                                </div>
                                <div style={{ 
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    fontSize: '0.9rem'
                                }}>
                                    {meals.length} Meals
                                </div>
                            </div>

                            {meals.length > 0 ? (
                                <div className="row g-2 g-md-3">
                                    {meals.map(meal => {
                                        const isMealPaused = mealStatus.pausedMeals.includes(meal);
                                        return (
                                            <div key={meal} className="col-6 col-lg-6" style={{ position: 'relative' }}>
                                                <div
                                                    className="h-100 border"
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        borderColor: '#e2e8f0',
                                                        borderWidth: '2px',
                                                        borderRadius: '8px',
                                                        padding: window.innerWidth <= 768 ? '0.75rem' : '1rem',
                                                        transition: 'all 0.2s ease',
                                                        cursor: 'default',
                                                        borderLeftWidth: '4px',
                                                        borderLeftColor: getMealColor(meal)
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.boxShadow = 'none';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <div className="d-flex align-items-start justify-content-between mb-2 mb-md-3">
                                                        <div className="d-flex align-items-center" style={{ gap: window.innerWidth <= 768 ? '0.5rem' : '0.75rem' }}>
                                                            <div style={{
                                                                fontSize: window.innerWidth <= 768 ? '1.2rem' : '1.5rem',
                                                                backgroundColor: '#f1f5f9',
                                                                borderRadius: '8px',
                                                                width: window.innerWidth <= 768 ? '36px' : '48px',
                                                                height: window.innerWidth <= 768 ? '36px' : '48px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}>
                                                                {getMealIcon(meal)}
                                                            </div>
                                                            <div>
                                                                <h5 className="mb-1 fw-bold text-capitalize" style={{
                                                                    fontSize: window.innerWidth <= 768 ? '1.1rem' : '1.1rem',
                                                                    color: getMealColor(meal),
                                                                    lineHeight: '1.2'
                                                                }}>
                                                                    {meal}
                                                                </h5>
                                                                <div style={{ color: '#64748b', fontSize: window.innerWidth <= 768 ? '0.8rem' : '0.85rem' }}>
                                                                    {getMealTime(meal)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div
                                                        style={{
                                                            backgroundColor: '#f8fafc',
                                                            borderRadius: '6px',
                                                            padding: window.innerWidth <= 768 ? '0.8rem' : '0.9rem',
                                                            fontSize: window.innerWidth <= 768 ? '0.85rem' : '0.93rem',
                                                            lineHeight: '1.5',
                                                            color: '#334155',
                                                            minHeight: window.innerWidth <= 768 ? '60px' : '70px',
                                                            border: '1px solid #e2e8f0'
                                                        }}
                                                    >
                                                        {(dayMenu && dayMenu[meal]) || 'Menu will be updated soon'}
                                                    </div>
                                                </div>

                                                {/* Red X badge positioned at top-right corner of card */}
                                                {isMealPaused && (
                                                    <span style={{
                                                        position: 'absolute',
                                                        right: window.innerWidth <= 768 ? '8px' : '20px',
                                                        top: window.innerWidth <= 768 ? '8px' : '10px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#fff',
                                                        backgroundColor: '#dc2626',
                                                        width: window.innerWidth <= 768 ? '20px' : '28px',
                                                        height: window.innerWidth <= 768 ? '20px' : '28px',
                                                        borderRadius: '50%',
                                                        fontSize: window.innerWidth <= 768 ? '0.9rem' : '1.2rem',
                                                        fontWeight: 700,
                                                        lineHeight: 1,
                                                        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                                                    }}>✕</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                meals.length === 0 && (
                                    <div className="text-center py-5" style={{ marginTop: '4rem' }}>
                                        <div style={{
                                            fontSize: '4rem',
                                            opacity: 0.15,
                                            marginBottom: '1rem'
                                        }}>
                                            {'🍽️'}
                                        </div>
                                        <h4 className="mb-2" style={{ color: '#64748b', fontWeight: '600' }}>No meals scheduled</h4>
                                        <p className="mb-0" style={{ color: '#94a3b8' }}>
                                            {studentStatus?.pause_from ? 'Your meal service is currently paused' : 'Check back soon for meal updates'}
                                        </p>
                                    </div>
                                )
                            )}
                        </div>
                        </div>
                </div>
            </div>
        </div>
    );
};

export default FoodScheduleViewer;
