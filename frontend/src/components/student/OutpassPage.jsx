import { useState, useEffect } from 'react';
import { Megaphone, CalendarDays, ArrowRight, CheckCircle } from 'lucide-react';
import Outpass from './Outpass';
import OutpassList from './OutpassList';
import CurrentPasses from './CurrentPasses';
import './OutpassPage.css';
import './MobileSafeNavbar.css';

/* Sliding indicator styles */
const slidingIndicatorStyles = `
.sliding-indicator {
    will-change: transform;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = slidingIndicatorStyles;
    document.head.appendChild(styleSheet);
}

const OutpassPage = () => {
    const [activeTab, setActiveTab] = useState('outpass');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [hasActivePass, setHasActivePass] = useState(true); // Mock active pass status

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const tabs = [
        { id: 'outpass', label: 'Apply', icon: CalendarDays },
        { id: 'currentPasses', label: 'Current', icon: CheckCircle },
        { id: 'outpassList', label: 'History', icon: ArrowRight }
    ];

    return (
        <div className={`outpass-container ${isMobile ? 'page-content' : ''}`} style={{ textAlign: 'center', padding: '1rem' }}>
            <div>
                {/* Desktop Header */}
                {!isMobile && (
                    <div className="outpass-header" style={{ marginBottom: '1rem' }}>
                        <h2
                            className="outpass-title"
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
                            <span>OUTPASS SECTION</span>
                        </h2>
                    </div>
                )}

                {/* Desktop Tabs Navigation */}
                {!isMobile && (
                    <div
                        className="outpass-tabs"
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginBottom: '1.5rem',
                        }}
                    >
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
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
                                onClick={() => setActiveTab('outpass')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 0.5rem',
                                    border: activeTab === 'outpass' ? 'none' : '1px solid #e2e8f0',
                                    background: activeTab === 'outpass' ? '#667eea' : 'white',
                                    color: activeTab === 'outpass' ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.75rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: activeTab === 'outpass' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== 'outpass') {
                                        e.currentTarget.style.background = '#f8fafc';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== 'outpass') {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                                    }
                                }}
                            >
                                <CalendarDays size={20} />
                                <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>Apply</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('currentPasses')}
                                style={{
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 0.5rem',
                                    border: activeTab === 'currentPasses' ? 'none' : '1px solid #e2e8f0',
                                    background: activeTab === 'currentPasses' ? '#667eea' : 'white',
                                    color: activeTab === 'currentPasses' ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.75rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: activeTab === 'currentPasses' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== 'currentPasses') {
                                        e.currentTarget.style.background = '#f8fafc';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== 'currentPasses') {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                                    }
                                }}
                            >
                                {hasActivePass && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '0.75rem',
                                        right: '1rem',
                                        width: '8px',
                                        height: '8px',
                                        backgroundColor: '#10b981',
                                        borderRadius: '50%',
                                        border: '2px solid white',
                                        zIndex: 10
                                    }} />
                                )}
                                <CheckCircle size={20} />
                                <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>Current</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('outpassList')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 0.5rem',
                                    border: activeTab === 'outpassList' ? 'none' : '1px solid #e2e8f0',
                                    background: activeTab === 'outpassList' ? '#667eea' : 'white',
                                    color: activeTab === 'outpassList' ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.75rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: activeTab === 'outpassList' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== 'outpassList') {
                                        e.currentTarget.style.background = '#f8fafc';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== 'outpassList') {
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

                <div className="outpass-content">
                    {activeTab === 'outpass' && <Outpass />}
                    {activeTab === 'currentPasses' && <CurrentPasses />}
                    {activeTab === 'outpassList' && <OutpassList />}
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
                                width: `calc(${100/3}% - 0.167rem)`,
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
                                    {tab.id === 'currentPasses' && hasActivePass && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '0.75rem',
                                            right: '1rem',
                                            width: '6px',
                                            height: '6px',
                                            backgroundColor: '#10b981',
                                            borderRadius: '50%',
                                            border: '1px solid white',
                                            zIndex: 10
                                        }} />
                                    )}
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

export default OutpassPage;