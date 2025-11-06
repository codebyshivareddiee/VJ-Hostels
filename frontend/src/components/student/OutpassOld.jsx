import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X } from 'lucide-react';

// Analog Clock Component
function AnalogClock({ selectedTime, onTimeSelect, mode }) {
    const [time, setTime] = useState(selectedTime || new Date());

    useEffect(() => {
        if (selectedTime) {
            setTime(selectedTime);
        }
    }, [selectedTime]);

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const displayHours = mode === 'AM' ? (hours % 12 || 12) : (hours % 12 || 12);

    const minuteDeg = (minutes * 6);
    const hourDeg = ((displayHours % 12) * 30) + (minutes * 0.5);

    const handleClockClick = (e) => {
        const clock = e.currentTarget;
        const rect = clock.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const x = e.clientX - rect.left - centerX;
        const y = e.clientY - rect.top - centerY;
        
        let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
        
        const minuteAngle = Math.round(angle / 6) * 6;
        const newMinutes = Math.round(minuteAngle / 6) % 60;
        
        const newTime = new Date(time);
        newTime.setMinutes(newMinutes);
        setTime(newTime);
        onTimeSelect(newTime);
    };

    const handleHourClick = (hour) => {
        const newTime = new Date(time);
        const adjustedHour = mode === 'PM' ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
        newTime.setHours(adjustedHour);
        setTime(newTime);
        onTimeSelect(newTime);
    };

    const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    return (
        <div style={{
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
            position: 'relative',
            boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.05)',
            cursor: 'pointer'
        }}
        onClick={handleClockClick}>
            {/* Hour numbers */}
            {hourNumbers.map((num, i) => {
                const angle = (i * 30 - 90) * (Math.PI / 180);
                const distance = 75;
                const x = distance * Math.cos(angle);
                const y = distance * Math.sin(angle);
                const isSelected = displayHours === num;
                
                return (
                    <div
                        key={num}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleHourClick(num);
                        }}
                        style={{
                            position: 'absolute',
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            transform: 'translate(-50%, -50%)',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: isSelected ? 'bold' : 'normal',
                            color: isSelected ? 'white' : '#333',
                            background: isSelected ? '#1976d2' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            zIndex: 2
                        }}>
                        {num}
                    </div>
                );
            })}

            {/* Hour hand */}
            <div style={{
                position: 'absolute',
                width: '4px',
                height: '50px',
                background: '#1976d2',
                bottom: '50%',
                left: '50%',
                transformOrigin: 'bottom center',
                transform: `translateX(-50%) rotate(${hourDeg}deg)`,
                borderRadius: '10px',
                zIndex: 3
            }} />

            {/* Minute hand */}
            <div style={{
                position: 'absolute',
                width: '3px',
                height: '70px',
                background: '#1976d2',
                bottom: '50%',
                left: '50%',
                transformOrigin: 'bottom center',
                transform: `translateX(-50%) rotate(${minuteDeg}deg)`,
                borderRadius: '10px',
                zIndex: 4
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
                zIndex: 5,
                border: '2px solid white'
            }} />
        </div>
    );
}

// Calendar Component
function CalendarView({ selectedDate, onDateSelect }) {
    const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        days.push({ day: daysInPrevMonth - i, isCurrentMonth: false, isPrevMonth: true });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, isCurrentMonth: true, isPrevMonth: false });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
        days.push({ day: i, isCurrentMonth: false, isPrevMonth: false });
    }
    
    const handleDateClick = (day) => {
        if (day.isCurrentMonth) {
            const newDate = new Date(year, month, day.day);
            if (selectedDate) {
                newDate.setHours(selectedDate.getHours());
                newDate.setMinutes(selectedDate.getMinutes());
            }
            onDateSelect(newDate);
        }
    };
    
    const isSelectedDate = (day) => {
        if (!selectedDate || !day.isCurrentMonth) return false;
        return selectedDate.getDate() === day.day &&
               selectedDate.getMonth() === month &&
               selectedDate.getFullYear() === year;
    };
    
    return (
        <div style={{ width: '300px' }}>
            {/* Month/Year header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px',
                background: '#1976d2',
                color: 'white',
                borderRadius: '8px 8px 0 0'
            }}>
                <div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>{year}</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {dayNames[selectedDate?.getDay() || new Date().getDay()]}, {monthNames[month]} {selectedDate?.getDate() || new Date().getDate()}
                    </div>
                </div>
            </div>
            
            {/* Month navigation */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: '#f5f5f5'
            }}>
                <button
                    onClick={() => setCurrentMonth(new Date(year, month - 1))}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px 8px'
                    }}>
                    ‹
                </button>
                <div style={{ fontWeight: 'bold' }}>
                    {monthNames[month]} {year}
                </div>
                <button
                    onClick={() => setCurrentMonth(new Date(year, month + 1))}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px 8px'
                    }}>
                    ›
                </button>
            </div>
            
            {/* Day names */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '2px',
                padding: '8px',
                background: '#f5f5f5',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#666'
            }}>
                {dayNames.map(day => (
                    <div key={day} style={{ textAlign: 'center', padding: '4px' }}>
                        {day}
                    </div>
                ))}
            </div>
            
            {/* Calendar grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '2px',
                padding: '8px',
                background: 'white'
            }}>
                {days.map((day, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleDateClick(day)}
                        style={{
                            padding: '8px',
                            border: 'none',
                            background: isSelectedDate(day) ? '#1976d2' : 'transparent',
                            color: isSelectedDate(day) ? 'white' : day.isCurrentMonth ? '#333' : '#ccc',
                            borderRadius: '50%',
                            cursor: day.isCurrentMonth ? 'pointer' : 'default',
                            fontSize: '13px',
                            fontWeight: isSelectedDate(day) ? 'bold' : 'normal',
                            transition: 'all 0.2s',
                            aspectRatio: '1'
                        }}>
                        {day.day}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Main DateTime Picker Component
function DateTimePicker({ value, onChange, onClose }) {
    const [selectedDate, setSelectedDate] = useState(value || new Date());
    const [mode, setMode] = useState('AM');

    useEffect(() => {
        if (selectedDate) {
            const hours = selectedDate.getHours();
            setMode(hours >= 12 ? 'PM' : 'AM');
        }
    }, [selectedDate]);

    const handleDateChange = (date) => {
        setSelectedDate(date);
    };

    const handleTimeChange = (time) => {
        setSelectedDate(time);
    };

    const toggleMode = () => {
        const newMode = mode === 'AM' ? 'PM' : 'AM';
        setMode(newMode);
        const newTime = new Date(selectedDate);
        const currentHours = newTime.getHours();
        if (newMode === 'PM' && currentHours < 12) {
            newTime.setHours(currentHours + 12);
        } else if (newMode === 'AM' && currentHours >= 12) {
            newTime.setHours(currentHours - 12);
        }
        setSelectedDate(newTime);
    };

    const handleConfirm = () => {
        onChange(selectedDate);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 50px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            overflow: 'hidden',
            maxWidth: '90vw'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 20px',
                background: '#f5f5f5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e0e0e0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} color="#1976d2" />
                    <span style={{ fontWeight: 'bold', color: '#333' }}>Select Date & Time</span>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px'
                    }}>
                    <X size={20} />
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {/* Calendar Section */}
                <CalendarView 
                    selectedDate={selectedDate}
                    onDateSelect={handleDateChange}
                />

                {/* Time Section */}
                <div style={{
                    padding: '20px',
                    background: '#fafafa',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '15px',
                    minWidth: '280px'
                }}>
                    {/* AM/PM Toggle */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => mode !== 'AM' && toggleMode()}
                            style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                border: 'none',
                                background: mode === 'AM' ? '#1976d2' : '#e0e0e0',
                                color: mode === 'AM' ? 'white' : '#666',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '16px',
                                transition: 'all 0.2s'
                            }}>
                            AM
                        </button>
                        <button
                            onClick={() => mode !== 'PM' && toggleMode()}
                            style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                border: 'none',
                                background: mode === 'PM' ? '#1976d2' : '#e0e0e0',
                                color: mode === 'PM' ? 'white' : '#666',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '16px',
                                transition: 'all 0.2s'
                            }}>
                            PM
                        </button>
                    </div>

                    {/* Analog Clock */}
                    <AnalogClock 
                        selectedTime={selectedDate}
                        onTimeSelect={handleTimeChange}
                        mode={mode}
                    />

                    {/* Digital Time Display */}
                    <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#333',
                        textAlign: 'center'
                    }}>
                        {selectedDate.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        })}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div style={{
                padding: '15px 20px',
                background: '#f5f5f5',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                borderTop: '1px solid #e0e0e0'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: 'transparent',
                        color: '#666',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        fontSize: '14px'
                    }}>
                    CANCEL
                </button>
                <button
                    onClick={handleConfirm}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: '#1976d2',
                        color: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        fontSize: '14px'
                    }}>
                    OK
                </button>
            </div>
        </div>
    );
}

// Demo Outpass Form
export default function OutpassDemo() {
    const [showDateTimePicker, setShowDateTimePicker] = useState(false);
    const [outTime] = useState(new Date());
    const [inTime, setInTime] = useState(null);

    const handleTimeConfirm = (time) => {
        setInTime(time);
    };

    return (
        <div style={{ 
            padding: '20px', 
            maxWidth: '600px', 
            margin: '0 auto',
            fontFamily: 'Arial, sans-serif',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '30px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
            }}>
                <h2 style={{ 
                    textAlign: 'center', 
                    color: '#333',
                    marginBottom: '30px',
                    fontSize: '24px'
                }}>
                    Apply for Outpass
                </h2>

                {/* Out Time */}
                <div style={{ marginBottom: '25px' }}>
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        color: '#555',
                        fontSize: '14px'
                    }}>
                        Out Time (Current Time)
                    </label>
                    <input
                        type="text"
                        value={outTime.toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        })}
                        readOnly
                        style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            backgroundColor: '#f0f0f0',
                            cursor: 'not-allowed',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* In Time */}
                <div style={{ marginBottom: '25px' }}>
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        color: '#555',
                        fontSize: '14px'
                    }}>
                        In Time
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            value={inTime ? inTime.toLocaleString('en-IN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            }) : ''}
                            placeholder="Click to select date & time"
                            readOnly
                            onClick={() => setShowDateTimePicker(true)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                paddingRight: '40px',
                                border: '2px solid #1976d2',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                backgroundColor: 'white',
                                boxSizing: 'border-box'
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none'
                        }}>
                            <Clock size={20} color="#1976d2" />
                        </div>
                    </div>
                </div>

                {/* Reason */}
                <div style={{ marginBottom: '25px' }}>
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        color: '#555',
                        fontSize: '14px'
                    }}>
                        Reason for Outpass
                    </label>
                    <textarea
                        placeholder="Enter reason for outpass request"
                        style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            minHeight: '100px',
                            fontSize: '14px',
                            fontFamily: 'Arial, sans-serif',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Submit Button */}
                <button style={{
                    width: '100%',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}>
                    Submit Outpass Request
                </button>
            </div>

            {/* DateTime Picker Modal */}
            {showDateTimePicker && (
                <>
                    <div 
                        onClick={() => setShowDateTimePicker(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            zIndex: 999
                        }} 
                    />
                    <DateTimePicker
                        value={inTime}
                        onChange={handleTimeConfirm}
                        onClose={() => setShowDateTimePicker(false)}
                    />
                </>
            )}
        </div>
    );
}