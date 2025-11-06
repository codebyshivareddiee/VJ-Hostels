import React from 'react';
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from '../context/SecurityContext';
import SecurityLayout from '../layouts/SecurityLayout';
import VisitorManagement from '../components/security/VisitorManagement';
import Home from '../components/student/HomePage';
import Attendance from '../components/security/Attendance';
import SecurityDashboard from '../components/security/SecurityDashboard';
import QRScanner from '../components/security/QRScanner';
import ActivePasses from '../components/security/ActivePasses';

function SecurityPage() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<SecurityLayout />}>
          {/* <Route index element={<SecurityDashboard />} /> */}
          <Route index element ={<Home/>} /> 
          <Route path="scanner" element={<QRScanner />} />
          <Route path="passes" element={<ActivePasses />} />
          <Route path="visitors" element={<VisitorManagement />} />
          <Route path="attendance" element={<Attendance/>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default SecurityPage;

