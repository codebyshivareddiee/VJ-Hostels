import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { QrCode, CheckCircle, XCircle, AlertCircle, User, Phone, Calendar, Clock } from 'lucide-react';
import '../../styles/qr-scanner.css';

const QRScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState(null);
    const [verifiedPass, setVerifiedPass] = useState(null);
    const [detectedAction, setDetectedAction] = useState(null); // Auto-detected: 'out' or 'in'
    const html5QrCodeRef = useRef(null);
    const scannerRef = useRef(null);

    useEffect(() => {
        // Initialize scanner
        const initScanner = async () => {
            try {
                if (!scannerRef.current) return;
                
                html5QrCodeRef.current = new Html5Qrcode('qr-reader');
                startScanning();
            } catch (err) {
                console.error('Error initializing scanner:', err);
                setError('Failed to initialize camera');
            }
        };

        initScanner();

        // Cleanup
        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.error('Error stopping scanner:', err));
            }
        };
    }, []);

    const startScanning = async () => {
        try {
            if (!html5QrCodeRef.current) return;
            
            setScanning(true);
            setError(null);
            
            await html5QrCodeRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                handleScan,
                (errorMessage) => {
                    // Handle scan error - usually means no QR code in frame
                }
            );
        } catch (err) {
            console.error('Error starting scanner:', err);
            setError('Failed to start camera. Please check permissions.');
            setScanning(false);
        }
    };

    const handleScan = async (decodedText, decodedResult) => {
        if (decodedText) {
            try {
                // Stop scanning temporarily
                if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                
                setScanning(false);
                setError(null);
                
                // First verify the QR code
                const verifyResponse = await axios.post(
                    `${import.meta.env.VITE_SERVER_URL}/outpass-api/verify-qr`,
                    { qrCodeData: decodedText }
                );

                if (verifyResponse.data.valid) {
                    const pass = verifyResponse.data.outpass;
                    setVerifiedPass(pass);
                    setScanResult(decodedText);
                    
                    // Auto-detect action based on pass status
                    if (pass.status === 'approved') {
                        setDetectedAction('out');
                    } else if (pass.status === 'out') {
                        setDetectedAction('in');
                    } else {
                        setDetectedAction(null);
                    }
                }
            } catch (err) {
                console.error('Error verifying QR code:', err);
                setError(err.response?.data?.message || 'Invalid QR code');
                setTimeout(() => {
                    setError(null);
                    startScanning();
                }, 3000);
            }
        }
    };

    const handleAction = async () => {
        if (!detectedAction) return;
        
        try {
            const endpoint = detectedAction === 'out' ? '/scan/out' : '/scan/in';
            const response = await axios.post(
                `${import.meta.env.VITE_SERVER_URL}/outpass-api${endpoint}`,
                { qrCodeData: scanResult }
            );

            const action = detectedAction === 'out' ? 'checked out' : 'checked in';
            const time = detectedAction === 'out' ? response.data.student.outTime : response.data.student.inTime;
            
            alert(`✅ ${response.data.message}\n\nStudent: ${response.data.student.name}\nTime: ${new Date(time).toLocaleString()}`);
            
            // Reset for next scan
            resetScanner();
        } catch (err) {
            console.error(`Error during ${detectedAction}:`, err);
            alert(err.response?.data?.message || `Failed to ${detectedAction === 'out' ? 'check out' : 'check in'} student`);
            resetScanner();
        }
    };

    const resetScanner = () => {
        setScanResult(null);
        setVerifiedPass(null);
        setDetectedAction(null);
        setError(null);
        startScanning();
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    <QrCode size={32} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
                    Smart QR Scanner
                </h1>
                <p style={{ color: '#666', fontSize: '1rem' }}>
                    Scan any outpass QR code - system automatically detects check-in or check-out
                </p>
                {detectedAction && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '8px 16px',
                        backgroundColor: detectedAction === 'out' ? '#e8f5e9' : '#e3f2fd',
                        color: detectedAction === 'out' ? '#2e7d32' : '#1565c0',
                        borderRadius: '20px',
                        display: 'inline-block',
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                    }}>
                        🎯 Detected: {detectedAction === 'out' ? 'Check-Out (Student Leaving)' : 'Check-In (Student Returning)'}
                    </div>
                )}
            </div>

            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '2rem',
                '@media (max-width: 768px)': {
                    gridTemplateColumns: '1fr'
                }
            }}>
                {/* Scanner Section */}
                <div style={{
                    backgroundColor: '#fff',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Camera View</h2>
                    
                    <div 
                        ref={scannerRef}
                        id="qr-reader"
                        style={{ 
                            border: scanning ? '3px solid #4CAF50' : '3px solid #ddd', 
                            borderRadius: '12px', 
                            overflow: 'hidden',
                            width: '100%',
                            maxWidth: '500px',
                            margin: '0 auto',
                            position: 'relative'
                        }}
                    >
                    </div>
                    
                    {!scanning && !error && verifiedPass && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            textAlign: 'center',
                            backgroundColor: '#e8f5e9',
                            borderRadius: '12px'
                        }}>
                            <CheckCircle size={32} color="#4CAF50" />
                            <p style={{ marginTop: '0.5rem', fontWeight: 'bold', color: '#4CAF50' }}>QR Code Scanned Successfully!</p>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            backgroundColor: '#ffebee',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <XCircle size={24} color="#d32f2f" />
                            <span style={{ color: '#d32f2f' }}>{error}</span>
                        </div>
                    )}

                    {!scanning && !error && (
                        <button
                            onClick={resetScanner}
                            style={{
                                marginTop: '1rem',
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#2196F3',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Scan Another Code
                        </button>
                    )}
                </div>

                {/* Pass Details Section */}
                <div style={{
                    backgroundColor: '#fff',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Pass Details</h2>
                    
                    {verifiedPass ? (
                        <div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <User size={18} color="#666" />
                                        <div>
                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>Student Name</span>
                                            <p style={{ margin: 0, fontWeight: 'bold' }}>{verifiedPass.name}</p>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <User size={18} color="#666" />
                                        <div>
                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>Roll Number</span>
                                            <p style={{ margin: 0, fontWeight: 'bold' }}>{verifiedPass.rollNumber}</p>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <Calendar size={18} color="#666" />
                                        <div>
                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>Pass Type</span>
                                            <p style={{ margin: 0, fontWeight: 'bold', textTransform: 'capitalize' }}>
                                                {verifiedPass.type}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <Clock size={18} color="#666" />
                                        <div>
                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>Scheduled Out Time</span>
                                            <p style={{ margin: 0, fontWeight: 'bold' }}>
                                                {new Date(verifiedPass.outTime).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <Clock size={18} color="#666" />
                                        <div>
                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>Scheduled In Time</span>
                                            <p style={{ margin: 0, fontWeight: 'bold' }}>
                                                {new Date(verifiedPass.inTime).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '12px',
                                    backgroundColor: verifiedPass.status === 'approved' ? '#e8f5e9' : '#fff3e0',
                                    borderRadius: '8px',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <AlertCircle size={18} color={verifiedPass.status === 'approved' ? '#4CAF50' : '#FF9800'} />
                                        <div>
                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>Current Status</span>
                                            <p style={{ 
                                                margin: 0, 
                                                fontWeight: 'bold', 
                                                textTransform: 'uppercase',
                                                color: verifiedPass.status === 'approved' ? '#4CAF50' : '#FF9800'
                                            }}>
                                                {verifiedPass.status}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px'
                                }}>
                                    <span style={{ fontSize: '0.85rem', color: '#666' }}>Reason</span>
                                    <p style={{ margin: '8px 0 0 0' }}>{verifiedPass.reason}</p>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div style={{ marginTop: '1.5rem' }}>
                                {detectedAction ? (
                                    <button
                                        onClick={handleAction}
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            backgroundColor: detectedAction === 'out' ? '#4CAF50' : '#2196F3',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            fontSize: '1.1rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.transform = 'scale(1.02)';
                                            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = 'scale(1)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    >
                                        <CheckCircle size={24} />
                                        {detectedAction === 'out' ? '✓ Confirm Exit (Check Out)' : '✓ Confirm Entry (Check In)'}
                                    </button>
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        padding: '16px',
                                        backgroundColor: '#ffebee',
                                        color: '#d32f2f',
                                        borderRadius: '8px',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}>
                                        <XCircle size={24} />
                                            <div>
                                            <div>Invalid Pass Status</div>
                                            <div style={{ fontSize: '0.85rem', marginTop: '4px', opacity: 0.9 }}>
                                                Current status: <strong>{verifiedPass.status}</strong><br/>
                                                {verifiedPass.status === 'pending' && 'Pass is not yet approved by admin'}
                                                {verifiedPass.status === 'rejected' && 'Pass has been rejected'}
                                                {verifiedPass.status === 'returned' && 'Student has already returned'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: '3rem',
                            textAlign: 'center',
                            color: '#666'
                        }}>
                            <QrCode size={64} color="#ddd" />
                            <p style={{ marginTop: '1rem' }}>Scan a QR code to view pass details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QRScanner;
