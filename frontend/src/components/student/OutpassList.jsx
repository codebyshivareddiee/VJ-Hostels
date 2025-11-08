import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import ErrorBoundary from './ErrorBoundary';

const OutpassList = () => {
    const { user, loading: userLoading } = useCurrentUser();
    const [outpasses, setOutpasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOutpasses = async () => {
            if (userLoading) {
                return;
            }

            if (!user) {
                setError('User not found. Please log in.');
                setLoading(false);
                return;
            }
            try {
                if (!user?.rollNumber) {
                    throw new Error('User roll number is required');
                }
                const response = await axios.get(
                    `${import.meta.env.VITE_SERVER_URL}/student-api/all-outpasses/${user.rollNumber}`
                );
                
                const historyPasses = response.data.studentOutpasses?.filter(
                    pass => pass.status === 'returned' || pass.status === 'rejected' || pass.status === 'pending'
                ) || [];
                
                setOutpasses(historyPasses);
            } catch (err) {
                console.error('Error fetching outpasses:', err);
                setError(err.response?.data?.message || err.message || 'Failed to fetch outpasses');
            } finally {
                setLoading(false);
            }
        };

        fetchOutpasses();
    }, [user, userLoading]);

    const getStatusStyle = (status) => {
        const styles = {
            pending: {
                backgroundColor: '#fff3cd',
                color: '#856404',
                borderColor: '#ffc107'
            },
            approved: {
                backgroundColor: '#d4edda',
                color: '#155724',
                borderColor: '#28a745'
            },
            rejected: {
                backgroundColor: '#f8d7da',
                color: '#721c24',
                borderColor: '#dc3545'
            },
            out: {
                backgroundColor: '#d1ecf1',
                color: '#0c5460',
                borderColor: '#17a2b8'
            },
            returned: {
                backgroundColor: '#e2d9f3',
                color: '#5a2d82',
                borderColor: '#9b59b6'
            }
        };
        return styles[status] || styles.pending;
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                gap: '1rem'
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    border: '4px solid #e9ecef',
                    borderTop: '4px solid #667eea',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ color: '#6c757d', fontSize: '0.95rem', fontWeight: '500' }}>
                    Loading outpasses...
                </p>
                <style>
                    {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
            </div>
        );
    }
    
    if (error) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                padding: '2rem'
            }}>
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    padding: '2rem',
                    textAlign: 'center',
                    border: '1px solid #f8d7da',
                    maxWidth: '400px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '1rem' }}>
                        <circle cx="12" cy="12" r="10" stroke="#dc3545" strokeWidth="2"/>
                        <path d="M12 8v4m0 4h.01" stroke="#dc3545" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <p style={{ color: '#721c24', fontSize: '0.95rem', margin: 0, fontWeight: '500' }}>
                        {error}
                    </p>
                </div>
            </div>
        );
    }
    
    if (!user) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                padding: '2rem'
            }}>
                <div style={{
                    backgroundColor: '#fff3cd',
                    borderRadius: '12px',
                    padding: '2rem',
                    border: '1px solid #ffc107',
                    maxWidth: '400px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                    <p style={{ color: '#856404', fontSize: '0.95rem', margin: 0, fontWeight: '500' }}>
                        Please log in to view your outpasses
                    </p>
                </div>
            </div>
        );
    }
    
    if (outpasses.length === 0) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                padding: '2rem'
            }}>
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    border: '1px solid #e9ecef',
                    maxWidth: '400px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '1rem' }}>
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                              stroke="#adb5bd" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <p style={{ color: '#6c757d', fontSize: '0.95rem', margin: 0, fontWeight: '500' }}>
                        No outpass requests found
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '1.5rem 1rem'
            }}>
                <style>
                    {`
                        @media (max-width: 768px) {
                            .outpass-grid {
                                grid-template-columns: 1fr !important;
                            }
                        }
                    `}
                </style>

                <div className="outpass-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: '1.25rem'
                }}>
                    {outpasses.map((outpass) => {
                        const statusStyle = getStatusStyle(outpass.status);
                        return (
                            <div key={outpass._id} style={{
                                backgroundColor: '#fff',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid #e9ecef',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}>
                                {/* Card Header */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <h3 style={{
                                        fontSize: '1.05rem',
                                        fontWeight: '600',
                                        color: '#fff',
                                        margin: 0
                                    }}>
                                        Outpass Request
                                    </h3>
                                    <span style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '20px',
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        letterSpacing: '0.03em',
                                        border: `1px solid ${statusStyle.borderColor}`,
                                        ...statusStyle
                                    }}>
                                        {outpass.status.toUpperCase()}
                                    </span>
                                </div>
                                
                                {/* Card Body */}
                                <div style={{ padding: '1.25rem' }}>
                                    {/* Out Time */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.75rem',
                                        marginBottom: '0.9rem'
                                    }}>
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '8px',
                                            backgroundColor: '#f8f9fa',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                                                      stroke="#6c757d" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                color: '#6c757d',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                marginBottom: '0.25rem'
                                            }}>
                                                Out Time
                                            </div>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                fontWeight: '500',
                                                color: '#212529'
                                            }}>
                                                {new Date(outpass.outTime).toLocaleString('en-US', {
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

                                    {/* In Time */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.75rem',
                                        marginBottom: '0.9rem'
                                    }}>
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '8px',
                                            backgroundColor: '#f8f9fa',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                                                      stroke="#6c757d" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                color: '#6c757d',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                marginBottom: '0.25rem'
                                            }}>
                                                In Time
                                            </div>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                fontWeight: '500',
                                                color: '#212529'
                                            }}>
                                                {new Date(outpass.inTime).toLocaleString('en-US', {
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

                                    {/* Divider */}
                                    <div style={{
                                        height: '1px',
                                        backgroundColor: '#e9ecef',
                                        margin: '1rem 0'
                                    }}></div>

                                    {/* Reason */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.75rem',
                                        marginBottom: '0.9rem'
                                    }}>
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '8px',
                                            backgroundColor: '#f8f9fa',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                                                      stroke="#6c757d" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                color: '#6c757d',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                marginBottom: '0.25rem'
                                            }}>
                                                Reason
                                            </div>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                fontWeight: '500',
                                                color: '#212529',
                                                wordBreak: 'break-word'
                                            }}>
                                                {outpass.reason}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Type */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.75rem'
                                    }}>
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '8px',
                                            backgroundColor: '#f8f9fa',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" 
                                                      stroke="#6c757d" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                color: '#6c757d',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                marginBottom: '0.25rem'
                                            }}>
                                                Type
                                            </div>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                fontWeight: '500',
                                                color: '#212529'
                                            }}>
                                                {outpass.type}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default OutpassList;