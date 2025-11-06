import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';

const Announcements = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const { token } = useAdmin();

    const [formData, setFormData] = useState({
        title: '',
        description: ''
    });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => {
        fetchAnnouncements();
    }, [token]);

    // Close modal on Escape key
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && showForm) {
                resetForm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showForm]);

    const isSameDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const isToday = (dateStr) => {
        const d = new Date(dateStr);
        return isSameDay(new Date(), d);
    };

    const isYesterday = (dateStr) => {
        const d = new Date(dateStr);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return isSameDay(yesterday, d);
    };

    const formatDateDisplay = (dateStr) => {
        const d = new Date(dateStr);
        if (isToday(dateStr)) {
            return `Today, ${d.toLocaleTimeString()}`;
        }
        if (isYesterday(dateStr)) {
            return `Yesterday, ${d.toLocaleTimeString()}`;
        }
        return d.toLocaleString();
    };

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/all-announcements`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            // Ensure newest announcements appear first
            const data = Array.isArray(response.data) ? response.data.slice().sort((a, b) => {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }) : response.data;
            setAnnouncements(data);
            setError('');
        } catch (err) {
            setError('Failed to load announcements');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Use FormData to support optional image upload
            const payload = new FormData();
            payload.append('title', formData.title);
            payload.append('description', formData.description);
            if (imageFile) payload.append('image', imageFile);

            if (editingId) {
                await axios.put(`${import.meta.env.VITE_SERVER_URL}/admin-api/edit-announcement/${editingId}`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
            } else {
                await axios.post(`${import.meta.env.VITE_SERVER_URL}/admin-api/post-announcement`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
            }

            fetchAnnouncements();
            resetForm();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save announcement');
            console.error(err);
        }
    };

    const handleEdit = (announcement) => {
        setFormData({
            title: announcement.title,
            description: announcement.description
        });
        setImageFile(null);
        setEditingId(announcement._id);
        setShowForm(true);
        window.scrollTo(0, 0);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this announcement? This action cannot be undone.')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_SERVER_URL}/admin-api/delete-announcement/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAnnouncements();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete announcement');
            console.error(err);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: ''
        });
        setEditingId(null);
        setShowForm(false);
        setImageFile(null);
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Announcements</h2>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        resetForm();
                        setShowForm(!showForm);
                    }}
                >
                    {showForm ? 'Cancel' : 'Create Announcement'}
                </button>
            </div>

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            {/* Modal form */}
            {showForm && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1050
                    }}
                    onClick={() => resetForm()}
                >
                    <div style={{ width: '90%', maxWidth: 800 }} onClick={e => e.stopPropagation()}>
                        <div className="card mb-4">
                            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                                <h5 className="mb-0">{editingId ? 'Edit Announcement' : 'Create New Announcement'}</h5>
                                <button className="btn btn-sm btn-light" onClick={resetForm}>Close</button>
                            </div>
                            <div className="card-body">
                                <form onSubmit={handleSubmit}>
                                    <div className="mb-3">
                                        <label htmlFor="title" className="form-label">Title</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="title"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleInputChange}
                                            required
                                            disabled={editingId}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="description" className="form-label">Description</label>
                                        <textarea
                                            className="form-control"
                                            id="description"
                                            name="description"
                                            rows="5"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            required
                                        ></textarea>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="image" className="form-label">Image (optional)</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="form-control"
                                            id="image"
                                            onChange={(e) => setImageFile(e.target.files[0] || null)}
                                        />
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button type="submit" className="btn btn-primary">
                                            {editingId ? 'Update Announcement' : 'Post Announcement'}
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={resetForm}>
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header bg-light">
                    <h5 className="mb-0">All Announcements</h5>
                </div>
                <div className="card-body">
                    {loading ? (
                        <div className="text-center my-4">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : announcements.length === 0 ? (
                        <div className="alert alert-info" role="alert">
                            No announcements found.
                        </div>
                    ) : (
                        <div className="list-group">
                            {announcements.map(announcement => (
                                <div key={announcement._id} className="list-group-item list-group-item-action">
                                    <div className="d-flex w-100 justify-content-between">
                                        <h5 className="mb-1">{announcement.title}</h5>
                                        <small>{formatDateDisplay(announcement.createdAt)}</small>
                                    </div>
                                    <p className="mb-1">{announcement.description}</p>
                                    <div className="d-flex justify-content-end gap-2 mt-2">
                                        {isToday(announcement.createdAt) && (
                                            <button
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => handleEdit(announcement)}
                                            >
                                                Edit
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleDelete(announcement._id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Announcements;
