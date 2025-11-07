import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Shield, Scan, CreditCard, FileCheck, Users, ClipboardCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import '../styles/security/custom.css';

const SecurityLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => isMobile && setSidebarOpen(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth-token');
    localStorage.removeItem('guard_token');
    window.location.href = '/login';
    logout().catch(() => {});
  };

  const isActive = (path) => location.pathname === `/security${path}`;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb',
      }}
    >
      {/* Floating Overlay Navbar */}
      <nav
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(30, 64, 175, 0.95)',
          color: 'white',
          borderRadius: '9999px',
          padding: '0.5rem 1.25rem',
          width: '90%',
          maxWidth: '1100px',
          boxShadow: scrolled
            ? '0 6px 20px rgba(0, 0, 0, 0.25)'
            : '0 2px 10px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Left section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isMobile && (
            <button
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
              }}
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
              <Menu size={24} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                letterSpacing: '0.02em',
                margin: 0,
              }}
            >
              Security Portal
            </h1>
          </div>
        </div>

        {/* Center section - Desktop Navigation */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <NavItem icon={<Scan size={18} />} label="QR Scanner" to="/security/scanner" isActive={isActive('/scanner')} onClick={closeSidebar} />
            <NavItem icon={<CreditCard size={18} />} label="ID Check-in" to="/security/scanner" isActive={isActive('/scanner')} onClick={closeSidebar} />
            <NavItem icon={<FileCheck size={18} />} label="Passes" to="/security/passes" isActive={isActive('/passes')} onClick={closeSidebar} />
            <NavItem icon={<Users size={18} />} label="Visitors" to="/security/visitors" isActive={isActive('/visitors')} onClick={closeSidebar} />
            <NavItem icon={<ClipboardCheck size={18} />} label="Attendance" to="/security/attendance" isActive={isActive('/attendance')} onClick={closeSidebar} />
          </div>
        )}

        {/* ✅ Right Section - Security Card + Logout (Desktop only) */}
        {!isMobile && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: '#FCD34D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1E40AF',
                  fontWeight: 'bold',
                }}
              >
                <Shield size={18} />
              </div>
              <div style={{ lineHeight: '1.1' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600' }}>Security Guard</p>
                <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.9 }}>Online</p>
              </div>
            </div>

            <button
              aria-label="Logout"
              title="Logout"
              onClick={handleLogout}
              style={{
                backgroundColor: '#FCD34D',
                color: '#1E40AF',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: '0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FDE68A')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FCD34D')}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        {/* ✅ Mobile scanner shortcut */}
        {isMobile && (
          <button
            onClick={() => navigate('/security/scanner')}
            aria-label="Open Scanner"
            style={{
              backgroundColor: '#FCD34D',
              color: '#1E40AF',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              transition: '0.2s',
            }}
          >
            <Scan size={22} />
          </button>
        )}
      </nav>

      {/* Mobile Sidebar */}
      {isMobile && (
        <>
          {sidebarOpen && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 900,
                backdropFilter: 'blur(2px)',
              }}
              onClick={closeSidebar}
            ></div>
          )}

          <aside
            style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              height: 'calc(100vh - 40px)',
              width: 'min(320px, calc(75% - 20px))',
              backgroundColor: '#1E40AF',
              color: 'white',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              transform: sidebarOpen ? 'translateX(0)' : 'translateX(-120%)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <SidebarContent handleLogout={handleLogout} toggleSidebar={toggleSidebar} closeSidebar={closeSidebar} isActive={isActive} />
          </aside>
        </>
      )}

      {/* Page Content */}
      <main
        style={{
          flexGrow: 1,
          padding: '0rem',
          backgroundColor: '#f9fafb',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: '1800px',
            width: '100%',
            margin: '0 auto',
            paddingTop: isMobile ? '80px' : '100px',
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, to, isActive, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      borderRadius: '9999px',
      textDecoration: 'none',
      color: isActive ? '#1E40AF' : '#DBEAFE',
      backgroundColor: isActive ? '#FCD34D' : 'transparent',
      fontWeight: isActive ? '600' : '500',
      fontSize: '0.875rem',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
    }}
  >
    {icon}
    <span>{label}</span>
  </Link>
);

const SidebarContent = ({ handleLogout, toggleSidebar, closeSidebar, isActive }) => (
  <>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        backgroundColor: '#1E3A8A',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            backgroundColor: '#FCD34D',
            padding: '0.5rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={28} color="#1E40AF" />
        </div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.95rem', lineHeight: 1 }}>Security</div>
          <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>Dashboard</div>
        </div>
      </div>
      <button
        onClick={toggleSidebar}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '0.5rem',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: '0.2s',
        }}
      >
        <X size={24} />
      </button>
    </div>

    <div style={{ padding: '0.75rem 0', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <nav
        style={{
          padding: '0.75rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        <SidebarNavItem icon={<Scan size={20} />} label="QR Scanner" to="/security/scanner" isActive={isActive('/scanner')} onClick={closeSidebar} />
        <SidebarNavItem icon={<FileCheck size={20} />} label="Active Passes" to="/security/passes" isActive={isActive('/passes')} onClick={closeSidebar} />
        <SidebarNavItem icon={<Users size={20} />} label="Visitors" to="/security/visitors" isActive={isActive('/visitors')} onClick={closeSidebar} />
        <SidebarNavItem icon={<ClipboardCheck size={20} />} label="Attendance" to="/security/attendance" isActive={isActive('/attendance')} onClick={closeSidebar} />
      </nav>
    </div>

    <div
      style={{
        padding: '1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        backgroundColor: '#1E3A8A',
        borderRadius: '12px',
        margin: '1rem 0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#FCD34D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1E40AF',
            }}
          >
            <Shield size={20} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'white', fontWeight: '600', fontSize: '0.875rem' }}>Security Guard</p>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>Online</p>
          </div>
        </div>
        <button
          aria-label="Logout"
          title="Logout"
          onClick={handleLogout}
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  </>
);

const SidebarNavItem = ({ icon, label, to, isActive, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '1rem 1.25rem',
      color: isActive ? '#FCD34D' : 'white',
      textDecoration: 'none',
      fontSize: '0.95rem',
      fontWeight: isActive ? '600' : '500',
      backgroundColor: isActive ? 'rgba(252,211,77,0.15)' : 'transparent',
      borderRadius: '12px',
      margin: '0 0.75rem',
      transition: '0.2s',
    }}
  >
    {icon}
    <span>{label}</span>
  </Link>
);

export default SecurityLayout;
