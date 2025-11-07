import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, User, Calendar, Clock, AlertCircle, Shield, MapPin } from 'lucide-react';

const ScanResultCard = ({ verifiedPass, detectedAction, onAction, isVerifying, error }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [cardAnimation, setCardAnimation] = useState('');

  useEffect(() => {
    if (verifiedPass || error) {
      setIsVisible(true);
      setCardAnimation('slideInUp');
      
      // Add pulse animation after initial slide
      setTimeout(() => {
        setCardAnimation('slideInUp pulse');
      }, 500);
    } else {
      setIsVisible(false);
      setCardAnimation('');
    }
  }, [verifiedPass, error]);

  if (!isVisible) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return { bg: '#e8f5e9', text: '#2e7d32', border: '#4caf50' };
      case 'late': return { bg: '#fff3e0', text: '#e65100', border: '#ff9800' };
      case 'out': return { bg: '#e3f2fd', text: '#1565c0', border: '#2196f3' };
      case 'pending': return { bg: '#fff8e1', text: '#f57f17', border: '#ffeb3b' };
      case 'rejected': return { bg: '#ffebee', text: '#c62828', border: '#f44336' };
      default: return { bg: '#f5f5f5', text: '#666', border: '#ddd' };
    }
  };

  const getActionButtonStyle = () => {
    if (detectedAction === 'out') {
      return verifiedPass?.status === 'late' 
        ? { bg: '#ff9800', hover: '#f57c00' }
        : { bg: '#4caf50', hover: '#388e3c' };
    }
    return { bg: '#2196f3', hover: '#1976d2' };
  };

  return (
    <div className={`scan-result-overlay ${cardAnimation}`}>
      <div className="scan-result-card">
        {error ? (
          // Error Card
          <div className="error-content">
            <div className="error-icon">
              <XCircle size={48} color="#f44336" />
            </div>
            <h3>Scan Failed</h3>
            <p>{error}</p>
            <div className="error-actions">
              <button className="retry-btn" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          </div>
        ) : (
          // Success Card
          <div className="success-content">
            {/* Header */}
            <div className="card-header">
              <div className="success-icon">
                <CheckCircle size={32} color="#4caf50" />
              </div>
              <div className="header-text">
                <h3>QR Code Verified</h3>
                <p>Student pass details loaded successfully</p>
              </div>
            </div>

            {/* Student Info */}
            <div className="student-info">
              <div className="student-avatar">
                <User size={24} color="#1976d2" />
              </div>
              <div className="student-details">
                <h4>{verifiedPass?.name}</h4>
                <p>Roll No: {verifiedPass?.rollNumber}</p>
              </div>
              <div className={`status-badge ${verifiedPass?.status}`}>
                <span>{verifiedPass?.status?.toUpperCase()}</span>
              </div>
            </div>

            {/* Pass Details Grid */}
            <div className="details-grid">
              <div className="detail-item">
                <Calendar size={18} />
                <div>
                  <span>Pass Type</span>
                  <p>{verifiedPass?.type}</p>
                </div>
              </div>
              
              <div className="detail-item">
                <Clock size={18} />
                <div>
                  <span>Out Time</span>
                  <p>{new Date(verifiedPass?.outTime).toLocaleTimeString()}</p>
                </div>
              </div>
              
              <div className="detail-item">
                <Clock size={18} />
                <div>
                  <span>In Time</span>
                  <p>{new Date(verifiedPass?.inTime).toLocaleTimeString()}</p>
                </div>
              </div>
              
              <div className="detail-item">
                <MapPin size={18} />
                <div>
                  <span>Reason</span>
                  <p>{verifiedPass?.reason}</p>
                </div>
              </div>
            </div>

            {/* Action Detection */}
            {detectedAction && (
              <div className={`action-detection ${detectedAction}`}>
                <Shield size={20} />
                <span>
                  {detectedAction === 'out' ? 'Student Leaving' : 'Student Returning'}
                </span>
              </div>
            )}

            {/* Action Button */}
            <div className="action-section">
              {detectedAction ? (
                <>
                  {verifiedPass?.status === 'late' && detectedAction === 'out' && (
                    <div className="warning-banner">
                      <AlertCircle size={20} />
                      <span>Late Entry - Pass regenerated after scheduled time</span>
                    </div>
                  )}
                  
                  <button
                    className={`action-btn ${detectedAction} ${isVerifying ? 'loading' : ''}`}
                    onClick={onAction}
                    disabled={isVerifying}
                  >
                    <div className="btn-content">
                      {isVerifying ? (
                        <>
                          <div className="spinner"></div>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={20} />
                          <span>
                            {detectedAction === 'out' ? 'Confirm Exit' : 'Confirm Entry'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </>
              ) : (
                <div className="invalid-status">
                  <XCircle size={24} />
                  <div>
                    <h4>Invalid Pass Status</h4>
                    <p>Current status: {verifiedPass?.status}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .scan-result-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .scan-result-card {
          background: white;
          border-radius: 20px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          position: relative;
        }

        .success-content, .error-content {
          padding: 30px;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
          padding-bottom: 20px;
          border-bottom: 2px solid #f0f0f0;
        }

        .success-icon {
          animation: bounceIn 0.6s ease-out;
        }

        .header-text h3 {
          margin: 0;
          color: #2e7d32;
          font-size: 1.4rem;
          font-weight: 700;
        }

        .header-text p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 0.9rem;
        }

        .student-info {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
          border-radius: 15px;
          margin-bottom: 25px;
          position: relative;
          overflow: hidden;
        }

        .student-info::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: shimmer 2s infinite;
        }

        .student-avatar {
          width: 50px;
          height: 50px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .student-details {
          flex: 1;
        }

        .student-details h4 {
          margin: 0;
          color: #1976d2;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .student-details p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 0.9rem;
        }

        .status-badge {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge.approved {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .status-badge.late {
          background: #fff3e0;
          color: #e65100;
        }

        .status-badge.out {
          background: #e3f2fd;
          color: #1565c0;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 25px;
        }

        .detail-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 12px;
          border-left: 4px solid #2196f3;
          transition: all 0.3s ease;
        }

        .detail-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .detail-item svg {
          color: #2196f3;
          margin-top: 2px;
        }

        .detail-item span {
          display: block;
          font-size: 0.8rem;
          color: #666;
          margin-bottom: 4px;
        }

        .detail-item p {
          margin: 0;
          font-weight: 600;
          color: #333;
          font-size: 0.9rem;
        }

        .action-detection {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          font-weight: 600;
          animation: slideInLeft 0.5s ease-out;
        }

        .action-detection.out {
          background: #e8f5e9;
          color: #2e7d32;
          border: 2px solid #4caf50;
        }

        .action-detection.in {
          background: #e3f2fd;
          color: #1565c0;
          border: 2px solid #2196f3;
        }

        .warning-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fff3e0;
          color: #e65100;
          border-radius: 8px;
          margin-bottom: 15px;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .action-btn {
          width: 100%;
          padding: 18px;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .action-btn.out {
          background: linear-gradient(135deg, #4caf50, #388e3c);
          color: white;
        }

        .action-btn.in {
          background: linear-gradient(135deg, #2196f3, #1976d2);
          color: white;
        }

        .action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        }

        .action-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .invalid-status {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          background: #ffebee;
          border-radius: 12px;
          color: #c62828;
        }

        .invalid-status h4 {
          margin: 0;
          font-size: 1rem;
        }

        .invalid-status p {
          margin: 5px 0 0 0;
          font-size: 0.9rem;
          opacity: 0.8;
        }

        .error-content {
          text-align: center;
        }

        .error-icon {
          margin-bottom: 20px;
          animation: shake 0.5s ease-in-out;
        }

        .error-content h3 {
          color: #c62828;
          margin-bottom: 15px;
          font-size: 1.4rem;
        }

        .error-content p {
          color: #666;
          margin-bottom: 25px;
          line-height: 1.5;
        }

        .retry-btn {
          padding: 12px 24px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .retry-btn:hover {
          background: #d32f2f;
          transform: translateY(-2px);
        }

        /* Animations */
        .slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pulse {
          animation: pulse 2s infinite;
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(100px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .scan-result-card {
            margin: 10px;
            max-height: 95vh;
          }

          .success-content, .error-content {
            padding: 20px;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .student-info {
            flex-direction: column;
            text-align: center;
            gap: 10px;
          }

          .card-header {
            flex-direction: column;
            text-align: center;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default ScanResultCard;