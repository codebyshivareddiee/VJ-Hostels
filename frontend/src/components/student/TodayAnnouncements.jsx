// TodayAnnouncements.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const TodayAnnouncements = () => {
    const [todayAnnouncements, setTodayAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedAnnouncements, setExpandedAnnouncements] = useState(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTodayAnnouncements = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/student-api/announcements`);
                const data = Array.isArray(response.data) ? response.data.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
                setTodayAnnouncements(data);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching today\'s announcements:', error);
                setError('Failed to load today\'s announcements');
                setLoading(false);
            }
        };

        fetchTodayAnnouncements();
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

    return (
        <div className="announcements-list">
            {todayAnnouncements.length > 0 ? (
                todayAnnouncements.map((announcement) => {
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
                                    Posted : {new Date(announcement.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </small>

                            </div>
                        </div>
                    );
                })
            ) : (
                <p className="no-announcements">No announcements for today.</p>
            )}
        </div>
    );
};

export default TodayAnnouncements;