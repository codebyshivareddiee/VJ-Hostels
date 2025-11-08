import React, { useState, useEffect, useRef } from 'react';
import { Users, Clock, CheckCircle, XCircle, Phone, User, Calendar, AlertCircle, Settings, Copy, Check, Plus, ChevronDown } from 'lucide-react';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import VisitorPreferences from './VisitorPreferences';
import io from 'socket.io-client';

const VisitorManagement = () => {
  const { user } = useCurrentUser();
  const [activeOTPs, setActiveOTPs] = useState(() => {
    try {
      const saved = localStorage.getItem('activeOTPs');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load OTPs from localStorage:', error);
      return [];
    }
  });
  const [visitHistory, setVisitHistory] = useState([]);
  const [currentView, setCurrentView] = useState('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedOTP, setCopiedOTP] = useState(null);
  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    visitorPhone: '',
    purpose: '',
    groupSize: 1
  });
  const [groupSizeOpen, setGroupSizeOpen] = useState(false);
  const groupSizeRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (groupSizeRef.current && !groupSizeRef.current.contains(event.target)) {
        setGroupSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user) {
      loadActiveOTPs();
      loadVisitHistory();

      const socket = io(import.meta.env.VITE_SERVER_URL);

      console.log('Listening for OTPs on channel:', `student-${user.id}`);
      console.log('User object in VisitorManagement:', user);
      
      socket.on(`student-${user.id}`, (data) => {
        console.log('Received OTP data:', data);
        if (data.type === 'new_otp') {
          setActiveOTPs(prev => {
            const updated = [data.otp, ...prev];
            localStorage.setItem('activeOTPs', JSON.stringify(updated));
            return updated;
          });
          setError(null);
        }
      });

      socket.on(`student-${user._id}`, (data) => {
        console.log('Received OTP data on _id channel:', data);
        if (data.type === 'new_otp') {
          setActiveOTPs(prev => {
            const updated = [data.otp, ...prev];
            localStorage.setItem('activeOTPs', JSON.stringify(updated));
            return updated;
          });
          setError(null);
        }
      });

      socket.on('new_otp_created', (data) => {
        console.log('General OTP created event:', data);
      });

      socket.on('otpVerified', (data) => {
        if (data.otp.studentId === user.id) {
          setActiveOTPs(prev => {
            const updated = prev.filter(otp => otp._id !== data.otp._id);
            localStorage.setItem('activeOTPs', JSON.stringify(updated));
            return updated;
          });
          loadVisitHistory();
        }
      });

      const interval = setInterval(() => {
        loadActiveOTPs();
      }, 30000);

      return () => {
        socket.disconnect();
        clearInterval(interval);
      };
    }
  }, [user]);

  const loadActiveOTPs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/otp/students/${user.id}/active-otps`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const otps = data.otps || [];
        setActiveOTPs(otps);
        localStorage.setItem('activeOTPs', JSON.stringify(otps));
      } else {
        console.error('Failed to load OTPs:', response.status, response.statusText);
        setError('Failed to load visitor requests');
      }
    } catch (error) {
      console.error('Failed to load active OTPs:', error);
      setError('Failed to load visitor requests');
    } finally {
      setLoading(false);
    }
  };

  const loadVisitHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/otp/students/${user.id}/visits?limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setVisitHistory(data.visits || []);
      } else {
        console.error('Failed to load visit history:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load visit history:', error);
    }
  };

  useEffect(() => {
    const cleanupExpiredOTPs = () => {
      setActiveOTPs(prev => {
        const now = new Date();
        const filtered = prev.filter(otp => new Date(otp.expiresAt) > now);
        if (filtered.length !== prev.length) {
          localStorage.setItem('activeOTPs', JSON.stringify(filtered));
        }
        return filtered;
      });
    };

    const interval = setInterval(cleanupExpiredOTPs, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  const copyOTPToClipboard = async (otp, otpId) => {
    try {
      await navigator.clipboard.writeText(otp);
      setCopiedOTP(otpId);
      setTimeout(() => setCopiedOTP(null), 2000);
    } catch (error) {
      console.error('Failed to copy OTP:', error);
      const textArea = document.createElement('textarea');
      textArea.value = otp;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedOTP(otpId);
      setTimeout(() => setCopiedOTP(null), 2000);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { background: '#dcfce7', color: '#166534' };
      case 'expired': return { background: '#fee2e2', color: '#991b1b' };
      case 'used': return { background: '#f1f5f9', color: '#475569' };
      default: return { background: '#f1f5f9', color: '#64748b' };
    }
  };

  const getMethodBadge = (method) => {
    const badgeStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.375rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: '600'
    };

    switch (method) {
      case 'otp':
        return <span style={{...badgeStyle, background: '#dbeafe', color: '#1e40af'}}>OTP</span>;
      case 'preapproved':
        return <span style={{...badgeStyle, background: '#dcfce7', color: '#166534'}}>Pre-approved</span>;
      case 'override':
        return <span style={{...badgeStyle, background: '#fef3c7', color: '#92400e'}}>Override</span>;
      default:
        return <span style={{...badgeStyle, background: '#f1f5f9', color: '#475569'}}>{method}</span>;
    }
  };

  const handleGenerateOTP = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/otp/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...visitorForm,
          studentId: user.id
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setActiveOTPs(prev => {
          const updated = [data.otp, ...prev];
          localStorage.setItem('activeOTPs', JSON.stringify(updated));
          return updated;
        });
        setCurrentView('active');
        setVisitorForm({
          visitorName: '',
          visitorPhone: '',
          purpose: '',
          groupSize: 1
        });
      } else {
        setError('Failed to generate OTP');
      }
    } catch (error) {
      console.error('Failed to generate OTP:', error);
      setError('Failed to generate OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '1.5rem',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color: '#2d3748',
              margin: '0 0 0.25rem 0'
            }}>Visitor Management</h2>
            <p style={{
              color: '#718096',
              margin: '0',
              fontSize: '0.95rem'
            }}>Track your visitor requests and OTPs</p>
          </div>
          
          {/* Tabs */}
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
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 0.5rem',
                border: currentView === 'generate' ? 'none' : '1px solid #e2e8f0',
                background: currentView === 'generate' ? '#667eea' : 'white',
                color: currentView === 'generate' ? 'white' : '#64748b',
                fontWeight: '600',
                fontSize: '0.75rem',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: currentView === 'generate' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}
              onClick={() => setCurrentView('generate')}
              onMouseEnter={(e) => {
                if (currentView !== 'generate') {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentView !== 'generate') {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              <Plus size={20} />
              <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>Generate</span>
            </button>
            <button
              type="button"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 0.5rem',
                border: currentView === 'active' ? 'none' : '1px solid #e2e8f0',
                background: currentView === 'active' ? '#667eea' : 'white',
                color: currentView === 'active' ? 'white' : '#64748b',
                fontWeight: '600',
                fontSize: '0.75rem',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: currentView === 'active' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}
              onClick={() => setCurrentView('active')}
              onMouseEnter={(e) => {
                if (currentView !== 'active') {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentView !== 'active') {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              <Clock size={20} />
              <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>Active</span>
            </button>

            <button
              type="button"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 0.5rem',
                border: currentView === 'history' ? 'none' : '1px solid #e2e8f0',
                background: currentView === 'history' ? '#667eea' : 'white',
                color: currentView === 'history' ? 'white' : '#64748b',
                fontWeight: '600',
                fontSize: '0.75rem',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: currentView === 'history' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}
              onClick={() => setCurrentView('history')}
              onMouseEnter={(e) => {
                if (currentView !== 'history') {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentView !== 'history') {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              <Calendar size={20} />
              <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          background: 'white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          borderLeft: '4px solid #ef4444',
          color: '#991b1b'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button 
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              lineHeight: 1,
              color: 'inherit',
              opacity: 0.6,
              cursor: 'pointer',
              padding: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
            onClick={() => setError(null)}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6';
              e.currentTarget.style.background = 'none';
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Generate OTP View */}
      {currentView === 'generate' && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(to right, #f8fafc, #ffffff)'
          }}>
            <h5 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0
            }}>Generate Visitor OTP</h5>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <form onSubmit={handleGenerateOTP}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem'
                }}>Visitor Name</label>
                <input
                  type="text"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s ease',
                    background: 'white',
                    color: '#1e293b'
                  }}
                  value={visitorForm.visitorName}
                  onChange={(e) => setVisitorForm({...visitorForm, visitorName: e.target.value})}
                  placeholder="Enter visitor's full name"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    e.target.style.outline = 'none';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem'
                }}>Visitor Phone</label>
                <input
                  type="tel"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s ease',
                    background: 'white',
                    color: '#1e293b'
                  }}
                  value={visitorForm.visitorPhone}
                  onChange={(e) => setVisitorForm({...visitorForm, visitorPhone: e.target.value})}
                  placeholder="Enter visitor's phone number"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    e.target.style.outline = 'none';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem'
                }}>Purpose of Visit</label>
                <input
                  type="text"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s ease',
                    background: 'white',
                    color: '#1e293b'
                  }}
                  value={visitorForm.purpose}
                  onChange={(e) => setVisitorForm({...visitorForm, purpose: e.target.value})}
                  placeholder="Enter the reason for visit"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    e.target.style.outline = 'none';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.25rem', position: 'relative' }} ref={groupSizeRef}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem'
                }}>Group Size</label>
                <div
                  onClick={() => setGroupSizeOpen(!groupSizeOpen)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: groupSizeOpen ? '2px solid #667eea' : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    background: 'white',
                    color: '#1e293b',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: groupSizeOpen ? '0 0 0 3px rgba(102, 126, 234, 0.1)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{visitorForm.groupSize} {visitorForm.groupSize === 1 ? 'person' : 'people'}</span>
                  <ChevronDown size={16} style={{ transform: groupSizeOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                </div>
                {groupSizeOpen && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    marginBottom: '0.25rem',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {[1,2,3,4,5].map(size => (
                      <div
                        key={size}
                        onClick={() => {
                          setVisitorForm({...visitorForm, groupSize: size});
                          setGroupSizeOpen(false);
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          background: visitorForm.groupSize === size ? '#f0f4ff' : 'white',
                          color: visitorForm.groupSize === size ? '#667eea' : '#1e293b',
                          fontWeight: visitorForm.groupSize === size ? '600' : '400',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (visitorForm.groupSize !== size) {
                            e.currentTarget.style.background = '#f8fafc';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (visitorForm.groupSize !== size) {
                            e.currentTarget.style.background = 'white';
                          }
                        }}
                      >
                        {size} {size === 1 ? 'person' : 'people'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    background: '#667eea',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    opacity: loading ? 0.6 : 1
                  }}
                disabled={loading}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                }}
                >
                  {loading ? 'Generating...' : 'Generate OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active OTPs View */}
      {currentView === 'active' && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(to right, #f8fafc, #ffffff)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <h5 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Users size={20} />
              Active Visitor Requests
            </h5>
            <button 
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                background: '#f1f5f9',
                color: '#475569',
                opacity: loading ? 0.6 : 1,
                flexShrink: 0
              }}
              onClick={loadActiveOTPs}
              disabled={loading}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#e2e8f0';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {loading && activeOTPs.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                color: '#64748b'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #e2e8f0',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '1rem'
                }} />
                <p>Loading...</p>
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : activeOTPs.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                textAlign: 'center',
                color: '#94a3b8'
              }}>
                <Users size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h6 style={{
                  color: '#64748b',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  margin: '0 0 0.5rem 0'
                }}>No active visitor requests</h6>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.875rem' }}>
                  When someone requests to visit you, their OTP will appear here
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.25rem'
              }}>
                {activeOTPs.map((otp) => (
                  <div key={otp._id} style={{
                    background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
                    border: '2px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem'
                    }}>
                      <div>
                        <h6 style={{
                          fontSize: '1.125rem',
                          fontWeight: '600',
                          color: '#1e293b',
                          margin: '0 0 0.25rem 0'
                        }}>{otp.visitorName}</h6>
                        <small style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: '#64748b',
                          fontSize: '0.875rem'
                        }}>
                          <Phone size={12} />
                          {otp.visitorPhone}
                        </small>
                      </div>
                      <span style={{
                        ...getStatusColor('active'),
                        padding: '0.375rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em'
                      }}>
                        Active
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#475569',
                        margin: '0 0 0.375rem 0'
                      }}>
                        <strong style={{ color: '#1e293b' }}>Purpose:</strong> {otp.purpose}
                      </p>
                      {otp.isGroupOTP && (
                        <p style={{
                          fontSize: '0.875rem',
                          color: '#475569',
                          margin: '0 0 0.375rem 0'
                        }}>
                          <strong style={{ color: '#1e293b' }}>Group Size:</strong> {otp.groupSize} people
                        </p>
                      )}
                    </div>

                    <div style={{
                      background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
                      border: '2px solid #c7d2fe',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <h4 style={{
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: '#4338ca',
                          margin: '0 0 0.75rem 0'
                        }}>Share this OTP</h4>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.75rem',
                          marginBottom: '0.75rem',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{
                            fontFamily: "'Courier New', monospace",
                            fontSize: '1.75rem',
                            fontWeight: '700',
                            color: '#4338ca',
                            background: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '10px',
                            border: '2px solid #c7d2fe',
                            letterSpacing: '0.25em'
                          }}>
                            {otp.otp || '••••••'}
                          </div>
                          <button
                            style={{
                              padding: '0.5rem 1rem',
                              border: '2px solid #c7d2fe',
                              borderRadius: '8px',
                              background: copiedOTP === otp._id ? '#22c55e' : 'white',
                              color: copiedOTP === otp._id ? 'white' : '#4338ca',
                              borderColor: copiedOTP === otp._id ? '#22c55e' : '#c7d2fe',
                              fontWeight: '600',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem'
                            }}
                            onClick={() => copyOTPToClipboard(otp.otp, otp._id)}
                            title="Copy OTP to clipboard"
                            onMouseEnter={(e) => {
                              if (copiedOTP !== otp._id) {
                                e.currentTarget.style.background = '#4338ca';
                                e.currentTarget.style.color = 'white';
                                e.currentTarget.style.borderColor = '#4338ca';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (copiedOTP !== otp._id) {
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.color = '#4338ca';
                                e.currentTarget.style.borderColor = '#c7d2fe';
                              }
                            }}
                          >
                            {copiedOTP === otp._id ? (
                              <>
                                <Check size={16} />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy size={16} />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <small style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.375rem',
                          color: '#6366f1',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}>
                          <Clock size={12} />
                          Expires in: {formatTimeRemaining(otp.expiresAt)}
                        </small>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      color: '#64748b'
                    }}>
                      <span>Created: {new Date(otp.createdAt).toLocaleTimeString()}</span>
                      <span>Attempts: {otp.attempts}/3</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preferences View */}
      {currentView === 'preferences' && (
        <VisitorPreferences />
      )}

      {/* Visit History View */}
      {currentView === 'history' && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(to right, #f8fafc, #ffffff)'
          }}>
            <h5 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Calendar size={20} />
              Recent Visits
            </h5>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {visitHistory.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                textAlign: 'center',
                color: '#94a3b8'
              }}>
                <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h6 style={{
                  color: '#64748b',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  margin: '0 0 0.5rem 0'
                }}>No visit history</h6>
                <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.875rem' }}>
                  Your visitor history will appear here once you have visitors
                </p>
              </div>
            ) : (
              <div style={{
                overflowX: 'auto',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead style={{ background: 'linear-gradient(to right, #f8fafc, #f1f5f9)' }}>
                    <tr>
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#475569',
                        borderBottom: '2px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>Visitor</th>
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#475569',
                        borderBottom: '2px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>Purpose</th>
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#475569',
                        borderBottom: '2px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>Method</th>
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#475569',
                        borderBottom: '2px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>Entry Time</th>
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#475569',
                        borderBottom: '2px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>Exit Time</th>
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#475569',
                        borderBottom: '2px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>Duration</th>
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#475569',
                        borderBottom: '2px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitHistory.map((visit) => (
                      <tr key={visit._id} style={{
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}>
                          <div>
                            <div style={{
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '0.125rem'
                            }}>{visit.visitorName}</div>
                            <small style={{
                              color: '#64748b',
                              fontSize: '0.8125rem'
                            }}>{visit.visitorPhone}</small>
                          </div>
                        </td>
                        <td style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}>{visit.purpose}</td>
                        <td style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}>{getMethodBadge(visit.method)}</td>
                        <td style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}>
                          <small>
                            {new Date(visit.entryAt).toLocaleDateString()}<br />
                            {new Date(visit.entryAt).toLocaleTimeString()}
                          </small>
                        </td>
                        <td style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}>
                          {visit.exitAt ? (
                            <small>
                              {new Date(visit.exitAt).toLocaleDateString()}<br />
                              {new Date(visit.exitAt).toLocaleTimeString()}
                            </small>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.375rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: '#fef3c7',
                              color: '#92400e'
                            }}>Still visiting</span>
                          )}
                        </td>
                        <td style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}>
                          {visit.exitAt ? (
                            <span>
                              {Math.floor((new Date(visit.exitAt) - new Date(visit.entryAt)) / 60000)} min
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>
                              {Math.floor((new Date() - new Date(visit.entryAt)) / 60000)} min
                            </span>
                          )}
                        </td>
                        <td style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}>
                          {visit.status === 'active' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.375rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: '#dcfce7',
                              color: '#166534'
                            }}>
                              <CheckCircle size={12} />
                              Active
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.375rem 0.75rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: '#f1f5f9',
                              color: '#64748b'
                            }}>
                              <CheckCircle size={12} />
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitorManagement;