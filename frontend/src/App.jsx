import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Toaster } from 'react-hot-toast';
import LoginPage from './auth/LoginPage';
import StudentPage from './pages/StudentPage';
import AdminPage from './pages/AdminPage';
import SecurityPage from './pages/SecurityPage';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import { AdminProvider } from './context/AdminContext';
import GoogleAnalytics from './utils/analytics';

// Initialize performance monitoring
import { initPerformanceMonitoring } from './utils/performance';
initPerformanceMonitoring();

function App() {
  return (
    <AdminProvider>
      <Router>
      {/* Google Analytics - Replace 'G-XXXXXXXXXX' with your actual Measurement ID */}
      <GoogleAnalytics measurementId="G-XXXXXXXXXX" />
      
      <div className="App">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
        
        <Routes>
          {/* Default route - redirect to login */}
          <Route path="/" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          
          {/* Login route */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          
          {/* Role-based protected routes */}
          <Route 
            path="/student/*" 
            element={
              <ProtectedRoute allowedRoles="student">
                <StudentPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute allowedRoles="admin">
                <AdminPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/security/*" 
            element={
              <ProtectedRoute allowedRoles={['security', 'guard']}>
                <SecurityPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      </Router>
    </AdminProvider>
  );
}

export default App;