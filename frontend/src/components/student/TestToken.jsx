import { useState } from 'react';
import { toast } from 'react-hot-toast';

const TestToken = () => {
    const [token, setToken] = useState('');

    const handleSetToken = () => {
        if (token.trim()) {
                localStorage.setItem('token', token.trim());
                toast.success('Token set in localStorage! Refreshing page...');
                setTimeout(() => window.location.reload(), 1200);
        } else {
                toast.error('Please enter a token');
        }
    };

    const handleClearToken = () => {
        localStorage.removeItem('token');
        // Also clear any cookies
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        toast.success('Token and cookies cleared! Refreshing page...');
        setTimeout(() => window.location.reload(), 1200);
    };

    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_SERVER_URL}/auth/google`;
    };

    const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YWQ5ZjE1MjQwMzEzYWE2MjYzNzcwMCIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzU2MjExNTA4LCJleHAiOjE3NTY4MTYzMDh9.Be5YqvZ417D7AQGH7XqXp6oNkEzapjU4qJZQtmhAF0c";

    return (
        <div style={{ 
            position: 'fixed', 
            bottom: '10px', 
            left: '10px', 
            background: 'white', 
            border: '1px solid #ccc', 
            padding: '15px',
            fontSize: '12px',
            zIndex: 9999,
            maxWidth: '400px'
        }}>
            <h4>Token Test</h4>
            <div style={{ marginBottom: '10px' }}>
                <textarea 
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste token here..."
                    style={{ width: '100%', height: '60px', fontSize: '10px' }}
                />
            </div>
            <div style={{ marginBottom: '10px' }}>
                <button onClick={handleSetToken} style={{ marginRight: '5px' }}>
                    Set Token
                </button>
                <button onClick={handleClearToken} style={{ marginRight: '5px' }}>
                    Clear All
                </button>
                <button
                    onClick={() => setToken(testToken)}
                    style={{ fontSize: '10px', marginRight: '5px' }}
                >
                    Use Test Token
                </button>
                <button
                    onClick={handleGoogleLogin}
                    style={{ fontSize: '10px' }}
                >
                    Test Google OAuth
                </button>
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>
                Current token: {localStorage.getItem('token') ? 'Set' : 'Not set'}
            </div>
        </div>
    );
};

export default TestToken;
