import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Shield, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { otpAPI, studentAPI, overrideAPI } from '../../securityServices/api';
import socketService from '../../securityServices/socket';
import { useAuth } from '../../context/SecurityContext';

/**
 * Guard.jsx
 * Single-file component combining:
 * - Your real logic (APIs + socket + useAuth)
 * - The modern inline-style UI (lucide icons) you liked
 *
 * Notes:
 * - Uses inline CSS (as requested)
 * - Assumes lucide-react is installed
 * - Assumes otpAPI, studentAPI, overrideAPI, socketService and useAuth are available
 */

const Guard = () => {
  const { user, logout } = useAuth();

  const [currentView, setCurrentView] = useState('search'); // search, verify, visits
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [visitorData, setVisitorData] = useState({
    name: '',
    phone: '',
    purpose: '',
    groupSize: 1
  });
  const [otpStatus, setOtpStatus] = useState(null); // null, 'sent', 'verified', 'expired', 'failed', 'out_of_hours', 'override_requested'
  const [activeVisits, setActiveVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [otpVerificationData, setOtpVerificationData] = useState({
    visitorPhone: '',
    otp: ''
  });

  // --- lifecycle & sockets ---
  useEffect(() => {
    socketService.connect();

    if (user && (user._id || user.id)) {
      loadActiveVisits();
    }

    socketService.on('otpVerified', handleOtpVerified);
    socketService.on('visitCreated', handleVisitCreated);
    socketService.on('visitCheckedOut', handleVisitCheckedOut);

    return () => {
      socketService.off('otpVerified', handleOtpVerified);
      socketService.off('visitCreated', handleVisitCreated);
      socketService.off('visitCheckedOut', handleVisitCheckedOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleOtpVerified = (data) => {
    // data might contain visit info; for UI purposes we set verified and refresh
    setOtpStatus('verified');
    loadActiveVisits();
    setTimeout(() => {
      setCurrentView('visits');
      resetForm();
    }, 1200);
  };

  const handleVisitCreated = (data) => {
    loadActiveVisits();
  };

  const handleVisitCheckedOut = (data) => {
    loadActiveVisits();
  };

  // --- API calls ---
  const loadActiveVisits = async () => {
    try {
      const guardId = user?._id || user?.id;
      if (!guardId) {
        setError('Authentication error: Guard ID missing');
        setActiveVisits([]);
        return;
      }
      const response = await otpAPI.getActiveVisits(guardId);
      setActiveVisits(response.data.visits || []);
    } catch (err) {
      console.error('loadActiveVisits error', err);
      setError(`Failed to load visits: ${err.message || 'Unknown error'}`);
    }
  };

  const searchStudents = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await studentAPI.searchStudents({ query });
      setSearchResults(response.data.students || []);
    } catch (err) {
      console.error('searchStudents error', err);
      setError('Failed to search students');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setSearchQuery(`${student.name} - Room ${student.room}`);
  };

  const handleRequestOTP = async () => {
    if (!selectedStudent || !visitorData.name || !visitorData.phone || !visitorData.purpose) {
      setError('Please fill in all required fields');
      return;
    }

    if (!user || (!user._id && !user.id)) {
      setError('Authentication error. Please login again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const requestData = {
        studentId: selectedStudent._id,
        visitorName: visitorData.name,
        visitorPhone: visitorData.phone,
        guardId: user._id || user.id,
        purpose: visitorData.purpose,
        groupSize: parseInt(visitorData.groupSize) || 1
      };

      const response = await otpAPI.requestOTP(requestData);

      if (response.data.success) {
        if (response.data.code === 'PRE_APPROVED') {
          setOtpStatus('verified');
          setError(null);
          loadActiveVisits();
          setTimeout(() => {
            setCurrentView('visits');
            resetForm();
          }, 1200);
        } else if (response.data.code === 'OTP_SENT') {
          setOtpStatus('sent');
          setError(null);
        } else {
          // unknown success code - still show sent
          setOtpStatus('sent');
          setError(null);
        }
      } else {
        const message = response.data.message || 'Failed to request OTP';
        const code = response.data.code;
        setError(message);

        if (code === 'OUT_OF_HOURS') {
          setOtpStatus('out_of_hours');
        }
      }
    } catch (err) {
      console.error('handleRequestOTP error', err);
      const message = err.response?.data?.message || err.message || 'Failed to request OTP';
      const code = err.response?.data?.code;
      setError(message);
      if (code === 'OUT_OF_HOURS') {
        setOtpStatus('out_of_hours');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otp) => {
    if (!otp || otp.length < 4) {
      setError('Enter a valid OTP');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await otpAPI.verifyOTP({
        visitorPhone: visitorData.phone,
        providedOtp: otp,
        guardId: user._id || user.id
      });

      if (response.data.success) {
        setOtpStatus('verified');
        loadActiveVisits();
        setTimeout(() => {
          setCurrentView('visits');
          resetForm();
        }, 1200);
      } else {
        const message = response.data.message || 'OTP verification failed';
        setError(message);
        setOtpStatus('sent');
      }
    } catch (err) {
      console.error('handleVerifyOTP error', err);
      const message = err.response?.data?.message || 'OTP verification failed';
      setError(message);
      setOtpStatus('sent');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOverride = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await overrideAPI.requestOverride({
        guardId: user._id || user.id,
        visitorName: visitorData.name,
        visitorPhone: visitorData.phone,
        studentId: selectedStudent._id,
        reason: 'Out of hours visit request',
        purpose: visitorData.purpose,
        urgency: 'medium'
      });

      if (response.data.success) {
        setOtpStatus('override_requested');
        setError(null);
        // optionally show message
        setTimeout(() => {
          alert(response.data.message || 'Override requested');
        }, 200);
      } else {
        setError(response.data.message || 'Override request failed');
      }
    } catch (err) {
      console.error('handleRequestOverride error', err);
      const message = err.response?.data?.message || 'Override request failed';
      setError(message);
      setOtpStatus('out_of_hours');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (visitId) => {
    try {
      setLoading(true);
      await otpAPI.checkout(visitId, { guardId: user._id || user.id });
      await loadActiveVisits();
    } catch (err) {
      console.error('handleCheckout error', err);
      setError(err.response?.data?.message || 'Failed to checkout visitor');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectOTPVerify = async (e) => {
    e.preventDefault();
    if (!otpVerificationData.visitorPhone || otpVerificationData.otp.length !== 6) {
      setError('Enter phone and 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await otpAPI.verifyOTP({
        visitorPhone: otpVerificationData.visitorPhone,
        providedOtp: otpVerificationData.otp,
        guardId: user._id || user.id
      });

      if (response.data.success) {
        setOtpStatus('verified');
        loadActiveVisits();
        setTimeout(() => {
          setCurrentView('visits');
          setOtpVerificationData({ visitorPhone: '', otp: '' });
        }, 1200);
      } else {
        setError(response.data.message || 'OTP verification failed');
      }
    } catch (err) {
      console.error('handleDirectOTPVerify error', err);
      const message = err.response?.data?.message || 'OTP verification failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setSearchQuery('');
    setVisitorData({ name: '', phone: '', purpose: '', groupSize: 1 });
    setOtpStatus(null);
    setError(null);
  };

  // --- UI ---
  if (!user) {
    return (
      <div style={{
        minHeight: '240px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          border: '4px solid rgba(102,126,234,0.2)',
          borderTopColor: '#667eea',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#666' }}>Loading guard information...</p>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fb',
      padding: '22px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '18px',
        border: '1px solid #e6e9f2'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Shield size={26} color="#667eea" />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', color: '#111', fontWeight: '700' }}>
                Visitor Management
              </h1>
              <h4>Security Portal</h4>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'nowrap'
          }}>
            <button
              onClick={() => setCurrentView('search')}
              style={headerButtonStyle(currentView === 'search')}
            >
              New Visitor
            </button>

            <button
              onClick={() => setCurrentView('verify')}
              style={headerButtonStyle(currentView === 'verify')}
            >
              Verify OTP
            </button>

            <button
              onClick={() => setCurrentView('visits')}
              style={{ ...headerButtonStyle(currentView === 'visits'), position: 'relative' }}
            >
              Active Visits
              {activeVisits.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: '#ff4757',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(255,71,87,0.25)'
                }}>{activeVisits.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fff5f5',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          border: '1px solid #ffd2d2'
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
            <AlertCircle size={18} color="#f56565" />
            <div style={{ color: '#c53030', fontSize: 14 }}>{error}</div>
          </div>
          <button onClick={() => setError(null)} style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#c53030',
            padding: 6
          }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main card */}
      <div style={{
        background: 'white',
        borderRadius: 12,
        border: '1px solid #e6e9f2',
        padding: 22
      }}>
        {currentView === 'search' && (
          <SearchView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSearch={searchStudents}
            onStudentSelect={handleStudentSelect}
            selectedStudent={selectedStudent}
            visitorData={visitorData}
            setVisitorData={setVisitorData}
            otpStatus={otpStatus}
            onRequestOTP={handleRequestOTP}
            onVerifyOTP={handleVerifyOTP}
            onRequestOverride={handleRequestOverride}
            onReset={resetForm}
            loading={loading}
          />
        )}

        {currentView === 'verify' && (
          <VerifyView
            otpVerificationData={otpVerificationData}
            setOtpVerificationData={setOtpVerificationData}
            onVerify={handleDirectOTPVerify}
            loading={loading}
            otpStatus={otpStatus}
          />
        )}

        {currentView === 'visits' && (
          <VisitsView
            activeVisits={activeVisits}
            onCheckout={handleCheckout}
            onRefresh={loadActiveVisits}
          />
        )}
      </div>
    </div>
  );
};

// helper style for header buttons
const headerButtonStyle = (active) => ({
  padding: '8px 16px',
  borderRadius: 10,
  border: active ? 'none' : '1px solid #e6e9f2',
  background: active ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
  color: active ? 'white' : '#666',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: active ? '0 6px 18px rgba(102,126,234,0.18)' : 'none'
});

// --- SearchView component (UI + OTP request) ---
const SearchView = ({
  searchQuery, setSearchQuery, searchResults, onSearch, onStudentSelect,
  selectedStudent, visitorData, setVisitorData, otpStatus, onRequestOTP, onVerifyOTP,
  onRequestOverride, onReset, loading
}) => {
  const [otpInput, setOtpInput] = useState('');
  const [groupSizeOpen, setGroupSizeOpen] = useState(false);
  const groupSizeRef = useRef(null);

  useEffect(() => {
    setOtpInput('');
  }, [otpStatus]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (groupSizeRef.current && !groupSizeRef.current.contains(event.target)) {
        setGroupSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px 0', color: '#111' }}>
        New Visitor Entry
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: 20
      }}>
        {/* Student Search Card */}
        <div style={{...cardStyle, boxShadow: '0 4px 12px rgba(0,0,0,0.08)'}}>
          <h3 style={cardTitleStyle}><Search size={18} /> Find Student</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Search by name, room, or roll number</label>
            <input
              type="text"
              placeholder="Enter student name..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e6e9f2'}
            />
          </div>

          {searchResults.length > 0 && (
            <div style={{
              maxHeight: 220,
              overflowY: 'auto',
              background: '#fafcff',
              borderRadius: 8,
              border: '1px solid #e6eefc'
            }}>
              {searchResults.map((student) => (
                <button
                  key={student._id}
                  onClick={() => onStudentSelect(student)}
                  style={searchResultStyle}
                >
                  <div style={{ fontWeight: 700, color: '#111', marginBottom: 4 }}>{student.name}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>Room {student.room} • {student.rollNumber}</div>
                </button>
              ))}
            </div>
          )}

          {selectedStudent && (
            <div style={{
              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
              borderRadius: 8,
              padding: 12,
              border: '2px solid #6ee7b7',
              marginTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255,255,255,0.5)'
            }}>
              <div style={{ flex: '1', minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: '#111', wordBreak: 'break-word' }}>{selectedStudent.name}</div>
                <div style={{ fontSize: 13, color: '#666' }}>Room {selectedStudent.room} • {selectedStudent.rollNumber}</div>
              </div>
              <button onClick={onReset} style={{
                padding: '8px 12px',
                background: 'white',
                border: '1px solid #e6e9f2',
                borderRadius: 8,
                color: '#667eea',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}>Change</button>
            </div>
          )}
        </div>

        {/* Visitor Details Card */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Visitor Details</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Visitor Name *</label>
            <input
              type="text"
              placeholder="Enter visitor's full name"
              value={visitorData.name}
              onChange={(e) => setVisitorData({ ...visitorData, name: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Phone Number *</label>
            <input
              type="tel"
              placeholder="Enter visitor's phone number"
              value={visitorData.phone}
              onChange={(e) => setVisitorData({ ...visitorData, phone: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Purpose of Visit *</label>
            <input
              type="text"
              placeholder="e.g., Family visit, Academic discussion"
              value={visitorData.purpose}
              onChange={(e) => setVisitorData({ ...visitorData, purpose: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18, position: 'relative' }} ref={groupSizeRef}>
            <label style={labelStyle}>Group Size</label>
            <div
              onClick={() => setGroupSizeOpen(!groupSizeOpen)}
              style={{
                ...inputStyle,
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                borderColor: groupSizeOpen ? '#667eea' : '#e6e9f2'
              }}
            >
              <span>{visitorData.groupSize} {visitorData.groupSize === 1 ? 'person' : 'people'}</span>
              <ChevronDown size={16} style={{ transform: groupSizeOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </div>
            {groupSizeOpen && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: '4px',
                background: 'white',
                border: '1px solid #e6e9f2',
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 1000,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {[1, 2, 3, 4, 5].map(size => (
                  <div
                    key={size}
                    onClick={() => {
                      setVisitorData({ ...visitorData, groupSize: size });
                      setGroupSizeOpen(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: visitorData.groupSize === size ? '#f0f4ff' : 'white',
                      color: visitorData.groupSize === size ? '#667eea' : '#111',
                      fontWeight: visitorData.groupSize === size ? 700 : 400,
                      fontSize: 14
                    }}
                    onMouseEnter={(e) => {
                      if (visitorData.groupSize !== size) {
                        e.currentTarget.style.background = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (visitorData.groupSize !== size) {
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

          {/* OTP Actions */}
          {!otpStatus && (
            <button
              onClick={onRequestOTP}
              disabled={loading || !selectedStudent || !visitorData.name || !visitorData.phone || !visitorData.purpose}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: (loading || !selectedStudent || !visitorData.name || !visitorData.phone || !visitorData.purpose)
                  ? '#e6e9f2' : 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
                color: 'white',
                fontWeight: 800,
                fontSize: 15,
                cursor: (loading || !selectedStudent || !visitorData.name || !visitorData.phone || !visitorData.purpose) ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 18px rgba(102,126,234,0.12)'
              }}
            >
              {loading ? 'Processing...' : 'Request OTP'}
            </button>
          )}

          {otpStatus === 'sent' && (
            <div>
              <div style={infoBoxStyle('warning', '#fffbeb', '#f59e0b')}>OTP sent to student. Please ask visitor for the OTP.</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  maxLength={6}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => onVerifyOTP(otpInput)}
                  disabled={loading || otpInput.length !== 6}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: (loading || otpInput.length !== 6) ? '#e6e9f2' : '#10b981',
                    color: 'white',
                    fontWeight: 800,
                    cursor: (loading || otpInput.length !== 6) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Verify
                </button>
              </div>
            </div>
          )}

          {otpStatus === 'verified' && (
            <div style={infoBoxStyle('success', '#d1f2eb', '#059669')}>✅ Entry approved! Visitor can proceed.</div>
          )}

          {otpStatus === 'out_of_hours' && (
            <div>
              <div style={infoBoxStyle('warning', '#fffbeb', '#f59e0b')}>This is an out-of-hours visit request. Warden approval required.</div>
              <button
                onClick={onRequestOverride}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: loading ? '#e6e9f2' : '#fbbf24',
                  color: '#92400e',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: 10
                }}
              >
                Request Warden Override
              </button>
            </div>
          )}

          {otpStatus === 'override_requested' && (
            <div style={infoBoxStyle('info', '#eef2ff', '#3b82f6')}>✅ Override request sent to admin. Please wait for approval.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- VerifyView component ---
const VerifyView = ({ otpVerificationData, setOtpVerificationData, onVerify, loading, otpStatus }) => {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px 0', color: '#111' }}>Verify Student OTP</h2>
      <p style={{ margin: '0 0 18px 0', color: '#666' }}>Enter visitor's phone and OTP to grant entry</p>

      <form onSubmit={onVerify}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Visitor Phone Number</label>
          <input
            type="tel"
            value={otpVerificationData.visitorPhone}
            onChange={(e) => setOtpVerificationData({ ...otpVerificationData, visitorPhone: e.target.value })}
            required
            placeholder="Enter visitor's phone number"
            style={{ ...inputStyle, border: '2px solid #e0e7ff', borderRadius: 10, padding: '12px 14px' }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e0e7ff'}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>OTP</label>
          <input
            type="text"
            value={otpVerificationData.otp}
            onChange={(e) => setOtpVerificationData({ ...otpVerificationData, otp: e.target.value })}
            required
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            style={{
              ...inputStyle,
              border: '2px solid #e0e7ff',
              borderRadius: 10,
              padding: '12px 14px',
              letterSpacing: 6,
              fontWeight: 800,
              fontSize: 16
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e0e7ff'}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !otpVerificationData.visitorPhone || otpVerificationData.otp.length !== 6}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: 'none',
            background: (loading || !otpVerificationData.visitorPhone || otpVerificationData.otp.length !== 6)
              ? '#ddd' : 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
            color: 'white',
            fontWeight: 900,
            fontSize: 15,
            cursor: (loading || !otpVerificationData.visitorPhone || otpVerificationData.otp.length !== 6) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
      </form>

      {otpStatus === 'verified' && (
        <div style={{
          background: '#d1f2eb',
          border: '2px solid #10b981',
          borderRadius: 10,
          padding: 12,
          marginTop: 16,
          fontWeight: 700,
          color: '#065f46',
          textAlign: 'center'
        }}>
          ✅ OTP verified successfully. Entry granted.
        </div>
      )}
    </div>
  );
};

// --- VisitsView component ---
const VisitsView = ({ activeVisits, onCheckout, onRefresh }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#111' }}>Active Visits</h2>
          <p style={{ margin: '6px 0 0 0', color: '#666' }}>{activeVisits.length} visitor{activeVisits.length !== 1 ? 's' : ''} currently on campus</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onRefresh} style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #e6e9f2',
            background: 'white',
            cursor: 'pointer',
            fontWeight: 700
          }}>Refresh</button>
        </div>
      </div>

      {activeVisits.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 20px',
          background: '#f8fbff',
          borderRadius: 12,
          border: '1px dashed #e6eefc'
        }}>
          <div style={{ fontSize: 56, opacity: 0.5, marginBottom: 12 }}>👥</div>
          <h3 style={{ fontSize: 20, margin: '0 0 8px 0', color: '#111' }}>No Active Visits</h3>
          <p style={{ margin: 0, color: '#666' }}>All visitors have been checked out</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
          gap: 18
        }}>
          {activeVisits.map((visit) => (
            <div key={visit._id} style={{
              background: 'linear-gradient(135deg,#fbfdff 0%,#ffffff 100%)',
              borderRadius: 14,
              padding: 18,
              border: '1px solid #eef6ff',
              boxShadow: '0 6px 18px rgba(15,23,42,0.04)',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#111' }}>{visit.visitorName}</h3>
                  <p style={{ margin: '6px 0 0 0', color: '#666' }}>{visit.visitorPhone}</p>
                </div>
                <button
                  onClick={() => onCheckout(visit._id)}
                  style={{
                    padding: '8px 12px',
                    background: '#ff4757',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  Check Out
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <infoRow label="Visiting:" value={visit.studentId?.name} />
                <infoRow label="Room:" value={visit.studentId?.room} />
                <infoRow label="Purpose:" value={visit.purpose} />
                <infoRow label="Entry Time:" value={formatTime(visit.entryAt)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#888', fontSize: 13, fontWeight: 600 }}>Duration:</div>
                  <div style={{ fontWeight: 800, color: '#667eea', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={14} /> {Math.floor((new Date() - new Date(visit.entryAt)) / 60000)} mins
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#888', fontSize: 13, fontWeight: 600 }}>Method:</div>
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    fontSize: 12,
                    background: visit.method === 'otp' ? '#d1f2eb' : '#fff3cd',
                    color: visit.method === 'otp' ? '#059669' : '#92400e'
                  }}>
                    {visit.method || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// small reusable helpers/styles
const cardStyle = {
  background: 'white',
  borderRadius: 12,
  padding: 18,
  border: '1px solid #eef4ff',
  boxSizing: 'border-box',
  minWidth: 0,
  width: '100%'
};

const cardTitleStyle = {
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 12,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  color: '#111'
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: '#444',
  marginBottom: 6
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e6e9f2',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none'
};

const searchResultStyle = {
  width: '100%',
  padding: 12,
  border: 'none',
  background: 'white',
  textAlign: 'left',
  cursor: 'pointer',
  borderBottom: '1px solid #f3f6fb'
};

const infoBoxStyle = (type, bg, color) => ({
  background: bg,
  border: `1px solid ${shadeColor(color, -8)}`,
  borderRadius: 10,
  padding: 12,
  fontSize: 14,
  color: color,
  fontWeight: 700,
  textAlign: 'center',
  marginTop: 8
});

// small row component for visits
const infoRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ color: '#888', fontSize: 13, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 14, color: '#111', fontWeight: 700 }}>{value || '—'}</div>
  </div>
);

// format time with locale en-IN fallback
const formatTime = (time) => {
  try {
    return new Date(time).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return time;
  }
};

// small color utility
function shadeColor(hex, percent) {
  // accepts '#rrggbb' and returns shaded version
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const num = parseInt(c, 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.max(Math.min(255, r), 0);
    g = Math.max(Math.min(255, g), 0);
    b = Math.max(Math.min(255, b), 0);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  } catch {
    return hex;
  }
}

export default Guard;
