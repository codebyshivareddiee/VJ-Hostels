import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X, LogOut } from 'lucide-react'
import Navbar from '../components/student/Navbar'
import useCurrentUser from '../hooks/student/useCurrentUser'
import { useAuthStore } from '../store/authStore'
import '../styles/student/custom.css'
import logo from '../assets/vnrvjiet-logo.png'

function StudentLayout() {
  const location = useLocation()
  const { clearUser } = useCurrentUser()
  const { logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [scrolled, setScrolled] = useState(false)

  const handleLogout = () => {
    // Clear state immediately
    clearUser()
    localStorage.removeItem('token')
    localStorage.removeItem('auth-token')
    localStorage.removeItem('guard_token')
    
    // Redirect immediately
    window.location.href = '/login'
    
    // Call logout API in background (non-blocking)
    logout().catch(() => {})
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const closeSidebar = () => isMobile && setSidebarOpen(false)

  return (
    <div className="relative min-h-screen flex flex-col bg-[#f9fafb]">
      
      {/* Floating Overlay Navbar */}
      <nav
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#4F46E5',
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
          zIndex: 50,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Left section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
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
            <img
              src={logo}
              alt="VJ Hostels"
              style={{ height: '36px', width: 'auto', borderRadius: '8px' }}
            />
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                letterSpacing: '0.02em',
                margin: 0,
              }}
            >
              VJ Hostels
            </h1>
          </div>
        </div>

        {/* Center section */}
        {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Navbar onNavigate={closeSidebar} isDesktop={true} />
          </div>
        )}

        {/* Logout button - hidden on mobile */}
        {!isMobile && (
          <button
            aria-label="Logout"
            title="Logout"
            onClick={handleLogout}
            style={{
              backgroundColor: 'white',
              color: '#4F46E5',
              borderRadius: '999px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3e8e8'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <LogOut size={18} />
          </button>
        )}
      </nav>

      {/* Mobile Sidebar */}
      {isMobile && (
        <>
          {/* Overlay - behind sidebar */}
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

          {/* Sidebar - highest z-index */}
          <aside
            style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              height: 'calc(100vh - 40px)',
              width: 'min(320px, calc(75% - 20px))',
              backgroundColor: '#4F46E5',
              color: 'white',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              transform: sidebarOpen ? 'translateX(0)' : 'translateX(-120%)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            aria-hidden={!sidebarOpen}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: '#3730A3',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={logo} alt="VJ Hostels" style={{ height: '42px', width: 'auto' }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', lineHeight: 1 }}>VNRVJIET</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>Student Portal</div>
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
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'
                }}
                aria-label="Close sidebar"
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: '0.75rem 0', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Navbar onNavigate={closeSidebar} isDesktop={false} isInSidebar={true} />
            </div>
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
          position: 'relative',
          zIndex: 1,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            maxWidth: '1800px',
            width: '100%',
            margin: '0 auto',
            marginTop: '0px',
            paddingTop: (location.pathname === '/home' || location.pathname === '/home/' || location.pathname === '/student' || location.pathname === '/student/') ? '0px' : (isMobile ? '80px' : '100px'),
            overflow: 'visible',
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default StudentLayout