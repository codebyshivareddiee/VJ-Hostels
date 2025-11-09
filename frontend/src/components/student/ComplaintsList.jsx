import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useCurrentUser from '../../hooks/student/useCurrentUser';

const ComplaintsList = () => {
    const { user, loading: userLoading } = useCurrentUser();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchComplaints = async () => {
            if (userLoading) {
                return; // Wait for user to load
            }

            if (!user?.rollNumber) {
                setError('User not found. Please log in.');
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/student-api/get-complaints/${user.rollNumber}`);
                setComplaints(response.data || []);
            } catch (err) {
                setError('Failed to fetch complaints.');
            } finally {
                setLoading(false);
            }
        };
        fetchComplaints();
    }, [user, userLoading]);

    if (loading) return <p>Loading complaints...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;
    if (complaints.length === 0) return <p>No complaints found.</p>;

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>My Complaints</h2>

            <div style={styles.complaintsList}>
                {complaints.map((complaint) => (
                    <div key={complaint._id} style={styles.complaintCard}>
                        <div style={styles.complaintHeader}>
                            <div style={styles.categoryBadge}>
                                {complaint.category}
                            </div>
                            <div style={{ ...styles.statusBadge, ...getStatusStyle(complaint.status) }}>
                                {complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                            </div>
                        </div>

                        <div style={styles.complaintBody}>
                            <p style={styles.description}>{complaint.description}</p>

                            {complaint.images && complaint.images.length > 0 && (
                                <div style={styles.imageContainer}>
                                    {complaint.images.map((image, index) => (
                                        <img
                                            key={index}
                                            src={image}
                                            alt={`Complaint image ${index + 1}`}
                                            style={styles.complaintImage}
                                            onClick={() => window.open(image, '_blank')}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={styles.complaintFooter}>
                            <span style={styles.timestamp}>
                                Submitted on: {new Date(complaint.createdAt).toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const getStatusStyle = (status) => {
    switch (status) {
        case 'active': return { color: '#FFA500', backgroundColor: '#FFF7E6' };
        case 'solved': return { color: '#4CAF50', backgroundColor: '#E8F5E9' };
        case 'rejected': return { color: '#FF0000', backgroundColor: '#FFEBEE' };
        default: return { color: '#000', backgroundColor: '#F0F0F0' };
    }
};

const styles = {
    container: {
        maxWidth: '800px',
        margin: '1rem auto',
        padding: '1rem',
        background: '#FFF',
    },
    title: {
        textAlign: 'center',
        marginBottom: '1.5rem',
        color: '#333',
        fontSize: '1.5rem',
        fontWeight: 'bold',
    },
    complaintsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    complaintCard: {
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    complaintHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        borderBottom: '1px solid #eee',
        backgroundColor: '#f8f9fa',
    },
    categoryBadge: {
        padding: '0.35rem 0.75rem',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '500',
        backgroundColor: '#e9ecef',
        color: '#495057',
    },
    statusBadge: {
        padding: '0.35rem 0.75rem',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '500',
    },
    complaintBody: {
        padding: '1.5rem',
    },
    description: {
        margin: '0 0 1rem 0',
        lineHeight: '1.6',
    },
    imageContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginTop: '1rem',
    },
    complaintImage: {
        width: '100px',
        height: '100px',
        objectFit: 'cover',
        borderRadius: '4px',
        cursor: 'pointer',
        border: '1px solid #dee2e6',
    },
    complaintFooter: {
        padding: '1rem',
        borderTop: '1px solid #eee',
        backgroundColor: '#f8f9fa',
    },
    timestamp: {
        fontSize: '0.85rem',
        color: '#6c757d',
    },
};

export default ComplaintsList;
