import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './OutpassOTPVerification.css';

const OutpassOTPVerification = ({ outpassId, parentMobileNumber, onVerified, onCancel, reason, outTime }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [resendDisabled, setResendDisabled] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [attemptCount, setAttemptCount] = useState(0);
    const [maxAttempts, setMaxAttempts] = useState(3);
    const otpInputRefs = useRef([]);

    // Timer for OTP expiry
    useEffect(() => {
        if (timeLeft <= 0) {
            setError('OTP has expired. Please request a new one.');
            return;
        }

        const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        return () => clearTimeout(timer);
    }, [timeLeft]);

    // Timer for resend cooldown
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        } else if (resendTimer === 0 && resendDisabled) {
            setResendDisabled(false);
        }
    }, [resendTimer, resendDisabled]);

    // Handle OTP input changes
    const handleOTPChange = (index, value) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus to next field
        if (value && index < 5) {
            otpInputRefs.current[index + 1].focus();
        }
    };

    // Handle backspace
    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputRefs.current[index - 1].focus();
        }
    };

    // Format time display (MM:SS)
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Verify OTP
    const handleVerifyOTP = async () => {
        const otpString = otp.join('');

        if (otpString.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await axios.post(
                `http://localhost:6201/outpass-api/verify-parent-otp/${outpassId}`,
                { otp: otpString }
            );

            setSuccess(true);
            setError('');
            
            // Show success message and call callback
            setTimeout(() => {
                onVerified(response.data.outpass);
            }, 1500);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to verify OTP';
            const remainingAttempts = err.response?.data?.remainingAttempts;
            
            setError(errorMessage);
            setOtp(['', '', '', '', '', '']);
            
            // Update attempt count
            if (remainingAttempts !== undefined) {
                setAttemptCount(maxAttempts - remainingAttempts);
            }

            // Auto-focus first input for retry
            otpInputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOTP = async () => {
        setLoading(true);
        setError('');

        try {
            await axios.post(
                `http://localhost:6201/outpass-api/resend-otp/${outpassId}`
            );

            setSuccess(false);
            setOtp(['', '', '', '', '', '']);
            setTimeLeft(300); // Reset timer to 5 minutes
            setAttemptCount(0); // Reset attempts
            setResendDisabled(true);
            setResendTimer(60); // 60 second cooldown
            setError('');
            
            // Auto-focus first input
            otpInputRefs.current[0]?.focus();
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to resend OTP';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Mask phone number for display
    const maskedPhone = `***${parentMobileNumber?.slice(-3)}`;

    return (
        <div className="otp-verification-container">
            <div className="otp-card">
                <div className="otp-header">
                    <h2>📱 OTP Verification</h2>
                    <p className="otp-subtitle">Confirm your outpass with your parent's approval</p>
                </div>

                {/* Outpass Details */}
                <div className="outpass-details">
                    <div className="detail-item">
                        <span className="detail-label">Reason:</span>
                        <span className="detail-value">{reason}</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Out Time:</span>
                        <span className="detail-value">
                            {new Date(outTime).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            })}
                        </span>
                    </div>
                </div>

                {/* Success State */}
                {success && (
                    <div className="otp-success">
                        <div className="success-icon">✓</div>
                        <h3>OTP Verified Successfully!</h3>
                        <p>Your parent has approved your outpass request.</p>
                        <p className="pending-admin">Your request has been sent to admin for final approval.</p>
                    </div>
                )}

                {/* OTP Input Form */}
                {!success && (
                    <>
                        <div className="otp-info">
                            <p>We've sent a 6-digit OTP to your parent's phone ending in <strong>{maskedPhone}</strong></p>
                            <p className="otp-info-secondary">Please ask your parent to check their SMS and enter the code below</p>
                        </div>

                        {error && <div className="otp-error">{error}</div>}

                        {/* OTP Input Fields */}
                        <div className="otp-input-group">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => (otpInputRefs.current[index] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength="1"
                                    value={digit}
                                    onChange={(e) => handleOTPChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className={`otp-input ${error && 'error'}`}
                                    placeholder="—"
                                    disabled={loading || timeLeft <= 0}
                                />
                            ))}
                        </div>

                        {/* Attempt Counter */}
                        {attemptCount > 0 && (
                            <div className="attempt-counter">
                                ⚠️ Attempt {attemptCount} of {maxAttempts}
                            </div>
                        )}

                        {/* Timer */}
                        <div className={`otp-timer ${timeLeft < 60 ? 'warning' : ''}`}>
                            ⏱️ OTP expires in: <strong>{formatTime(timeLeft)}</strong>
                        </div>

                        {/* Verify Button */}
                        <button
                            onClick={handleVerifyOTP}
                            disabled={loading || timeLeft <= 0}
                            className="otp-verify-btn"
                        >
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>

                        {/* Resend Option */}
                        <div className="otp-resend-section">
                            <p>Didn't receive the OTP?</p>
                            <button
                                onClick={handleResendOTP}
                                disabled={resendDisabled || loading}
                                className="otp-resend-btn"
                            >
                                {resendDisabled ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                            </button>
                        </div>

                        {/* Cancel Option */}
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="otp-cancel-btn"
                        >
                            Cancel Request
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default OutpassOTPVerification;
