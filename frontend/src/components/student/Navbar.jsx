import { useState, useEffect } from 'react'
import useCurrentUser from '../../hooks/student/useCurrentUser'
import { Home, Bell, Users, MessageSquare, LogOut, User, Utensils, UserCheck, Menu, X, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import '../../styles/student/custom.css';

function Navbar({ onNavigate, isDesktop = false, isInSidebar = false }) {
    const { user, loading, clearUser } = useCurrentUser();
    const { logout } = useAuthStore();
    const location = useLocation();
    const [isMobile, setIsMobile] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false);


    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const handleNavClick = () => {
        if (onNavigate) {
            onNavigate();
        }
    };

    const handleLogout = () => {
        clearUser()
        localStorage.removeItem('token')
        localStorage.removeItem('auth-token')
        localStorage.removeItem('guard_token')
        
        // Redirect immediately
        window.location.href = '/login'
        
        // Call logout API in background (non-blocking)
        logout().catch(() => {})
    };
        
    if (isDesktop) {
        // Desktop horizontal navbar
        return (
            <div className="desktop-navbar" style={{ backgroundColor: '#4F46E5' }}>
                <nav className="desktop-nav-container">
                    <NavItem
                        icon={<Home size={18} />}
                        label="Home"
                        to=""
                        isActive={location.pathname === '/home' || location.pathname === '/home/'}
                        onClick={handleNavClick}
                        isDesktop={true}
                    />
                    <NavItem
                        icon={<Bell size={18} />}
                        label="Announcements"
                        to="announcements"
                        isActive={location.pathname.includes('/home/announcements')}
                        onClick={handleNavClick}
                        isDesktop={true}
                    />
                    <NavItem
                        icon={<MessageSquare size={18} />}
                        label="Complaints"
                        to="complaints"
                        isActive={location.pathname.includes('/home/complaints')}
                        onClick={handleNavClick}
                        isDesktop={true}
                    />
                    <NavItem
                        icon={<LogOut size={18} />}
                        label="Outpass"
                        to="outpass"
                        isActive={location.pathname.includes('/home/outpass')}
                        onClick={handleNavClick}
                        isDesktop={true}
                    />
                    <NavItem
                        icon={<Utensils size={18} />}
                        label="Food"
                        to="food"
                        isActive={location.pathname.includes('/home/food')}
                        onClick={handleNavClick}
                        isDesktop={true}
                    />
                    <NavItem
                        icon={<UserCheck size={18} />}
                        label="Visitors"
                        to="visitors"
                        isActive={location.pathname.includes('/home/visitors')}
                        onClick={handleNavClick}
                        isDesktop={true}
                    />
                    <NavItem
                        icon={<User size={18} />}
                        label="Profile"
                        to="profile"
                        isActive={location.pathname.includes('/home/profile')}
                        onClick={handleNavClick}
                        isDesktop={true}
                    />
                </nav>
            </div>
        );
    }

    // Mobile behaviour
    if (!isDesktop) {
        if (isInSidebar) {
            return (
                <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'transparent',
                    width: '100%'
                }}>
                    <nav style={{
                        padding: '0.75rem 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                    }}>
                        <SidebarNavItem label="Home" to="" isActive={location.pathname === '/home' || location.pathname === '/home/'} onClick={handleNavClick} />
                        <SidebarNavItem label="Announcements" to="announcements" isActive={location.pathname.includes('/home/announcements')} onClick={handleNavClick} />
                        <SidebarNavItem label="Complaints" to="complaints" isActive={location.pathname.includes('/home/complaints')} onClick={handleNavClick} />
                        <SidebarNavItem label="Outpass" to="outpass" isActive={location.pathname.includes('/home/outpass')} onClick={handleNavClick} />
                        <SidebarNavItem label="Student Profile" to="profile" isActive={location.pathname.includes('/home/profile')} onClick={handleNavClick} />
                        <SidebarNavItem label="Food" to="food" isActive={location.pathname.includes('/home/food')} onClick={handleNavClick} />
                        <SidebarNavItem label="Visitors" to="visitors" isActive={location.pathname.includes('/home/visitors')} onClick={handleNavClick} />
                    </nav>

                    <div style={{
                        padding: '1rem',
                        marginTop: '12.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: '#3730A3',
                        borderRadius: '12px',
                        margin: '1rem 0.75rem 0 0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {user && (
                                    <>
                                        {user.profilePhoto ? (
                                            <img src={user.profilePhoto} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255, 255, 255, 0.3)' }} />
                                        ) : (
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.125rem' }}>
                                                <span>{user.name ? user.name.charAt(0).toUpperCase() : 'S'}</span>
                                            </div>
                                        )}
                                        <div>
                                            <p style={{ margin: 0, color: 'white', fontWeight: '600', fontSize: '0.875rem' }}>{user.name || 'Student'}</p>
                                            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem' }}>ID: {user.rollNumber || 'N/A'}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <button
                                aria-label="Logout"
                                title="Logout"
                                onClick={handleLogout}
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
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
                                }}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )
        }
        return null;
    }
}

const NavItem = ({ icon, label, to, isActive, onClick, isDesktop = false }) => {
    const blue = '#1E3A8A'; // deep indigo blue

    if (isDesktop) {
        return (
            <Link
                to={to}
                className={`nav-item ${isActive ? 'active' : ''} desktop-nav-item`}
                onClick={onClick}
                title={label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                    color: isActive ? '#3B82F6' : '#E0E7FF'
                }}
            >
                <div className="icon-container">{icon}</div>
                <span className="fw-medium">{label}</span>
            </Link>
        );
    }

    return (
        <Link
            to={to}
            onClick={onClick}
            className={`nav-item mobile-nav-item ${isActive ? 'mobile-active' : ''}`}
            style={{
                color: isActive ? '#3B82F6' : 'white'
            }}
            onMouseEnter={(e) => {
                const el = e.currentTarget;
                if (!isActive) {
                    el.style.backgroundColor = 'rgba(59, 130, 246, 0.06)';
                    el.style.paddingLeft = '1.5rem';
                }
            }}
            onMouseLeave={(e) => {
                const el = e.currentTarget;
                if (!isActive) {
                    el.style.backgroundColor = 'transparent';
                    el.style.paddingLeft = '1.25rem';
                }
            }}
        >
            <div className="icon-container" style={{ minWidth: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
            </div>
            <span style={{
                fontWeight: isActive ? '600' : '500'
            }}>
                {label}
            </span>
        </Link>
    );
};

const SidebarNavItem = ({ label, to, isActive, onClick }) => {
    return (
        <Link
            to={to}
            onClick={onClick}
            className={`sidebar-large-item ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            style={{
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
                margin: '0 0.75rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
                if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.paddingLeft = '1.5rem'
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.paddingLeft = '1.25rem'
                }
            }}
        >
            <span className="sidebar-label">{label}</span>
            <ChevronRight size={18} className="sidebar-arrow" style={{ 
                opacity: isActive ? 1 : 0.6,
                transition: 'all 0.2s ease'
            }} />
        </Link>
    );
};

export default Navbar;