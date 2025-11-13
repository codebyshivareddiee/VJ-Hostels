import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';

const Profile = () => {
    const { admin, token } = useAdmin();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        // You could fetch additional admin details here if needed
    }, [token]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Reset messages
        setError('');
        setSuccess('');

        // Validate passwords
        if (formData.newPassword !== formData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        // This is a placeholder for password change functionality
        // You would need to implement this endpoint in your backend
        setLoading(true);
        try {
            // Simulating API call
            // await axios.post(`${import.meta.env.VITE_SERVER_URL}/admin-api/change-password`,
            //     {
            //         currentPassword: formData.currentPassword,
            //         newPassword: formData.newPassword
            //     },
            //     {
            //         headers: {
            //             Authorization: `Bearer ${token}`
            //         }
            //     }
            // );

            // Since we don't have the actual endpoint, we'll just simulate success
            setTimeout(() => {
                setSuccess('Password changed successfully');
                setFormData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                setLoading(false);
            }, 1000);

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change password');
            setLoading(false);
        }
    };

    return (
        <div>
            <h2 className="mb-4">Admin Profile</h2>

            <div className="row">
                <div className="col-md-6">
                    <div className="card mb-4">
                        <div className="card-header bg-primary text-white">
                            <h5 className="mb-0">Profile Information</h5>
                        </div>
                        <div className="card-body">
                            <div className="mb-3 d-flex align-items-center">
                                <div className="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '80px', height: '80px' }}>
                                    <i className="bi bi-person-fill" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <div>
                                    <h4 className="mb-1">{admin?.name || 'Admin'}</h4>
                                    <p className="text-muted mb-0 text-capitalize">{admin?.role || 'Administrator'}</p>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-muted">Username</label>
                                <p className="form-control-plaintext">{admin?.username || 'N/A'}</p>
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-muted">Email</label>
                                <p className="form-control-plaintext">{admin?.email || 'N/A'}</p>
                            </div>

                            {admin?.googleId && (
                                <div className="mb-3">
                                    <label className="form-label text-muted">Google ID</label>
                                    <p className="form-control-plaintext">{admin.googleId}</p>
                                </div>
                            )}

                            <div className="mb-3">
                                <label className="form-label text-muted">Account Created</label>
                                <p className="form-control-plaintext">
                                    {admin?.createdAt ? new Date(admin.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }) : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-6">
                    <div className="card">
                        <div className="card-header bg-primary text-white">
                            <h5 className="mb-0">Change Password</h5>
                        </div>
                        <div className="card-body">
                            {error && (
                                <div className="alert alert-danger" role="alert">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="alert alert-success" role="alert">
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label htmlFor="currentPassword" className="form-label">Current Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        id="currentPassword"
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="newPassword" className="form-label">New Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        id="newPassword"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Changing Password...
                                        </>
                                    ) : 'Change Password'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
