import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';

const Outpasses = () => {
    const [outpasses, setOutpasses] = useState([]);
    const [uniqueYears, setUniqueYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    
    // Filter states
    const [filterType, setFilterType] = useState(''); // '' | 'home pass' | 'late pass'
    const [filterBatch, setFilterBatch] = useState(''); // year
    const [filterApprovalStatus, setFilterApprovalStatus] = useState('pending_admin_approval'); // 'pending_admin_approval' | 'pending_parent_approval'
    
    // Confirmation modal states
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmData, setConfirmData] = useState({
        outpassId: null,
        outpassName: '',
        action: null, // 'approved' or 'rejected'
        rejectionReason: '' // Admin rejection reason
    });
    
    const { token } = useAdmin();

    useEffect(() => {
        fetchOutpasses();
    }, [token]);

    const fetchOutpasses = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/all-outpasses`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            setOutpasses(response.data.outpasses || []);
            setUniqueYears(response.data.uniqueYears || []);
            setError('');
        } catch (err) {
            setError('Failed to load outpasses');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await axios.put(`${import.meta.env.VITE_SERVER_URL}/admin-api/update-outpass-status/${id}`,
                { status },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            fetchOutpasses();
        } catch (err) {
            setError(`Failed to ${status} outpass`);
            console.error(err);
        }
    };

    const openConfirmModal = (outpassId, outpassName, action) => {
        setConfirmData({
            outpassId,
            outpassName,
            action,
            rejectionReason: ''
        });
        setShowConfirmModal(true);
    };

    const handleConfirmAction = async () => {
        try {
            const payload = { 
                status: confirmData.action,
                rejectionReason: confirmData.rejectionReason || undefined
            };
            
            await axios.put(`${import.meta.env.VITE_SERVER_URL}/admin-api/update-outpass-status/${confirmData.outpassId}`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            setShowConfirmModal(false);
            fetchOutpasses();
        } catch (err) {
            setError(`Failed to ${confirmData.action} outpass`);
            console.error(err);
        }
    };

    // Apply all filters
    const filteredOutpasses = outpasses.filter(outpass => {
        // If showing history, only show approved/returned/out statuses
        if (showHistory) {
            if (!['approved', 'returned', 'out'].includes(outpass.status)) {
                return false;
            }
        } else {
            // In normal view (not history), only show pending statuses
            if (!['pending_admin_approval', 'pending_parent_approval'].includes(outpass.status)) {
                return false;
            }
            
            // Also filter by specific approval status if selected
            if (filterApprovalStatus && outpass.status !== filterApprovalStatus) {
                return false;
            }
        }
        
        // Search filter
        const matchesSearch = outpass.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            outpass.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            outpass.reason.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        // Type filter
        if (filterType && outpass.type !== filterType) return false;

        // Batch/Year filter - use studentYear field that comes from Student collection
        if (filterBatch && outpass.studentYear !== filterBatch) return false;

        return true;
    });

    const clearFilters = () => {
        setFilterType('');
        setFilterBatch('');
        setSearchTerm('');
        setFilterApprovalStatus('pending_admin_approval');
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Outpass Requests</h2>
                <button
                    className={`btn ${showHistory ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => setShowHistory(!showHistory)}
                >
                    <i className={`bi ${showHistory ? 'bi-arrow-left' : 'bi-clock-history'} me-2`}></i>
                    {showHistory ? 'Back to All Requests' : 'View History'}
                </button>
            </div>

            <div className="card">
                <div className="card-header bg-light">
                    <h5 className="mb-0">{showHistory ? 'Outpass History (Approved & Returned)' : 'Pending Outpass Requests'}</h5>
                </div>
                <div className="card-body">

                    {/* Filters Section */}
                    <div className="mb-4 p-3 bg-light rounded">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0">Filters</h6>
                            <button 
                                className="btn btn-sm btn-outline-secondary"
                                onClick={clearFilters}
                                title="Clear all filters"
                            >
                                <i className="bi bi-x-circle me-1"></i>
                                Clear Filters
                            </button>
                        </div>
                        <div className="row g-3">
                            {/* Approval Status Filter Dropdown */}
                            <div className="col-md-4">
                                <label className="form-label">Approval Status</label>
                                <select 
                                    className="form-select"
                                    value={filterApprovalStatus}
                                    onChange={(e) => setFilterApprovalStatus(e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="pending_admin_approval">Waiting Admin Approval</option>
                                    <option value="pending_parent_approval">Waiting Parent Approval</option>
                                </select>
                            </div>
                            {/* Type Filter */}
                            <div className="col-md-4">
                                <label className="form-label">Type</label>
                                <select 
                                    className="form-select"
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                >
                                    <option value="">All Types</option>
                                    <option value="home pass">Home Pass</option>
                                    <option value="late pass">Late Pass</option>
                                </select>
                            </div>

                            {/* Batch/Year Filter */}
                            <div className="col-md-4">
                                <label className="form-label">Batch</label>
                                <select 
                                    className="form-select"
                                    value={filterBatch}
                                    onChange={(e) => setFilterBatch(e.target.value)}
                                >
                                    <option value="">All Batches</option>
                                    {uniqueYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {/* Active filters indicator */}
                        {(filterType || filterBatch || filterApprovalStatus !== 'pending_admin_approval') && (
                            <div className="mt-2">
                                <small className="text-muted">
                                    Active filters: 
                                    {filterApprovalStatus === 'pending_parent_approval' && <span className="badge bg-info ms-1">Parent Approval Pending</span>}
                                    {filterType && <span className="badge bg-info ms-1">{filterType}</span>}
                                    {filterBatch && <span className="badge bg-info ms-1">Batch: {filterBatch}</span>}
                                </small>
                            </div>
                        )}
                    </div>
                    {/* Search Bar */}
                    <div className="mb-3">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search by name, roll number, or reason..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
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
                    ) : filteredOutpasses.length === 0 ? (
                        <div className="alert alert-info" role="alert">
                            {showHistory 
                                ? 'No outpass history found matching the current filters.' 
                                : 'No outpass requests found matching the current filters.'}
                        </div>
                    ) : (
                        <>
                            <div className="mb-2">
                                <small className="text-muted">
                                    Showing {filteredOutpasses.length} of {outpasses.length} outpass{outpasses.length !== 1 ? 'es' : ''}
                                    {showHistory && ' (History)'}
                                </small>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-striped table-hover">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Roll Number</th>
                                            <th>Type</th>
                                            <th>Out Time</th>
                                            <th>In Time</th>
                                            <th>Reason</th>
                                            <th>Contact</th>
                                            <th>Parent Approval</th>
                                            {!showHistory && <th>Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredOutpasses.map(outpass => (
                                            <tr key={outpass._id}>
                                                <td>{outpass.name}</td>
                                                <td>{outpass.rollNumber}</td>
                                                <td>
                                                    <span className={`badge ${outpass.type === 'home pass' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                                                        {outpass.type}
                                                    </span>
                                                </td>
                                                <td>{new Date(outpass.outTime).toLocaleString()}</td>
                                                <td>{new Date(outpass.inTime).toLocaleString()}</td>
                                                <td>{outpass.reason}</td>
                                                <td>
                                                    <div>Student: {outpass.studentMobileNumber}</div>
                                                    <div>Parent: {outpass.parentMobileNumber}</div>
                                                </td>
                                                <td>
                                                    {outpass.parentApproval?.status === 'approved' ? (
                                                        <span className="badge" title="Parent Approved">
                                                            ✅
                                                        </span>
                                                    ) : outpass.parentApproval?.status === 'rejected' ? (
                                                        <span className="badge" title="Parent Rejected">
                                                            ❌
                                                        </span>
                                                    ) : (
                                                        <span className="badge text-dark" title="Pending Parent Approval">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                {!showHistory && (
                                                    <td>
                                                        {(outpass.status === 'pending' || outpass.status === 'pending_admin_approval' || outpass.status === 'pending_parent_approval') ? (
                                                            <div className="d-flex gap-2">
                                                                <button
                                                                    className="btn btn-sm btn-success"
                                                                    onClick={() => openConfirmModal(outpass._id, outpass.name, 'approved')}
                                                                    title='Approve outpass'
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-danger"
                                                                    onClick={() => openConfirmModal(outpass._id, outpass.name, 'rejected')}
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted">-</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header" style={{
                                backgroundColor: confirmData.action === 'approved' ? '#28a745' : '#dc3545',
                                color: 'white'
                            }}>
                                <h5 className="modal-title">
                                    {confirmData.action === 'approved' ? '✓ Approve Outpass' : '✗ Reject Outpass'}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowConfirmModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-3">
                                    Are you sure you want to <strong>{confirmData.action}</strong> the outpass for <strong>{confirmData.outpassName}</strong>?
                                </p>
                                
                                {confirmData.action === 'rejected' && (
                                    <div className="mb-3">
                                        <label className="form-label">Rejection Reason (Optional)</label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            placeholder="Enter rejection reason..."
                                            value={confirmData.rejectionReason}
                                            onChange={(e) => setConfirmData({
                                                ...confirmData,
                                                rejectionReason: e.target.value
                                            })}
                                        ></textarea>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowConfirmModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${confirmData.action === 'approved' ? 'btn-success' : 'btn-danger'}`}
                                    onClick={handleConfirmAction}
                                >
                                    {confirmData.action === 'approved' ? 'Approve' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Outpasses;
