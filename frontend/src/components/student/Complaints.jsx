import { useState, useEffect } from 'react';
import { Megaphone, CalendarDays, ArrowRight } from 'lucide-react';
import PostComplaint from './PostComplaints';
import ComplaintsList from './ComplaintsList';

const Complaints = () => {
    const [activeTab, setActiveTab] = useState('complaint');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const tabs = [
        { id: 'complaint', label: 'Post Complaint', icon: CalendarDays },
        { id: 'complaint-list', label: 'History', icon: ArrowRight }
    ];

    return (
        <div className="complaints-container" style={{ textAlign: 'center', padding: '1rem' }}>
            <div>
                {/* Desktop Header */}
                {!isMobile && (
                    <div className="complaints-header" style={{ marginBottom: '1rem' }}>
                        <h2
                            className="complaints-title"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                fontSize: '1.5rem',
                                fontWeight: '600',
                            }}
                        >
                            <Megaphone size={32} />
                            <span>COMPLAINTS SECTION</span>
                        </h2>
                    </div>
                )}

                {/* Tabs Navigation */}
                <div
                    className="complaints-tabs"
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: isMobile ? '0.5rem' : '1rem',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap',
                        padding: isMobile ? '0 0.5rem' : '0',
                    }}
                >
                    {isMobile ? (
                        // Modern Mobile Segmented Control
                        <div style={{
                            display: 'flex',
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            borderRadius: '16px',
                            padding: '4px',
                            gap: '4px',
                            width: '100%',
                            maxWidth: '400px',
                            border: '1px solid rgba(102, 126, 234, 0.2)',
                        }}>
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <div
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.25rem',
                                            padding: '0.75rem 0.5rem',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            backgroundColor: isActive ? '#667eea' : 'transparent',
                                            color: isActive ? '#fff' : '#667eea',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: isActive ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                                            transform: isActive ? 'translateY(-1px)' : 'none',
                                        }}
                                    >
                                        <Icon size={20} strokeWidth={2.5} />
                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: isActive ? '700' : '600',
                                            letterSpacing: '0.02em',
                                        }}>
                                            {tab.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        // Desktop Tabs
                        <>
                            <div
                                className={`complaints-tab ${activeTab === 'complaint' ? 'active' : ''}`}
                                onClick={() => setActiveTab('complaint')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    padding: '0.6rem 1rem',
                                    borderRadius: '8px',
                                    backgroundColor:
                                        activeTab === 'complaint' ? '#007bff' : '#f0f0f0',
                                    color: activeTab === 'complaint' ? '#fff' : '#333',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                <CalendarDays size={20} />
                                <span>Post Complaint</span>
                            </div>

                            <div
                                className={`complaints-tab ${activeTab === 'complaint-list' ? 'active' : ''}`}
                                onClick={() => setActiveTab('complaint-list')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    padding: '0.6rem 1rem',
                                    borderRadius: '8px',
                                    backgroundColor:
                                        activeTab === 'complaint-list' ? '#007bff' : '#f0f0f0',
                                    color: activeTab === 'complaint-list' ? '#fff' : '#333',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                <ArrowRight size={20} />
                                <span>Complaint History</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="complaints-content">
                    {activeTab === 'complaint' ? <PostComplaint /> : <ComplaintsList />}
                </div>
            </div>
        </div>
    );
};

export default Complaints;