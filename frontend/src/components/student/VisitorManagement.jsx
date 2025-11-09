import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, XCircle, Phone, User, Calendar, AlertCircle, Settings, Copy, Check, Plus, AlertTriangle } from 'lucide-react';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import VisitorPreferences from './VisitorPreferences';
import io from 'socket.io-client';
import { checkOffensiveContent } from '../common/OffensiveTextInput';

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
  const [currentView, setCurrentView] = useState('active'); // 'active', 'history', 'preferences', 'generate'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedOTP, setCopiedOTP] = useState(null);
  const [offensiveWarning, setOffensiveWarning] = useState(null);
  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    visitorPhone: '',
    purpose: '',
    groupSize: 1
  });

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
      case 'active': return 'text-success-600 bg-success-50';
      case 'expired': return 'text-danger-600 bg-danger-50';
      case 'used': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case 'otp':
        return <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full">OTP</span>;
      case 'preapproved':
        return <span className="px-2 py-1 bg-success-100 text-success-800 text-xs rounded-full">Pre-approved</span>;
      case 'override':
        return <span className="px-2 py-1 bg-warning-100 text-warning-800 text-xs rounded-full">Override</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{method}</span>;
    }
  };

  const handleGenerateOTP = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setOffensiveWarning(null);

      // Check for offensive content in purpose
      if (visitorForm.purpose && visitorForm.purpose.trim().length > 0) {
        console.log('🔍 Checking purpose for offensive content:', visitorForm.purpose);
        const offensiveCheck = await checkOffensiveContent(visitorForm.purpose);
        console.log('✅ Offensive check result:', offensiveCheck);
        
        if (offensiveCheck.isOffensive) {
          setOffensiveWarning(
            'The purpose of visit contains inappropriate content (offensive language, emojis, or random text). Please revise it before submitting.'
          );
          setLoading(false);
          
          // Scroll to the warning message
          setTimeout(() => {
            const warningElement = document.querySelector('.offensive-warning-visitor');
            if (warningElement) {
              warningElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          return;
        }
      }

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
        setOffensiveWarning(null);
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
    <div className="visitor-management">
      <div className="container-fluid">
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="h3 mb-1">Visitor Management</h2>
                <p className="text-muted mb-0">Track your visitor requests and OTPs</p>
              </div>
              <div className="btn-group" role="group">
                <button
                  type="button"
                  className={`btn ${currentView === 'generate' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setCurrentView('generate')}
                >
                  Generate OTP
                </button>
                <button
                  type="button"
                  className={`btn ${currentView === 'active' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setCurrentView('active')}
                >
                  <Clock size={16} className="me-1" />
                  Active OTPs
                </button>
                <button
                  type="button"
                  className={`btn ${currentView === 'history' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setCurrentView('history')}
                >
                  <Calendar size={16} className="me-1" />
                  Visit History
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="alert alert-danger d-flex align-items-center" role="alert">
                <AlertCircle size={16} className="me-2" />
                {error}
                <button 
                  type="button" 
                  className="btn-close ms-auto" 
                  onClick={() => setError(null)}
                ></button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'generate' && (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">
                    Generate Visitor OTP
                  </h5>
                </div>
                <div className="card-body">
                  {offensiveWarning && (
                    <div className="offensive-warning-visitor alert alert-warning d-flex align-items-start mb-3" role="alert" style={{
                      backgroundColor: '#fff3cd',
                      border: '2px solid #ffc107',
                      borderRadius: '8px',
                      animation: 'shake 0.5s'
                    }}>
                      <AlertTriangle size={24} className="me-2 flex-shrink-0" style={{ color: '#856404', marginTop: '2px' }} />
                      <div className="flex-grow-1">
                        <h6 className="mb-1" style={{ color: '#856404', fontWeight: 'bold' }}>
                          ⚠️ Inappropriate Content Detected
                        </h6>
                        <p className="mb-0" style={{ color: '#856404' }}>
                          {offensiveWarning}
                        </p>
                      </div>
                      <button 
                        type="button" 
                        className="btn-close" 
                        onClick={() => setOffensiveWarning(null)}
                        style={{ color: '#856404' }}
                      ></button>
                    </div>
                  )}
                  
                  <form onSubmit={handleGenerateOTP}>
                    <div className="mb-3">
                      <label className="form-label">Visitor Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={visitorForm.visitorName}
                        onChange={(e) => setVisitorForm({...visitorForm, visitorName: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Visitor Phone</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={visitorForm.visitorPhone}
                        onChange={(e) => setVisitorForm({...visitorForm, visitorPhone: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Purpose of Visit</label>
                      <input
                        type="text"
                        className="form-control"
                        value={visitorForm.purpose}
                        onChange={(e) => setVisitorForm({...visitorForm, purpose: e.target.value})}
                        placeholder="e.g., Meeting, Family visit, Academic discussion"
                        required
                        style={{
                          borderColor: offensiveWarning ? '#ffc107' : undefined,
                          borderWidth: offensiveWarning ? '2px' : undefined
                        }}
                      />
                      <small className="form-text text-muted d-block mt-1">
                        Please provide a clear and appropriate purpose. Offensive language, emojis, or gibberish will be rejected.
                      </small>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Group Size</label>
                      <select
                        className="form-select"
                        value={visitorForm.groupSize}
                        onChange={(e) => setVisitorForm({...visitorForm, groupSize: parseInt(e.target.value)})}
                      >
                        {[1,2,3,4,5].map(size => (
                          <option key={size} value={size}>{size} {size === 1 ? 'person' : 'people'}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                      style={{
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {loading ? 'Validating & Generating...' : 'Generate OTP'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <style>
          {`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
              20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
          `}
        </style>

        {currentView === 'active' && (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <Users size={20} className="me-2" />
                    Active Visitor Requests
                  </h5>
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={loadActiveOTPs}
                    disabled={loading}
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="card-body">
                  {loading && activeOTPs.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : activeOTPs.length === 0 ? (
                    <div className="text-center py-5">
                      <Users size={48} className="text-muted mb-3" />
                      <h6 className="text-muted">No active visitor requests</h6>
                      <p className="text-muted small">
                        When someone requests to visit you, their OTP will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {activeOTPs.map((otp) => (
                        <div key={otp._id} className="col-md-6 col-lg-4">
                          <div className="card border-primary">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                  <h6 className="card-title mb-1">{otp.visitorName}</h6>
                                  <small className="text-muted">
                                    <Phone size={12} className="me-1" />
                                    {otp.visitorPhone}
                                  </small>
                                </div>
                                <span className={`badge ${getStatusColor('active')}`}>
                                  Active
                                </span>
                              </div>
                              
                              <div className="mb-3">
                                <p className="small mb-1">
                                  <strong>Purpose:</strong> {otp.purpose}
                                </p>
                                {otp.isGroupOTP && (
                                  <p className="small mb-1">
                                    <strong>Group Size:</strong> {otp.groupSize} people
                                  </p>
                                )}
                              </div>

                              <div className="bg-primary bg-opacity-10 p-3 rounded mb-3 border border-primary border-opacity-25">
                                <div className="text-center">
                                  <h4 className="text-primary mb-1">Share this OTP</h4>
                                  <div className="d-flex align-items-center justify-content-center gap-2">
                                    <div className="h3 font-monospace text-primary fw-bold mb-0 p-2 bg-white rounded border">
                                      {otp.otp || '••••••'}
                                    </div>
                                    <button
                                      className={`btn ${copiedOTP === otp._id ? 'btn-success' : 'btn-outline-primary'} btn-sm`}
                                      onClick={() => copyOTPToClipboard(otp.otp, otp._id)}
                                      title="Copy OTP to clipboard"
                                    >
                                      {copiedOTP === otp._id ? (
                                        <>
                                          <Check size={16} className="me-1" />
                                          Copied!
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={16} className="me-1" />
                                          Copy
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <small className="text-muted mt-2 d-block">
                                    <Clock size={12} className="me-1" />
                                    Expires in: {formatTimeRemaining(otp.expiresAt)}
                                  </small>
                                </div>
                              </div>

                              <div className="d-flex justify-content-between text-muted small">
                                <span>Created: {new Date(otp.createdAt).toLocaleTimeString()}</span>
                                <span>Attempts: {otp.attempts}/3</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'preferences' && (
          <VisitorPreferences />
        )}

        {currentView === 'history' && (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">
                    <Calendar size={20} className="me-2" />
                    Recent Visits
                  </h5>
                </div>
                <div className="card-body">
                  {visitHistory.length === 0 ? (
                    <div className="text-center py-5">
                      <Calendar size={48} className="text-muted mb-3" />
                      <h6 className="text-muted">No visit history</h6>
                      <p className="text-muted small">
                        Your visitor history will appear here once you have visitors
                      </p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Visitor</th>
                            <th>Purpose</th>
                            <th>Method</th>
                            <th>Entry Time</th>
                            <th>Exit Time</th>
                            <th>Duration</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitHistory.map((visit) => (
                            <tr key={visit._id}>
                              <td>
                                <div>
                                  <div className="fw-medium">{visit.visitorName}</div>
                                  <small className="text-muted">{visit.visitorPhone}</small>
                                </div>
                              </td>
                              <td>{visit.purpose}</td>
                              <td>{getMethodBadge(visit.method)}</td>
                              <td>
                                <small>
                                  {new Date(visit.entryAt).toLocaleDateString()}<br />
                                  {new Date(visit.entryAt).toLocaleTimeString()}
                                </small>
                              </td>
                              <td>
                                {visit.exitAt ? (
                                  <small>
                                    {new Date(visit.exitAt).toLocaleDateString()}<br />
                                    {new Date(visit.exitAt).toLocaleTimeString()}
                                  </small>
                                ) : (
                                  <span className="badge bg-warning">Still visiting</span>
                                )}
                              </td>
                              <td>
                                {visit.exitAt ? (
                                  <span>
                                    {Math.floor((new Date(visit.exitAt) - new Date(visit.entryAt)) / 60000)} min
                                  </span>
                                ) : (
                                  <span className="text-muted">
                                    {Math.floor((new Date() - new Date(visit.entryAt)) / 60000)} min
                                  </span>
                                )}
                              </td>
                              <td>
                                {visit.status === 'active' ? (
                                  <span className="badge bg-success">
                                    <CheckCircle size={12} className="me-1" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary">
                                    <CheckCircle size={12} className="me-1" />
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
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default VisitorManagement;
