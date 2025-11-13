import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';
import { toast } from 'react-hot-toast';
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

    // refs to allow focusing and highlighting the active textarea inside the edit modal
    const breakfastRef = useRef(null);
    const lunchRef = useRef(null);
    const snacksRef = useRef(null);
    const dinnerRef = useRef(null);

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
        dateFilter: 'thisMonth',
        customStartDate: '',
        customEndDate: '',
        mealType: 'all',
        showOnlyWithComments: 'false'
    });

    // Comment modal state for viewing long comments
    const [commentModal, setCommentModal] = useState({ open: false, text: '', student: '', date: '', mealType: '' });

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

    // Compute filtered period's averages and rating distribution, plus recent 7-day trends
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

        feedback.forEach(f => {
            // Ensure f.date exists and is parseable - try both date and dateStr fields
            let dateStr = null;
            if (f.dateStr) {
                dateStr = f.dateStr; // Already in YYYY-MM-DD format
            } else if (f.date) {
                dateStr = getDateStr(f.date);
            }
            
            if (!dateStr) {
                return;
            }

            // ignore future-dated reviews
            if (dateStr > todayStr) {
                return;
            }

            if (!byDateMeal[dateStr]) byDateMeal[dateStr] = {};
            if (!byDateMeal[dateStr][f.mealType]) byDateMeal[dateStr][f.mealType] = [];
            byDateMeal[dateStr][f.mealType].push(Number(f.rating));
        });

        // Determine which dates to use for statistics based on filter
        let datesForStats = [todayStr]; // default to today
        
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
            for (let day = 1; day <= today; day++) {
                const date = new Date(year, month, day, 12, 0, 0);
                datesForStats.push(date.toISOString().split('T')[0]);
            }
        } else if (feedbackFilters.dateFilter === 'lastMonth') {
            const d = new Date();
            const lastMonth = d.getMonth() - 1;
            const year = lastMonth < 0 ? d.getFullYear() - 1 : d.getFullYear();
            const month = lastMonth < 0 ? 11 : lastMonth;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            datesForStats = [];
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day, 12, 0, 0);
                datesForStats.push(date.toISOString().split('T')[0]);
            }
        } else if (feedbackFilters.dateFilter === 'thisYear') {
            const d = new Date();
            const year = d.getFullYear();
            datesForStats = [];
            for (let month = 0; month <= d.getMonth(); month++) {
                const daysInMonth = (month === d.getMonth()) ? d.getDate() : new Date(year, month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day, 12, 0, 0);
                    datesForStats.push(date.toISOString().split('T')[0]);
                }
            }
        } else if (feedbackFilters.dateFilter === 'all' || feedbackFilters.dateFilter === 'allTime') {
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
        const filteredRatingDist = [0,0,0,0,0];
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

        // Generate trend dates based on filter
        let trendDates = [];
        
        if (datesForStats.length > 0 && datesForStats.length <= 31) {
            trendDates = [...datesForStats].sort();
        } else if (datesForStats.length > 31) {
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                if (datesForStats.includes(dateStr)) {
                    trendDates.push(dateStr);
                }
            }
        } else {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                trendDates.push(d.toISOString().split('T')[0]);
            }
        }

        const recentTrends = [];
        const recentByDate = {};
        trendDates.forEach(date => {
            recentByDate[date] = {};
            mealTypes.forEach(mt => {
                const ratings = (byDateMeal[date] && byDateMeal[date][mt]) || [];
                const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;
                recentByDate[date][mt] = avg;
                recentTrends.push({ _id: { date, mealType: mt }, averageRating: avg });
            });
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

    // When a cell is selected, focus the corresponding textarea inside modal and scroll it into view
    useEffect(() => {
        if (!selectedCell) return;
        const refs = {
            breakfast: breakfastRef,
            lunch: lunchRef,
            snacks: snacksRef,
            dinner: dinnerRef
        };
        const ref = refs[selectedCell.mealType];
        if (ref && ref.current) {
            // small timeout to ensure modal has rendered
            setTimeout(() => {
                try {
                    ref.current.focus();
                    ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } catch (e) {
                    // ignore
                }
            }, 50);
        }
    }, [selectedCell]);

    // Confirmation modal state for update action
    const [showConfirm, setShowConfirm] = useState(false);

    const handleEditFormSubmit = (e) => {
        e.preventDefault();
        if (!editFormData.week || !editFormData.day) return;
        // Open confirmation modal before performing the update
        setShowConfirm(true);
    };

    const confirmUpdateMenu = async () => {
        setShowConfirm(false);
        setMenuFormLoading(true);
        try {
            const response = await axios.put(`${import.meta.env.VITE_SERVER_URL}/food-api/menu/day`, {
                week: editFormData.week,
                day: editFormData.day,
                breakfast: editFormData.breakfast,
                lunch: editFormData.lunch,
                snacks: editFormData.snacks,
                dinner: editFormData.dinner
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.success) {
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

                // show confirmation toast
                toast.success('Menu updated successfully');
            } else {
                // show error toast
                toast.error('Failed to update menu. Please try again.');
            }
        } catch (error) {
            toast.error('Failed to update menu. Please try again.');
        } finally {
            setMenuFormLoading(false);
        }
    };

    const fetchFeedbacks = async () => {
        try {
            setFeedbackLoading(true);
            
            const apiUrl = `${import.meta.env.VITE_SERVER_URL}/food-api/admin/feedback`;
            const params = {
                dateFilter: feedbackFilters.dateFilter,
                customStartDate: feedbackFilters.customStartDate,
                customEndDate: feedbackFilters.customEndDate,
                mealType: feedbackFilters.mealType,
                showOnlyWithComments: feedbackFilters.showOnlyWithComments
            };
            
            const response = await axios.get(apiUrl, {
                headers: { Authorization: `Bearer ${token}` },
                params: params
            });
            
            if (response.data && Array.isArray(response.data)) {
                setFeedback(response.data);
            } else {
                setFeedback([]);
            }
            
            // Also fetch stats
            const statsResponse = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/admin/feedback/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (statsResponse.data) {
                setFeedbackStats(statsResponse.data);
            }
        } catch (err) {
            console.error('Failed to fetch feedbacks:', err);
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
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: '1px solid #E5E7EB',
                    overflow: 'visible' // allow inner scrollbars to be shown on small screens
                }}>
                    <div style={{
                        backgroundColor: '#4F46E5',
                        color: 'white',
                        padding: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                            📋 Weekly Menu - Click to Edit
                        </h5>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <label style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                                Select Week:
                            </label>
                            <select
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    minWidth: '150px'
                                }}
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
                    <div style={{ padding: '1.5rem' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    border: '4px solid #E0E7FF',
                                    borderTop: '4px solid #4F46E5',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    margin: '0 auto 1rem'
                                }} />
                                <p style={{ color: '#64748B' }}>Loading menu...</p>
                            </div>
                        ) : error ? (
                            <div style={{
                                backgroundColor: '#FEE2E2',
                                border: '1px solid #FCA5A5',
                                borderRadius: '8px',
                                padding: '1rem',
                                color: '#991B1B'
                            }}>
                                {error}
                            </div>
                        ) : (
                            <div>
                                {Object.entries(monthlyMenuData)
                                    .filter(([weekKey]) => {
                                        if (selectedWeek === 'all') return true;
                                        return weekKey === selectedWeek;
                                    })
                                    .map(([weekKey, weekData]) => (
                                    <div key={weekKey} style={{ marginBottom: '2rem' }}>
                                        <h6 style={{
                                            marginBottom: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: parseInt(weekKey.replace('week', '')) === currentWeek ? '#10B981' : '#4F46E5',
                                            fontSize: '1.125rem',
                                            fontWeight: '600'
                                        }}>
                                            📅 {weekKey.charAt(0).toUpperCase() + weekKey.slice(1)}
                                            {parseInt(weekKey.replace('week', '')) === currentWeek && (
                                                <span style={{
                                                    backgroundColor: '#10B981',
                                                    color: 'white',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem',
                                                    marginLeft: '1rem'
                                                }}>
                                                    Current Week
                                                </span>
                                            )}
                                            {(() => {
                                                const range = getWeekDateRangeForWeekKey(weekKey);
                                                if (!range) return null;
                                                return (
                                                    <small style={{ 
                                                        fontSize: '0.85rem',
                                                        color: '#64748B',
                                                        marginLeft: '1rem',
                                                        fontWeight: '400'
                                                    }}>
                                                        ({formatShort(range.start)} - {formatShort(range.end)})
                                                    </small>
                                                );
                                            })()}
                                        </h6>
                                        <div style={{
                                            borderRadius: '8px',
                                            overflowX: 'auto',
                                            WebkitOverflowScrolling: 'touch', // smooth scrolling on iOS
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                            border: '1px solid #E5E7EB'
                                        }}>
                                            {/* enforce a minimum table width so columns don't collapse on small screens */}
                                            <table style={{ minWidth: '720px', width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                                <thead style={{ backgroundColor: '#F8FAFC' }}>
                                                    <tr>
                                                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', width: '12%' }}>Day</th>
                                                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', width: '22%' }}>
                                                            🌅 Breakfast
                                                        </th>
                                                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', width: '22%' }}>
                                                            ☀️ Lunch
                                                        </th>
                                                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', width: '22%' }}>
                                                            ☕ Snacks
                                                        </th>
                                                        <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', width: '22%' }}>
                                                            🌙 Dinner
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(weekData).map(([dayKey, dayData]) => (
                                                        <tr key={dayKey} style={{ borderTop: '1px solid #E5E7EB' }}>
                                                            <td style={{
                                                                padding: '1rem',
                                                                textAlign: 'center',
                                                                fontWeight: '600',
                                                                textTransform: 'capitalize',
                                                                backgroundColor: '#F8FAFC'
                                                            }}>
                                                                {dayKey}
                                                            </td>
                                                            {['breakfast', 'lunch', 'snacks', 'dinner'].map(mealType => (
                                                                <td
                                                                    key={mealType}
                                                                    style={{
                                                                        padding: '0.75rem',
                                                                        cursor: 'pointer',
                                                                        backgroundColor: selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === mealType ? '#E0E7FF' : 'white',
                                                                        transition: 'all 0.2s ease',
                                                                        borderLeft: selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === mealType ? '3px solid #4F46E5' : '3px solid transparent'
                                                                    }}
                                                                    onClick={() => handleCellClick(weekKey, dayKey, mealType)}
                                                                    onMouseEnter={(e) => {
                                                                        if (!(selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === mealType)) {
                                                                            e.currentTarget.style.backgroundColor = '#F1F5F9';
                                                                        }
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (!(selectedCell?.week === weekKey && selectedCell?.day === dayKey && selectedCell?.mealType === mealType)) {
                                                                            e.currentTarget.style.backgroundColor = 'white';
                                                                        }
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        fontSize: '0.8rem',
                                                                        lineHeight: '1.4',
                                                                        color: '#374151',
                                                                        minHeight: '2.5rem',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}>
                                                                        {dayData[mealType] || <em style={{ color: '#9CA3AF' }}>Click to add</em>}
                                                                    </div>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Comment modal for showing large comments */}
            {commentModal.open && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }} onClick={() => setCommentModal({ open: false, text: '', student: '', date: '', mealType: '' })}>
                    <div onClick={(e) => e.stopPropagation()} style={{
                        backgroundColor: 'white',
                        borderRadius: '10px',
                        maxWidth: '720px',
                        width: '100%',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            backgroundColor: '#4F46E5',
                            color: 'white',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ fontWeight: 700 }}>
                                Comment by {commentModal.student} — {commentModal.mealType ? (commentModal.mealType.charAt(0).toUpperCase() + commentModal.mealType.slice(1)) : ''}
                            </div>
                            <button onClick={() => setCommentModal({ open: false, text: '', student: '', date: '', mealType: '' })} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                        </div>
                        <div style={{ padding: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>{commentModal.text}</div>
                            <div style={{ marginTop: '1rem', color: '#64748B', fontSize: '0.9rem' }}>Date: {commentModal.date ? new Date(commentModal.date).toLocaleString() : ''}</div>
                        </div>
                    </div>
                </div>
            )}

            {showConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 1101,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '10px',
                        maxWidth: '440px',
                        width: '100%',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            backgroundColor: '#4F46E5',
                            color: 'white',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <strong>Confirm Update</strong>
                            <button onClick={() => setShowConfirm(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                        </div>
                        <div style={{ padding: '1rem' }}>
                            <p style={{ margin: '0 0 1rem 0', color: '#374151' }}>
                                Are you sure you want to update the menu for <strong>{selectedCell?.week} - {selectedCell?.day}</strong>? This will overwrite the existing items for this day.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button onClick={confirmUpdateMenu} style={{ flex: 1, padding: '0.6rem', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                                    {menuFormLoading ? 'Updating...' : 'Confirm'}
                                </button>
                                <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '0.6rem', backgroundColor: '#6B7280', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedCell && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        animation: 'slideIn 0.3s ease-out'
                    }}>
                        <div style={{
                            backgroundColor: '#4F46E5',
                            color: 'white',
                            padding: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                                ✏️ Edit Menu Item
                            </h5>
                            <button
                                onClick={() => setSelectedCell(null)}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    fontSize: '1.5rem',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ 
                            padding: '1.5rem',
                            maxHeight: 'calc(90vh - 80px)',
                            overflowY: 'auto'
                        }}>
                            <div style={{
                                backgroundColor: '#E0E7FF',
                                border: '1px solid #C7D2FE',
                                borderRadius: '8px',
                                padding: '1rem',
                                marginBottom: '1.5rem'
                            }}>
                                <div style={{ fontSize: '0.875rem', color: '#4F46E5', marginBottom: '0.25rem' }}>Editing</div>
                                <div style={{ fontWeight: '600', color: '#1E293B' }}>
                                    {selectedCell.week.charAt(0).toUpperCase() + selectedCell.week.slice(1)} - {selectedCell.day.charAt(0).toUpperCase() + selectedCell.day.slice(1)}
                                </div>
                            </div>
                            
                            <form onSubmit={handleEditFormSubmit}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>🌅 Breakfast</label>
                                    <textarea
                                        name="breakfast"
                                        ref={breakfastRef}
                                        value={editFormData.breakfast}
                                        onChange={handleEditFormChange}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: selectedCell?.mealType === 'breakfast' ? '2px solid #4F46E5' : '1px solid #E5E7EB',
                                            boxShadow: selectedCell?.mealType === 'breakfast' ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
                                            borderRadius: '6px',
                                            resize: 'vertical',
                                            minHeight: '60px',
                                            fontSize: '0.875rem'
                                        }}
                                        placeholder="Enter breakfast items..."
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>☀️ Lunch</label>
                                    <textarea
                                        name="lunch"
                                        ref={lunchRef}
                                        value={editFormData.lunch}
                                        onChange={handleEditFormChange}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: selectedCell?.mealType === 'lunch' ? '2px solid #4F46E5' : '1px solid #E5E7EB',
                                            boxShadow: selectedCell?.mealType === 'lunch' ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
                                            borderRadius: '6px',
                                            resize: 'vertical',
                                            minHeight: '60px',
                                            fontSize: '0.875rem'
                                        }}
                                        placeholder="Enter lunch items..."
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>☕ Snacks</label>
                                    <textarea
                                        name="snacks"
                                        ref={snacksRef}
                                        value={editFormData.snacks}
                                        onChange={handleEditFormChange}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: selectedCell?.mealType === 'snacks' ? '2px solid #4F46E5' : '1px solid #E5E7EB',
                                            boxShadow: selectedCell?.mealType === 'snacks' ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
                                            borderRadius: '6px',
                                            resize: 'vertical',
                                            minHeight: '60px',
                                            fontSize: '0.875rem'
                                        }}
                                        placeholder="Enter snack items..."
                                    />
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>🌙 Dinner</label>
                                    <textarea
                                        name="dinner"
                                        ref={dinnerRef}
                                        value={editFormData.dinner}
                                        onChange={handleEditFormChange}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: selectedCell?.mealType === 'dinner' ? '2px solid #4F46E5' : '1px solid #E5E7EB',
                                            boxShadow: selectedCell?.mealType === 'dinner' ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none',
                                            borderRadius: '6px',
                                            resize: 'vertical',
                                            minHeight: '60px',
                                            fontSize: '0.875rem'
                                        }}
                                        placeholder="Enter dinner items..."
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        type="submit"
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            backgroundColor: '#10B981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#10B981'}
                                    >
                                        Update Menu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCell(null)}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            backgroundColor: '#6B7280',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#4B5563'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#6B7280'}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'feedback' && (
                <div>
                    {/* Feedback Filters */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        border: '1px solid #E5E7EB',
                        marginBottom: '1.5rem',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            backgroundColor: '#4F46E5',
                            color: 'white',
                            padding: '1rem 1.25rem'
                        }}>
                            <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                                🔍 Feedback Filters
                            </h5>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Date Range</label>
                                    <select
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '6px',
                                            fontSize: '0.875rem'
                                        }}
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
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Meal Type</label>
                                    <select
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '6px',
                                            fontSize: '0.875rem'
                                        }}
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

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Show Comments</label>
                                    <select
                                        style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '6px',
                                            fontSize: '0.875rem'
                                        }}
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
                        <div style={{
                            backgroundColor: '#FEF3C7',
                            border: '1px solid #FCD34D',
                            borderRadius: '8px',
                            padding: '1rem',
                            marginBottom: '1.5rem',
                            color: '#92400E'
                        }}>
                            <strong>No reviews found for the selected period.</strong>
                            {feedbackFilters.dateFilter === 'thisMonth' && (
                                <span> Try selecting "Last Month" or "All Time" to see historical data.</span>
                            )}
                        </div>
                    )}

                    {/* Feedback Statistics Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {mealTypes.map(mt => {
                            const ratingColor = getRatingColor(todayAvgByMeal[mt].averageRating);
                            const bgColors = {
                                success: '#D1FAE5',
                                info: '#DBEAFE',
                                warning: '#FEF3C7',
                                danger: '#FEE2E2'
                            };
                            const textColors = {
                                success: '#065F46',
                                info: '#1E40AF',
                                warning: '#92400E',
                                danger: '#991B1B'
                            };
                            return (
                                <div key={mt} style={{
                                    backgroundColor: bgColors[ratingColor],
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    border: '1px solid ' + (ratingColor === 'success' ? '#A7F3D0' : ratingColor === 'info' ? '#BFDBFE' : ratingColor === 'warning' ? '#FCD34D' : '#FCA5A5')
                                }}>
                                    <h5 style={{ margin: '0 0 0.75rem 0', textTransform: 'capitalize', color: textColors[ratingColor], fontSize: '1.125rem' }}>{mt}</h5>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <h2 style={{ fontSize: '2.5rem', margin: '0 0.5rem 0 0', color: textColors[ratingColor] }}>
                                            {todayAvgByMeal[mt].count ? todayAvgByMeal[mt].averageRating.toFixed(1) : '—'}
                                        </h2>
                                        {todayAvgByMeal[mt].count ? renderStars(todayAvgByMeal[mt].averageRating) : <small style={{ color: textColors[ratingColor] }}>No reviews</small>}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: textColors[ratingColor] }}>Based on {todayAvgByMeal[mt].count} reviews</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Charts Section */}
                    {feedbackStats && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            {/* Rating Distribution Pie Chart */}
                            <div style={{
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                border: '1px solid #E5E7EB',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    backgroundColor: '#F8FAFC',
                                    padding: '1rem 1.25rem',
                                    borderBottom: '1px solid #E5E7EB'
                                }}>
                                    <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Rating Distribution</h5>
                                </div>
                                <div style={{ padding: '1.5rem' }}>
                                    <div style={{ height: '300px' }}>
                                        <Pie
                                            data={{
                                                labels: ['1 Stars','2 Stars','3 Stars','4 Stars','5 Stars'],
                                                datasets: [{
                                                    data: todayRatingDistribution,
                                                    backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#0dcaf0', '#198754'],
                                                    borderWidth: 1,
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { position: 'bottom' },
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

                                    {/* Progress bars */}
                                    <div style={{ marginTop: '1.5rem' }}>
                                        {todayRatingDistribution.map((count, idx) => {
                                            const percentage = totalTodayReviews ? (count / totalTodayReviews) * 100 : 0;
                                            const star = idx + 1;
                                            return (
                                                <div key={star} style={{ marginBottom: '0.75rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                                                        <span>{star} Stars</span>
                                                        <span>{count} reviews ({percentage.toFixed(1)}%)</span>
                                                    </div>
                                                    <div style={{ height: '10px', backgroundColor: '#E5E7EB', borderRadius: '5px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${percentage}%`,
                                                            height: '100%',
                                                            backgroundColor: star === 5 ? '#198754' : star === 4 ? '#0dcaf0' : star === 3 ? '#ffc107' : star === 2 ? '#fd7e14' : '#dc3545',
                                                            transition: 'width 0.3s ease'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Trends Line Chart */}
                            <div style={{
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                border: '1px solid #E5E7EB',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    backgroundColor: '#F8FAFC',
                                    padding: '1rem 1.25rem',
                                    borderBottom: '1px solid #E5E7EB'
                                }}>
                                    <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                                        Recent Trends
                                        <small style={{ color: '#64748B', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                                            ({recentDates.length} {recentDates.length === 1 ? 'day' : 'days'})
                                        </small>
                                    </h5>
                                </div>
                                <div style={{ padding: '1.5rem' }}>
                                    {(() => {
                                        const trendsByMeal = {};
                                        const dates = [...new Set(recentTrendsFromFeedback.map(t => t._id.date))].sort();

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

                                        dates.forEach(date => {
                                            Object.keys(trendsByMeal).forEach(mealType => {
                                                const trend = recentTrendsFromFeedback.find(t =>
                                                    t._id.date === date && t._id.mealType === mealType
                                                );
                                                trendsByMeal[mealType].data.push(trend ? trend.averageRating : null);
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
                                                                title: { display: true, text: 'Average Rating' }
                                                            }
                                                        },
                                                        plugins: {
                                                            legend: { position: 'bottom' },
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

                                    {/* Detailed table */}
                                    <div style={{ marginTop: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                            <thead style={{ backgroundColor: '#F8FAFC', position: 'sticky', top: 0 }}>
                                                <tr>
                                                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>Date</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #E5E7EB' }}>Breakfast</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #E5E7EB' }}>Lunch</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #E5E7EB' }}>Snacks</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #E5E7EB' }}>Dinner</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentDates.slice().reverse().filter((date) => {
                                                    return mealTypes.some(mt => 
                                                        recentByDate[date] && recentByDate[date][mt] !== null
                                                    );
                                                }).map((date) => (
                                                    <tr key={date}>
                                                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
                                                            {new Date(date).toLocaleDateString()}
                                                        </td>
                                                        {mealTypes.map(mt => (
                                                            <td key={mt} style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #F1F5F9' }}>
                                                                {recentByDate[date] && recentByDate[date][mt] !== null ? (
                                                                    <>
                                                                        <span style={{
                                                                            backgroundColor: recentByDate[date][mt] >= 4.5 ? '#D1FAE5' : 
                                                                                           recentByDate[date][mt] >= 3.5 ? '#DBEAFE' : 
                                                                                           recentByDate[date][mt] >= 2.5 ? '#FEF3C7' : '#FEE2E2',
                                                                            color: recentByDate[date][mt] >= 4.5 ? '#065F46' : 
                                                                                   recentByDate[date][mt] >= 3.5 ? '#1E40AF' : 
                                                                                   recentByDate[date][mt] >= 2.5 ? '#92400E' : '#991B1B',
                                                                            padding: '0.25rem 0.5rem',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.8rem',
                                                                            fontWeight: '600'
                                                                        }}>
                                                                            {recentByDate[date][mt].toFixed(1)}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span style={{ color: '#9CA3AF' }}>—</span>
                                                                )}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bar Charts Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* Meal Type Comparison */}
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            border: '1px solid #E5E7EB',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                backgroundColor: '#F8FAFC',
                                padding: '1rem 1.25rem',
                                borderBottom: '1px solid #E5E7EB'
                            }}>
                                <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>📊 Meal Type Comparison</h5>
                            </div>
                            <div style={{ padding: '1.5rem' }}>
                                <div style={{ height: '350px' }}>
                                    <Bar
                                        data={{
                                            labels: ['Breakfast', 'Lunch', 'Snacks', 'Dinner'],
                                            datasets: [
                                                {
                                                    label: 'Average Rating',
                                                    data: mealTypes.map(mt => todayAvgByMeal[mt].count ? todayAvgByMeal[mt].averageRating : 0),
                                                    backgroundColor: ['rgba(253, 126, 20, 0.8)', 'rgba(13, 110, 253, 0.8)', 'rgba(111, 66, 193, 0.8)', 'rgba(25, 135, 84, 0.8)'],
                                                    borderColor: ['rgb(253, 126, 20)', 'rgb(13, 110, 253)', 'rgb(111, 66, 193)', 'rgb(25, 135, 84)'],
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
                                                legend: { position: 'bottom' },
                                                title: {
                                                    display: true,
                                                    text: 'Compare Ratings & Review Counts Across Meals',
                                                    font: { size: 14, weight: 'normal' }
                                                }
                                            },
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    max: Math.max(5, Math.max(...mealTypes.map(mt => todayAvgByMeal[mt].count)))
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Meal-wise Rating Distribution */}
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            border: '1px solid #E5E7EB',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                backgroundColor: '#F8FAFC',
                                padding: '1rem 1.25rem',
                                borderBottom: '1px solid #E5E7EB'
                            }}>
                                <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>📊 Meal-wise Rating Distribution</h5>
                            </div>
                            <div style={{ padding: '1.5rem' }}>
                                <div style={{ height: '350px' }}>
                                    {(() => {
                                        const mealRatingDistribution = {};
                                        mealTypes.forEach(mt => {
                                            mealRatingDistribution[mt] = [0, 0, 0, 0, 0];
                                        });

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
                                                        legend: { position: 'bottom' },
                                                        title: {
                                                            display: true,
                                                            text: 'How Each Meal is Rated (1-5 Stars)',
                                                            font: { size: 14, weight: 'normal' }
                                                        }
                                                    },
                                                    scales: {
                                                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                                                    }
                                                }}
                                            />
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Individual Reviews List */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        border: '1px solid #E5E7EB',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            backgroundColor: '#F8FAFC',
                            padding: '1rem 1.25rem',
                            borderBottom: '1px solid #E5E7EB',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h5 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                                💬 Student Reviews & Comments
                            </h5>
                            <span style={{
                                backgroundColor: '#4F46E5',
                                color: 'white',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                            }}>
                                {feedback.length} {feedback.length === 1 ? 'Review' : 'Reviews'}
                            </span>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {feedbackLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        border: '4px solid #E0E7FF',
                                        borderTop: '4px solid #4F46E5',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        margin: '0 auto 1rem'
                                    }} />
                                    <p style={{ color: '#64748B' }}>Loading reviews...</p>
                                </div>
                            ) : feedback.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem',
                                    color: '#64748B'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                                    <h6 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>No Reviews Found</h6>
                                    <p style={{ margin: 0 }}>No feedback received for the selected filters. Try changing the date range or meal type.</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ backgroundColor: '#F8FAFC' }}>
                                            <tr>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', width: '12%' }}>Date</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', width: '15%' }}>Student</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', width: '12%' }}>Meal Type</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', width: '15%' }}>Rating</th>
                                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', width: '46%' }}>Comments</th>
                                                </tr>
                                        </thead>
                                        <tbody>
                                                {feedback.map((item, index) => (
                                                <tr key={item._id || index} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748B' }}>
                                                        {new Date(item.date || item.dateStr).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', color: '#374151', fontWeight: 600 }}>
                                                        {item.studentName || (item.student && (item.student.name || item.student.fullName)) || item.name || 'Unknown'}
                                                    </td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        <span style={{
                                                            backgroundColor: '#E5E7EB',
                                                            color: '#374151',
                                                            padding: '0.25rem 0.5rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '500',
                                                            textTransform: 'capitalize'
                                                        }}>
                                                            {item.mealType ? (item.mealType.charAt(0).toUpperCase() + item.mealType.slice(1)) : '—'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{
                                                                backgroundColor: item.rating >= 4.5 ? '#D1FAE5' : 
                                                                               item.rating >= 3.5 ? '#DBEAFE' : 
                                                                               item.rating >= 2.5 ? '#FEF3C7' : '#FEE2E2',
                                                                color: item.rating >= 4.5 ? '#065F46' : 
                                                                       item.rating >= 3.5 ? '#1E40AF' : 
                                                                       item.rating >= 2.5 ? '#92400E' : '#991B1B',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.875rem',
                                                                fontWeight: '600'
                                                            }}>
                                                                {item.rating}/5
                                                            </span>
                                                            <span>{renderStars(item.rating)}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                        {item.feedback && item.feedback.trim() !== '' ? (
                                                            (() => {
                                                                const txt = item.feedback;
                                                                const max = 80;
                                                                if (txt.length > max) {
                                                                    const short = txt.slice(0, max).trim() + '...';
                                                                    return (
                                                                        <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                                                                            <span style={{ color: '#4F46E5', fontSize: '1rem' }}>💬</span>
                                                                            <span onClick={() => setCommentModal({ open: true, text: txt, student: item.studentName || (item.student && (item.student.name || item.student.fullName)) || item.name || 'Unknown', date: item.date || item.dateStr, mealType: item.mealType })} style={{ color: '#374151', cursor: 'pointer' }}>{short}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                                                                        <span style={{ color: '#4F46E5', fontSize: '1rem' }}>💬</span>
                                                                        <span style={{ color: '#374151' }}>{txt}</span>
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <em style={{ color: '#9CA3AF' }}>No comments provided</em>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {feedback.length > 10 && (
                                        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748B' }}>
                                            Showing all {feedback.length} reviews. Use filters above to narrow down results.
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
                        <span>👥</span>
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