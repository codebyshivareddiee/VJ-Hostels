import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';
import FoodCountManager from './FoodCountManager';
import StudentFoodManager from './StudentFoodManager';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

const Food = () => {
    const [activeTab, setActiveTab] = useState('menu');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { token } = useAdmin();

    // Monthly menu data from backend
    const [monthlyMenuData, setMonthlyMenuData] = useState({});

    // Selected cell state for editing
    const [selectedCell, setSelectedCell] = useState(null);
    const [editFormData, setEditFormData] = useState({
        week: '',
        day: '',
        breakfast: '',
        lunch: '',
        snacks: '',
        dinner: ''
    });

    const getRotationWeek = (date = new Date()) => {
        const ROTATION_EPOCH_UTC = new Date(Date.UTC(2025, 0, 6));
        const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const weeksSinceEpoch = Math.floor((d - ROTATION_EPOCH_UTC) / MS_PER_WEEK);
        const idx = ((weeksSinceEpoch % 4) + 4) % 4;
        return idx + 1;
    };

    const [currentWeek] = useState(() => getRotationWeek());
    const [selectedWeek, setSelectedWeek] = useState(() => `week${getRotationWeek()}`);
    const [menuFormLoading, setMenuFormLoading] = useState(false);
    const [menuFormSuccess, setMenuFormSuccess] = useState('');
    const [menuFormError, setMenuFormError] = useState('');

    // Feedback state
    const [feedback, setFeedback] = useState([]);
    const [feedbackStats, setFeedbackStats] = useState(null);
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [feedbackFilters, setFeedbackFilters] = useState({
        dateFilter: 'thisMonth',  // Changed default to show current month data
        customStartDate: '',
        customEndDate: '',
        mealType: 'all',
        showOnlyWithComments: 'false'
    });

    // Helper functions
    const getRatingColor = (rating) => {
        if (rating >= 4.5) return 'success';
        if (rating >= 3.5) return 'info';
        if (rating >= 2.5) return 'warning';
        return 'danger';
    };

    const renderStars = (rating) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        for (let i = 0; i < fullStars; i++) {
            stars.push(<span key={`full-${i}`}>⭐</span>);
        }
        if (hasHalfStar) {
            stars.push(<span key="half">✨</span>);
        }
        return <span>{stars}</span>;
    };

    const getWeekDateRangeForWeekKey = (weekKey) => {
        const weekNumber = parseInt(weekKey.replace('week', ''));
        const ROTATION_EPOCH_UTC = new Date(Date.UTC(2025, 0, 6));
        const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
        
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const weeksSinceEpoch = Math.floor((todayUTC - ROTATION_EPOCH_UTC) / MS_PER_WEEK);
        const currentWeekNum = ((weeksSinceEpoch % 4) + 4) % 4 + 1;
        
        const weeksToAdd = weekNumber - currentWeekNum;
        const weekStart = new Date(todayUTC.getTime() + (weeksToAdd * MS_PER_WEEK));
        const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000));
        
        return { start: weekStart, end: weekEnd };
    };

    const formatShort = (date) => {
        const month = date.toLocaleString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}`;
    };

    const handleFeedbackFilterChange = (field, value) => {
        setFeedbackFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Derived feedback views computed from raw `feedback` (client-side)
    const getDateStr = (d) => new Date(d).toISOString().split('T')[0];
    
    const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    
    // Today's date string
    const todayStr = new Date().toISOString().split('T')[0];
    console.log('📅 Today\'s date string:', todayStr);    // Compute filtered period's averages and rating distribution, plus recent 7-day trends
    const {
        todayAvgByMeal,
        todayRatingDistribution,
        totalTodayReviews,
        recentTrendsFromFeedback,
        recentDates,
        recentByDate,
        filteredDates
    } = (() => {
        // Group reviews by date and meal
        const byDateMeal = {}; // { 'YYYY-MM-DD': { mealType: [ratings] } }

        // Log feedback processing
        console.log('🔍 Processing feedback data:', {
            totalFeedback: feedback.length,
            filter: feedbackFilters.dateFilter
        });

        feedback.forEach(f => {
            // Ensure f.date exists and is parseable - try both date and dateStr fields
            let dateStr = null;
            if (f.dateStr) {
                dateStr = f.dateStr; // Already in YYYY-MM-DD format
            } else if (f.date) {
                dateStr = getDateStr(f.date);
            }
            
            if (!dateStr) {
                console.log('⚠️ Skipping feedback with no date:', f);
                return;
            }

            // ignore future-dated reviews
            if (dateStr > todayStr) {
                console.log('⚠️ Skipping future-dated review:', dateStr);
                return;
            }

            if (!byDateMeal[dateStr]) byDateMeal[dateStr] = {};
            if (!byDateMeal[dateStr][f.mealType]) byDateMeal[dateStr][f.mealType] = [];
            byDateMeal[dateStr][f.mealType].push(Number(f.rating));
        });

        console.log('📊 Processed dates:', Object.keys(byDateMeal).sort());

        // Determine which dates to use for statistics based on filter
        let datesForStats = [todayStr]; // default to today
        
        console.log('🔍 Calculating date range for filter:', feedbackFilters.dateFilter);
        
        if (feedbackFilters.dateFilter === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            datesForStats = [yesterday.toISOString().split('T')[0]];
        } else if (feedbackFilters.dateFilter === 'thisWeek') {
            const d = new Date();
            const dayOfWeek = d.getDay();
            datesForStats = [];
            for (let i = dayOfWeek; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                datesForStats.push(date.toISOString().split('T')[0]);
            }
        } else if (feedbackFilters.dateFilter === 'lastWeek') {
            const d = new Date();
            const dayOfWeek = d.getDay();
            datesForStats = [];
            for (let i = dayOfWeek + 7; i >= dayOfWeek + 1; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                datesForStats.push(date.toISOString().split('T')[0]);
            }
        } else if (feedbackFilters.dateFilter === 'thisMonth') {
            const d = new Date();
            const year = d.getFullYear();
            const month = d.getMonth();
            const today = d.getDate();
            datesForStats = [];
            // Loop from day 1 to today (inclusive)
            for (let day = 1; day <= today; day++) {
                const date = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
                datesForStats.push(date.toISOString().split('T')[0]);
            }
            console.log('📅 This Month calculation:', {
                year,
                month: month + 1, // +1 for display (January = 1)
                todayDay: today,
                generatedDates: datesForStats,
                includestoday: datesForStats.includes(todayStr)
            });
        } else if (feedbackFilters.dateFilter === 'lastMonth') {
            const d = new Date();
            const lastMonth = d.getMonth() - 1;
            const year = lastMonth < 0 ? d.getFullYear() - 1 : d.getFullYear();
            const month = lastMonth < 0 ? 11 : lastMonth;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            datesForStats = [];
            // Loop from day 1 to last day of last month
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
                datesForStats.push(date.toISOString().split('T')[0]);
            }
        } else if (feedbackFilters.dateFilter === 'thisYear') {
            const d = new Date();
            const year = d.getFullYear();
            datesForStats = [];
            // Loop from Jan 1 to today
            for (let month = 0; month <= d.getMonth(); month++) {
                const daysInMonth = (month === d.getMonth()) ? d.getDate() : new Date(year, month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
                    datesForStats.push(date.toISOString().split('T')[0]);
                }
            }
        } else if (feedbackFilters.dateFilter === 'all' || feedbackFilters.dateFilter === 'allTime') {
            // For "all time", use all dates from the feedback data
            datesForStats = Object.keys(byDateMeal).sort();
        } else if (feedbackFilters.dateFilter === 'custom' && feedbackFilters.customStartDate && feedbackFilters.customEndDate) {
            const start = new Date(feedbackFilters.customStartDate);
            const end = new Date(feedbackFilters.customEndDate);
            datesForStats = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                datesForStats.push(d.toISOString().split('T')[0]);
                if (datesForStats.length > 0 && datesForStats[datesForStats.length - 1] === end.toISOString().split('T')[0]) break;
            }
        }

        console.log('📅 Calculated date range:', {
            filter: feedbackFilters.dateFilter,
            totalDates: datesForStats.length,
            firstDate: datesForStats[0],
            lastDate: datesForStats[datesForStats.length - 1],
            sampleDates: datesForStats.slice(0, 5)
        });

        // Calculate averages for filtered period
        const filteredAvg = {};
        let filteredTotal = 0;
        mealTypes.forEach(mt => {
            let allRatings = [];
            datesForStats.forEach(dateStr => {
                const ratings = (byDateMeal[dateStr] && byDateMeal[dateStr][mt]) || [];
                allRatings = allRatings.concat(ratings);
            });
            const count = allRatings.length;
            filteredTotal += count;
            const avg = count ? allRatings.reduce((a,b)=>a+b,0)/count : 0;
            filteredAvg[mt] = { averageRating: avg, count };
        });

        // Filtered period's rating distribution (1-5)
        const filteredRatingDist = [0,0,0,0,0]; // indices 0->1star ... 4->5star
        datesForStats.forEach(dateStr => {
            if (byDateMeal[dateStr]) {
                Object.values(byDateMeal[dateStr]).forEach(arr => {
                    arr.forEach(r => {
                        const idx = Math.min(Math.max(Math.round(r) - 1, 0), 4);
                        filteredRatingDist[idx]++;
                    });
                });
            }
        });

        // Generate trend dates based on filter (use filtered dates or last 7 days)
        let trendDates = [];
        
        if (datesForStats.length > 0 && datesForStats.length <= 31) {
            // Use filtered dates if reasonable range (up to 31 days)
            trendDates = [...datesForStats].sort();
        } else if (datesForStats.length > 31) {
            // If too many dates (like full year), show last 30 days
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                if (datesForStats.includes(dateStr)) {
                    trendDates.push(dateStr);
                }
            }
        } else {
            // Default: last 7 days
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                trendDates.push(d.toISOString().split('T')[0]);
            }
        }

        const recentTrends = [];
        const recentByDate = {}; // { date: { mealType: avg|null } }
        trendDates.forEach(date => {
            recentByDate[date] = {};
            mealTypes.forEach(mt => {
                const ratings = (byDateMeal[date] && byDateMeal[date][mt]) || [];
                const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;
                recentByDate[date][mt] = avg;
                recentTrends.push({ _id: { date, mealType: mt }, averageRating: avg });
            });
        });

        // Log final stats
        console.log('📈 Final statistics:', {
            totalReviews: filteredTotal,
            dateRange: datesForStats.length > 0 ? `${datesForStats[0]} to ${datesForStats[datesForStats.length - 1]}` : 'none',
            trendDates: trendDates.length,
            mealCounts: {
                breakfast: filteredAvg.breakfast?.count || 0,
                lunch: filteredAvg.lunch?.count || 0,
                snacks: filteredAvg.snacks?.count || 0,
                dinner: filteredAvg.dinner?.count || 0
            }
        });

        return {
            todayAvgByMeal: filteredAvg,
            todayRatingDistribution: filteredRatingDist,
            totalTodayReviews: filteredTotal,
            recentTrendsFromFeedback: recentTrends,
            recentDates: trendDates,
            recentByDate,
            filteredDates: datesForStats
        };
    })();

    useEffect(() => {
        if (activeTab === 'menu') {
            fetchMonthlyMenu();
        } else if (activeTab === 'feedback') {
            fetchFeedbacks();
        }
    }, [activeTab, token, feedbackFilters]);

    const fetchMonthlyMenu = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/menu/templates`);

            if (response.data && response.data.success && Array.isArray(response.data.data)) {
                const map = {};
                response.data.data.forEach(t => {
                    if (t.weekName && t.days) map[t.weekName] = t.days;
                });
                for (let i = 1; i <= 4; i++) {
                    const key = `week${i}`;
                    if (!map[key]) {
                        map[key] = {
                            monday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                            tuesday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                            wednesday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                            thursday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                            friday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                            saturday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
                            sunday: { breakfast: '', lunch: '', snacks: '', dinner: '' }
                        };
                    }
                }
                setMonthlyMenuData(map);
            }
            setError('');
        } catch (err) {
            setError('Failed to load weekly templates');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCellClick = (week, day, mealType) => {
        const dayData = monthlyMenuData[week][day];
        setSelectedCell({ week, day, mealType });
        setEditFormData({
            week: week,
            day: day,
            breakfast: dayData.breakfast,
            lunch: dayData.lunch,
            snacks: dayData.snacks,
            dinner: dayData.dinner
        });
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleEditFormSubmit = async (e) => {
        e.preventDefault();
        if (!editFormData.week || !editFormData.day) return;

        try {
            const response = await axios.put(`${import.meta.env.VITE_SERVER_URL}/food-api/menu/day`, {
                week: editFormData.week,
                day: editFormData.day,
                breakfast: editFormData.breakfast,
                lunch: editFormData.lunch,
                snacks: editFormData.snacks,
                dinner: editFormData.dinner
            });

            if (response.data.success) {
                setMonthlyMenuData(prev => ({
                    ...prev,
                    [editFormData.week]: {
                        ...prev[editFormData.week],
                        [editFormData.day]: {
                            breakfast: editFormData.breakfast,
                            lunch: editFormData.lunch,
                            snacks: editFormData.snacks,
                            dinner: editFormData.dinner
                        }
                    }
                }));

                setSelectedCell(null);
                setEditFormData({
                    week: '',
                    day: '',
                    breakfast: '',
                    lunch: '',
                    snacks: '',
                    dinner: ''
                });
            }
        } catch (error) {
            console.error('Error updating menu:', error);
            setMenuFormError('Failed to update menu. Please try again.');
            setTimeout(() => setMenuFormError(''), 3000);
        }
    };

    const fetchFeedbacks = async () => {
        try {
            setFeedbackLoading(true);
            
            console.log('📊 Fetching feedback with filters:', {
                dateFilter: feedbackFilters.dateFilter,
                mealType: feedbackFilters.mealType,
                showOnlyWithComments: feedbackFilters.showOnlyWithComments
            });
            
            const apiUrl = `${import.meta.env.VITE_SERVER_URL}/food-api/admin/feedback`;
            const params = {
                dateFilter: feedbackFilters.dateFilter,
                customStartDate: feedbackFilters.customStartDate,
                customEndDate: feedbackFilters.customEndDate,
                mealType: feedbackFilters.mealType,
                showOnlyWithComments: feedbackFilters.showOnlyWithComments
            };
            
            console.log('🌐 API URL:', apiUrl);
            console.log('📤 Request params:', params);
            
            // Fetch feedback data from admin API
            const response = await axios.get(apiUrl, {
                headers: { Authorization: `Bearer ${token}` },
                params: params
            });
            
            console.log('📥 Response status:', response.status);
            console.log('📥 Response data type:', Array.isArray(response.data) ? 'Array' : typeof response.data);
            console.log('📥 Response data length:', Array.isArray(response.data) ? response.data.length : 'N/A');
            if (response.data && Array.isArray(response.data)) {
                setFeedback(response.data);
                console.log('✅ Feedback loaded:', response.data.length, 'reviews');
                
                // Log sample dates and full data
                if (response.data.length > 0) {
                    const dates = [...new Set(response.data.map(f => f.dateStr || f.date))].sort();
                    console.log('📅 Date range:', dates[0], 'to', dates[dates.length - 1]);
                    console.log('📍 Total unique dates:', dates.length);
                    console.log('📊 Full feedback data:', response.data);
                    
                    // Group by meal type
                    const byMeal = {};
                    response.data.forEach(f => {
                        if (!byMeal[f.mealType]) byMeal[f.mealType] = [];
                        byMeal[f.mealType].push(f);
                    });
                    console.log('📊 Feedback by meal type:', byMeal);
                } else {
                    console.log('⚠️ Response data is empty array');
                }
            } else {
                setFeedback([]);
                console.log('⚠️ No feedback data received or invalid format');
            }
            
            // Also fetch stats
            const statsResponse = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/admin/feedback/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (statsResponse.data) {
                setFeedbackStats(statsResponse.data);
            }
        } catch (err) {
            console.error('❌ Failed to fetch feedbacks:', err);
            setFeedback([]);
        } finally {
            setFeedbackLoading(false);
        }
    };

    return (
        <div style={{ padding: '0' }}>
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes fadeIn {
                        0% { opacity: 0; }
                        100% { opacity: 1; }
                    }
                    @keyframes slideIn {
                        0% { transform: scale(0.9) translateY(-20px); opacity: 0; }
                        100% { transform: scale(1) translateY(0); opacity: 1; }
                    }
                `}
            </style>
            
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ 
                    fontSize: '1.875rem', 
                    fontWeight: '700', 
                    color: '#1E293B',
                    margin: '0 0 1rem 0'
                }}>Food Management</h2>
                <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                }}>
                    <button
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: activeTab === 'menu' ? '#4F46E5' : 'white',
                            color: activeTab === 'menu' ? 'white' : '#64748B',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            border: activeTab === 'menu' ? 'none' : '1px solid #E5E7EB',
                            minWidth: 'fit-content',
                            whiteSpace: 'nowrap'
                        }}
                        onClick={() => setActiveTab('menu')}
                    >
                        📅 Menu
                    </button>
                    <button
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: activeTab === 'students' ? '#4F46E5' : 'white',
                            color: activeTab === 'students' ? 'white' : '#64748B',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            border: activeTab === 'students' ? 'none' : '1px solid #E5E7EB',
                            minWidth: 'fit-content',
                            whiteSpace: 'nowrap'
                        }}
                        onClick={() => setActiveTab('students')}
                    >
                        👥 Students
                    </button>
                    <button
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: activeTab === 'feedback' ? '#4F46E5' : 'white',
                            color: activeTab === 'feedback' ? 'white' : '#64748B',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            border: activeTab === 'feedback' ? 'none' : '1px solid #E5E7EB',
                            minWidth: 'fit-content',
                            whiteSpace: 'nowrap'
                        }}
                        onClick={() => setActiveTab('feedback')}
                    >
                        💬 Reviews
                    </button>
                </div>
            </div>

            {activeTab === 'menu' && (
                <div className="row">
                    <div className="col-md-5">
                        <div className="card">
                            <div className="card-header bg-primary text-white">
                                <h5 className="mb-0">
                                    {selectedCell ? 'Edit Menu Item' : 'Create/Update Menu'}
                                </h5>
                            </div>
                            <div className="card-body">
                                {selectedCell ? (
                                    // Edit form for selected cell
                                    <div>
                                        <div className="alert alert-info" role="alert">
                                            <i className="bi bi-info-circle me-2"></i>
                                            Editing: <strong>{selectedCell.week.charAt(0).toUpperCase() + selectedCell.week.slice(1)} - {selectedCell.day.charAt(0).toUpperCase() + selectedCell.day.slice(1)}</strong>
                                        </div>
                                        <form onSubmit={handleEditFormSubmit}>
                                            <div className="mb-3">
                                                <label className="form-label">Week & Day</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={`${editFormData.week.charAt(0).toUpperCase() + editFormData.week.slice(1)} - ${editFormData.day.charAt(0).toUpperCase() + editFormData.day.slice(1)}`}
                                                    disabled
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label htmlFor="edit-breakfast" className="form-label">
                                                    <i className="bi bi-sunrise me-2 text-warning"></i>
                                                    Breakfast
                                                </label>
                                                <textarea
                                                    className="form-control"
                                                    id="edit-breakfast"
                                                    name="breakfast"
                                                    rows="2"
                                                    value={editFormData.breakfast}
                                                    onChange={handleEditFormChange}
                                                    placeholder="Enter breakfast menu items..."
                                                ></textarea>
                                            </div>
                                            <div className="mb-3">
                                                <label htmlFor="edit-lunch" className="form-label">
                                                    <i className="bi bi-sun me-2 text-warning"></i>
                                                    Lunch
                                                </label>
                                                <textarea
                                                    className="form-control"
                                                    id="edit-lunch"
                                                    name="lunch"
                                                    rows="2"
                                                    value={editFormData.lunch}
                                                    onChange={handleEditFormChange}
                                                    placeholder="Enter lunch menu items..."
                                                ></textarea>
                                            </div>
                                            <div className="mb-3">
                                                <label htmlFor="edit-snacks" className="form-label">
                                                    <i className="bi bi-cup-hot me-2 text-warning"></i>
                                                    Snacks
                                                </label>
                                                <textarea
                                                    className="form-control"
                                                    id="edit-snacks"
                                                    name="snacks"
                                                    rows="2"
                                                    value={editFormData.snacks}
                                                    onChange={handleEditFormChange}
                                                    placeholder="Enter snacks menu items..."
                                                ></textarea>
                                            </div>
                                            <div className="mb-3">
                                                <label htmlFor="edit-dinner" className="form-label">
                                                    <i className="bi bi-moon me-2 text-warning"></i>
                                                    Dinner
                                                </label>
                                                <textarea
                                                    className="form-control"
                                                    id="edit-dinner"
                                                    name="dinner"
                                                    rows="2"
                                                    value={editFormData.dinner}
                                                    onChange={handleEditFormChange}
                                                    placeholder="Enter dinner menu items..."
                                                ></textarea>
                                            </div>
                                            <div className="d-flex gap-2">
                                                <button type="submit" className="btn btn-success">
                                                    <i className="bi bi-check-lg me-1"></i>
                                                    Update Menu
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        setSelectedCell(null);
                                                        setEditFormData({
                                                            week: '',
                                                            day: '',
                                                            breakfast: '',
                                                            lunch: '',
                                                            snacks: '',
                                                            dinner: ''
                                                        });
                                                    }}
                                                >
                                                    <i className="bi bi-x-lg me-1"></i>
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                ) : (
                                    // Placeholder message to click on menu
                                    <div className="text-center my-5">
                                        <div className="mb-3">
                                            <i className="bi bi-cursor-fill text-primary" style={{ fontSize: '3rem' }}></i>
                                        </div>
                                        <h5 className="text-muted mb-2">Click on a Menu Item to Edit</h5>
                                        <p className="text-muted mb-0">
                                            Select any menu item from the table on the right to edit its details
                                        </p>
                                        <div className="mt-3">
                                            <small className="text-muted">
                                                <i className="bi bi-info-circle me-1"></i>
                                                Click on any cell in the menu table to start editing
                                            </small>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="col-md-7">
                        <div className="card">
                            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                                <h5 className="mb-0">Menu History</h5>
                                <div className="d-flex align-items-center gap-2">
                                    <label htmlFor="weekSelect" className="form-label mb-0 me-2">
                                        <i className="bi bi-calendar-week me-1"></i>
                                        Select Week:
                                    </label>
                                    <select
                                        id="weekSelect"
                                        className="form-select form-select-sm"
                                        style={{ width: 'auto', minWidth: '150px' }}
                                        value={selectedWeek}
                                        onChange={(e) => setSelectedWeek(e.target.value)}
                                    >
                                        <option value="">Select Week...</option>
                                        {Object.keys(monthlyMenuData).map((weekKey) => {
                                            const weekNumber = parseInt(weekKey.replace('week', ''));
                                            const isCurrentWeek = weekNumber === currentWeek;
                                            return (
                                                <option key={weekKey} value={weekKey}>
                                                    Week {weekNumber} {isCurrentWeek ? '(Current)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                            <div className="card-body">
                                {loading ? (
                                    <div className="text-center my-4">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : error ? (
                                    <div className="alert alert-danger" role="alert">
                                        {error}
                                    </div>
                                ) : (
                                    <div className="monthly-menu-container">
                                        {Object.entries(monthlyMenuData)
                                            .filter(([weekKey]) => {
                                                if (selectedWeek === 'all') return true;
                                                return weekKey === selectedWeek;
                                            })
                                            .map(([weekKey, weekData]) => (
                                            <div key={weekKey} className="mb-4">
                                                <h6 className={`mb-3 d-flex align-items-center ${parseInt(weekKey.replace('week', '')) === currentWeek ? 'text-success' : 'text-primary'}`}>
                                                        <i className="bi bi-calendar-week me-2"></i>
                                                        {weekKey.charAt(0).toUpperCase() + weekKey.slice(1)}
                                                        {parseInt(weekKey.replace('week', '')) === currentWeek && (
                                                            <span className="badge bg-success ms-2">
                                                                <i className="bi bi-clock me-1"></i>
                                                                Current Week
                                                            </span>
                                                        )}
                                                        {/* Display start-end date range for this rotation week */}
                                                        {(() => {
                                                            const range = getWeekDateRangeForWeekKey(weekKey);
                                                            if (!range) return null;
                                                            return (
                                                                <small className="text-muted ms-3" style={{ fontSize: '0.85rem' }}>
                                                                    {`(${formatShort(range.start)} - ${formatShort(range.end)})`}
                                                                </small>
                                                            );
                                                        })()}
                                                    </h6>
                                                <div className="table-responsive">
                                                    <table className="table table-bordered table-hover" style={{ fontSize: '0.85rem' }}>
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th scope="col" className="text-center" style={{ width: '12%' }}>Day</th>
                                                                <th scope="col" className="text-center" style={{ width: '22%' }}>
                                                                    <i className="bi bi-sunrise me-2 text-warning"></i>
                                                                    Breakfast
                                                                </th>
                                                                <th scope="col" className="text-center" style={{ width: '22%' }}>
                                                                    <i className="bi bi-sun me-2 text-warning"></i>
                                                                    Lunch
                                                                </th>
                                                                <th scope="col" className="text-center" style={{ width: '22%' }}>
                                                                    <i className="bi bi-cup-hot me-2 text-warning"></i>
                                                                    Snacks
                                                                </th>
                                                                <th scope="col" className="text-center" style={{ width: '22%' }}>
                                                                    <i className="bi bi-moon me-2 text-warning"></i>
                                                                    Dinner
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.entries(weekData).map(([dayKey, dayData]) => (
                                                                <tr key={dayKey}>
                                                                    <td className="fw-bold text-center align-middle text-capitalize">
                                                                        {dayKey}
                                                                    </td>
                                                                    <td
                                                                        className="align-middle clickable-cell"
                                                                        style={{
                                                                            padding: '8px',
                                                                            cursor: 'pointer',
                                                                            backgroundColor: selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === 'breakfast' ? '#e3f2fd' : 'transparent'
                                                                        }}
                                                                        onClick={() => handleCellClick(weekKey, dayKey, 'breakfast')}
                                                                    >
                                                                        <div className="meal-content" style={{
                                                                            fontSize: '0.8rem',
                                                                            lineHeight: '1.3',
                                                                            color: '#495057'
                                                                        }}>
                                                                            {dayData.breakfast}
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        className="align-middle clickable-cell"
                                                                        style={{
                                                                            padding: '8px',
                                                                            cursor: 'pointer',
                                                                            backgroundColor: selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === 'lunch' ? '#e3f2fd' : 'transparent'
                                                                        }}
                                                                        onClick={() => handleCellClick(weekKey, dayKey, 'lunch')}
                                                                    >
                                                                        <div className="meal-content" style={{
                                                                            fontSize: '0.8rem',
                                                                            lineHeight: '1.3',
                                                                            color: '#495057'
                                                                        }}>
                                                                            {dayData.lunch}
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        className="align-middle clickable-cell"
                                                                        style={{
                                                                            padding: '8px',
                                                                            cursor: 'pointer',
                                                                            backgroundColor: selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === 'snacks' ? '#e3f2fd' : 'transparent'
                                                                        }}
                                                                        onClick={() => handleCellClick(weekKey, dayKey, 'snacks')}
                                                                    >
                                                                        <div className="meal-content" style={{
                                                                            fontSize: '0.8rem',
                                                                            lineHeight: '1.3',
                                                                            color: '#495057'
                                                                        }}>
                                                                            {dayData.snacks}
                                                                        </div>
                                                                    </td>
                                                                    <td
                                                                        className="align-middle clickable-cell"
                                                                        style={{
                                                                            padding: '8px',
                                                                            cursor: 'pointer',
                                                                            backgroundColor: selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === 'dinner' ? '#e3f2fd' : 'transparent'
                                                                        }}
                                                                        onClick={() => handleCellClick(weekKey, dayKey, 'dinner')}
                                                                    >
                                                                        <div className="meal-content" style={{
                                                                            fontSize: '0.8rem',
                                                                            lineHeight: '1.3',
                                                                            color: '#495057'
                                                                        }}>
                                                                            {dayData.dinner}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="text-muted small mt-3">
                                            <i className="bi bi-info-circle me-1"></i>
                                            Last updated: {new Date().toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'feedback' && (
                <div>
                    {/* Feedback Filters */}
                    <div className="card mb-4">
                        <div className="card-header bg-primary text-white">
                            <h5 className="mb-0">
                                <i className="bi bi-funnel me-2"></i>
                                Feedback Filters
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-md-3">
                                    <label className="form-label">Date Range</label>
                                    <select
                                        className="form-select"
                                        value={feedbackFilters.dateFilter}
                                        onChange={(e) => handleFeedbackFilterChange('dateFilter', e.target.value)}
                                    >
                                        <option value="today">Today</option>
                                        <option value="yesterday">Yesterday</option>
                                        <option value="thisWeek">This Week</option>
                                        <option value="lastWeek">Last Week</option>
                                        <option value="thisMonth">This Month</option>
                                        <option value="lastMonth">Last Month</option>
                                        <option value="thisYear">This Year</option>
                                        <option value="all">All Time</option>
                                        {/* <option value="lastYear">Last Year</option>
                                        <option value="custom">Custom Range</option> */}
                                    </select>
                                </div>

                                {feedbackFilters.dateFilter === 'custom' && (
                                    <>
                                        <div className="col-md-2">
                                            <label className="form-label">Start Date</label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={feedbackFilters.customStartDate}
                                                onChange={(e) => handleFeedbackFilterChange('customStartDate', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label">End Date</label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={feedbackFilters.customEndDate}
                                                onChange={(e) => handleFeedbackFilterChange('customEndDate', e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="col-md-3">
                                    <label className="form-label">Meal Type</label>
                                    <select
                                        className="form-select"
                                        value={feedbackFilters.mealType}
                                        onChange={(e) => handleFeedbackFilterChange('mealType', e.target.value)}
                                    >
                                        <option value="all">All Meals</option>
                                        <option value="breakfast">Breakfast Only</option>
                                        <option value="lunch">Lunch Only</option>
                                        <option value="snacks">Snacks Only</option>
                                        <option value="dinner">Dinner Only</option>
                                    </select>
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label">Show Comments</label>
                                    <select
                                        className="form-select"
                                        value={feedbackFilters.showOnlyWithComments || 'false'}
                                        onChange={(e) => handleFeedbackFilterChange('showOnlyWithComments', e.target.value)}
                                    >
                                        <option value="false">All Reviews</option>
                                        <option value="true">With Comments Only</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* No Data Alert */}
                    {feedback.length === 0 && !feedbackLoading && (
                        <div className="alert alert-warning" role="alert">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            <strong>No reviews found for the selected period.</strong>
                            {feedbackFilters.dateFilter === 'thisMonth' && (
                                <span> Try selecting "Last Month" or "All Time" to see historical data.</span>
                            )}
                        </div>
                    )}

                    {/* Feedback Statistics */}
                    <div className="row g-4 mb-4">
                        {mealTypes.map(mt => (
                            <div className="col-md-3" key={mt}>
                                <div className={`card bg-${getRatingColor(todayAvgByMeal[mt].averageRating)} text-white h-100`}>
                                    <div className="card-body">
                                        <h5 className="card-title text-capitalize">{mt}</h5>
                                        <div className="d-flex align-items-center">
                                            <h2 className="display-4 me-2">{todayAvgByMeal[mt].count ? todayAvgByMeal[mt].averageRating.toFixed(1) : '—'}</h2>
                                            {todayAvgByMeal[mt].count ? renderStars(todayAvgByMeal[mt].averageRating) : <small className="text-light">No reviews</small>}
                                        </div>
                                        <p className="card-text">Based on {todayAvgByMeal[mt].count} reviews</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Rating Distribution and Trends Charts */}
                    {feedbackStats && (
                        <div className="row mb-4">
                            <div className="col-md-6">
                                <div className="card h-100">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">Rating Distribution</h5>
                                    </div>
                                    <div className="card-body">
                                        <div style={{ height: '300px' }}>
                                            <Pie
                                                data={{
                                                    labels: ['1 Stars','2 Stars','3 Stars','4 Stars','5 Stars'],
                                                    datasets: [
                                                        {
                                                            data: todayRatingDistribution,
                                                            backgroundColor: [
                                                                '#dc3545', // 1 star - danger
                                                                '#fd7e14', // 2 stars - orange
                                                                '#ffc107', // 3 stars - warning
                                                                '#0dcaf0', // 4 stars - info
                                                                '#198754', // 5 stars - success
                                                            ],
                                                            borderWidth: 1,
                                                        },
                                                    ],
                                                }}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    plugins: {
                                                        legend: {
                                                            position: 'bottom',
                                                        },
                                                        tooltip: {
                                                            callbacks: {
                                                                label: (context) => {
                                                                    const label = context.label || '';
                                                                    const value = context.raw || 0;
                                                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                                                    const percentage = Math.round((value / total) * 100);
                                                                    return `${label}: ${value} (${percentage}%)`;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>

                                        {/* Progress bars for each rating */}
                                        <div className="mt-4">
                                            {todayRatingDistribution.map((count, idx) => {
                                                const percentage = totalTodayReviews ? (count / totalTodayReviews) * 100 : 0;
                                                const star = idx + 1;
                                                return (
                                                    <div className="mb-2" key={star}>
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span>{star} Stars</span>
                                                            <span>{count} reviews ({percentage.toFixed(1)}%)</span>
                                                        </div>
                                                        <div className="progress" style={{ height: '10px' }}>
                                                            <div
                                                                className={`progress-bar bg-${getRatingColor(star)}`}
                                                                role="progressbar"
                                                                style={{ width: `${percentage}%` }}
                                                                aria-valuenow={percentage}
                                                                aria-valuemin="0"
                                                                aria-valuemax="100"
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="card h-100">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">
                                            Recent Trends 
                                            <small className="text-muted ms-2">
                                                ({recentDates.length} {recentDates.length === 1 ? 'day' : 'days'})
                                            </small>
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        {/* Group trends by date and meal type for the chart */}
                                        {(() => {
                                            // Process data for the chart using client-side recentTrendsFromFeedback
                                            const trendsByMeal = {};
                                            const dates = [...new Set(recentTrendsFromFeedback.map(t => t._id.date))].sort();

                                            // Initialize meal types
                                            recentTrendsFromFeedback.forEach(trend => {
                                                if (!trendsByMeal[trend._id.mealType]) {
                                                    trendsByMeal[trend._id.mealType] = {
                                                        label: trend._id.mealType.charAt(0).toUpperCase() + trend._id.mealType.slice(1),
                                                        data: [],
                                                        borderColor: trend._id.mealType === 'breakfast' ? '#fd7e14' :
                                                                    trend._id.mealType === 'lunch' ? '#0d6efd' :
                                                                    trend._id.mealType === 'snacks' ? '#6f42c1' : '#198754',
                                                        backgroundColor: trend._id.mealType === 'breakfast' ? 'rgba(253, 126, 20, 0.2)' :
                                                                        trend._id.mealType === 'lunch' ? 'rgba(13, 110, 253, 0.2)' :
                                                                        trend._id.mealType === 'snacks' ? 'rgba(111, 66, 193, 0.2)' : 'rgba(25, 135, 84, 0.2)',
                                                    };
                                                }
                                            });

                                            // Fill in data for each date
                                            dates.forEach(date => {
                                                Object.keys(trendsByMeal).forEach(mealType => {
                                                    const trend = recentTrendsFromFeedback.find(t =>
                                                        t._id.date === date && t._id.mealType === mealType
                                                    );

                                                    trendsByMeal[mealType].data.push(
                                                        trend ? trend.averageRating : null
                                                    );
                                                });
                                            });

                                            return (
                                                <div style={{ height: '300px' }}>
                                                    <Line
                                                        data={{
                                                            labels: dates.map(d => new Date(d).toLocaleDateString()),
                                                            datasets: Object.values(trendsByMeal),
                                                        }}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            scales: {
                                                                y: {
                                                                    min: 1,
                                                                    max: 5,
                                                                    title: {
                                                                        display: true,
                                                                        text: 'Average Rating'
                                                                    }
                                                                }
                                                            },
                                                            plugins: {
                                                                legend: {
                                                                    position: 'bottom',
                                                                },
                                                                tooltip: {
                                                                    callbacks: {
                                                                        label: (context) => {
                                                                            const label = context.dataset.label || '';
                                                                            const value = context.raw !== null ? context.raw.toFixed(1) : 'No data';
                                                                            return `${label}: ${value}`;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })()}

                                        {/* Table with detailed data — only show dates with at least one meal data */}
                                        <div className="table-responsive mt-4">
                                            <table className="table table-sm table-hover">
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Breakfast</th>
                                                        <th>Lunch</th>
                                                        <th>Snacks</th>
                                                        <th>Dinner</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recentDates.slice().reverse().filter((date) => {
                                                        // Check if at least one meal has data for this date
                                                        return mealTypes.some(mt => 
                                                            recentByDate[date] && recentByDate[date][mt] !== null
                                                        );
                                                    }).map((date) => (
                                                        <tr key={date}>
                                                            <td>{new Date(date).toLocaleDateString()}</td>
                                                            {mealTypes.map(mt => (
                                                                <td key={mt} className="text-capitalize">
                                                                    {recentByDate[date] && recentByDate[date][mt] !== null ? (
                                                                        <>
                                                                            <span className={`badge bg-${getRatingColor(recentByDate[date][mt])}`}>
                                                                                {recentByDate[date][mt].toFixed(1)}
                                                                            </span>
                                                                            {' '}
                                                                            {renderStars(recentByDate[date][mt])}
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-muted">No data</span>
                                                                    )}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {/* Show message if no data found */}
                                            {recentDates.filter((date) => {
                                                return mealTypes.some(mt => 
                                                    recentByDate[date] && recentByDate[date][mt] !== null
                                                );
                                            }).length === 0 && (
                                                <div className="alert alert-info text-center" role="alert">
                                                    <i className="bi bi-info-circle me-2"></i>
                                                    No review data available for the selected period.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bar Charts & Histograms Section */}
                    <div className="row mb-4">
                        {/* Bar Chart: Meal Type Comparison */}
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">
                                        <i className="bi bi-bar-chart-fill me-2"></i>
                                        Meal Type Comparison
                                    </h5>
                                </div>
                                <div className="card-body">
                                    <div style={{ height: '350px' }}>
                                        <Bar
                                            data={{
                                                labels: ['Breakfast', 'Lunch', 'Snacks', 'Dinner'],
                                                datasets: [
                                                    {
                                                        label: 'Average Rating',
                                                        data: mealTypes.map(mt => todayAvgByMeal[mt].count ? todayAvgByMeal[mt].averageRating : 0),
                                                        backgroundColor: [
                                                            'rgba(253, 126, 20, 0.8)',
                                                            'rgba(13, 110, 253, 0.8)',
                                                            'rgba(111, 66, 193, 0.8)',
                                                            'rgba(25, 135, 84, 0.8)'
                                                        ],
                                                        borderColor: [
                                                            'rgb(253, 126, 20)',
                                                            'rgb(13, 110, 253)',
                                                            'rgb(111, 66, 193)',
                                                            'rgb(25, 135, 84)'
                                                        ],
                                                        borderWidth: 2,
                                                        borderRadius: 5
                                                    },
                                                    {
                                                        label: 'Total Reviews',
                                                        data: mealTypes.map(mt => todayAvgByMeal[mt].count),
                                                        backgroundColor: 'rgba(128, 128, 128, 0.6)',
                                                        borderColor: 'rgb(128, 128, 128)',
                                                        borderWidth: 2,
                                                        borderRadius: 5
                                                    }
                                                ]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        position: 'bottom',
                                                    },
                                                    title: {
                                                        display: true,
                                                        text: 'Compare Ratings & Review Counts Across Meals',
                                                        font: {
                                                            size: 14,
                                                            weight: 'normal'
                                                        }
                                                    },
                                                    tooltip: {
                                                        callbacks: {
                                                            label: (context) => {
                                                                let label = context.dataset.label || '';
                                                                if (label) {
                                                                    label += ': ';
                                                                }
                                                                if (context.datasetIndex === 0) {
                                                                    label += context.raw.toFixed(2) + ' ⭐';
                                                                } else {
                                                                    label += context.raw + ' reviews';
                                                                }
                                                                return label;
                                                            }
                                                        }
                                                    }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        max: Math.max(5, Math.max(...mealTypes.map(mt => todayAvgByMeal[mt].count))),
                                                        title: {
                                                            display: true,
                                                            text: 'Rating (0-5) / Review Count'
                                                        }
                                                    },
                                                    x: {
                                                        title: {
                                                            display: true,
                                                            text: 'Meal Type'
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Histogram: Meal-wise Rating Distribution */}
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0">
                                        <i className="bi bi-bar-chart-line me-2"></i>
                                        Meal-wise Rating Distribution
                                    </h5>
                                </div>
                                <div className="card-body">
                                    <div style={{ height: '350px' }}>
                                        {(() => {
                                            // Calculate rating distribution per meal type
                                            const mealRatingDistribution = {};
                                            mealTypes.forEach(mt => {
                                                mealRatingDistribution[mt] = [0, 0, 0, 0, 0]; // [1star, 2star, 3star, 4star, 5star]
                                            });

                                            // Group feedback by meal type and rating
                                            feedback.forEach(f => {
                                                const mt = f.mealType;
                                                const rating = Math.round(f.rating);
                                                if (mealRatingDistribution[mt] && rating >= 1 && rating <= 5) {
                                                    mealRatingDistribution[mt][rating - 1]++;
                                                }
                                            });

                                            return (
                                                <Bar
                                                    data={{
                                                        labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
                                                        datasets: [
                                                            {
                                                                label: '🌅 Breakfast',
                                                                data: mealRatingDistribution.breakfast,
                                                                backgroundColor: 'rgba(253, 126, 20, 0.7)',
                                                                borderColor: 'rgb(253, 126, 20)',
                                                                borderWidth: 2
                                                            },
                                                            {
                                                                label: '☀️ Lunch',
                                                                data: mealRatingDistribution.lunch,
                                                                backgroundColor: 'rgba(13, 110, 253, 0.7)',
                                                                borderColor: 'rgb(13, 110, 253)',
                                                                borderWidth: 2
                                                            },
                                                            {
                                                                label: '☕ Snacks',
                                                                data: mealRatingDistribution.snacks,
                                                                backgroundColor: 'rgba(111, 66, 193, 0.7)',
                                                                borderColor: 'rgb(111, 66, 193)',
                                                                borderWidth: 2
                                                            },
                                                            {
                                                                label: '🌙 Dinner',
                                                                data: mealRatingDistribution.dinner,
                                                                backgroundColor: 'rgba(25, 135, 84, 0.7)',
                                                                borderColor: 'rgb(25, 135, 84)',
                                                                borderWidth: 2
                                                            }
                                                        ]
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        maintainAspectRatio: false,
                                                        plugins: {
                                                            legend: {
                                                                position: 'bottom',
                                                            },
                                                            title: {
                                                                display: true,
                                                                text: 'How Each Meal is Rated (1-5 Stars)',
                                                                font: {
                                                                    size: 14,
                                                                    weight: 'normal'
                                                                }
                                                            },
                                                            tooltip: {
                                                                callbacks: {
                                                                    label: (context) => {
                                                                        const label = context.dataset.label || '';
                                                                        const value = context.raw || 0;
                                                                        return `${label}: ${value} reviews`;
                                                                    }
                                                                }
                                                            }
                                                        },
                                                        scales: {
                                                            y: {
                                                                beginAtZero: true,
                                                                ticks: {
                                                                    stepSize: 1
                                                                },
                                                                title: {
                                                                    display: true,
                                                                    text: 'Number of Reviews'
                                                                }
                                                            },
                                                            x: {
                                                                title: {
                                                                    display: true,
                                                                    text: 'Rating'
                                                                }
                                                            }
                                                        }
                                                    }}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Individual Feedback/Reviews List */}
                    <div className="card">
                        <div className="card-header bg-light d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">
                                <i className="bi bi-chat-left-text me-2"></i>
                                Student Reviews & Comments
                            </h5>
                            <span className="badge bg-primary">
                                {feedback.length} {feedback.length === 1 ? 'Review' : 'Reviews'}
                            </span>
                        </div>
                        <div className="card-body">
                            {feedbackLoading ? (
                                <div className="text-center my-4">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="text-muted mt-2">Loading reviews...</p>
                                </div>
                            ) : feedback.length === 0 ? (
                                <div className="alert alert-info" role="alert">
                                    <i className="bi bi-info-circle me-2"></i>
                                    No feedback received for the selected filters. Try changing the date range or meal type.
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ width: '12%' }}>Date</th>
                                                <th style={{ width: '12%' }}>Meal Type</th>
                                                <th style={{ width: '15%' }}>Rating</th>
                                                <th style={{ width: '61%' }}>Comments</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {feedback.map((item, index) => (
                                                <tr key={item._id || index}>
                                                    <td>
                                                        <small className="text-muted">
                                                            {new Date(item.date || item.dateStr).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-secondary text-capitalize">
                                                            {item.mealType === 'breakfast' && '🌅'}
                                                            {item.mealType === 'lunch' && '☀️'}
                                                            {item.mealType === 'snacks' && '☕'}
                                                            {item.mealType === 'dinner' && '🌙'}
                                                            {' '}{item.mealType}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className={`badge bg-${getRatingColor(item.rating)}`}>
                                                                {item.rating}/5
                                                            </span>
                                                            <span>{renderStars(item.rating)}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {item.feedback && item.feedback.trim() !== '' ? (
                                                            <div className="d-flex align-items-start gap-2">
                                                                <i className="bi bi-chat-quote text-primary mt-1"></i>
                                                                <span>{item.feedback}</span>
                                                            </div>
                                                        ) : (
                                                            <em className="text-muted">
                                                                <i className="bi bi-dash-circle me-1"></i>
                                                                No comments provided
                                                            </em>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Pagination info */}
                                    {feedback.length > 10 && (
                                        <div className="mt-3 text-center text-muted">
                                            <small>
                                                Showing all {feedback.length} reviews. Use filters above to narrow down results.
                                            </small>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'students' && (
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        backgroundColor: '#4F46E5',
                        color: 'white',
                        padding: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>�</span>
                        <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Student Food Management</h5>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <StudentFoodManager />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Food;