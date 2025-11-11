import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import vnrvjietLogo from '../assets/vnrvjiet-logo.png';
import { 
  Home, 
  Users, 
  Bell, 
  FileText, 
  MessageSquare, 
  LogOut, 
  Utensils, 
  UserCheck,
  Menu,
  X,
  ChevronRight,
  Building,
  MessageCircle,
  User
} from 'lucide-react';
import logo from '../assets/vnrvjiet-logo.png';
import axios from 'axios';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingOutpassCount, setPendingOutpassCount] = useState(0);
  const { admin, logout, token } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchPendingOutpassCount = async () => {
      if (token) {
        try {
          const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/pending-outpasses`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const count = response.data.pendingOutpasses?.length || 0;
          console.log('Pending outpass count:', count);
          setPendingOutpassCount(count);
        } catch (error) {
          console.error('Error fetching pending outpass count:', error);
        }
      }
    };

    fetchPendingOutpassCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingOutpassCount, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebarOnMobile = () => {
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <>
      <style>
        {`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F1F5F9' }}>
      {/* Sidebar Overlay for Mobile */}
      {isMobile && sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '280px',
        backgroundColor: '#4F46E5',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        height: '100vh',
        overflow: 'hidden',
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        transition: 'transform 0.3s ease',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isMobile ? '2px 0 8px rgba(0, 0, 0, 0.15)' : 'none'
      }}>
        <div style={{ 
          padding: '1.5rem', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
              Admin Portal
            </h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
              Hostel Management
            </p>
          </div>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '0.5rem'
              }}
            >
              <X size={24} />
            </button>
          )}
        </div>

        <nav style={{ 
          flex: 1, 
          padding: '1rem 0', 
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }} className="hide-scrollbar">
          <SidebarNavItem 
            icon={<Home size={20} />} 
            label="Dashboard" 
            to="/admin" 
            end={true}
            onClick={closeSidebarOnMobile}
          />
          <SidebarNavItem 
            icon={<Bell size={20} />} 
            label="Announcements" 
            to="/admin/announcements"
            onClick={closeSidebarOnMobile}
          />
          <SidebarNavItem 
            icon={<Users size={20} />} 
            label="Students" 
            to="/admin/students"
            onClick={closeSidebarOnMobile}
          />
          <SidebarNavItem 
            icon={<Building size={20} />} 
            label="Rooms" 
            to="/admin/rooms"
            onClick={closeSidebarOnMobile}
          />
          <SidebarNavItem 
            icon={<MessageSquare size={20} />} 
            label="Complaints" 
            to="/admin/complaints"
            onClick={closeSidebarOnMobile}
          />
          <SidebarNavItem 
            icon={<FileText size={20} />} 
            label="Outpasses" 
            to="/admin/outpasses"
            onClick={closeSidebarOnMobile}
            badge={pendingOutpassCount}
          />
          <SidebarNavItem 
            icon={<Utensils size={20} />} 
            label="Food Menu" 
            to="/admin/food"
            onClick={closeSidebarOnMobile}
          />
          <SidebarNavItem 
            icon={<UserCheck size={20} />} 
            label="Visitors" 
            to="/admin/visitors"
            onClick={closeSidebarOnMobile}
          />
          <SidebarNavItem 
            icon={<User size={20} />} 
            label="Profile" 
            to="/admin/profile"
            onClick={closeSidebarOnMobile}
          />
          
          {/* Admin Profile Section */}
          <div style={{
            padding: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            backgroundColor: '#3730A3',
            borderRadius: '12px',
            margin: '1rem 0.75rem 1rem 0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1.125rem'
                }}>
                  {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div>
                  <p style={{ margin: 0, color: 'white', fontWeight: '600', fontSize: '0.875rem' }}>
                    {admin?.name || 'Admin User'}
                  </p>
                  <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem' }}>
                    Administrator
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        width: '100%'
      }}>
        {/* Header */}
        <header style={{
          backgroundColor: 'white',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isMobile && (
              <button
                onClick={toggleSidebar}
                style={{
                  backgroundColor: '#4F46E5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Menu size={24} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                backgroundColor: '#4F46E5',
                borderRadius: '8px',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src={vnrvjietLogo} 
                  alt="VNRVJIET Logo" 
                  style={{ 
                    height: isMobile ? '24px' : '32px', 
                    width: 'auto' 
                  }} 
                />
              </div>
              <h5 style={{ margin: 0, color: '#1E293B', fontWeight: '600', fontSize: isMobile ? '1rem' : '1.25rem' }}>
                Admin Portal
              </h5>
            </div>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#64748B', fontWeight: '500', fontSize: '0.95rem' }}>
                {admin?.name || 'Admin'}
              </span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#E0E7FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4F46E5',
                fontWeight: 'bold',
                fontSize: '0.875rem'
              }}>
                {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main style={{ 
          flex: 1, 
          padding: isMobile ? '1rem' : '2rem',
          overflowY: 'auto',
          backgroundColor: '#F1F5F9'
        }}>
          <Outlet />
        </main>
      </div>
      </div>
    </>
  );
};

const SidebarNavItem = ({ icon, label, to, end = false, onClick, badge }) => {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        color: isActive ? '#60A5FA' : 'white',
        textDecoration: 'none',
        fontSize: '0.95rem',
        fontWeight: isActive ? '600' : '500',
        backgroundColor: isActive ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
        borderRadius: '12px',
        margin: '0 0.75rem 0.25rem 0.75rem',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      })}
      onMouseEnter={(e) => {
        const isActive = e.currentTarget.classList.contains('active');
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.paddingLeft = '1.5rem';
        }
      }}
      onMouseLeave={(e) => {
        const isActive = e.currentTarget.classList.contains('active');
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.paddingLeft = '1.25rem';
        }
      }}
    >
      {({ isActive }) => (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            {icon}
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
              <span style={{
                backgroundColor: '#EF4444',
                color: 'white',
                borderRadius: '9999px',
                padding: '0.125rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: '700',
                minWidth: '20px',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                {badge}
              </span>
            )}
          </div>
          <ChevronRight size={18} style={{ opacity: isActive ? 1 : 0.6 }} />
        </>
      )}
    </NavLink>
  );
};

export default AdminLayout;