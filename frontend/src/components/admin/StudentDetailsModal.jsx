import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';
import EditStudentModal from './EditStudentModal';

const StudentDetailsModal = ({ show, onClose, rollNumber, onStudentUpdated }) => {
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const { token } = useAdmin();

    useEffect(() => {
        if (show && rollNumber) {
            fetchStudentDetails();
        }
    }, [show, rollNumber, token]);

    const fetchStudentDetails = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/student-details/${rollNumber}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setStudent(response.data);
            setError('');
        } catch (err) {
            setError('Failed to load student details');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStudentUpdated = (updatedStudent) => {
        setStudent(updatedStudent);
        if (onStudentUpdated) {
            onStudentUpdated(updatedStudent);
        }
    };

    if (!show) return null;

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header bg-primary text-white">
                        <h5 className="modal-title">Student Details</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        {loading ? (
                            <div className="text-center my-4">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="alert alert-danger" role="alert">
                                {error}
                            </div>
                        ) : student ? (
                            <div className="row">
                                <div className="col-md-4 text-center mb-4">
                                    {student.profilePhoto ? (
                                        <img
                                            src={student.profilePhoto}
                                            alt={student.name}
                                            className="img-fluid rounded-circle mb-3"
                                            style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div
                                            className="rounded-circle bg-secondary d-flex align-items-center justify-content-center mb-3 mx-auto"
                                            style={{ width: '150px', height: '150px' }}
                                        >
                                            <span className="text-white display-4">
                                                {student.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <h4>{student.name}</h4>
                                    <p className="badge bg-info">{student.rollNumber}</p>
                                </div>
                                <div className="col-md-8">
                                    <div className="row mb-2">
                                        <div className="col-md-6">
                                            <h6 className="fw-bold">Branch:</h6>
                                            <p>{student.branch}</p>
                                        </div>
                                        <div className="col-md-6">
                                            <h6 className="fw-bold">Year:</h6>
                                            <p>{student.year}</p>
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <div className="col-md-6">
                                            <h6 className="fw-bold">Room Number:</h6>
                                            <p>{student.room || 'Not assigned'}</p>
                                        </div>
                                        <div className="col-md-6">
                                            <h6 className="fw-bold">Email:</h6>
                                            <p>{student.email}</p>
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <div className="col-md-6">
                                            <h6 className="fw-bold">Phone Number:</h6>
                                            <p>{student.phoneNumber}</p>
                                        </div>
                                        <div className="col-md-6">
                                            <h6 className="fw-bold">Parent's Phone Number:</h6>
                                            <p className="text-danger fw-bold">{student.parentMobileNumber}</p>
                                        </div>
                                    </div>
                                    <div className="row mb-2">
                                        <div className="col-12">
                                            <h6 className="fw-bold">Account Status:</h6>
                                            <p>
                                                <span className={`badge ${student.is_active ? 'bg-success' : 'bg-danger'}`}>
                                                    {student.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="alert alert-info" role="alert">
                                No student data found.
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        {student && (
                            <button
                                type="button"
                                className="btn btn-primary me-auto"
                                onClick={() => setShowEditModal(true)}
                            >
                                Edit Student
                            </button>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                    </div>

                    {/* Edit Student Modal */}
                    {showEditModal && student && (
                        <EditStudentModal
                            show={showEditModal}
                            onClose={() => setShowEditModal(false)}
                            student={student}
                            onStudentUpdated={handleStudentUpdated}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentDetailsModal;
