import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';
import FoodAnalytics from './FoodAnalyticsFixed';

const StudentFoodManager = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedDate, setSelectedDate] = useState(''); // Current selected date
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentStats, setCurrentStats] = useState(null);
    const { token } = useAdmin();

    const getDefaultStats = () => ({
        date: '',
        summary: {
            totalStudents: 0,
            availableStudents: 0,
            totalStudentsWithPause: 0,
            studentsTakingMeals: 0,
            totalMealsAvailable: 0,
            totalMealsPaused: 0,
            totalMealsServed: 0,
            pausePercentage: 0
        },
        foodCountToPrepare: {
            breakfast: 0,
            lunch: 0,
            snacks: 0,
            dinner: 0,
            total: 0
        },
        mealWiseStats: {
            breakfast: { paused: 0, available: 0, served: 0, foodCountToPrepare: 0, students: [] },
            lunch: { paused: 0, available: 0, served: 0, foodCountToPrepare: 0, students: [] },
            snacks: { paused: 0, available: 0, served: 0, foodCountToPrepare: 0, students: [] },
            dinner: { paused: 0, available: 0, served: 0, foodCountToPrepare: 0, students: [] }
        },
        statusDistribution: {},
        allPauses: []
    });

    useEffect(() => {
        // Initialize with today's date
        const today = getTodayDate();
        setSelectedDate(today);
        fetchStatsForDate(today);
    }, []);

    // Fetch stats when selected date changes
    useEffect(() => {
        if (selectedDate) {
            fetchStatsForDate(selectedDate);
        }
    }, [selectedDate]);

    const getTodayDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const getTomorrowDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };
    
    const fetchStatsForDate = async (date) => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${import.meta.env.VITE_SERVER_URL}/food-api/admin/food/stats/date?date=${date}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            
            setCurrentStats(response.data);
            setError('');
        } catch (err) {
            console.error(`Error fetching stats for ${date}:`, err);
            setError(`Failed to fetch stats: ${err.response?.data?.error || err.message}`);
            setCurrentStats(getDefaultStats());
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
    };

    const isToday = (date) => {
        return date === getTodayDate();
    };

    const isTomorrow = (date) => {
        return date === getTomorrowDate();
    };

    const formatDateDisplay = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    if (loading) {
        return (
            <div className="text-center my-4">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading food management data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-danger" role="alert">
                {error}
                <button 
                    className="btn btn-sm btn-outline-danger ms-3"
                    onClick={() => fetchStatsForDate(selectedDate)}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!currentStats) {
        return (
            <div className="alert alert-warning" role="alert">
                No data available
            </div>
        );
    }

    return (
        <div className="student-food-manager">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4>👥 Student Food Management</h4>
                    <small className="text-muted">
                        {formatDateDisplay(selectedDate)}
                        {isToday(selectedDate) && <span className="badge bg-success ms-2">Today</span>}
                        {isTomorrow(selectedDate) && <span className="badge bg-info ms-2">Tomorrow</span>}
                    </small>
                </div>
                
                {activeTab === 'overview' && (
                    <div className="d-flex gap-2">
                        <button 
                            className="btn btn-primary"
                            onClick={() => fetchStatsForDate(selectedDate)}
                        >
                            <i className="bi bi-arrow-clockwise me-2"></i>
                            Refresh Data
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="card mb-4">
                <div className="card-header">
                    <ul className="nav nav-tabs card-header-tabs">
                        <li className="nav-item">
                            <button
                                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                                style={{ color: activeTab === 'overview' ? '#0c63e4' : '#333' }}
                            >
                                <i className="bi bi-speedometer2 me-2"></i>
                                Overview
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div>
                    {/* Date Selection Section */}
                    <div className="card mb-4">
                        <div className="card-body">
                            <div className="row align-items-center">
                                <div className="col-md-6">
                                    <label className="form-label fw-bold">
                                        <i className="bi bi-calendar3 me-2"></i>
                                        Select Date to View Food Count
                                    </label>
                                    <input 
                                        type="date" 
                                        className="form-control form-control-lg" 
                                        value={selectedDate}
                                        onChange={(e) => handleDateChange(e.target.value)}
                                        min={getTodayDate()}
                                    />
                                </div>
                                <div className="col-md-6 mt-3 mt-md-0">
                                    <label className="form-label fw-bold">Quick Select</label>
                                    <div className="btn-group w-100" role="group">
                                        <button
                                            type="button"
                                            className={`btn ${isToday(selectedDate) ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => handleDateChange(getTodayDate())}
                                        >
                                            <i className="bi bi-calendar-day me-1"></i>
                                            Today
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn ${isTomorrow(selectedDate) ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => handleDateChange(getTomorrowDate())}
                                        >
                                            <i className="bi bi-calendar-plus me-1"></i>
                                            Tomorrow
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Food Count to Prepare - Highlighted Section */}
                    <div className="card mb-4" style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none'
                    }}>
                        <div className="card-body text-white">
                            <h5 className="card-title mb-3 fw-bold" style={{ color: '#ffffff' }}>
                                <i className="bi bi-cart-check me-2"></i>
                                🍽️ Food Count to Prepare
                            </h5>
                            <div className="row g-3 text-center">
                                <div className="col-6 col-md-3">
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '20px',
                                        border: '1px solid rgba(255, 255, 255, 0.4)'
                                    }}>
                                        <div className="fs-5 mb-2 fw-bold" style={{ color: '#ffffff' }}>🍳 Breakfast</div>
                                        <h1 className="mb-1 fw-bold" style={{ color: '#ffffff', fontSize: '3rem' }}>
                                            {currentStats.foodCountToPrepare?.breakfast || 0}
                                        </h1>
                                        <small style={{ color: '#ffffff', fontSize: '0.9rem' }}>meals</small>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '20px',
                                        border: '1px solid rgba(255, 255, 255, 0.4)'
                                    }}>
                                        <div className="fs-5 mb-2 fw-bold" style={{ color: '#ffffff' }}>🍛 Lunch</div>
                                        <h1 className="mb-1 fw-bold" style={{ color: '#ffffff', fontSize: '3rem' }}>
                                            {currentStats.foodCountToPrepare?.lunch || 0}
                                        </h1>
                                        <small style={{ color: '#ffffff', fontSize: '0.9rem' }}>meals</small>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '20px',
                                        border: '1px solid rgba(255, 255, 255, 0.4)'
                                    }}>
                                        <div className="fs-5 mb-2 fw-bold" style={{ color: '#ffffff' }}>☕ Snacks</div>
                                        <h1 className="mb-1 fw-bold" style={{ color: '#ffffff', fontSize: '3rem' }}>
                                            {currentStats.foodCountToPrepare?.snacks || 0}
                                        </h1>
                                        <small style={{ color: '#ffffff', fontSize: '0.9rem' }}>meals</small>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '20px',
                                        border: '1px solid rgba(255, 255, 255, 0.4)'
                                    }}>
                                        <div className="fs-5 mb-2 fw-bold" style={{ color: '#ffffff' }}>🍽️ Dinner</div>
                                        <h1 className="mb-1 fw-bold" style={{ color: '#ffffff', fontSize: '3rem' }}>
                                            {currentStats.foodCountToPrepare?.dinner || 0}
                                        </h1>
                                        <small style={{ color: '#ffffff', fontSize: '0.9rem' }}>meals</small>
                                    </div>
                                </div>
                            </div>
                            <div className="text-center mt-4" style={{ 
                                background: 'rgba(255, 255, 255, 0.2)',
                                padding: '15px',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                                <h4 className="mb-0 fw-bold" style={{ color: '#ffffff' }}>
                                    Total Meals to Prepare: <span className="fw-bold" style={{ fontSize: '1.8rem' }}>
                                        {currentStats.foodCountToPrepare?.total || 0}
                                    </span>
                                </h4>
                            </div>
                        </div>
                    </div>

                    {/* Summary Statistics Cards */}
                    <div className="row g-3 mb-4">
                        <div className="col-md-3">
                            <div className="card bg-primary text-white h-100">
                                <div className="card-body">
                                    <h6 className="card-title">Total Students</h6>
                                    <h3 className="mb-0">{currentStats.summary.totalStudents}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-success text-white h-100">
                                <div className="card-body">
                                    <h6 className="card-title">Taking Meals</h6>
                                    <h3 className="mb-0">{currentStats.summary.studentsTakingMeals}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-warning text-dark h-100">
                                <div className="card-body">
                                    <h6 className="card-title">With Pauses</h6>
                                    <h3 className="mb-0">{currentStats.summary.totalStudentsWithPause}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="card bg-info text-white h-100">
                                <div className="card-body">
                                    <h6 className="card-title">Total Meals Paused</h6>
                                    <h3 className="mb-0">{currentStats.summary.totalMealsPaused}</h3>
                                    <small>({currentStats.summary.pausePercentage}%)</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Meal-Wise Pause Statistics */}
                    <div className="row g-3">
                        <div className="col-md-6 col-lg-3">
                            <div className="card border-warning h-100">
                                <div className="card-body">
                                    <h6 className="card-title text-warning">🌅 Breakfast</h6>
                                    <h3 className="mb-1 text-warning">{currentStats.mealWiseStats.breakfast.paused}</h3>
                                    <small className="text-muted">
                                        Available: {currentStats.mealWiseStats.breakfast.available} | 
                                        Served: {currentStats.mealWiseStats.breakfast.served}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6 col-lg-3">
                            <div className="card border-info h-100">
                                <div className="card-body">
                                    <h6 className="card-title text-info">🍛 Lunch</h6>
                                    <h3 className="mb-1 text-info">{currentStats.mealWiseStats.lunch.paused}</h3>
                                    <small className="text-muted">
                                        Available: {currentStats.mealWiseStats.lunch.available} | 
                                        Served: {currentStats.mealWiseStats.lunch.served}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6 col-lg-3">
                            <div className="card border-success h-100">
                                <div className="card-body">
                                    <h6 className="card-title text-success">☕ Snacks</h6>
                                    <h3 className="mb-1 text-success">{currentStats.mealWiseStats.snacks.paused}</h3>
                                    <small className="text-muted">
                                        Available: {currentStats.mealWiseStats.snacks.available} | 
                                        Served: {currentStats.mealWiseStats.snacks.served}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6 col-lg-3">
                            <div className="card border-danger h-100">
                                <div className="card-body">
                                    <h6 className="card-title text-danger">🌙 Dinner</h6>
                                    <h3 className="mb-1 text-danger">{currentStats.mealWiseStats.dinner.paused}</h3>
                                    <small className="text-muted">
                                        Available: {currentStats.mealWiseStats.dinner.available} | 
                                        Served: {currentStats.mealWiseStats.dinner.served}
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'analytics' && (
                <FoodAnalytics />
            )}
        </div>
    );
};

export default StudentFoodManager;
