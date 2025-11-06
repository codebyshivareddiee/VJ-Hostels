import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import './OutpassDateTimePicker.css';

// Modern DateTime Picker Component
function DateTimePicker({ selectedDateTime, onConfirm, onClose, minDate }) {
    // Initialize with minDate if provided and no selectedDateTime, or ensure selectedDateTime is after minDate
    const initialDate = selectedDateTime || (minDate ? new Date(minDate.getTime() + 60000) : new Date()); // Add 1 minute to minDate
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [viewDate, setViewDate] = useState(new Date(initialDate));
    const [selectedHour, setSelectedHour] = useState(initialDate.getHours() % 12 || 12);
    const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());
    const [period, setPeriod] = useState(initialDate.getHours() >= 12 ? 'PM' : 'AM');

    // Calendar logic
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        const days = [];
        
        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true });
        }
        
        // Next month days
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            days.push({ day: i, isCurrentMonth: false });
        }
        
        return days;
    };

    const isDateSelected = (day) => {
        return day.isCurrentMonth &&
            day.day === currentDate.getDate() &&
            viewDate.getMonth() === currentDate.getMonth() &&
            viewDate.getFullYear() === currentDate.getFullYear();
    };

    const isDateDisabled = (day) => {
        if (!day.isCurrentMonth || !minDate) return false;
        
        const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day.day);
        const minDateOnly = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
        
        return checkDate < minDateOnly;
    };

    const handleDateSelect = (day) => {
        if (day.isCurrentMonth && !isDateDisabled(day)) {
            const newDate = new Date(viewDate);
            newDate.setDate(day.day);
            newDate.setHours(period === 'PM' && selectedHour !== 12 ? selectedHour + 12 : selectedHour === 12 && period === 'AM' ? 0 : selectedHour);
            newDate.setMinutes(selectedMinute);
            
            // Validate against minDate
            if (minDate && newDate < minDate) {
                alert('Please select a date and time after the out time.');
                return;
            }
            
            setCurrentDate(newDate);
        }
    };

    const changeMonth = (delta) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const handleHourChange = (hour) => {
        setSelectedHour(hour);
        const newDate = new Date(currentDate);
        const actualHour = period === 'PM' && hour !== 12 ? hour + 12 : hour === 12 && period === 'AM' ? 0 : hour;
        newDate.setHours(actualHour);
        
        // Validate against minDate
        if (minDate && newDate < minDate) {
            alert('Please select a time after the out time.');
            return;
        }
        
        setCurrentDate(newDate);
    };

    const handleMinuteChange = (minute) => {
        setSelectedMinute(minute);
        const newDate = new Date(currentDate);
        newDate.setMinutes(minute);
        
        // Validate against minDate
        if (minDate && newDate < minDate) {
            alert('Please select a time after the out time.');
            return;
        }
        
        setCurrentDate(newDate);
    };

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        const newDate = new Date(currentDate);
        const hours = newDate.getHours();
        if (newPeriod === 'PM' && hours < 12) {
            newDate.setHours(hours + 12);
        } else if (newPeriod === 'AM' && hours >= 12) {
            newDate.setHours(hours - 12);
        }
        
        // Validate against minDate
        if (minDate && newDate < minDate) {
            alert('Please select a time after the out time.');
            return;
        }
        
        setCurrentDate(newDate);
    };

    const handleConfirm = () => {
        // Final validation before confirming
        if (minDate && currentDate < minDate) {
            alert('In time must be after out time.');
            return;
        }
        onConfirm(currentDate);
    };

    const days = getDaysInMonth(viewDate);
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 9998
                }}
            />

            {/* Picker Container */}
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'white',
                borderRadius: '16px',
                overflow: 'hidden',
                maxWidth: '90vw',
                maxHeight: '90vh',
                zIndex: 9999,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header with selected date */}
                <div className="datetime-header" style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <div className="datetime-header-day" style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
                        {dayNames[currentDate.getDay()]}
                    </div>
                    <div className="datetime-header-date" style={{ fontSize: '32px', fontWeight: 'bold' }}>
                        {monthNames[currentDate.getMonth()].slice(0, 3)} {currentDate.getDate()}
                    </div>
                    <div className="datetime-header-time" style={{ fontSize: '24px', marginTop: '8px', fontWeight: '500' }}>
                        {currentDate.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                        })}
                    </div>
                </div>

                <div style={{ 
                    overflowY: 'auto',
                    maxHeight: 'calc(90vh - 180px)'
                }}>
                    {/* Min Date Info */}
                    {minDate && (
                        <div className="out-time-banner" style={{
                            padding: '12px 20px',
                            background: '#e3f2fd',
                            borderBottom: '1px solid #90caf9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            color: '#1565c0'
                        }}>
                            <Clock size={16} />
                            <span>
                                <strong>Out Time:</strong> {minDate.toLocaleString('en-IN', { 
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                            </span>
                        </div>
                    )}
                    
                    {/* Calendar Section */}
                    <div className="calendar-section" style={{ padding: '20px' }}>
                        {/* Month Navigation */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <button
                                onClick={() => changeMonth(-1)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                <ChevronLeft size={24} />
                            </button>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                            </h3>
                            <button
                                onClick={() => changeMonth(1)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                <ChevronRight size={24} />
                            </button>
                        </div>

                        {/* Day Names */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: '8px',
                            marginBottom: '8px'
                        }}>
                            {dayNames.map((day, i) => (
                                <div key={i} style={{
                                    textAlign: 'center',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: '#666'
                                }}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: '8px'
                        }}>
                            {days.map((day, i) => {
                                const isSelected = isDateSelected(day);
                                const isDisabled = isDateDisabled(day) || !day.isCurrentMonth;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleDateSelect(day)}
                                        disabled={isDisabled}
                                        style={{
                                            padding: '10px',
                                            border: 'none',
                                            borderRadius: '50%',
                                            background: isSelected ? '#1976d2' : 'transparent',
                                            color: isSelected ? 'white' : isDisabled ? '#ccc' : '#333',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            fontSize: '14px',
                                            fontWeight: isSelected ? 'bold' : 'normal',
                                            opacity: isDisabled ? 0.5 : 1,
                                            transition: 'all 0.2s',
                                            outline: isSelected ? '2px solid #ffa726' : 'none'
                                        }}>
                                        {day.day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Time Section */}
                    <div className="time-section" style={{
                        padding: '20px',
                        background: '#f5f5f5',
                        borderTop: '1px solid #e0e0e0'
                    }}>
                        {/* AM/PM Toggle */}
                        <div className="period-toggle" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '10px',
                            marginBottom: '20px'
                        }}>
                            <button
                                onClick={() => handlePeriodChange('AM')}
                                className="period-button"
                                style={{
                                    padding: '10px 30px',
                                    border: 'none',
                                    borderRadius: '50px',
                                    background: period === 'AM' ? '#1976d2' : '#e0e0e0',
                                    color: period === 'AM' ? 'white' : '#666',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s'
                                }}>
                                AM
                            </button>
                            <button
                                onClick={() => handlePeriodChange('PM')}
                                className="period-button"
                                style={{
                                    padding: '10px 30px',
                                    border: 'none',
                                    borderRadius: '50px',
                                    background: period === 'PM' ? '#1976d2' : '#e0e0e0',
                                    color: period === 'PM' ? 'white' : '#666',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s'
                                }}>
                                PM
                            </button>
                        </div>

                        {/* Clock Face */}
                        <div className="clock-face" style={{
                            width: '260px',
                            height: '260px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                            position: 'relative',
                            margin: '0 auto 20px',
                            boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.05)'
                        }}>
                            {/* Hour markers */}
                            {hours.map((hour) => {
                                const angle = ((hour % 12) * 30 - 90) * (Math.PI / 180);
                                const radius = 90;
                                const x = radius * Math.cos(angle);
                                const y = radius * Math.sin(angle);
                                const isSelected = selectedHour === hour;

                                return (
                                    <button
                                        key={hour}
                                        onClick={() => handleHourChange(hour)}
                                        className="clock-hour-button"
                                        style={{
                                            position: 'absolute',
                                            left: `calc(50% + ${x}px)`,
                                            top: `calc(50% + ${y}px)`,
                                            transform: 'translate(-50%, -50%)',
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            background: isSelected ? '#1976d2' : 'transparent',
                                            color: isSelected ? 'white' : '#333',
                                            fontSize: '14px',
                                            fontWeight: isSelected ? 'bold' : 'normal',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            zIndex: 2
                                        }}>
                                        {hour}
                                    </button>
                                );
                            })}

                            {/* Clock hands */}
                            <div style={{
                                position: 'absolute',
                                width: '4px',
                                height: '70px',
                                background: '#1976d2',
                                bottom: '50%',
                                left: '50%',
                                transformOrigin: 'bottom center',
                                transform: `translateX(-50%) rotate(${(selectedHour % 12) * 30}deg)`,
                                borderRadius: '10px',
                                zIndex: 1
                            }} />

                            {/* Center dot */}
                            <div style={{
                                position: 'absolute',
                                width: '12px',
                                height: '12px',
                                background: '#1976d2',
                                borderRadius: '50%',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 3,
                                border: '2px solid white'
                            }} />

                            {/* Minute display */}
                            <div style={{
                                position: 'absolute',
                                bottom: '40px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'white',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#1976d2',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                zIndex: 4
                            }}>
                                :{selectedMinute.toString().padStart(2, '0')}
                            </div>
                        </div>

                        {/* Minute selector */}
                        <div className="minute-controls" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}>
                            <button
                                onClick={() => handleMinuteChange(Math.max(0, selectedMinute - 1))}
                                className="minute-button"
                                style={{
                                    padding: '8px 16px',
                                    background: '#667eea',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}>
                                -1
                            </button>
                            <button
                                onClick={() => handleMinuteChange(Math.max(0, selectedMinute - 5))}
                                className="minute-button"
                                style={{
                                    padding: '8px 16px',
                                    background: '#667eea',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}>
                                -5
                            </button>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={selectedMinute}
                                onChange={(e) => handleMinuteChange(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                                className="minute-input"
                                style={{
                                    width: '60px',
                                    padding: '8px',
                                    textAlign: 'center',
                                    border: '2px solid #1976d2',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: 'bold'
                                }}
                            />
                            <button
                                onClick={() => handleMinuteChange(Math.min(59, selectedMinute + 5))}
                                className="minute-button"
                                style={{
                                    padding: '8px 16px',
                                    background: '#667eea',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}>
                                +5
                            </button>
                            <button
                                onClick={() => handleMinuteChange(Math.min(59, selectedMinute + 1))}
                                className="minute-button"
                                style={{
                                    padding: '8px 16px',
                                    background: '#667eea',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}>
                                +1
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="action-buttons" style={{
                    padding: '16px 20px',
                    background: '#f5f5f5',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    borderTop: '1px solid #e0e0e0'
                }}>
                    <button
                        onClick={onClose}
                        className="action-button"
                        style={{
                            padding: '10px 24px',
                            background: 'transparent',
                            color: '#666',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="action-button"
                        style={{
                            padding: '10px 24px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                        }}>
                        Confirm
                    </button>
                </div>
            </div>
        </>
    );
}

// Main Outpass Component
function Outpass() {
    const { user, loading } = useCurrentUser();
    const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm();
    const navigate = useNavigate();
    const [activePass, setActivePass] = useState(null);
    const [pendingPass, setPendingPass] = useState(null);
    const [checkingActivePass, setCheckingActivePass] = useState(true);
    const [calculatedType, setCalculatedType] = useState('');
    const [showInTimePicker, setShowInTimePicker] = useState(false);

    // Watch outTime and inTime to calculate duration
    const outTime = watch('outTime');
    const inTime = watch('inTime');

    // Set current time as default out time
    useEffect(() => {
        setValue('outTime', new Date());
    }, [setValue]);

    // Calculate outpass type based on duration
    useEffect(() => {
        if (outTime && inTime) {
            const outDate = new Date(outTime);
            const inDate = new Date(inTime);
            const durationInHours = (inDate - outDate) / (1000 * 60 * 60);

            if (durationInHours <= 24) {
                setCalculatedType('late pass');
                setValue('type', 'late pass');
            } else {
                setCalculatedType('home pass');
                setValue('type', 'home pass');
            }
        }
    }, [outTime, inTime, setValue]);

    useEffect(() => {
        const checkForActivePass = async () => {
            if (!user?.rollNumber) {
                setCheckingActivePass(false);
                return;
            }

            try {
                const response = await axios.get(
                    `${import.meta.env.VITE_SERVER_URL}/student-api/all-outpasses/${user.rollNumber}`
                );
                
                const activePasses = response.data.studentOutpasses?.filter(
                    pass => pass.status === 'approved' || pass.status === 'out'
                ) || [];
                
                if (activePasses.length > 0) {
                    setActivePass(activePasses[0]);
                }

                const pendingPasses = response.data.studentOutpasses?.filter(
                    pass => pass.status === 'pending'
                ) || [];
                
                if (pendingPasses.length > 0) {
                    setPendingPass(pendingPasses[0]);
                }
            } catch (error) {
                console.error('Error checking for active pass:', error);
            } finally {
                setCheckingActivePass(false);
            }
        };

        if (user) {
            checkForActivePass();
        }
    }, [user]);

    if (loading || checkingActivePass) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>Please log in to submit an outpass request.</p>
            </div>
        );
    }

    if (activePass) {
        return (
            <div className="form-container responsive-form">
                <div style={{
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    marginBottom: '1rem'
                }}>
                    <h3 style={{ color: '#856404', marginBottom: '1rem' }}>
                        Active Pass Found
                    </h3>
                    <p style={{ color: '#856404', marginBottom: '0.5rem' }}>
                        You already have an active <strong>{activePass.type}</strong> (Status: <strong>{activePass.status}</strong>).
                    </p>
                    <p style={{ color: '#856404', marginBottom: '0.5rem' }}>
                        You can only have one active pass at a time.
                    </p>
                </div>
            </div>
        );
    }

    if (pendingPass && !activePass) {
        return (
            <div className="form-container responsive-form">
                <div style={{
                    backgroundColor: '#d1ecf1',
                    border: '1px solid #0c5460',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    marginBottom: '1rem'
                }}>
                    <h3 style={{ color: '#0c5460', marginBottom: '1rem' }}>
                        Pending Pass Request
                    </h3>
                    <p style={{ color: '#0c5460' }}>
                        You have a pending <strong>{pendingPass.type}</strong> request awaiting approval.
                    </p>
                </div>
            </div>
        );
    }

    const onSubmit = async (data) => {
        try {
            if (!user?.phoneNumber || !user?.parentMobileNumber) {
                alert('Phone numbers are required. Please update your profile.');
                return;
            }

            // Validate inTime is selected
            if (!data.inTime) {
                alert('Please select an in time.');
                return;
            }

            // Validate inTime is after outTime
            const outDateTime = new Date(data.outTime);
            const inDateTime = new Date(data.inTime);
            
            if (inDateTime <= outDateTime) {
                alert('In time must be after out time.');
                return;
            }

            const now = new Date();
            const payload = {
                ...data,
                name: user?.name,
                rollNumber: user?.rollNumber,
                studentMobileNumber: user?.phoneNumber,
                parentMobileNumber: user?.parentMobileNumber,
                month: now.getMonth() + 1,
                year: now.getFullYear()
            };
            
            if (payload.outTime instanceof Date) payload.outTime = payload.outTime.toISOString();
            if (payload.inTime instanceof Date) payload.inTime = payload.inTime.toISOString();

            const response = await axios.post(`${import.meta.env.VITE_SERVER_URL}/student-api/apply-outpass`, payload);
            alert(response.data.message || 'Outpass request submitted successfully!');
            reset();
            navigate('/home');
        } catch (error) {
            console.error('Error:', error);
            alert(error.response?.data?.message || 'Failed to submit outpass request');
        }
    };

    return (
        <div className="form-container responsive-form">
            <h2 className="form-title">Apply for Outpass</h2>
            
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="form-row two-columns">
                    <div className="form-group">
                        <label className="form-label">Out Time (Current Time)</label>
                        <input
                            type="text"
                            className="form-input"
                            value={outTime ? new Date(outTime).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            }) : ''}
                            readOnly
                            style={{ 
                                backgroundColor: '#f0f0f0', 
                                cursor: 'not-allowed',
                                color: '#495057'
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">In Time</label>
                        <input
                            type="text"
                            className="form-input"
                            value={inTime ? new Date(inTime).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            }) : ''}
                            placeholder="Click to select date & time"
                            onClick={() => setShowInTimePicker(true)}
                            readOnly
                            style={{ cursor: 'pointer' }}
                        />
                        {errors.inTime && <span className="error-message">In time is required</span>}
                    </div>
                </div>

                {showInTimePicker && (
                    <DateTimePicker
                        selectedDateTime={inTime || new Date(outTime)}
                        onConfirm={(dateTime) => {
                            setValue('inTime', dateTime);
                            setShowInTimePicker(false);
                        }}
                        onClose={() => setShowInTimePicker(false)}
                        minDate={outTime}
                    />
                )}

                <div className="form-group">
                    <label className="form-label">Reason for Outpass</label>
                    <textarea
                        className="form-textarea"
                        placeholder="Enter reason for outpass request"
                        {...register('reason', { required: 'Reason is required', maxLength: 200 })}
                    />
                    {errors.reason && <span className="error-message">{errors.reason.message}</span>}
                </div>

                <div className="form-group">
                    <label className="form-label">Outpass Type</label>
                    <select
                        className="form-select"
                        {...register('type', { required: 'Type of outpass is required' })}
                        disabled={true}
                        style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                    >
                        <option value="">Select Type</option>
                        <option value="late pass">Late Pass</option>
                        <option value="home pass">Home Pass</option>
                    </select>
                    {calculatedType && (
                        <div style={{ 
                            marginTop: '0.5rem', 
                            padding: '0.5rem', 
                            backgroundColor: '#e7f3ff', 
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            color: '#0066cc'
                        }}>
                            <strong>Auto-selected:</strong> {calculatedType === 'late pass' ? 'Late Pass (≤24 hours)' : 'Home Pass (>24 hours)'}
                        </div>
                    )}
                    {errors.type && <span className="error-message">{errors.type.message}</span>}
                </div>

                <button type="submit" className="form-button">Submit Outpass Request</button>
            </form>
        </div>
    );
}

export default Outpass;
