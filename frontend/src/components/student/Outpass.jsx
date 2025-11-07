import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './OutpassDateTimePicker.css';

// Modern DateTime Picker Component
function DateTimePicker({ selectedDateTime, onConfirm, onClose, minDate }) {
    const initialDate = selectedDateTime || (minDate ? new Date(minDate.getTime() + 60000) : new Date());
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [viewDate, setViewDate] = useState(new Date(initialDate));
    const [selectedHour, setSelectedHour] = useState(initialDate.getHours() % 12 || 12);
    const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());
    const [period, setPeriod] = useState(initialDate.getHours() >= 12 ? 'PM' : 'AM');
    const [activeTab, setActiveTab] = useState('date');

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
        
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true });
        }
        
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
            
            if (minDate && newDate < minDate) {
                alert('Please select a date and time after the out time.');
                return;
            }
            
            setCurrentDate(newDate);
            // Automatically switch to time tab after date selection
            setTimeout(() => setActiveTab('time'), 150);
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
        
        if (minDate && newDate < minDate) {
            alert('Please select a time after the out time.');
            return;
        }
        
        setCurrentDate(newDate);
    };

    const handleConfirm = () => {
        if (minDate && currentDate < minDate) {
            alert('In time must be after out time.');
            return;
        }
        onConfirm(currentDate);
    };

    const days = getDaysInMonth(viewDate);
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'white',
                borderRadius: '20px',
                overflow: 'hidden',
                width: 'calc(100vw - 32px)',
                maxWidth: '400px',
                maxHeight: '85vh',
                zIndex: 9999,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Compact Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '20px',
                    position: 'relative'
                }}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                            transition: 'background 0.2s',
                            zIndex: 10
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        <X size={18} />
                    </button>
                    
                    <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>
                        Select In Time
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={20} />
                        {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '20px', marginTop: '4px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} />
                        {currentDate.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                        })}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{
                    display: 'flex',
                    borderBottom: '2px solid #e0e0e0',
                    background: '#fafafa'
                }}>
                    <button
                        onClick={() => setActiveTab('date')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === 'date' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'date' ? '3px solid #667eea' : '3px solid transparent',
                            color: activeTab === 'date' ? '#667eea' : '#666',
                            fontWeight: activeTab === 'date' ? 'bold' : 'normal',
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <Calendar size={16} />
                        Date
                    </button>
                    <button
                        onClick={() => setActiveTab('time')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: activeTab === 'time' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'time' ? '3px solid #667eea' : '3px solid transparent',
                            color: activeTab === 'time' ? '#667eea' : '#666',
                            fontWeight: activeTab === 'time' ? 'bold' : 'normal',
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <Clock size={16} />
                        Time
                    </button>
                </div>

                <div style={{ 
                    overflowY: 'auto',
                    flex: 1,
                    padding: '0'
                }}>
                    {/* Min Date Info */}
                    {minDate && (
                        <div style={{
                            padding: '10px 16px',
                            background: '#f0f4ff',
                            borderBottom: '1px solid #667eea',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            color: '#667eea'
                        }}>
                            <Clock size={14} />
                            <span>
                                <strong>After:</strong> {minDate.toLocaleString('en-IN', { 
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                            </span>
                        </div>
                    )}
                    
                    {/* Calendar Section */}
                    {activeTab === 'date' && (
                        <div style={{ padding: '12px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '16px'
                            }}>
                                <button
                                    onClick={() => changeMonth(-1)}
                                    style={{
                                        background: '#f5f5f5',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e0e0e0'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                                    {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                                </h3>
                                <button
                                    onClick={() => changeMonth(1)}
                                    style={{
                                        background: '#f5f5f5',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e0e0e0'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(7, 1fr)',
                                gap: '4px',
                                marginBottom: '4px'
                            }}>
                                {dayNames.map((day, i) => (
                                    <div key={i} style={{
                                        textAlign: 'center',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: '#999',
                                        padding: '4px 0'
                                    }}>
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(7, 1fr)',
                                gap: '4px'
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
                                                padding: '10px 0',
                                                border: 'none',
                                                borderRadius: '8px',
                                                background: isSelected ? '#667eea' : 'transparent',
                                                color: isSelected ? 'white' : isDisabled ? '#ddd' : '#333',
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                fontSize: '13px',
                                                fontWeight: isSelected ? 'bold' : 'normal',
                                                opacity: isDisabled ? 0.4 : 1,
                                                transition: 'all 0.2s',
                                                width: '100%'
                                            }}
                                        >
                                            {day.day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Time Section */}
                    {activeTab === 'time' && (
                        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {/* AM/PM Toggle */}
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                marginBottom: '16px',
                                background: '#f5f5f5',
                                padding: '4px',
                                borderRadius: '12px',
                                width: '180px'
                            }}>
                                <button
                                    onClick={() => handlePeriodChange('AM')}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: period === 'AM' ? 'white' : 'transparent',
                                        color: period === 'AM' ? '#667eea' : '#666',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s',
                                        boxShadow: period === 'AM' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    AM
                                </button>
                                <button
                                    onClick={() => handlePeriodChange('PM')}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: period === 'PM' ? 'white' : 'transparent',
                                        color: period === 'PM' ? '#667eea' : '#666',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s',
                                        boxShadow: period === 'PM' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    PM
                                </button>
                            </div>

                            {/* Clock Face */}
                            <div style={{
                                position: 'relative',
                                width: 'min(240px, 65vw)',
                                height: 'min(240px, 65vw)',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
                                border: '3px solid #e0e0e0',
                                marginBottom: '16px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                            }}>
                                {/* Center dot */}
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: '#667eea',
                                    zIndex: 10
                                }} />
                                
                                {/* Hour numbers in circle */}
                                {hours.map((hour) => {
                                    const angle = (hour * 30 - 90) * (Math.PI / 180);
                                    const clockSize = Math.min(240, window.innerWidth * 0.65);
                                    const radius = clockSize * 0.39;
                                    const x = Math.cos(angle) * radius;
                                    const y = Math.sin(angle) * radius;
                                    
                                    return (
                                        <button
                                            key={hour}
                                            onClick={() => handleHourChange(hour)}
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                background: selectedHour === hour ? '#667eea' : 'transparent',
                                                color: selectedHour === hour ? 'white' : '#333',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                zIndex: 5
                                            }}
                                            onMouseEnter={(e) => {
                                                if (selectedHour !== hour) {
                                                    e.currentTarget.style.background = '#f0f4ff';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedHour !== hour) {
                                                    e.currentTarget.style.background = 'transparent';
                                                }
                                            }}
                                        >
                                            {hour}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Minute Selector */}
                            <div style={{ width: '100%', maxWidth: '100%', padding: '0 8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
                                    Minutes
                                </label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'white',
                                    padding: '8px',
                                    borderRadius: '12px',
                                    border: '2px solid #e0e0e0',
                                    flexWrap: 'wrap',
                                    justifyContent: 'center'
                                }}>
                                    <button
                                        onClick={() => handleMinuteChange(Math.max(0, selectedMinute - 5))}
                                        style={{
                                            padding: '8px 12px',
                                            background: '#f5f5f5',
                                            color: '#667eea',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#667eea';
                                            e.currentTarget.style.color = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f5f5f5';
                                            e.currentTarget.style.color = '#667eea';
                                        }}
                                    >
                                        -5
                                    </button>
                                    <button
                                        onClick={() => handleMinuteChange(Math.max(0, selectedMinute - 1))}
                                        style={{
                                            padding: '8px 12px',
                                            background: '#f5f5f5',
                                            color: '#667eea',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#667eea';
                                            e.currentTarget.style.color = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f5f5f5';
                                            e.currentTarget.style.color = '#667eea';
                                        }}
                                    >
                                        -1
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={selectedMinute}
                                        onChange={(e) => handleMinuteChange(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                                        style={{
                                            flex: 1,
                                            minWidth: '60px',
                                            padding: '12px',
                                            textAlign: 'center',
                                            border: '2px solid #667eea',
                                            borderRadius: '10px',
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            background: '#f0f4ff',
                                            color: '#667eea'
                                        }}
                                    />
                                    <button
                                        onClick={() => handleMinuteChange(Math.min(59, selectedMinute + 1))}
                                        style={{
                                            padding: '8px 12px',
                                            background: '#f5f5f5',
                                            color: '#667eea',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#667eea';
                                            e.currentTarget.style.color = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f5f5f5';
                                            e.currentTarget.style.color = '#667eea';
                                        }}
                                    >
                                        +1
                                    </button>
                                    <button
                                        onClick={() => handleMinuteChange(Math.min(59, selectedMinute + 5))}
                                        style={{
                                            padding: '8px 12px',
                                            background: '#f5f5f5',
                                            color: '#667eea',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#667eea';
                                            e.currentTarget.style.color = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f5f5f5';
                                            e.currentTarget.style.color = '#667eea';
                                        }}
                                    >
                                        +5
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '10px 16px',
                    background: '#fafafa',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    borderTop: '1px solid #e0e0e0',
                    flexShrink: 0
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            background: 'white',
                            color: '#666',
                            border: '1px solid #ddd',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '8px 20px',
                            background: 'linear-gradient(135deg, #667eea 50%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
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

    const outTime = watch('outTime');
    const inTime = watch('inTime');

    useEffect(() => {
        setValue('outTime', new Date());
    }, [setValue]);

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

            if (!data.inTime) {
                alert('Please select an in time.');
                return;
            }

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

            await axios.post(`${import.meta.env.VITE_SERVER_URL}/student-api/apply-outpass`, payload);
            reset();
            window.location.reload();
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
                    {/* {errors.type && <span className="error-message">{errors.type.message}</span>} */}
                </div>

                <button type="submit" className="form-button">Submit Outpass Request</button>
            </form>
        </div>
    );
}

export default Outpass;