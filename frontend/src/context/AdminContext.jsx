import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AdminContext = createContext(null);

export const AdminProvider = ({ children }) => {
    const [admin, setAdmin] = useState(() => {
        const storedAdmin = localStorage.getItem('admin');
        return storedAdmin ? JSON.parse(storedAdmin) : null;
    });
    
    const [token, setToken] = useState(() => {
        return localStorage.getItem('adminToken') || localStorage.getItem('token') || localStorage.getItem('auth-token') || null;
    });

    // Fetch admin profile data on mount if token exists
    useEffect(() => {
        const fetchAdminProfile = async () => {
            const authToken = localStorage.getItem('token') || localStorage.getItem('auth-token') || localStorage.getItem('adminToken');
            
            if (authToken && (!admin || !admin.name)) {
                try {
                    // Set axios defaults
                    axios.defaults.withCredentials = true;
                    if (!axios.defaults.headers.common['Authorization']) {
                        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
                    }

                    const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/auth/check-auth`);
                    
                    if (response.data.success && response.data.user && response.data.user.role === 'admin') {
                        const adminData = response.data.user;
                        setAdmin(adminData);
                        setToken(authToken);
                        localStorage.setItem('admin', JSON.stringify(adminData));
                        localStorage.setItem('adminToken', authToken);
                    }
                } catch (error) {
                    console.error('Failed to fetch admin profile:', error);
                    // Don't clear the token here, let the user stay logged in
                }
            }
        };

        fetchAdminProfile();
    }, []);

    const login = (adminData, authToken) => {
        setAdmin(adminData);
        setToken(authToken);
        localStorage.setItem('admin', JSON.stringify(adminData));
        localStorage.setItem('adminToken', authToken);
        localStorage.setItem('token', authToken);
        localStorage.setItem('auth-token', authToken);
    };

    const logout = () => {
        setAdmin(null);
        setToken(null);
        // Clear all possible token variations from localStorage
        localStorage.removeItem('admin');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('token');
        localStorage.removeItem('auth-token');
        localStorage.removeItem('guard_token');
        delete axios.defaults.headers.common['Authorization'];
    };

    const isAuthenticated = () => {
        return !!token;
    };

    return (
        <AdminContext.Provider value={{ admin, token, login, logout, isAuthenticated }}>
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (context === null) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};
