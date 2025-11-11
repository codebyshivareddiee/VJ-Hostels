import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import FoodPauseManager from './FoodPauseManagerEnhanced';
import FoodScheduleViewer from './FoodScheduleViewer';
import '../../styles/student/Food.css';
import pastryChef from '../../assets/pastry-chef-animate.svg';
import OffensiveTextInput, { checkOffensiveContent } from '../common/OffensiveTextInput';
import './MobileSafeNavbar.css';


// --- START: SHARED CONSTANTS AND HELPERS ---

// Meal timings (24hr format)
const mealTimings = {
    breakfast: { start: "07:00", end: "09:00" },
    lunch: { start: "12:30", end: "14:00" },
    snacks: { start: "16:30", end: "18:30" },
    dinner: { start: "19:30", end: "21:00" }
};

// Meal icons mapping
const mealIcons = {
    breakfast: "🍳",
    lunch: "🍚",
    snacks: "☕",
    dinner: "🌙"
};

const getMealIcon = (meal) => mealIcons[meal] || '🍽️';

// Helper to get status and color
const getMealStatus = (meal) => {
    const now = new Date();
    const [startH, startM] = mealTimings[meal].start.split(":").map(Number);
    const [endH, endM] = mealTimings[meal].end.split(":").map(Number);

    const start = new Date(now);
    start.setHours(startH, startM, 0, 0);
    const end = new Date(now);
    end.setHours(endH, endM, 0, 0);

    const last30 = new Date(end.getTime() - 30 * 60000);

    if (now < start) return { color: "gray", status: "Not started" };
    if (now >= start && now < last30) return { color: "green", status: "Started" };
    if (now >= last30 && now < end) return { color: "orange", status: "Ending soon" };
    if (now >= end) return { color: "red", status: "Ended" };
};

// Helper to determine the *next* meal for highlighting
const getNextMeal = () => {
    const now = new Date();
    const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];
    for (const meal of meals) {
        const [startH, startM] = mealTimings[meal].start.split(":").map(Number);
        const start = new Date(now);
        start.setHours(startH, startM, 0, 0);
        const mealStatus = getMealStatus(meal);

        if (now < start || mealStatus.status === 'Started' || mealStatus.status === 'Ending soon') return meal;
    }
    return null; // All meals have ended
};

// Blinking light component
const BlinkingLight = React.memo(({ color }) => (
    <span
        className="blinking-light"
        style={{
            background: color,
            animation: color !== 'gray' ? 'pulse-light 1s infinite' : 'none',
            boxShadow: color !== 'gray' ? `0 0 8px 2px ${color}` : 'none'
        }}
    />
));
// --- END: SHARED CONSTANTS AND HELPERS ---


const Food = () => {
    // --- START: STATE ---
    const { user, loading: userLoading } = useCurrentUser();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [menu, setMenu] = useState(null);
    const [menuLoading, setMenuLoading] = useState(false);
    const [schedule, setSchedule] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('menu');
    const [mealType, setMealType] = useState('breakfast');
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [feedbackOffensive, setFeedbackOffensive] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [quickRating, setQuickRating] = useState({ meal: null, rating: 0, submitted: false });
    const [submittedQuickRatings, setSubmittedQuickRatings] = useState({});
    // Local, optimistic aggregate ratings so UI updates immediately after a user rates
    const [aggregatedRatings, setAggregatedRatings] = useState({});
    // Track whether the current user has already submitted detailed feedback per meal
    const [submittedFeedbacks, setSubmittedFeedbacks] = useState({});
    // Store user's feedback details (rating + comment) for each meal
    const [userFeedbackDetails, setUserFeedbackDetails] = useState({});

    // --- END: STATE ---


    // --- START: CORE LOGIC & HANDLERS ---
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!document.getElementById('pulse-light-keyframes')) { 
            const style = document.createElement('style');
            style.id = 'pulse-light-keyframes';
            style.innerHTML = `
                @keyframes pulse-light {
                    0% { opacity: 1; box-shadow: 0 0 4px 1px var(--color); }
                    50% { opacity: 0.4; box-shadow: 0 0 8px 3px var(--color); }
                    100% { opacity: 1; box-shadow: 0 0 4px 1px var(--color); }
                }
                .blinking-light[style*="green"] { --color: #007a8c; } 
                .blinking-light[style*="orange"] { --color: #ff9800; } 
                .blinking-light[style*="red"] { --color: #dc3545; } 
                .blinking-light[style*="gray"] { --color: #6c757d; } 
            `;
            document.head.appendChild(style);
        }
    }, []);

    useEffect(() => {
        fetchTodaysMenu();
    }, [user]);

    const fetchTodaysMenu = async () => {
        try {
            setMenuLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/food-api/student/menu/today-from-schedule`);
            setMenu(response.data);
            setError(null);
            
            // Now fetch the student's feedback status for today
            if (user && (user._id || user.id)) {
                try {
                    const studentId = user._id || user.id;
                    const feedbackStatusResponse = await axios.get(
                        `${import.meta.env.VITE_SERVER_URL}/food-api/student/feedback/today-status`,
                        { params: { studentId } }
                    );
                    
                    // Convert feedback status to submittedFeedbacks format and store feedback details
                    const submitted = {};
                    const feedbackDetails = {};
                    for (const [mealType, status] of Object.entries(feedbackStatusResponse.data)) {
                        if (status.submitted) {
                            submitted[mealType] = true;
                            feedbackDetails[mealType] = {
                                rating: status.rating,
                                feedback: status.feedback
                            };
                        }
                    }
                    setSubmittedFeedbacks(submitted);
                    setUserFeedbackDetails(feedbackDetails);
                } catch (feedbackErr) {
                    console.error('Error fetching feedback status:', feedbackErr);
                    // Don't break the meal loading if feedback status fails
                }
            }
        } catch (err) {
            console.error('Error fetching today\'s menu:', err);
            setError("No menu available for today.");
            setMenu(null);
        } finally {
            setMenuLoading(false);
        }
    };

    const canSubmitFeedback = (mealType) => {
        const mealStatus = getMealStatus(mealType);
        return mealStatus.status === 'Started' || mealStatus.status === 'Ending soon' || mealStatus.status === 'Ended';
    };

    const handleSubmitFeedback = async (e) => {
        e.preventDefault();
        if (!user) {
            setError("You must be logged in to submit feedback.");
            return;
        }
        
        if (!canSubmitFeedback(mealType)) {
            setError(`You can only submit feedback for ${mealType} after it has started.`);
            return;
        }
        
        try {
            setSubmitting(true);
            setError(null);
            setFeedbackOffensive(false);
            
            // Check for offensive content ONLY when submitting
            if (feedback && feedback.trim().length > 0) {
                console.log('🔍 [Food] Checking feedback for offensive content before submit...');
                const offensiveCheck = await checkOffensiveContent(feedback);
                console.log('🔍 [Food] Offensive check result:', offensiveCheck);
                
                if (offensiveCheck.isOffensive) {
                    setFeedbackOffensive(true);
                    setError("Cannot submit feedback with offensive content. Please revise your message.");
                    setSubmitting(false);
                    return;
                }
            }
            
            const feedbackData = {
                mealType,
                rating: parseInt(rating),
                feedback,
                // include student id (prefer _id, fallback to id or rollNumber)
                studentId: user && (user._id || user.id)
            };
            
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/food-api/student/feedback`, feedbackData);
            
            setSubmitSuccess(true);
            setFeedback('');
            setError(null);
            setFeedbackOffensive(false);
            
            // Optimistically update local aggregate so UI reflects the new feedback immediately
            updateLocalAggregate(mealType, parseInt(rating));
            // Mark that the current user has submitted feedback for this meal (prevents duplicates)
            setSubmittedFeedbacks(prev => ({ ...prev, [mealType]: true }));
            // Store the feedback details for display on menu card
            setUserFeedbackDetails(prev => ({
                ...prev,
                [mealType]: {
                    rating: parseInt(rating),
                    feedback: feedbackData.feedback
                }
            }));
            setTimeout(() => {
                setSubmitSuccess(false);
            }, 3000);
        } catch (err) {
            // Show specific error message from backend if available
            const errorMessage = err.response?.data?.message || "Failed to submit feedback. Please try again.";
            setError(errorMessage);
            console.error('Error submitting feedback:', err);
            
            // If backend detected offensive content, ensure the flag is set
            if (err.response?.data?.offensive === true) {
                setFeedbackOffensive(true);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuickRating = async (meal, ratingValue) => {
        // Don't allow quick-rating if user already submitted detailed feedback for this meal
        if (submittedFeedbacks[meal] || submittedQuickRatings[meal] || (quickRating.meal === meal && quickRating.submitted)) return;

        await new Promise(resolve => setTimeout(resolve, 500)); 

        setSubmittedQuickRatings(prev => ({
            ...prev,
            [meal]: ratingValue 
        }));

        setQuickRating({ meal: meal, rating: ratingValue, submitted: true });
        // Optimistically update local aggregate so UI shows the new rating immediately
        updateLocalAggregate(meal, ratingValue);

        setTimeout(() => {
            setQuickRating(prev => (prev.meal === meal ? { meal: null, rating: 0, submitted: false } : prev));
        }, 2500); 
    };
    // --- END: CORE LOGIC & HANDLERS ---

    // Keep the visible star rating and feedback text in sync with the selected meal.
    // If the user has previously submitted detailed feedback for the selected meal,
    // show that rating and comment; otherwise reset to defaults.
    useEffect(() => {
        const stored = userFeedbackDetails && userFeedbackDetails[mealType];
        if (stored) {
            if (stored.rating != null) {
                setRating(Number(stored.rating));
            }
            if (stored.feedback != null) {
                setFeedback(stored.feedback);
            }
        } else {
            // don't inherit from previously-selected meal; reset to defaults
            setRating(0);
            setFeedback('');
        }
    }, [mealType, userFeedbackDetails]);


    // --- START: RENDER HELPERS ---
    const renderStarRating = () => {
        const isSubmittedForMeal = !!submittedFeedbacks[mealType];
        const isCurrentMealValid = canSubmitFeedback(mealType) && !isSubmittedForMeal;
        return (
            <div 
  className={`rating-container ${!isCurrentMealValid ? 'text-muted' : ''}`} 
  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
>
  {[1, 2, 3, 4, 5].map((star) => (
    <button
      key={star}
      type="button"
      className="star-button btn p-0"
      onClick={() => setRating(star)}
      disabled={!isCurrentMealValid}
      style={{
        background: 'none',
        border: 'none',
        fontSize: '2rem',
        cursor: 'pointer',
        color: '#ff9800',
        outline: 'none'
      }}
    >
      <span style={{ fontWeight: 900 }}>
        {star <= rating ? '★' : '☆'}
      </span>
    </button>
  ))}
</div>

        );
    };

    const renderRatingWidget = (meal) => {
        const status = getMealStatus(meal);
        const hasBeenRated = !!submittedQuickRatings[meal] || !!submittedFeedbacks[meal]; 
        const currentSubmittedRating = submittedQuickRatings[meal] || 0;

        const canRateNow = status.status === 'Ended' && !hasBeenRated;
        
        const displayRating = (quickRating.meal === meal && quickRating.submitted) 
            ? quickRating.rating 
            : currentSubmittedRating;
        
        const isShowingMessage = quickRating.meal === meal && quickRating.submitted;
        
        const starColor = canRateNow ? '#ff9800' : '#cccccc';
        
        return (
            <div className="quick-rating-container mt-2" style={{ borderTop: '1px dashed #ccc', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', minHeight: '30px' }}>
                    <span style={{ marginRight: '10px', fontSize: '0.9rem', color: '#555' }}>Rate:</span>
                    
                    {[1, 2, 3, 4, 5].map(star => {
                        const isFilled = star <= displayRating;
                        
                        return (
                            <button
                                key={star}
                                type="button"
                                className="star-button btn p-0"
                                onClick={() => canRateNow && handleQuickRating(meal, star)}
                                disabled={!canRateNow} 
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    fontSize: '1.4rem', 
                                    cursor: canRateNow ? 'pointer' : 'default', 
                                    color: starColor, 
                                    outline: 'none'
                                }} 
                            >
                                <span style={{ fontWeight: 900 }}>
                                    {isFilled ? '★' : '☆'}
                                </span>
                            </button>
                        );
                    })}

                    {isShowingMessage && (
                        <div className="text-success ms-2" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                             <i className="bi bi-check-circle-fill me-1"></i>Rating Submitted!
                        </div>
                    )}
                </div>

                {!isShowingMessage && hasBeenRated && (
                     <div className="text-info mt-1" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        <i className="bi bi-star-fill me-1"></i>Rated {currentSubmittedRating} Stars
                    </div>
                )}
                {!isShowingMessage && !hasBeenRated && status.status === 'Not started' && (
                    <small className="text-muted mt-1" style={{ fontSize: '0.8rem', display: 'block' }}>
                        *Available after the meal starts.
                    </small>
                )}
            </div>
        );
    };
    // Helper: update local/optimistic aggregate for a meal
    const updateLocalAggregate = (meal, newRating) => {
        if (!meal || newRating == null) return;
        setAggregatedRatings(prev => {
            const existing = prev[meal];
            let baseAvg = 0;
            let baseCount = 0;

            if (existing && existing.count != null) {
                baseAvg = Number(existing.avg ?? 0);
                baseCount = Number(existing.count ?? 0);
            } else if (menu && menu[meal]) {
                const m = menu[meal];
                baseAvg = Number(m.avgRating ?? m.ratingAvg ?? m.rating ?? m.rating_mean ?? m.ratingAverage ?? 0);
                baseCount = Number(m.ratingCount ?? m.ratingsCount ?? m.count ?? m.reviews ?? 0);
            }

            const newCount = (baseCount || 0) + 1;
            const newAvg = newCount === 0 ? null : ((baseAvg * (baseCount || 0)) + Number(newRating)) / newCount;

            return {
                ...prev,
                [meal]: { avg: newAvg, count: newCount }
            };
        });
    };

    // Aggregate rating display (prefer local aggregatedRatings if present, else read from `menu`)
    const getAggregateRating = (meal) => {
        if (aggregatedRatings && aggregatedRatings[meal]) {
            const a = aggregatedRatings[meal];
            return {
                avg: a.avg != null ? Number(a.avg) : null,
                count: a.count != null ? Number(a.count) : null
            };
        }

        if (!menu || !menu[meal]) return null;
        const m = menu[meal];
        const avg = m.avgRating ?? m.ratingAvg ?? m.rating ?? m.rating_mean ?? m.ratingAverage ?? null;
        const count = m.ratingCount ?? m.ratingsCount ?? m.count ?? m.reviews ?? null;
        return {
            avg: avg != null ? Number(avg) : null,
            count: count != null ? Number(count) : null
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const nextMeal = getNextMeal();
    // --- END: RENDER HELPERS ---


    // --- START: MAIN RENDER WITH CUSTOM UI STYLE ---

    const tabs = [
        { id: 'menu', text: 'Today\'s Menu', icon: 'bi-calendar-check', isPause: false, shortLabel: 'Today' },
        { id: 'feedback', text: 'Give Feedback', icon: 'bi-chat-dots', isPause: false, shortLabel: 'Feedback' },
        { id: 'schedule', text: 'Weekly Schedule', icon: 'bi-calendar-week', isPause: false, shortLabel: 'Schedule' },
        { id: 'pause', text: 'Pause Service', icon: 'bi-slash-circle', isPause: true, shortLabel: 'Pause' }
    ];
    
    const badgeColorMap = {
        'gray': 'bg-secondary',
        'green': 'bg-info',    
        'orange': 'bg-warning', 
        'red': 'bg-danger'      
    };

    const renderTabButton = (tab) => {
        const { id, text, icon, isPause } = tab;
        const isActive = activeTab === id;

        const defaultStyle = {
            background: '#FFFFFF',
            border: `1px solid ${isActive ? '#4364f7' : isPause ? '#f5c2c7' : '#dee2e6'}`,
            borderRadius: '28px',
            padding: '0.8rem 1.8rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            color: isActive ? '#4364f7' : isPause ? '#842029' : '#343a40',
            boxShadow: isActive
                ? `0 0 0 1px ${isPause ? '#dc3545' : '#4364f7'}, 0 4px 12px rgba(67,100,247,0.2)`
                : isPause
                    ? '0 4px 12px rgba(132,32,41,0.1)'
                    : '0 4px 12px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease',
            width: '100%',
            transform: isActive ? 'scale(1.02)' : 'none', 
        };

        const hoverBoxShadow = isPause
            ? '0 0 0 3px rgba(220, 53, 69, 0.3), 0 6px 16px rgba(132, 32, 41, 0.15)'
            : '0 0 0 3px rgba(67, 100, 247, 0.3), 0 6px 16px rgba(0, 0, 0, 0.15)';
        const hoverBorderColor = isPause ? '#dc3545' : '#4364f7';
        const hoverColor = isPause ? '#58151c' : '#343a40';
        
        const applyHover = (e) => {
             e.currentTarget.style.transform = 'scale(1.02)';
             e.currentTarget.style.boxShadow = hoverBoxShadow;
             e.currentTarget.style.borderColor = hoverBorderColor;
             e.currentTarget.style.color = hoverColor;
        };

        const removeHover = (e) => {
            if (activeTab !== id) {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = isPause ? '0 4px 12px rgba(132,32,41,0.1)' : '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = isPause ? '#f5c2c7' : '#dee2e6';
                e.currentTarget.style.color = isPause ? '#842029' : '#343a40';
            } else {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = isActive ? `0 0 0 1px ${isPause ? '#dc3545' : '#4364f7'}, 0 4px 12px rgba(67,100,247,0.2)` : defaultStyle.boxShadow;
                e.currentTarget.style.borderColor = isPause ? '#dc3545' : '#4364f7';
                e.currentTarget.style.color = isPause ? '#842029' : '#4364f7';
            }
        };

        return (
            <div className="tab-grid-item" key={id}>
                <div
                    onClick={() => setActiveTab(id)}
                    onMouseEnter={applyHover}
                    onMouseLeave={removeHover}
                    className={`tab-card ${isActive ? 'active-tab-card' : ''}`}
                    style={defaultStyle}
                >
                    <i className={`bi ${icon}`} style={{ fontSize: '1.1rem' }}></i>
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>{text}</span>
                </div>
            </div>
        );
    };
    return (
        
        <div className={`food-container ${isMobile ? 'page-content' : ''}`}>
            <div className="food-header">
                <h2>Hostel Food Menu & Feedback</h2>
                {user && <p>Welcome, {user.name}! Don't forget to rate your finished meals.</p>}
            </div>

            {/* Tabs (Custom UI) - Desktop Only */}
            {!isMobile && (
                <div className="tab-container">
                    <div className="tab-grid">
                        {tabs.map(renderTabButton)}
                    </div>
                </div>
            )}

            {/* --- Today's Menu Tab --- */}
            {activeTab === 'menu' && (
                <div className="menu-card">
                    {menuLoading ? (
                        <div className="text-center my-4">
                            <div className="spinner-border text-primary" role="status"></div>
                            <p className="mt-2">Loading today's menu...</p>
                        </div>
                    ) : menu ? (
                        <>
                            <h3 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', marginBottom: '1rem' }}>
                                Today's Menu - {formatDate(menu.date)}
                            </h3>
                            <div 
                                className="row"
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: window.innerWidth <= 768 ? '4px' : '8px',
                                    margin: window.innerWidth <= 768 ? '0 -2px' : '0 -4px'
                                }}
                            >
                                {['breakfast','lunch','snacks','dinner'].map(meal => {
                                    if(!menu[meal]) return null;
                                    const status = getMealStatus(meal);
                                    const isNextMeal = meal===getNextMeal() && status.status!=='Ended';
                                    
                                    const badgeClass = badgeColorMap[status.color] || 'bg-secondary';
                                    
                                    return (
                                        <div key={meal} 
                                            style={{
                                                flex: window.innerWidth <= 768 ? '1 1 100%' : '1 1 calc(50% - 8px)',
                                                display: 'flex',
                                                marginBottom: window.innerWidth <= 768 ? '8px' : '8px',
                                                minWidth: window.innerWidth <= 768 ? '100%' : '160px'
                                            }}
                                        >
                                            <div 
                                                className={`meal-item-card`}
                                                style={{
                                                    border: '1px solid whitesmoke',
                                                    boxShadow: '0 1px 6px rgba(0,0,0,0.3)', 
                                                    padding: 'clamp(0.6rem, 2vw, 1rem)',
                                                    borderRadius: '8px',
                                                    display: 'flex', 
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    width: '100%',
                                                    background: '#fff'
                                                }}
                                            >
                                                <div className="card-body p-0 d-flex flex-column justify-content-between h-100">
                                                    <div>
                                                        <div className="meal-title" style={{ 
                                                            display:'flex', 
                                                            alignItems:'center', 
                                                            gap:'0.4rem', 
                                                            marginBottom:'0.4rem',
                                                            flexWrap: 'wrap'
                                                        }}>
                                                            <span className="meal-icon" style={{fontSize:'clamp(1rem, 3vw, 1.2rem)'}}>{getMealIcon(meal)}</span>
                                                            <BlinkingLight color={status.color} />
                                                            <h6 className="mb-0 text-capitalize" style={{ 
                                                                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                                                                fontWeight: window.innerWidth <= 768 ? '800' : '600'
                                                            }}>
                                                                {meal}
                                                            </h6>
                                                            <small className={`badge ${badgeClass}`} style={{ 
                                                                marginLeft:'auto',
                                                                fontSize: 'clamp(0.65rem, 2vw, 0.75rem)',
                                                                padding: '0.25rem 0.5rem'
                                                            }}>
                                                                {status.status}
                                                            </small>
                                                        </div>
                                                        
                                                        <p className="meal-content mb-1" style={{ 
                                                            paddingLeft:'1.2rem',
                                                            fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)',
                                                            lineHeight: '1.3',
                                                            marginBottom: '0.5rem'
                                                        }}>
                                                            {menu[meal]}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    ) : <div className="alert alert-warning">No menu available today.</div>}
                </div>
            )}



            {/* --- Feedback Form Tab (DEFINITIVE ALIGNMENT FIX) --- */}
            {activeTab === 'feedback' && (
                <form className="feedback-form" onSubmit={handleSubmitFeedback} style={{ maxWidth: '900px', padding: '2rem' }}>
                    
                    <h4 className='mb-4' style={{color:'#4364f7'}}>Submit Detailed Meal Feedback</h4>
                    
                    {submitSuccess && <div className="alert alert-success">Feedback submitted successfully!</div>}
                    {error && (
                        <div className="alert alert-danger">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            {error}
                        </div>
                    )}

                    {/* ALIGNED INPUT GROUP: Fixed vertical alignment and visual spacing */}
                    <div className="row mb-4 g-4 d-flex align-items-start">
                        
                        {/* 1. Meal Selection (Col-4) */}
                        <div className="col-12 col-md-4">
                            <label className="form-label d-block text-start fw-bold mb-2">Select Meal</label>
                            <select
                                className="form-select form-select-lg"
                                value={mealType}
                                onChange={(e) => setMealType(e.target.value)}
                                disabled={submitting} 
                                // FIX: Removed vertical padding from select to ensure it aligns with the boxes' top padding
                                style={{ height: '56px', border: '2px solid #ced4da', padding: '0.375rem 1rem' }} 
                            >
                                {menu ? ['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => {
                                    if (!menu?.[meal]) return null;
                                    const canSubmit = canSubmitFeedback(meal);
                                    return (
                                        <option key={meal} value={meal} disabled={!canSubmit}>
                                            {meal.charAt(0).toUpperCase() + meal.slice(1)} 
                                            {!canSubmit ? ' (Not ready)' : ''}
                                        </option>
                                    );
                                }) : <option>Loading...</option>}
                            </select>
                            <div className="mt-2 text-start">
                                <small className="text-muted d-inline-block me-2">Status:</small>
                                <span className={`badge ${badgeColorMap[getMealStatus(mealType).color]}`}>{getMealStatus(mealType).status}</span>
                            </div>
                        </div>
                        
                        {/* 2. Your Rating (Col-4) - BOLD styling applied, centered vertically */}
                        <div className="col-12 col-md-4">
                            <label className="form-label d-block text-start fw-bold mb-2">Your Rating</label>
                            <div
                                className="border rounded d-flex align-items-center justify-content-center w-100"
                                style={{
                                    minHeight: '56px',
                                    borderColor: '#ff9800',
                                    borderWidth: '2px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                                    position: 'sticky',
                                    top: '0',           // keeps it visible at top on scroll
                                    backgroundColor: 'white', // needed for sticky
                                    zIndex: 10,
                                    padding: '0.25rem'
                                }}
                            >
                                {renderStarRating()}
                            </div>
                            
                            {!canSubmitFeedback(mealType) && (
                                <small className="text-danger d-block mt-2 text-start">
                                    <i className="bi bi-x-circle me-1"></i>Rating disabled.
                                </small>
                            )}

                            {/* If user already submitted feedback for selected meal, show a message */}
                            {submittedFeedbacks[mealType] && (
                                <small className="text-success d-block mt-2 text-start">
                                    <i className="bi bi-check2-circle me-1"></i>You have already submitted feedback for this meal.
                                </small>
                            )}
                        </div>

                        {/* 3. Today's Dishes (Col-4) - BOLD styling applied, min-height aligns it with select input */}
                        <div className="col-12 col-md-4">
                            <label className="form-label d-block text-start fw-bold mb-2">Today's Dishes</label>
                            <div 
                                className="p-3 border rounded w-100" 
                                style={{ 
                                    minHeight: '56px', /* Matches height of select input */
                                    background: '#f8f9fa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderColor: '#ced4da', 
                                    borderWidth: '2px', 
                                    fontWeight: 'bold', 
                                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' 
                                }} 
                            >
                                <p className="mb-0 text-muted">{menu?.[mealType] || 'Menu details unavailable'}</p>
                            </div>
                        </div>
                    </div>
                    {/* END ALIGNED INPUT GROUP */}

                    {/* Detailed Feedback */}
                    <div className="form-group mb-4">
                        <label className="form-label d-block text-start fw-bold mb-2">Your Experience (Optional)</label>
                        <OffensiveTextInput
                            name="feedback"
                            value={feedback}
                            onChange={(value) => setFeedback(value)}
                            disabled={submitting || !canSubmitFeedback(mealType) || !!submittedFeedbacks[mealType]}
                            rows={4}
                            placeholder={`Share specific comments about the ${mealType} meal (taste, quantity, quality, etc.)`}
                        />
                        {feedbackOffensive && (
                            <div className="alert alert-danger d-flex align-items-center mt-2" role="alert">
                                <i className="bi bi-exclamation-triangle-fill me-2" style={{ fontSize: '1.2rem' }}></i>
                                <div>
                                    <strong>Offensive Content Detected:</strong> Your feedback contains inappropriate language. 
                                    Please revise your message before submitting.
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Submission Button */}
                    <div className="d-grid">
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={submitting || !canSubmitFeedback(mealType) || !!submittedFeedbacks[mealType]}
                        >
                            {submitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Submitting Feedback...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-send me-2"></i>
                                    Submit Final Feedback
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}

            {/* --- Schedule Tab --- */}
            {activeTab === 'schedule' && <FoodScheduleViewer />}
            
            {/* --- Pause Service Tab --- */}
            {activeTab === 'pause' && <FoodPauseManager />}

            {/* Fixed Bottom Navigation for Mobile */}
            {isMobile && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    padding: '0.5rem',
                    paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))',
                    paddingTop: '1rem',
                }}>
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '9999px',
                        padding: '0.25rem',
                        width: '85%',
                        maxWidth: '1100px',
                        margin: '0 auto',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: '0.3s',
                    }}>
                        {/* Sliding Active Indicator */}
                        <div 
                            style={{
                                position: 'absolute',
                                top: '0.25rem',
                                left: '0.25rem',
                                width: `calc(${100/4}% - 0.167rem)`,
                                height: 'calc(100% - 0.5rem)',
                                backgroundColor: '#667eea',
                                borderRadius: '9999px',
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                transform: `translateX(${tabs.findIndex(tab => tab.id === activeTab) * 100}%)`,
                                transition: 'transform 0.3s ease',
                                zIndex: 1,
                                willChange: 'transform'
                            }}
                        />
                        
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        position: 'relative',
                                        zIndex: 2,
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.25rem',
                                        padding: '0.75rem 0.25rem',
                                        borderRadius: '9999px',
                                        cursor: 'pointer',
                                        backgroundColor: 'transparent',
                                        color: isActive ? '#fff' : '#667eea',
                                        transition: 'color 0.3s ease',
                                    }}
                                >
                                    <i className={`bi ${tab.icon}`} style={{ fontSize: '1.25rem' }} />
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: isActive ? '700' : '600',
                                        letterSpacing: '0.02em',
                                    }}>
                                        {tab.shortLabel}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Food;