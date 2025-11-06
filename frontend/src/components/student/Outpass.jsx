import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function Outpass() {
    const { user, loading } = useCurrentUser();
    const { register, handleSubmit, control, formState: { errors }, reset, watch, setValue } = useForm();
    const navigate = useNavigate();
    const [activePass, setActivePass] = useState(null);
    const [pendingPass, setPendingPass] = useState(null);
    const [checkingActivePass, setCheckingActivePass] = useState(true);
    const [isMobileView, setIsMobileView] = useState(false);
    const [calculatedType, setCalculatedType] = useState('');


    // Watch outTime and inTime to calculate duration
    const outTime = watch('outTime');
    const inTime = watch('inTime');

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

    // console.log(user)

    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth <= 480);
        handleResize();
        window.addEventListener('resize', handleResize);
        const checkForActivePass = async () => {
            if (!user?.rollNumber) {
                setCheckingActivePass(false);
                return;
            }

            try {
                const response = await axios.get(
                    `${import.meta.env.VITE_SERVER_URL}/student-api/all-outpasses/${user.rollNumber}`
                );
                
                // Check for any active pass (approved or out status)
                const activePasses = response.data.studentOutpasses?.filter(
                    pass => pass.status === 'approved' || pass.status === 'out'
                ) || [];
                
                if (activePasses.length > 0) {
                    setActivePass(activePasses[0]);
                }

                // Also check for pending passes
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
        return () => window.removeEventListener('resize', handleResize);
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

    // If there's an active pass, show a message instead of the form
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
                        You can only have one active pass at a time. Please complete or return your current pass before requesting a new one.
                    </p>
                    <div style={{ 
                        marginTop: '1rem', 
                        padding: '1rem', 
                        backgroundColor: '#fff',
                        borderRadius: '6px',
                        border: '1px solid #ffc107'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                            <strong>Pass Details:</strong>
                        </p>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                            Type: {activePass.type} | 
                            Out Time: {new Date(activePass.outTime).toLocaleString()} | 
                            In Time: {new Date(activePass.inTime).toLocaleString()}
                        </p>
                    </div>
                    <div style={{ marginTop: '1.5rem' }}>
                        <button 
                            onClick={() => navigate('/home/outpass')}
                            className="form-button"
                            style={{ marginRight: '1rem' }}
                        >
                            View Current Pass
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // If there's a pending pass, show an informational message but block form submission
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
                    <p style={{ color: '#0c5460', marginBottom: '0.5rem' }}>
                        You have a pending <strong>{pendingPass.type}</strong> request awaiting admin approval.
                    </p>
                    <p style={{ color: '#0c5460', marginBottom: '0.5rem' }}>
                        You can only request one pass at a time. Please wait for admin to approve or reject your current request before submitting a new one.
                    </p>
                    <div style={{ 
                        marginTop: '1rem', 
                        padding: '1rem', 
                        backgroundColor: '#fff',
                        borderRadius: '6px',
                        border: '1px solid #bee5eb'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                            <strong>Pending Pass Details:</strong>
                        </p>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                            Type: {pendingPass.type} | 
                            Out Time: {new Date(pendingPass.outTime).toLocaleString()} | 
                            In Time: {new Date(pendingPass.inTime).toLocaleString()}
                        </p>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#999' }}>
                            Submitted: {new Date(pendingPass.createdAt).toLocaleString()}
                        </p>
                    </div>
                    <div style={{ marginTop: '1.5rem' }}>
                        <button 
                            onClick={() => navigate('/home/outpass')}
                            className="form-button"
                        >
                            View Outpass History
                        </button>
                    </div>
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

            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

            const payload = {
                ...data,
                name: user?.name,
                rollNumber: user?.rollNumber,
                studentMobileNumber: user?.phoneNumber,
                parentMobileNumber: user?.parentMobileNumber,
                month,
                year
            };
            // Convert Date objects to ISO strings (server expects datetime strings)
            if (payload.outTime instanceof Date) payload.outTime = payload.outTime.toISOString();
            if (payload.inTime instanceof Date) payload.inTime = payload.inTime.toISOString();

            console.log('Submitting Payload:', payload);

            const response = await axios.post(`${import.meta.env.VITE_SERVER_URL}/student-api/apply-outpass`, payload);

            console.log('API Response:', response);
            alert(response.data.message || 'Outpass request submitted successfully!');

            reset();
            navigate('/home');
        } catch (error) {
            console.error('Error Details:', error);
            alert(error.response?.data?.message || 'Failed to submit outpass request');
        }
    };

    return (
        <div className="form-container responsive-form">
            <h2 className="form-title">Apply for Outpass</h2>
            
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="form-row two-columns">
                    <div className="form-group">
                        <label className="form-label">Out Time</label>
                        <Controller
                            control={control}
                            name="outTime"
                            rules={{ required: 'Out time is required' }}
                            render={({ field }) => (
                                <DatePicker
                                    placeholderText="Select out date & time"
                                    selected={field.value ? new Date(field.value) : null}
                                    onChange={(val) => field.onChange(val)}
                                    showTimeSelect
                                    timeIntervals={15}
                                    timeCaption="Time"
                                    dateFormat="dd-MM-yyyy h:mm aa"
                                    className="form-input"
                                    minDate={new Date()}
                                    minTime={new Date()}
                                    maxTime={new Date(new Date().setHours(23, 59, 59, 999))}
                                    popperPlacement="bottom"
                                    popperModifiers={[
                                        { name: 'offset', options: { offset: [0, 8] } },
                                        { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
                                        { name: 'flip', options: { fallbackPlacements: ['top', 'bottom'] } },
                                        { name: 'computeStyles', options: { adaptive: false } }
                                    ]}
                                    withPortal={isMobileView}
                                />
                            )}
                        />
                        {errors.outTime && <span className="error-message">{errors.outTime.message}</span>}
                    </div>

                    <div className="form-group">
                        <label className="form-label">In Time</label>
                        <Controller
                            control={control}
                            name="inTime"
                            rules={{ required: 'In time is required' }}
                            render={({ field }) => (
                                <DatePicker
                                    placeholderText="Select in date & time"
                                    selected={field.value ? new Date(field.value) : null}
                                    onChange={(val) => field.onChange(val)}
                                    showTimeSelect
                                    timeIntervals={15}
                                    timeCaption="Time"
                                    dateFormat="dd-MM-yyyy h:mm aa"
                                    className="form-input"
                                    minDate={outTime ? new Date(outTime) : new Date()}
                                    minTime={outTime && field.value && new Date(field.value).toDateString() === new Date(outTime).toDateString() 
                                        ? new Date(outTime) 
                                        : new Date(new Date().setHours(0, 0, 0, 0))}
                                    maxTime={new Date(new Date().setHours(23, 59, 59, 999))}
                                    popperPlacement="bottom"
                                    popperModifiers={[
                                        { name: 'offset', options: { offset: [0, 8] } },
                                        { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
                                        { name: 'flip', options: { fallbackPlacements: ['top', 'bottom'] } },
                                        { name: 'computeStyles', options: { adaptive: false } }
                                    ]}
                                    withPortal={isMobileView}
                                />
                            )}
                        />
                        {errors.inTime && <span className="error-message">{errors.inTime.message}</span>}
                    </div>
                </div>

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
