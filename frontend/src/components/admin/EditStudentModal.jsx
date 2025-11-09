import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';

const EditStudentModal = ({ show, onClose, student, onStudentUpdated }) => {
    const [formData, setFormData] = useState({
        name: '',
        branch: '',
        year: '',
        phoneNumber: '',
        email: '',
        parentMobileNumber: '',
        roomNumber: ''
    });
    const [availableRooms, setAvailableRooms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { token } = useAdmin();

    useEffect(() => {
        if (student) {
            setFormData({
                name: student.name || '',
                branch: student.branch || '',
                year: student.year || '',
                phoneNumber: student.phoneNumber || '',
                email: student.email || '',
                parentMobileNumber: student.parentMobileNumber || '',
                roomNumber: student.room || ''  // Fixed: use student.room instead of student.roomNumber
            });
            fetchAvailableRooms();
        }
    }, [student]);

    const fetchAvailableRooms = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/rooms`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            // Filter rooms that have space or include the current student's room
            const rooms = response.data.filter(room => 
                room.occupants.length < room.capacity || 
                room.roomNumber === student?.room  // Fixed: use student.room instead of student.roomNumber
            );
            
            setAvailableRooms(rooms);
        } catch (err) {
            console.error('Failed to fetch available rooms', err);
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
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const response = await axios.put(
                `${import.meta.env.VITE_SERVER_URL}/admin-api/update-student/${student._id}`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            setSuccess('Student updated successfully!');
            if (onStudentUpdated) {
                onStudentUpdated(response.data.student);
            }
            
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update student');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header bg-primary text-white">
                        <h5 className="modal-title">Edit Student: {student?.name}</h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={onClose}
                            disabled={loading}
                        ></button>
                    </div>
                    <div className="modal-body">
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
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="name" className="form-label">Full Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="branch" className="form-label">Branch</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="branch"
                                        name="branch"
                                        value={formData.branch}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label htmlFor="year" className="form-label">Year</label>
                                    <select
                                        className="form-select"
                                        id="year"
                                        name="year"
                                        value={formData.year}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="">Select</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label htmlFor="phoneNumber" className="form-label">Phone Number</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        value={formData.phoneNumber}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label htmlFor="parentMobileNumber" className="form-label">Parent's Phone</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="parentMobileNumber"
                                        name="parentMobileNumber"
                                        value={formData.parentMobileNumber}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="email" className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="roomNumber" className="form-label">Room Number</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="roomNumber"
                                        name="roomNumber"
                                        value={formData.roomNumber}
                                        onChange={handleInputChange}
                                        list="editRoomNumberList"
                                        placeholder="Type room number or leave empty..."
                                        autoComplete="off"
                                    />
                                    <datalist id="editRoomNumberList">
                                        <option value="">No Room (Unassigned)</option>
                                        {availableRooms.map(room => (
                                            <option key={room._id} value={room.roomNumber}>
                                                Room {room.roomNumber} ({room.occupants.length}/{room.capacity} occupied)
                                            </option>
                                        ))}
                                    </datalist>
                                    <small className="form-text text-muted">Type to search or leave empty to unassign</small>
                                </div>
                            </div>
                            <div className="d-flex justify-content-end mt-4">
                                <button
                                    type="button"
                                    className="btn btn-secondary me-2"
                                    onClick={onClose}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Updating...
                                        </>
                                    ) : 'Update Student'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditStudentModal;
