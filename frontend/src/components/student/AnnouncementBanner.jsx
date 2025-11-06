import { useEffect, useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

const AnnouncementBanner = () => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  // local-only dismissed state; do not persist to sessionStorage
  const [dismissed, setDismissed] = useState(false);
  const [slide, setSlide] = useState(false);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_SERVER_URL}/student-api/announcements`
        );
        const data = Array.isArray(response.data)
          ? response.data.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          : [];
        console.log('Fetched announcements for banner:', data);
        setAnnouncements(data);
      } catch (error) { 
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setSlide(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % announcements.length);
        setSlide(false);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, [announcements]);

  const handleDotClick = (index) => {
    if (index === currentIndex) return;
    setSlide(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setSlide(false);
    }, 400);
  };

  const handleAnnouncementClick = () => {
    navigate('/student/announcements');
  };

  const truncateText = (text, maxLength) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  const handleDismiss = () => {
    // Keep dismissed state local-only (no storage).
    setDismissed(true);
  };

  if (loading || dismissed || announcements.length === 0) return null;

  const current = announcements[currentIndex];

  return (
    <div
      style={{
        position: 'fixed',
        top: '30%',
        right: '2%',
        padding: '0.75rem 1rem',
        width: '320px',
        background: 'white',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        zIndex: 40,
        border: '1px solid rgba(0,0,0,0.1)',
        animation: 'slideInRight 0.6s ease-out',
      }}
      onClick={handleAnnouncementClick}
      className="announcement-banner"
    >
      {/* Main content */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.9rem',
          flex: 1,
          transform: slide ? 'translateX(-25px)' : 'translateX(0)',
          opacity: slide ? 0 : 1,
          transition: 'transform 0.45s ease, opacity 0.45s ease',
        }}
      >
        {/* Icon and text */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <Megaphone size={20} style={{ color: '#4F46E5', marginTop: '0.1rem', flexShrink: 0 }} />
          <div>
            <h6
              className="mb-1 fw-semibold"
              style={{
                color: '#4F46E5',
                fontSize: '1rem',
                fontWeight: '600',
                margin: '0 0 0.25rem 0',
                textTransform: 'uppercase'
              }}
            >
              {truncateText(current.title, 35)}
            </h6>
            <p
              className="mb-0 small"
              style={{
                color: '#000000',
                lineHeight: 1.45,
                fontSize: '0.85rem',
                margin: 0
              }}
            >
              {truncateText(current.description, 80)}
            </p>
          </div>
        </div>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        aria-label="Dismiss"
        style={{
          background: 'rgba(0,0,0,0.1)',
          border: 'none',
          color: '#000000',
          padding: '0.5rem',
          marginLeft: '0.5rem',
          cursor: 'pointer',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
        }}
      >
        <X size={16} />
      </button>

      {/* Dots Indicator */}
      {announcements.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
          }}
        >
          {announcements.map((_, index) => (
            <div
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                handleDotClick(index);
              }}
              style={{
                width: currentIndex === index ? '10px' : '8px',
                height: currentIndex === index ? '10px' : '8px',
                borderRadius: '50%',
                backgroundColor:
                  currentIndex === index ? '#4F46E5' : 'rgba(0,0,0,0.3)',
                boxShadow:
                  currentIndex === index
                    ? '0 0 8px rgba(79,70,229,0.5)'
                    : 'none',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
            ></div>
          ))}
        </div>
      )}

      {/* Keyframes for Glow & Waves */}
      <style>
        {`
        @keyframes slideInRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @media (max-width: 1024px) {
          .announcement-banner {
            position: fixed !important;
            top: 100px !important;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: 90% !important;
            max-width: 600px !important;
            border-radius: 9999px !important;
            padding: 0.5rem 1.25rem !important;
          }
        }

        @media (max-width: 768px) {
          .announcement-banner {
            top: 90px !important;
          }
        }

        @media (max-width: 480px) {
          .announcement-banner {
            top: 85px !important;
          }
          
          .announcement-banner h6 {
            font-size: 0.9rem !important;
          }
          
          .announcement-banner p {
            font-size: 0.8rem !important;
          }
        }
        `}
      </style>
    </div>
  );
};

export default AnnouncementBanner;
