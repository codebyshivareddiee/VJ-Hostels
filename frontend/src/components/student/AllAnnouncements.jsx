// AllAnnouncements.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ErrorBoundary from './ErrorBoundary';

const AllAnnouncements = () => {
    const [allAnnouncements, setAllAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedAnnouncements, setExpandedAnnouncements] = useState(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAllAnnouncements = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/student-api/all-announcements`);
                const data = Array.isArray(response.data) ? response.data.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
                setAllAnnouncements(data);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching all announcements:', error);
                setError('Failed to load announcements');
                setLoading(false);
            }
        };

        fetchAllAnnouncements();
    }, []);

    // Helper function to check if text needs truncation (approximately 3 lines = 200 characters)
    const shouldTruncate = (text) => text.length > 200;

    // Helper function to truncate text to 3 lines
    const truncateText = (text, maxLength = 200) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    };

    const handleReadMore = (announcementId) => {
        const newExpanded = new Set(expandedAnnouncements);
        if (newExpanded.has(announcementId)) {
            newExpanded.delete(announcementId);
        } else {
            newExpanded.add(announcementId);
        }
        setExpandedAnnouncements(newExpanded);
    };

    // Date helpers
    const isSameDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const isToday = (dateStr) => {
        const d = new Date(dateStr);
        return isSameDay(new Date(), d);
    };

    const isYesterday = (dateStr) => {
        const d = new Date(dateStr);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return isSameDay(yesterday, d);
    };

    const formatDateDisplay = (dateStr) => {
        const d = new Date(dateStr);
        if (isToday(dateStr)) {
            return `Today, ${d.toLocaleTimeString()}`;
        }
        if (isYesterday(dateStr)) {
            return `Yesterday, ${d.toLocaleTimeString()}`;
        }
        return d.toLocaleString();
    };

    if (loading) return <p style={{ textAlign: 'center' }}>Loading...</p>;
    if (error) return <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>;

    const announcementsContent = (
        <div className="announcements-list">
            {Array.isArray(allAnnouncements) && allAnnouncements.length > 0 ? (
                allAnnouncements.map((announcement) => {
                    const isExpanded = expandedAnnouncements.has(announcement._id);
                    const needsTruncation = shouldTruncate(announcement.description);
                    
                    return (
                        <div key={announcement._id} className="announcement-card">
                            <div className="announcement-card-body">
                                {announcement.imageUrl && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <img
                                            src={announcement.imageUrl}
                                            alt={announcement.title}
                                            style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 8 }}
                                        />
                                    </div>
                                )}
                                <h5 className="announcement-card-title">{announcement.title}</h5>
                                <p className="announcement-card-text">
                                    {isExpanded || !needsTruncation 
                                        ? announcement.description 
                                        : truncateText(announcement.description)
                                    }
                                </p>
                                {needsTruncation && (
                                    <button 
                                        className="read-more-btn"
                                        onClick={() => handleReadMore(announcement._id)}
                                    >
                                        {isExpanded ? 'Read Less' : 'Read More'}
                                    </button>
                                )}
                                <small className="announcement-card-date">
                                    Posted : {formatDateDisplay(announcement.createdAt)}
                                </small>
                            </div>
                        </div>
                    );
                })
            ) : (
                <p className="no-announcements">No announcements available.</p>
            )}
        </div>
    );

    return (
        <ErrorBoundary>
            {announcementsContent}
        </ErrorBoundary>
    );
};

export default AllAnnouncements;