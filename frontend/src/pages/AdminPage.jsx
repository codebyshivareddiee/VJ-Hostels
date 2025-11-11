import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from '../layouts/AdminLayout';
import Dashboard from '../components/admin/Dashboard';
import Students from '../components/admin/Students';
import Rooms from '../components/admin/Rooms';
import Announcements from '../components/admin/Announcements';
import Complaints from '../components/admin/Complaints';
import Outpasses from '../components/admin/Outpasses';
import Food from '../components/admin/Food';
import Visitors from '../components/admin/Visitors';
import Profile from '../components/admin/Profile';

function AdminPage() {
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="outpasses" element={<Outpasses />} />
        <Route path="food" element={<Food />} />
        <Route path="visitors" element={<Visitors />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default AdminPage;
