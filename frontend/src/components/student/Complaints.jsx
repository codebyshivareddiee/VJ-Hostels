import { useState, useEffect } from 'react';
import { Megaphone, CalendarDays, ArrowRight } from 'lucide-react';
import PostComplaint from './PostComplaints';
import ComplaintsList from './ComplaintsList';
import './MobileSafeNavbar.css';

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
        <div className={`complaints-container ${isMobile ? 'page-content' : ''}`} style={{ textAlign: 'center', padding: '1rem' }}>
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

                {/* Desktop Tabs Navigation */}
                {!isMobile && (
                    <div
                        className="complaints-tabs"
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginBottom: '1.5rem',
                        }}
                    >
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.5rem',
                            background: 'white',
                            padding: '0.5rem',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                            maxWidth: '600px',
                            margin: '0 auto',
                            width: '100%'
                        }}>
                            <button
                                type="button"
                                onClick={() => setActiveTab('complaint')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 0.5rem',
                                    border: activeTab === 'complaint' ? 'none' : '1px solid #e2e8f0',
                                    background: activeTab === 'complaint' ? '#667eea' : 'white',
                                    color: activeTab === 'complaint' ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.75rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: activeTab === 'complaint' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== 'complaint') {
                                        e.currentTarget.style.background = '#f8fafc';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== 'complaint') {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                                    }
                                }}
                            >
                                <CalendarDays size={20} />
                                <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>Post Complaint</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('complaint-list')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 0.5rem',
                                    border: activeTab === 'complaint-list' ? 'none' : '1px solid #e2e8f0',
                                    background: activeTab === 'complaint-list' ? '#667eea' : 'white',
                                    color: activeTab === 'complaint-list' ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.75rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: activeTab === 'complaint-list' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== 'complaint-list') {
                                        e.currentTarget.style.background = '#f8fafc';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== 'complaint-list') {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                                    }
                                }}
                            >
                                <ArrowRight size={20} />
                                <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>History</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="complaints-content">
                    {activeTab === 'complaint' ? <PostComplaint /> : <ComplaintsList />}
                </div>
            </div>

            {/* Fixed Bottom Navigation for Mobile */}
            {isMobile && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    padding: '0.5rem',
                    paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))',
                    paddingTop: '1rem',
                }}>
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '9999px',
                        padding: '0.25rem',
                        width: '85%',
                        maxWidth: '1100px',
                        margin: '0 auto',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: '0.3s',
                    }}>
                        {/* Sliding Active Indicator */}
                        <div 
                            style={{
                                position: 'absolute',
                                top: '0.25rem',
                                left: '0.25rem',
                                width: `calc(${100/2}% - 0.167rem)`,
                                height: 'calc(100% - 0.5rem)',
                                backgroundColor: '#667eea',
                                borderRadius: '9999px',
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                transform: `translateX(${tabs.findIndex(tab => tab.id === activeTab) * 100}%)`,
                                transition: 'transform 0.3s ease',
                                zIndex: 1,
                                willChange: 'transform'
                            }}
                        />
                        
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        position: 'relative',
                                        zIndex: 2,
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.25rem',
                                        padding: '0.75rem 0.25rem',
                                        borderRadius: '9999px',
                                        cursor: 'pointer',
                                        backgroundColor: 'transparent',
                                        color: isActive ? '#fff' : '#667eea',
                                        transition: 'color 0.3s ease',
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
                </div>
            )}
        </div>
    );
};

export default Complaints;