import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { QrCode, CheckCircle, XCircle, AlertCircle, User, Calendar, Clock, Loader } from 'lucide-react';
import '../../styles/qr-scanner.css';

const QRScanner = () => {
    const [scanResult, setScanResult] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState(null);
    const [verifiedPass, setVerifiedPass] = useState(null);
    const [detectedAction, setDetectedAction] = useState(null); // Auto-detected: 'out' or 'in'
    const [isVerifying, setIsVerifying] = useState(false); // New state for verification loading
    const [showFullScreen, setShowFullScreen] = useState(false); // Full-screen overlay state
    const html5QrCodeRef = useRef(null);
    const scannerRef = useRef(null);

    useEffect(() => {
        // Initialize scanner
        const initScanner = async () => {
            try {
                // Ensure there is a place for the scanner to attach
                if (document.getElementById('qr-reader')) {
                    html5QrCodeRef.current = new Html5Qrcode('qr-reader');
                    startScanning();
                } else {
                    // This case should ideally not happen if the JSX renders correctly
                    console.warn('QR reader element not found on initial load.');
                }
            } catch (err) {
                console.error('Error initializing scanner:', err);
                setError('Failed to initialize camera');
            }
        };

        // Delay init to ensure the element is in the DOM (more robust than just checking for scannerRef.current which isn't used for init)
        const timeoutId = setTimeout(initScanner, 100);

        // Cleanup
        return () => {
            clearTimeout(timeoutId);
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.error('Error stopping scanner:', err));
            }
        };
    }, []);

    const startScanning = async () => {
        try {
            if (!html5QrCodeRef.current || isVerifying || verifiedPass) return; // Prevent starting if busy or results are displayed

            setScanning(true);
            setError(null);
            
            // Check if the camera is already running before starting
            if (!html5QrCodeRef.current.isScanning) {
                await html5QrCodeRef.current.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    handleScan,
                    (errorMessage) => {
                        // Suppress constant error logging for "No QR code found"
                        if (!String(errorMessage).includes('No QR code found')) {
                            // console.warn('Scan error:', errorMessage);
                        }
                    }
                );
            }
        } catch (err) {
            console.error('Error starting scanner:', err);
            setError('Failed to start camera. Please check permissions.');
            setScanning(false);
        }
    };

    const handleScan = async (decodedText, decodedResult) => {
        if (decodedText && !isVerifying) {
            try {
                // Stop scanning immediately upon detection
                if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                
                setScanning(false);
                setError(null);
                setIsVerifying(true);
                setScanResult(decodedText); // Store for later action

                // 1. Verify the QR code
                const verifyResponse = await axios.post(
                    `${import.meta.env.VITE_SERVER_URL}/outpass-api/verify-qr`,
                    { qrCodeData: decodedText }
                );

                // Check if QR code is expired
                if (verifyResponse.data.expired) {
                    setError(verifyResponse.data.expirationReason || 'QR code has expired');
                    setIsVerifying(false);
                    setTimeout(resetScanner, 5000);
                    return;
                }

                if (verifyResponse.data.valid) {
                    const pass = verifyResponse.data.outpass;
                    setVerifiedPass(pass);
                    
                    // Auto-detect action based on pass status
                    if (pass.status === 'approved' || pass.status === 'late') {
                        setDetectedAction('out');
                    } else if (pass.status === 'out') {
                        setDetectedAction('in');
                    } else {
                        setDetectedAction(null); // Invalid status for immediate action
                    }
                    
                    // Show full-screen overlay with smooth transition
                    setTimeout(() => setShowFullScreen(true), 100);
                } else {
                    setError(verifyResponse.data.message || 'Invalid QR code');
                    setTimeout(resetScanner, 3000);
                }
            } catch (err) {
                console.error('Error verifying QR code:', err);
                setError(err.response?.data?.message || 'Invalid QR code or server error');
                setTimeout(resetScanner, 3000);
            } finally {
                setIsVerifying(false);
            }
        }
    };

    const handleAction = async () => {
        if (!detectedAction || isVerifying) return; // Use isVerifying to block action during server calls
        
        try {
            setIsVerifying(true); // Re-use loading state for action
            const endpoint = detectedAction === 'out' ? '/scan/out' : '/scan/in';
            const response = await axios.post(
                `${import.meta.env.VITE_SERVER_URL}/outpass-api${endpoint}`,
                { qrCodeData: scanResult }
            );

            resetScanner();
        } catch (err) {
            console.error(`Error during ${detectedAction}:`, err);
            const errorMsg = err.response?.data?.message || `Failed to ${detectedAction === 'out' ? 'check out' : 'check in'} student`;
            
            if (err.response?.data?.requiresRegeneration) {
                alert(`❌ ${errorMsg}\n\nThe student must regenerate their QR code as "Late" from their current passes page.`);
            } else {
                alert(`❌ ${errorMsg}`);
            }
            
            resetScanner();
        } finally {
            setIsVerifying(false);
        }
    };

    const resetScanner = () => {
        setShowFullScreen(false);
        setTimeout(() => {
            setScanResult(null);
            setVerifiedPass(null);
            setDetectedAction(null);
            setError(null);
            setIsVerifying(false);
            startScanning();
        }, 300); // Wait for transition to complete
    };

    // --- Styling for Mobile Responsiveness (The requested change) ---
    const gridContainerStyle = { 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '2rem',
        // Media query for mobile layout (CSS-in-JS pattern)
        '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr'
        }
    };

    const mobileOptimizedContainerStyle = {
        padding: '2rem', 
        maxWidth: '1000px', 
        margin: '0 auto'
    };
    
    // Applying the media query dynamically (This pattern requires a CSS-in-JS library like styled-components 
    // or Emotion to work fully with dynamic media queries. Since we are using plain React with inline styles, 
    // we'll apply a simpler direct grid-column for mobile via a key prop to simulate the responsive change. 
    // For true mobile support, using external CSS or a library is better, but here we enforce the single-column view):

    const scannerContainerStyle = {
        backgroundColor: '#fff',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        // On small screens, this must be the first column (default, so no special logic needed)
        order: 1, // Ensure it's the first item visually
    };

    const detailsContainerStyle = {
        backgroundColor: '#fff',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        // On small screens, this must be the second column
        order: 2, // Ensure it's the second item visually on mobile
    };
    
    // Fallback for native inline style grid, which doesn't support @media natively:
    // We'll use a wrapper div and rely on the browser's Flexbox/Grid behavior to stack
    // or a dedicated CSS class for the media query, but let's stick to inline style updates:
    // The `style` prop only takes an object, not a CSS string, so native media queries won't work.
    // I will use a simple, modern CSS grid setup that naturally stacks on small screens 
    // unless explicitly told otherwise in external CSS, or I'll assume an external CSS solution is allowed, 
    // or I'll use the external class name already provided in the imports.
    
    // *Self-Correction: Since I cannot use `@media` queries in React inline styles directly,
    // and the original code imports `qr-scanner.css`, I will **add the mobile-specific CSS to the external stylesheet**
    // conceptually, but for the JSX, I will structure it for a robust layout.*

    return (
        <>
        {/* Full-Screen Overlay */}
        {showFullScreen && verifiedPass && (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.95)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                paddingTop: 'max(20px, env(safe-area-inset-top))',
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
                animation: 'fadeIn 0.3s ease-out',
                backdropFilter: 'blur(10px)',
                overflowY: 'auto'
            }}>
                <div 
                    className="overlay-card"
                    style={{
                        backgroundColor: '#fff',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '550px',
                        width: '95%',
                        maxHeight: '90vh',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                        animation: 'slideUp 0.4s ease-out',
                        position: 'relative',
                        border: '1px solid #e0e0e0',
                        margin: 'auto',
                        overflowY: 'auto'
                    }}>
                    {/* Close Button */}
                    <button
                        onClick={resetScanner}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: '#f5f5f5',
                            border: 'none',
                            fontSize: '18px',
                            cursor: 'pointer',
                            color: '#666',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#e0e0e0';
                            e.target.style.color = '#333';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#f5f5f5';
                            e.target.style.color = '#666';
                        }}
                    >
                        ×
                    </button>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <CheckCircle size={24} color="#4CAF50" />
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: 0, color: '#333' }}>
                                QR Code Verified
                            </h2>
                        </div>
                        <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>Student pass details</p>
                    </div>

                    {/* Student Details */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '15px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '12px',
                            marginBottom: '15px'
                        }}>
                            <div style={{
                                width: '45px',
                                height: '45px',
                                backgroundColor: '#2196F3',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <User size={22} color="white" />
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 3px 0', fontSize: '1.2rem', color: '#333' }}>
                                    {verifiedPass.name}
                                </h3>
                                <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
                                    Roll: {verifiedPass.rollNumber}
                                </p>
                            </div>
                        </div>

                        {/* Pass Info Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                            marginBottom: '15px'
                        }}>
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#e3f2fd',
                                borderRadius: '10px',
                                textAlign: 'center'
                            }}>
                                <Calendar size={18} color="#2196F3" style={{ marginBottom: '6px' }} />
                                <p style={{ margin: '0 0 3px 0', fontSize: '0.8rem', color: '#666' }}>Pass Type</p>
                                <p style={{ margin: 0, fontWeight: 'bold', textTransform: 'capitalize', color: '#2196F3', fontSize: '0.9rem' }}>
                                    {verifiedPass.type}
                                </p>
                            </div>
                            <div style={{
                                padding: '12px',
                                backgroundColor: verifiedPass.status === 'approved' ? '#e8f5e9' : 
                                                verifiedPass.status === 'late' ? '#fef3c7' : 
                                                verifiedPass.status === 'out' ? '#e3f2fd' : '#ffebee',
                                borderRadius: '10px',
                                textAlign: 'center'
                            }}>
                                <AlertCircle size={18} color={
                                    verifiedPass.status === 'approved' ? '#4CAF50' : 
                                    verifiedPass.status === 'late' ? '#f59e0b' : 
                                    verifiedPass.status === 'out' ? '#2196F3' : '#d32f2f'
                                } style={{ marginBottom: '6px' }} />
                                <p style={{ margin: '0 0 3px 0', fontSize: '0.8rem', color: '#666' }}>Status</p>
                                <p style={{ 
                                    margin: 0, 
                                    fontWeight: 'bold', 
                                    textTransform: 'uppercase',
                                    fontSize: '0.9rem',
                                    color: verifiedPass.status === 'approved' ? '#4CAF50' : 
                                           verifiedPass.status === 'late' ? '#f59e0b' : 
                                           verifiedPass.status === 'out' ? '#2196F3' : '#d32f2f'
                                }}>
                                    {verifiedPass.status}
                                </p>
                            </div>
                        </div>

                        {/* Time Details */}
                        <div style={{
                            padding: '15px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '12px',
                            marginBottom: '15px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Clock size={16} color="#666" />
                                <span style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Schedule</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <p style={{ margin: '0 0 3px 0', fontSize: '0.8rem', color: '#666' }}>Out Time</p>
                                    <p style={{ margin: 0, fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>
                                        {new Date(verifiedPass.outTime).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 3px 0', fontSize: '0.8rem', color: '#666' }}>In Time</p>
                                    <p style={{ margin: 0, fontWeight: 'bold', color: '#333', fontSize: '0.85rem' }}>
                                        {new Date(verifiedPass.inTime).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Reason */}
                        <div style={{
                            padding: '15px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '12px',
                            marginBottom: '15px'
                        }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>Reason</p>
                            <p style={{ margin: 0, color: '#333', lineHeight: '1.4', fontSize: '0.9rem' }}>{verifiedPass.reason}</p>
                        </div>
                    </div>

                    {/* Action Button */}
                    {detectedAction && (
                        <div style={{ textAlign: 'center' }}>
                            {verifiedPass.status === 'late' && detectedAction === 'out' && (
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    borderRadius: '10px',
                                    marginBottom: '15px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem'
                                }}>
                                    <Clock size={16} />
                                    ⚠️ Late Entry - Pass was regenerated
                                </div>
                            )}
                            <button
                                onClick={handleAction}
                                disabled={isVerifying}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    backgroundColor: detectedAction === 'out' 
                                        ? (verifiedPass.status === 'late' ? '#f59e0b' : '#4CAF50')
                                        : '#2196F3',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 'bold',
                                    fontSize: '1rem',
                                    cursor: isVerifying ? 'not-allowed' : 'pointer',
                                    opacity: isVerifying ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                }}
                                onMouseEnter={(e) => !isVerifying && (e.target.style.transform = 'translateY(-1px)', e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)')}
                                onMouseLeave={(e) => !isVerifying && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)')}
                            >
                                {isVerifying ? (
                                    <Loader size={18} className="spin-animation" />
                                ) : (
                                    <CheckCircle size={18} />
                                )}
                                {isVerifying 
                                    ? 'Processing...'
                                    : detectedAction === 'out' ? 'Confirm Exit' : 'Confirm Entry'
                                }
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}
        
        <div style={mobileOptimizedContainerStyle}>
            {/* Main Content Grid - Using a CSS class for responsiveness */}
            <div 
                // A responsive class that switches from 2-column to 1-column on small screens
                // Assuming this class is defined in '../../styles/qr-scanner.css' as:
                // @media (min-width: 769px) { .responsive-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; } }
                // @media (max-width: 768px) { .responsive-grid { display: flex; flex-direction: column; gap: 2rem; } }
                className="responsive-grid-container" // New class for external CSS control
                style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '2rem',
                    // Inline media query simulation/override for mobile stacking
                    // Note: This is an approximation since true inline @media is not possible in React style prop.
                    // The layout will rely on external CSS for actual mobile stacking.
                    // For the desktop view, the grid is defined here.
                }}
            >
                {/* 1. Scanner Section (Order 1 on mobile) */}
                <div style={scannerContainerStyle}>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Camera View</h2>
                    
                    <div 
                        ref={scannerRef}
                        id="qr-reader"
                        style={{
                            position: 'relative',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            width: '100%',
                            maxWidth: '450px',
                            aspectRatio: '1 / 1',
                            margin: '0 auto',
                            backgroundColor: '#000',
                            boxShadow: scanning
                                ? '0 0 20px rgba(76, 175, 80, 0.7)'
                                : '0 0 10px rgba(0,0,0,0.3)',
                            border: scanning ? '3px solid #4CAF50' : '3px solid #333',
                        }}
                    >
                    </div>

                    
                    {/* Status/Feedback section */}
                    {!scanning && !error && (verifiedPass || isVerifying) && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            textAlign: 'center',
                            backgroundColor: isVerifying ? '#fffde7' : '#e8f5e9',
                            borderRadius: '12px'
                        }}>
                            {isVerifying ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#FFC107', fontWeight: 'bold' }}>
                                    <Loader size={32} color="#FFC107" className="spin-animation" />
                                    <p style={{ margin: 0 }}>Verifying QR Code...</p>
                                </div>
                            ) : (
                                <>
                                    <CheckCircle size={32} color="#4CAF50" />
                                    <p style={{ marginTop: '0.5rem', fontWeight: 'bold', color: '#4CAF50' }}>QR Code Scanned Successfully!</p>
                                </>
                            )}
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

                    {/* Reset Button */}
                    {!scanning && !error && !isVerifying && (
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
                                cursor: 'pointer',
                                // Basic hover effect retained
                            }}
                        >
                            Scan Another Code
                        </button>
                    )}
                </div>

                {/* 2. Pass Details Section (Order 2 on mobile - appears below scanner) */}
                <div className="pass-details-section" style={detailsContainerStyle}>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Pass Details</h2>
                    
                    {verifiedPass ? (
                        <div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                {/* Student Name and Roll Number in an updated, cleaner layout */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '1fr 1fr', 
                                    gap: '10px', 
                                    marginBottom: '12px' 
                                }}>
                                    {/* Name */}
                                    <PassDetailItem 
                                        Icon={User} 
                                        label="Student Name" 
                                        value={verifiedPass.name} 
                                    />
                                    {/* Roll Number */}
                                    <PassDetailItem 
                                        Icon={Calendar} 
                                        label="Roll Number" 
                                        value={verifiedPass.rollNumber} 
                                    />
                                </div>

                                {/* Pass Type and Status */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '1fr 1fr', 
                                    gap: '10px', 
                                    marginBottom: '12px' 
                                }}>
                                    {/* Pass Type */}
                                    <PassDetailItem 
                                        Icon={Calendar} 
                                        label="Pass Type" 
                                        value={verifiedPass.type} 
                                        textTransform="capitalize"
                                    />
                                    {/* Current Status */}
                                    <PassDetailItem 
                                        Icon={AlertCircle} 
                                        label="Current Status" 
                                        value={verifiedPass.status + (verifiedPass.status === 'late' ? ' (Regenerated Late)' : '')}
                                        status={verifiedPass.status}
                                        textTransform="uppercase"
                                    />
                                </div>
                                
                                {/* Scheduled Times */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '1fr 1fr', 
                                    gap: '10px', 
                                    marginBottom: '12px' 
                                }}>
                                    {/* Scheduled Out Time */}
                                    <PassDetailItem 
                                        Icon={Clock} 
                                        label="Scheduled Out Time" 
                                        value={new Date(verifiedPass.outTime).toLocaleString()} 
                                    />
                                    {/* Scheduled In Time */}
                                    <PassDetailItem 
                                        Icon={Clock} 
                                        label="Scheduled In Time" 
                                        value={new Date(verifiedPass.inTime).toLocaleString()} 
                                    />
                                </div>

                                {/* Reason */}
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
                                    <>
                                        {/* Late Warning */}
                                        {verifiedPass.status === 'late' && detectedAction === 'out' && (
                                            <div style={{
                                                width: '100%',
                                                padding: '12px',
                                                backgroundColor: '#fef3c7',
                                                color: '#92400e',
                                                borderRadius: '8px',
                                                textAlign: 'center',
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem',
                                                marginBottom: '12px',
                                                border: '2px solid #f59e0b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}>
                                                <Clock size={20} />
                                                ⚠️ Late Entry - Pass was regenerated after scheduled time
                                            </div>
                                        )}
                                        {/* Confirm Action Button */}
                                        <button
                                            onClick={handleAction}
                                            disabled={isVerifying} // Disable button during verification/action
                                            style={{
                                                width: '100%',
                                                padding: '16px',
                                                backgroundColor: 
                                                    detectedAction === 'out' 
                                                        ? (verifiedPass.status === 'late' ? '#f59e0b' : '#4CAF50')
                                                        : '#2196F3',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 'bold',
                                                fontSize: '1.1rem',
                                                cursor: isVerifying ? 'not-allowed' : 'pointer',
                                                opacity: isVerifying ? 0.6 : 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                transition: 'all 0.2s'
                                            }}
                                            // Retained simplified inline hover effects
                                            onMouseEnter={(e) => !isVerifying && (e.target.style.transform = 'scale(1.02)', e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)')}
                                            onMouseLeave={(e) => !isVerifying && (e.target.style.transform = 'scale(1)', e.target.style.boxShadow = 'none')}
                                        >
                                            <CheckCircle size={24} />
                                            {isVerifying 
                                                ? <Loader size={24} className="spin-animation" />
                                                : detectedAction === 'out' ? '✓ Confirm Exit (Check Out)' : '✓ Confirm Entry (Check In)'
                                            }
                                        </button>
                                    </>
                                ) : (
                                    /* Invalid Status Message */
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
                        /* Initial state: No pass scanned */
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

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    <QrCode size={32} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
                    Smart QR Scanner
                </h1>
                <p style={{ color: '#666', fontSize: '1rem' }}>
                    Scan any outpass QR code - system automatically detects check-in or check-out
                </p>
                {/* Detected Action Indicator */}
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
            
            {/* Simple CSS animation class definition for the Loader icon */}
            <style>
                {`
                .spin-animation {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(50px) scale(0.9);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                

                
                /* Mobile Layout Override: Stacks elements */
                @media (max-width: 768px) {
                    .responsive-grid-container {
                        display: flex !important;
                        flex-direction: column !important;
                    }
                }
                
                /* Mobile viewport handling */
                @media (max-width: 480px) {
                    .overlay-card {
                        margin: 10px !important;
                        padding: 2rem !important;
                        max-height: 92vh !important;
                        border-radius: 12px !important;
                        max-width: 95vw !important;
                        width: 95vw !important;
                    }
                }
                
                /* Hide pass details section on mobile since popup shows details */
                @media (max-width: 768px) {
                    .pass-details-section {
                        display: none !important;
                    }
                }
                `}
            </style>
        </div>
        </>
    );
};

// Helper component for cleaner detail rendering
const PassDetailItem = ({ Icon, label, value, status, textTransform = 'none' }) => {
    let bgColor = '#f5f5f5';
    let textColor = '#333';
    let iconColor = '#666';

    if (status) {
        if (status === 'approved') {
            bgColor = '#e8f5e9'; // Green light
            textColor = '#4CAF50';
            iconColor = '#4CAF50';
        } else if (status === 'late') {
            bgColor = '#fef3c7'; // Yellow warning
            textColor = '#f59e0b';
            iconColor = '#f59e0b';
        } else if (status === 'out') {
             bgColor = '#e3f2fd'; // Blue for out
             textColor = '#2196F3';
             iconColor = '#2196F3';
        }
    }

    return (
        <div style={{
            padding: '12px',
            backgroundColor: bgColor,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        }}>
            <Icon size={18} color={iconColor} />
            <div>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>{label}</span>
                <p style={{ margin: 0, fontWeight: 'bold', textTransform: textTransform, color: textColor }}>
                    {value}
                </p>
            </div>
        </div>
    );
};

export default QRScanner;