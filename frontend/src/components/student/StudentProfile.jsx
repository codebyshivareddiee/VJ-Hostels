import React, { useState } from 'react';
import axios from 'axios';
import useCurrentUser from '../../hooks/student/useCurrentUser';
import { toast } from 'react-hot-toast';

function StudentProfile() {
  const { user, loading, updateUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('details');

  // State for password change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [profileData, setProfileData] = useState({
    phoneNumber: user?.phoneNumber || '',
    parentMobileNumber: user?.parentMobileNumber || '',
  });

  // Update profile data when user changes
  React.useEffect(() => {
    if (user) {
      setProfileData({
        phoneNumber: user.phoneNumber || '',
        parentMobileNumber: user.parentMobileNumber || '',
      });
    }
  }, [user]);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // State for profile photo
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Handle password input changes
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
  };

  // Handle password form submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    // Reset messages
    setPasswordError('');
    setPasswordSuccess('');

    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await axios.put(`${import.meta.env.VITE_SERVER_URL}/student-api/change-password`, {
        rollNumber: user.rollNumber,
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordSuccess(response.data.message || 'Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);

      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setPhotoError('Please select a file to upload');
      return;
    }

    setPhotoLoading(true);
    setPhotoError('');
    setPhotoSuccess('');

    try {
      const formData = new FormData();
      formData.append('profilePhoto', selectedFile);
      formData.append('rollNumber', user.rollNumber);

      const response = await axios.put(
        `${import.meta.env.VITE_SERVER_URL}/student-api/update-profile-photo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Update user data with new profile photo
      updateUser({
        ...user,
        profilePhoto: response.data.profilePhoto
      });

      setPhotoSuccess('Profile photo updated successfully');
      setSelectedFile(null);
    } catch (error) {
      setPhotoError(error.response?.data?.message || 'Failed to upload profile photo');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_SERVER_URL}/student-api/update-profile/${user.rollNumber}`,
        profileData
      );
      if (response.data.success) {
        updateUser({ ...user, ...profileData });
        toast.success('Profile updated successfully');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Student Profile</h2>

      {/* Profile Photo */}
      <div style={styles.photoContainer}>
        {previewUrl ? (
          <img src={previewUrl} alt="Profile Preview" style={styles.image} />
        ) : user && user.profilePhoto ? (
          <img src={user.profilePhoto} alt="Profile" style={styles.image} />
        ) : (
          <div style={styles.placeholderImage}>
            {user && user.name ? user.name.charAt(0).toUpperCase() : 'S'}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabContainer}>
        <button
          style={activeTab === 'details' ? {...styles.tabButton, ...styles.activeTab} : styles.tabButton}
          onClick={() => setActiveTab('details')}
        >
          Student Details
        </button>
      </div>

      {/* Student Details Tab */}
      {activeTab === 'details' && (
        <div style={styles.infoContainer}>
          <p><strong>Name:</strong> {user?.name || 'N/A'}</p>
          <p><strong>Roll Number:</strong> {user?.rollNumber || 'N/A'}</p>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Department:</strong> {user?.branch || 'N/A'}</p>
          <p><strong>Year:</strong> {user?.year || 'N/A'}</p>
          <p><strong>Phone Number:</strong> {user?.phoneNumber || 'N/A'}</p>
          <p><strong>Parent's Mobile Number:</strong> {user?.parentMobileNumber || 'N/A'}</p>
          <p><strong>Room:</strong> {user?.room || 'N/A'}</p>
        </div>
      )}

      {/* Update Photo Tab */}
      {activeTab === 'photo' && (
        <div style={styles.formContainer}>
          <h3 style={styles.subHeader}>Update Profile Photo</h3>

          {photoError && <p style={styles.errorText}>{photoError}</p>}
          {photoSuccess && <p style={styles.successText}>{photoSuccess}</p>}

          <form onSubmit={handlePhotoUpload}>
            <div style={styles.formGroup}>
              <label htmlFor="profilePhoto" style={styles.label}>Select Photo</label>
              <input
                type="file"
                id="profilePhoto"
                accept="image/*"
                onChange={handleFileChange}
                style={styles.fileInput}
              />
            </div>

            <button
              type="submit"
              style={styles.submitButton}
              disabled={photoLoading || !selectedFile}
            >
              {photoLoading ? 'Uploading...' : 'Upload Photo'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '2rem auto',
    padding: '2rem',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    borderRadius: '12px',
    backgroundColor: '#fff',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  subHeader: {
    marginBottom: '1.5rem',
    fontSize: '1.2rem',
    fontWeight: '500',
  },
  photoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  image: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #f0f0f0',
  },
  placeholderImage: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    backgroundColor: '#0D6EFD',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    fontWeight: 'bold',
  },
  tabContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '2rem',
    borderBottom: '1px solid #dee2e6',
  },
  tabButton: {
    padding: '0.75rem 1rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    color: '#6c757d',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s',
  },
  activeTab: {
    color: '#0D6EFD',
    borderBottom: '3px solid #0D6EFD',
  },
  infoContainer: {
    lineHeight: '1.8',
  },
  formContainer: {
    padding: '1rem 0',
  },
  formGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '1rem',
  },
  fileInput: {
    width: '100%',
    padding: '0.5rem 0',
  },
  submitButton: {
    backgroundColor: '#0D6EFD',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  errorText: {
    color: '#dc3545',
    marginBottom: '1rem',
    padding: '0.5rem',
    backgroundColor: '#f8d7da',
    borderRadius: '4px',
  },
  successText: {
    color: '#198754',
    marginBottom: '1rem',
    padding: '0.5rem',
    backgroundColor: '#d1e7dd',
    borderRadius: '4px',
  },
};

export default StudentProfile;
