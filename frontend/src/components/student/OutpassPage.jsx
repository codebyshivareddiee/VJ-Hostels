import { useState, useEffect } from 'react';
import { Megaphone, CalendarDays, ArrowRight, CheckCircle } from 'lucide-react';
import Outpass from './Outpass';
import OutpassList from './OutpassList';
import CurrentPasses from './CurrentPasses';
import FormsAnimation from '../../assets/forms-animate.svg'; // ✅ Import animation

const OutpassPage = () => {
    const [activeTab, setActiveTab] = useState('outpass'); // Default to outpass application
    const [showAnimation, setShowAnimation] = useState(true); // ✅ Controls animation visibility

    // ✅ Play animation on mount
    useEffect(() => {
        const timer = setTimeout(() => setShowAnimation(false), 2500); // Match your SVG duration
        return () => clearTimeout(timer);
    }, []);

    // ✅ Inline fade-in animation
    const fadeInStyle = {
        animation: 'fadeIn 0.8s ease-in-out',
    };

    const keyframes = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;

    return (
        <div className="outpass-container" style={{ textAlign: 'center', padding: '1rem' }}>
            {/* Inject keyframes */}
            <style>{keyframes}</style>

            {showAnimation ? (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '70vh',
            textAlign: 'center',
            ...fadeInStyle,
        }}
    >
        <img
            src={FormsAnimation}
            alt="Forms animation"
            style={{
                width: '180px', // ✅ Base size
                height: 'auto',
                maxWidth: '80%', // ✅ Prevents overflow
                objectFit: 'contain',
            }}
        />
        <p
            style={{
                marginTop: '1rem',
                color: '#6c757d',
                fontSize: '1rem',
            }}
        >
            Preparing Outpass Section...
        </p>

        {/* ✅ Mobile-specific inline style via media query */}
        <style>
            {`
                @media (max-width: 480px) {
                    img {
                        width: 140px !important; /* smaller on phones */
                    }
                }
            `}
        </style>
    </div>
) : (
    <div style={fadeInStyle}>

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

                    {/* Tabs */}
                    <div
                        className="outpass-tabs"
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '1rem',
                            marginBottom: '1.5rem',
                            flexWrap: 'wrap',
                        }}
                    >
                        <div
                            className={`outpass-tab ${activeTab === 'outpass' ? 'active' : ''}`}
                            onClick={() => setActiveTab('outpass')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                padding: '0.6rem 1rem',
                                borderRadius: '8px',
                                backgroundColor:
                                    activeTab === 'outpass' ? '#007bff' : '#f0f0f0',
                                color: activeTab === 'outpass' ? '#fff' : '#333',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            <CalendarDays size={20} />
                            <span>Apply For OutPass</span>
                        </div>

                        <div
                            className={`outpass-tab ${activeTab === 'currentPasses' ? 'active' : ''}`}
                            onClick={() => setActiveTab('currentPasses')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                padding: '0.6rem 1rem',
                                borderRadius: '8px',
                                backgroundColor:
                                    activeTab === 'currentPasses' ? '#007bff' : '#f0f0f0',
                                color: activeTab === 'currentPasses' ? '#fff' : '#333',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            <CheckCircle size={20} />
                            <span>Current Passes</span>
                        </div>

                        <div
                            className={`outpass-tab ${activeTab === 'outpassList' ? 'active' : ''}`}
                            onClick={() => setActiveTab('outpassList')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                padding: '0.6rem 1rem',
                                borderRadius: '8px',
                                backgroundColor:
                                    activeTab === 'outpassList' ? '#007bff' : '#f0f0f0',
                                color: activeTab === 'outpassList' ? '#fff' : '#333',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            <ArrowRight size={20} />
                            <span>OutPass History</span>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="outpass-content" style={{ ...fadeInStyle }}>
                        {activeTab === 'outpass' && <Outpass />}
                        {activeTab === 'currentPasses' && <CurrentPasses />}
                        {activeTab === 'outpassList' && <OutpassList />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutpassPage;