import { useEffect, useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_SERVER_URL}/student-api/announcements`
        );
        const data = Array.isArray(response.data)
          ? response.data
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          : [];
        setAnnouncements(data);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return { announcements, loading, hasAnnouncements: announcements.length > 0 };
};

const AnnouncementBanner = ({ onDismiss }) => {
  const navigate = useNavigate();
  const { announcements, loading } = useAnnouncements();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (announcements.length <= 1 || isDragging) return;
    const interval = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [announcements, currentIndex, isDragging]);

  const handleNext = () => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
      setAnimating(false);
    }, 600);
  };

  const handleDotClick = (index) => {
    if (index === currentIndex || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setAnimating(false);
    }, 600);
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentTouch = e.targetTouches[0].clientX;
    const diff = currentTouch - touchStart;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const threshold = 50;
    
    if (Math.abs(dragOffset) > threshold && announcements.length > 1) {
      if (dragOffset < 0) {
        handleNext();
      } else {
        if (animating) return;
        setAnimating(true);
        setTimeout(() => {
          setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
          setAnimating(false);
        }, 300);
      }
    }
    setDragOffset(0);
    setTouchStart(0);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissed(true);
    onDismiss?.();
  };

  const handleAnnouncementClick = () => {
    navigate('/student/announcements');
  };

  if (loading || dismissed || announcements.length === 0) return null;

  const current = announcements[currentIndex];

  return (
    <div
      onClick={!isDragging ? handleAnnouncementClick : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="announcement-banner"
      style={{
        width: '100%',
        background: 'transparent',
        borderRadius: '12px',
        padding: '0.5rem 0.8rem',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'pan-y',
      }}
    >
      <div
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            width: '100%',
          }}
        >
          <div
            style={{
              background: '#4F46E5',
              borderRadius: '8px',
              padding: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
            }}
          >
            <Megaphone
              size={16}
              style={{
                color: '#ffffff',
              }}
            />
          </div>

          <div style={{ 
            flex: 1, 
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            minWidth: 0
          }}>
            <span
              style={{
                color: '#1e1b4b',
                fontSize: '0.85rem',
                fontWeight: '700',
                marginRight: '0.4rem',
              }}
            >
              {current.title}:
            </span>
            <span
              style={{
                color: '#334155',
                fontSize: '0.85rem',
                fontWeight: '500',
              }}
            >
              {current.description}
            </span>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              background: 'rgba(0, 0, 0, 0.1)',
              border: 'none',
              borderRadius: '50%',
              padding: '0.25rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
            }}
          >
            <X size={14} style={{ color: '#1e1b4b' }} />
          </button>
        </div>

        {announcements.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '5px',
              justifyContent: 'center',
              marginTop: '0.6rem',
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
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background:
                    currentIndex === index
                      ? '#4F46E5'
                      : 'rgba(79, 70, 229, 0.3)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
              ></div>
            ))}
          </div>
        )}
      </div>

      <style>
        {`
        .announcement-banner:hover {
          opacity: 0.9;
        }
        `}
      </style>
    </div>
  );
};

export default AnnouncementBanner;
