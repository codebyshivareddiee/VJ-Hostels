import { useEffect } from 'react';

/**
 * SEO Component for managing dynamic meta tags
 * @param {Object} props - SEO configuration
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} props.keywords - Page keywords
 * @param {string} props.image - OG image URL
 * @param {string} props.url - Canonical URL
 * @param {string} props.type - OG type (default: website)
 */
const SEO = ({
  title = 'VNR Hostel Management System',
  description = 'Comprehensive hostel management system for VNR VJIET',
  keywords = 'VNR hostel, VNRVJIET, hostel management, student portal',
  image = '/logo.png',
  url = window.location.href,
  type = 'website'
}) => {
  useEffect(() => {
    // Update title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (attribute, attributeValue, content) => {
      let element = document.querySelector(`meta[${attribute}="${attributeValue}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, attributeValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Basic meta tags
    updateMetaTag('name', 'title', title);
    updateMetaTag('name', 'description', description);
    updateMetaTag('name', 'keywords', keywords);

    // Open Graph tags
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:image', image);
    updateMetaTag('property', 'og:url', url);
    updateMetaTag('property', 'og:type', type);

    // Twitter tags
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', image);
    updateMetaTag('name', 'twitter:url', url);

    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }, [title, description, keywords, image, url, type]);

  return null;
};

export default SEO;

/**
 * Page-specific SEO configurations
 */
export const SEO_CONFIGS = {
  login: {
    title: 'Login | VNR Hostel Management System',
    description: 'Login to VNR Hostel Management System. Access student portal, admin panel, or security dashboard.',
    keywords: 'VNR hostel login, student login, admin login, hostel portal',
  },
  studentDashboard: {
    title: 'Student Dashboard | VNR Hostel',
    description: 'Access your hostel dashboard. View room details, apply for outpass, submit complaints, and connect with community.',
    keywords: 'student dashboard, hostel room, outpass, complaints, community',
  },
  adminDashboard: {
    title: 'Admin Dashboard | VNR Hostel Management',
    description: 'Manage hostel operations. Monitor students, allocate rooms, approve outpasses, and handle complaints.',
    keywords: 'admin dashboard, hostel management, room allocation, student management',
  },
  securityDashboard: {
    title: 'Security Dashboard | VNR Hostel',
    description: 'Security portal for managing visitor entries, scanning QR codes, and monitoring active outpasses.',
    keywords: 'security dashboard, visitor management, outpass verification, QR scanner',
  },
  outpass: {
    title: 'Outpass Management | VNR Hostel',
    description: 'Apply for outpass, track status, and manage your leave requests easily.',
    keywords: 'outpass, leave application, hostel exit, student outpass',
  },
  complaints: {
    title: 'Complaints & Issues | VNR Hostel',
    description: 'Submit and track your hostel complaints. Get quick resolution for room, food, and facility issues.',
    keywords: 'hostel complaints, maintenance issues, food complaints, facility issues',
  },
  food: {
    title: 'Food Services | VNR Hostel',
    description: 'View menu, provide feedback, and manage your food preferences in the hostel mess.',
    keywords: 'hostel food, mess menu, food feedback, dining services',
  },
  community: {
    title: 'Community | VNR Hostel',
    description: 'Connect with fellow students, share experiences, and stay updated with hostel community.',
    keywords: 'student community, hostel community, student posts, social network',
  },
  announcements: {
    title: 'Announcements | VNR Hostel',
    description: 'Stay updated with latest hostel announcements, notices, and important information.',
    keywords: 'hostel announcements, notices, hostel news, important updates',
  },
  rooms: {
    title: 'Room Management | VNR Hostel',
    description: 'View room details, check occupancy, and manage room allocations.',
    keywords: 'hostel rooms, room allocation, room occupancy, dormitory',
  },
  students: {
    title: 'Student Management | VNR Hostel Admin',
    description: 'Manage student records, registrations, and hostel assignments.',
    keywords: 'student management, student records, hostel registration',
  },
  visitors: {
    title: 'Visitor Management | VNR Hostel Security',
    description: 'Manage visitor entries, track visits, and maintain security logs.',
    keywords: 'visitor management, guest entry, security logs, hostel visitors',
  },
  profile: {
    title: 'Profile | VNR Hostel',
    description: 'View and manage your profile information, update details, and change preferences.',
    keywords: 'student profile, profile settings, account management',
  }
};
