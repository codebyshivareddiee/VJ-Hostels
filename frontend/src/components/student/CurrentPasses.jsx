import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Clock, Calendar, Phone, User, FileText } from 'lucide-react';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import { generateOutpassPDF } from '../../utils/outpassPDF';
import ErrorBoundary from './ErrorBoundary';

const CurrentPasses = () => {
    const { user, loading: userLoading } = useCurrentUser();
    const [currentPasses, setCurrentPasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [regenerating, setRegenerating] = useState(null);

    useEffect(() => {
        const fetchCurrentPasses = async () => {
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
                
                // Filter for approved, late, and out status only
                const activePasses = response.data.studentOutpasses?.filter(
                    pass => pass.status === 'approved' || pass.status === 'late' || pass.status === 'out'
                ) || [];
                
                setCurrentPasses(activePasses);
            } catch (err) {
                console.error('Error fetching current passes:', err);
                setError(err.response?.data?.message || err.message || 'Failed to fetch current passes');
            } finally {
                setLoading(false);
            }
        };

        fetchCurrentPasses();
    }, [user, userLoading]);

    const handleDownloadPDF = (pass) => {
        try {
            generateOutpassPDF(pass);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const handleRegenerateQR = async (passId) => {
        if (!confirm('Regenerate QR code? This will mark your pass as "Late".')) {
            return;
        }

        setRegenerating(passId);
        try {
            const response = await axios.post(
                `${import.meta.env.VITE_SERVER_URL}/outpass-api/regenerate-qr/${passId}`
            );

            alert(response.data.message);

            // Refresh the passes list
            const updatedResponse = await axios.get(
                `${import.meta.env.VITE_SERVER_URL}/student-api/all-outpasses/${user.rollNumber}`
            );
            
            const activePasses = updatedResponse.data.studentOutpasses?.filter(
                pass => pass.status === 'approved' || pass.status === 'late' || pass.status === 'out'
            ) || [];
            
            setCurrentPasses(activePasses);
        } catch (error) {
            console.error('Error regenerating QR code:', error);
            alert(error.response?.data?.message || 'Failed to regenerate QR code. Please try again.');
        } finally {
            setRegenerating(null);
        }
    };

    const isPassExpired = (pass) => {
        const now = new Date();
        const scheduledOutTime = new Date(pass.outTime);
        const scheduledInTime = new Date(pass.inTime);
        
        // For 'approved' status: expired if past scheduled out time
        if (pass.status === 'approved' && now > scheduledOutTime) {
            return true;
        }
        
        // For 'out' status: expired if past scheduled in time and not already marked as late
        if (pass.status === 'out' && now > scheduledInTime && !pass.isLate) {
            return true;
        }
        
        return false;
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>Loading current passes...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#ffebee', borderRadius: '8px' }}>
                <p style={{ color: '#d32f2f' }}>{error}</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
                <p style={{ color: '#e65100' }}>Please log in to view your passes</p>
            </div>
        );
    }

    if (currentPasses.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <p style={{ color: '#666' }}>No active passes found. Apply for an outpass to see it here once approved.</p>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div style={styles.pageContainer}>
                <div style={styles.headerSection}>
                    <h1 style={styles.mainTitle}>Current Active Passes</h1>
                    <p style={styles.subtitle}>Your approved outpasses ready to use</p>
                </div>

                <div style={styles.cardsContainer}>
                    {currentPasses.map((pass) => (
                        <div key={pass._id} style={styles.card}>
                            {/* Horizontal Layout: Left and Right Sections */}
                            <div style={styles.cardContent}>
                                {/* Left Section - Information */}
                                <div style={styles.leftSection}>
                                    {/* Header with Status */}
                                    <div style={styles.cardHeaderInline}>
                                        <div>
                                            <h3 style={styles.cardTitle}>{pass.name}</h3>
                                            <p style={styles.cardSubtitle}>
                                                Outpass - <span style={{ textTransform: 'capitalize' }}>{pass.type}</span>
                                            </p>
                                        </div>
                                        <span style={{
                                            ...styles.statusBadge,
                                            backgroundColor: 
                                                pass.status === 'approved' ? '#4CAF50' : 
                                                pass.status === 'late' ? '#f59e0b' : 
                                                '#FF9800',
                                        }}>
                                            {pass.status === 'approved' ? 'APPROVED' : 
                                             pass.status === 'late' ? 'LATE' : 'OUT'}
                                        </span>
                                    </div>

                                    {/* Student Details */}
                                    <div style={styles.detailsSection}>
                                        <div style={styles.detailRow}>
                                            <FileText size={18} color="#667eea" style={{ flexShrink: 0 }} />
                                            <div style={styles.detailContent}>
                                                <span style={styles.detailLabel}>Roll Number</span>
                                                <span style={styles.detailValue}>{pass.rollNumber}</span>
                                            </div>
                                        </div>

                                        <div style={styles.detailRow}>
                                            <Phone size={18} color="#667eea" style={{ flexShrink: 0 }} />
                                            <div style={styles.detailContent}>
                                                <span style={styles.detailLabel}>Parent's Phone</span>
                                                <span style={styles.detailValue}>{pass.parentMobileNumber}</span>
                                            </div>
                                        </div>

                                        <div style={styles.detailRow}>
                                            <Calendar size={18} color="#667eea" style={{ flexShrink: 0 }} />
                                            <div style={styles.detailContent}>
                                                <span style={styles.detailLabel}>Out Time</span>
                                                <span style={styles.detailValue}>
                                                    {new Date(pass.outTime).toLocaleString('en-IN', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={styles.detailRow}>
                                            <Clock size={18} color="#667eea" style={{ flexShrink: 0 }} />
                                            <div style={styles.detailContent}>
                                                <span style={styles.detailLabel}>In Time</span>
                                                <span style={styles.detailValue}>
                                                    {new Date(pass.inTime).toLocaleString('en-IN', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={styles.reasonBox}>
                                            <span style={styles.detailLabel}>Reason</span>
                                            <p style={styles.reasonText}>{pass.reason}</p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {isPassExpired(pass) && (
                                            <button 
                                                onClick={() => handleRegenerateQR(pass._id)}
                                                disabled={regenerating === pass._id}
                                                style={{
                                                    ...styles.regenerateButton,
                                                    opacity: regenerating === pass._id ? 0.6 : 1,
                                                    cursor: regenerating === pass._id ? 'not-allowed' : 'pointer'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (regenerating !== pass._id) {
                                                        e.currentTarget.style.backgroundColor = '#d97706';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (regenerating !== pass._id) {
                                                        e.currentTarget.style.backgroundColor = '#f59e0b';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }
                                                }}
                                            >
                                                <Clock size={18} />
                                                <span>
                                                    {regenerating === pass._id 
                                                        ? 'Regenerating...' 
                                                        : pass.status === 'out' 
                                                            ? 'Return Time Passed - Regenerate for Late Check-in'
                                                            : 'QR Expired - Regenerate as Late'}
                                                </span>
                                            </button>
                                        )}
                                        
                                        <button 
                                            onClick={() => handleDownloadPDF(pass)}
                                            style={styles.downloadButton}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#5a67d8';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#667eea';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <Download size={18} />
                                            <span>Download Pass</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Right Section - QR Code */}
                                <div style={styles.rightSection}>
                                    {pass.qrCodeData && (
                                        <div style={styles.qrWrapper}>
                                            {pass.isLate && (
                                                <div style={styles.lateIndicator}>
                                                    <Clock size={20} />
                                                    <span>LATE ENTRY</span>
                                                </div>
                                            )}
                                            {isPassExpired(pass) && (
                                                <div style={styles.expiredIndicator}>
                                                    <Clock size={20} />
                                                    <span>QR EXPIRED</span>
                                                </div>
                                            )}
                                            <div style={styles.qrContainer}>
                                                <QRCodeSVG 
                                                    value={pass.qrCodeData} 
                                                    size={200}
                                                    level="H"
                                                    includeMargin={true}
                                                />
                                            </div>
                                            <p style={styles.qrText}>
                                                {pass.isLate ? 'Late Entry Pass - Show at gate' : 'Show this QR code at the gate'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ErrorBoundary>
    );
};

const styles = {
    pageContainer: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        padding: '2rem 1rem',
    },
    headerSection: {
        textAlign: 'center',
        marginBottom: '2.5rem',
    },
    mainTitle: {
        fontSize: '2.5rem',
        fontWeight: '700',
        margin: '0 0 0.5rem 0',
        color: '#2d3748',
        textShadow: '0 2px 4px rgba(0,0,0,0.05)',
    },
    subtitle: {
        fontSize: '1.1rem',
        margin: 0,
        color: '#4a5568',
        fontWeight: '400',
    },
    cardsContainer: {
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        transition: 'transform 0.3s, box-shadow 0.3s',
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'row',
        minHeight: '320px',
    },
    leftSection: {
        flex: '1 1 60%',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    rightSection: {
        flex: '1 1 40%',
        padding: '2rem',
        backgroundColor: '#f8f9fb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: '1px solid #e2e8f0',
    },
    cardHeaderInline: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: '1rem',
        borderBottom: '2px solid #e2e8f0',
    },
    cardTitle: {
        margin: 0,
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#2d3748',
    },
    cardSubtitle: {
        margin: '0.25rem 0 0 0',
        fontSize: '0.95rem',
        color: '#718096',
        fontWeight: '500',
    },
    statusBadge: {
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    },
    detailsSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        flex: 1,
    },
    detailRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    detailContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.1rem',
    },
    detailLabel: {
        fontSize: '0.75rem',
        color: '#718096',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    detailValue: {
        fontSize: '0.95rem',
        color: '#2d3748',
        fontWeight: '600',
    },
    reasonBox: {
        padding: '1rem',
        backgroundColor: '#fff5e6',
        borderLeft: '3px solid #f59e0b',
        borderRadius: '8px',
        marginTop: '0.5rem',
    },
    reasonText: {
        margin: '0.5rem 0 0 0',
        fontSize: '0.9rem',
        color: '#92400e',
        lineHeight: '1.5',
    },
    qrWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
    },
    qrContainer: {
        padding: '1rem',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    },
    qrText: {
        margin: 0,
        fontSize: '0.85rem',
        color: '#4a5568',
        fontWeight: '600',
        textAlign: 'center',
    },
    downloadButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 20px',
        backgroundColor: '#667eea',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 10px rgba(102, 126, 234, 0.3)',
    },
    regenerateButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px 20px',
        backgroundColor: '#f59e0b',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)',
    },
    lateIndicator: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#fef3c7',
        color: '#92400e',
        borderRadius: '8px',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        border: '2px solid #f59e0b',
    },
    expiredIndicator: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        borderRadius: '8px',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        border: '2px solid #dc2626',
    },
};

export default CurrentPasses;
