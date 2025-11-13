import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, Button, Modal, Form, Alert } from 'react-bootstrap';
import { Eye, Users, Clock, Calendar, Search, Filter, Download, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {FiRefreshCcw} from 'react-icons/fi';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL; // Add this at the top

const Visitors = () => {
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [visitHistory, setVisitHistory] = useState([]);
  const [pendingOverrides, setPendingOverrides] = useState([]);
  const [stats, setStats] = useState({
    totalVisitors: 0,
    activeVisitors: 0,
    todayVisitors: 0,
    thisWeekVisitors: 0,
    pendingOverrides: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedOverride, setSelectedOverride] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateVisitors, setDateVisitors] = useState([]);
  const [processingOverride, setProcessingOverride] = useState(false);

  useEffect(() => {
    loadVisitorData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadDateVisitors();
    }
  }, [selectedDate]);

  const loadVisitorData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');

      // if (!token) {
      //   alert('Admin authentication required');
      //   window.location.href = '/admin/login';
      //   return;
      // }

      const config = {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-access-role': 'admin'
        },
        withCredentials: true
      };

      try {
        const [activeResponse, statsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/admin/visitors/active`, config),
          axios.get(`${API_BASE_URL}/api/admin/visitors/stats`, config)
        ]);

        if (activeResponse.data.success) {
          setActiveVisitors(activeResponse.data.visitors || []);
        }

        if (statsResponse.data.success) {
          setStats(prevStats => ({
            ...prevStats,
            totalVisitors: statsResponse.data.stats.totalVisitors || 0,
            activeVisitors: statsResponse.data.stats.activeVisitors || 0,
            todayVisitors: statsResponse.data.stats.todayVisitors || 0,
            thisWeekVisitors: statsResponse.data.stats.thisWeekVisitors || 0
          }));
        }

        // Load overrides
        // const overridesResponse = await axios.get(
        //   `${API_BASE_URL}/api/admin/override/pending`,
        //   config
        // );

        // if (overridesResponse.data.success) {
        //   setPendingOverrides(overridesResponse.data.requests || []);
        //   setStats(prevStats => ({
        //     ...prevStats,
        //     pendingOverrides: overridesResponse.data.count || 0
        //   }));
        // }

        } catch (error) {
        if (error.response?.status === 403) {
          toast.error('Admin access required');
          window.location.href = '/admin/login';
        }
        throw error;
      }

    } catch (error) {
      console.error('Error loading visitor data:', error);
      if (error.response?.status === 403) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDateVisitors = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const config = {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-access-role': 'admin'
        },
        withCredentials: true
      };
      
      const response = await axios.get(
        `${API_BASE_URL}/api/admin/visitors/by-date?date=${selectedDate}`, 
        config
      );
      
      if (response.data.success) {
        setDateVisitors(response.data.visitors || []);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Session expired. Please login again.');
        window.location.href = '/admin/login';
      }
      setDateVisitors([]);
    }
  };

  const handleProcessOverride = async () => {
    if (!overrideDecision) {
      toast.error('Please select approve or reject');
      return;
    }

    try {
      setProcessingOverride(true);
      const token = localStorage.getItem('adminToken');
      
      const config = {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-access-role': 'admin'
        },
        withCredentials: true
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/admin/override/${selectedOverride._id}/process`,
        {
          status: overrideDecision,
          notes: overrideNotes
        },
        config
      );

      if (response.data.success) {
        toast.success(`Override request ${overrideDecision}!`);
        setShowOverrideModal(false);
        setOverrideDecision('');
        setOverrideNotes('');
        setSelectedOverride(null);
        loadVisitorData();
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('You do not have permission to process overrides');
        window.location.href = '/admin/login';
      }
      console.error('Error processing override:', error);
    } finally {
      setProcessingOverride(false);
    }
  };

  const formatDuration = (entryTime, exitTime) => {
    if (!exitTime) return 'Ongoing';
    
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const duration = exit - entry;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (visit) => {
    if (!visit.exitTime) {
      return <Badge bg="success">Active</Badge>;
    }
    return <Badge bg="secondary">Completed</Badge>;
  };

  const getUrgencyBadge = (urgency) => {
    const colors = {
      'low': 'info',
      'medium': 'warning',
      'high': 'danger'
    };
    return <Badge bg={colors[urgency] || 'secondary'}>{urgency.toUpperCase()}</Badge>;
  };

  const handleViewDetails = (visit) => {
    setSelectedVisit(visit);
    setShowDetailsModal(true);
  };

  const handleOverrideDetails = (override) => {
    setSelectedOverride(override);
    setShowOverrideModal(true);
  };

  const filteredDateVisitors = dateVisitors.filter(visitor => 
    visitor.visitorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visitor.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visitor.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Users className="me-2" size={28} />
          Visitor Management
        </h2>
        <Button variant="outline-primary" onClick={loadVisitorData}>
          <FiRefreshCcw size={16} className="me-1" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <div className="text-primary mb-2">
                <Users size={32} />
              </div>
              <h4 className="mb-1">{stats.totalVisitors}</h4>
              <small className="text-muted">Total Visitors</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <div className="text-success mb-2">
                <Clock size={32} />
              </div>
              <h4 className="mb-1">{stats.activeVisitors}</h4>
              <small className="text-muted">Active Visitors</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <div className="text-info mb-2">
                <Calendar size={32} />
              </div>
              <h4 className="mb-1">{stats.todayVisitors}</h4>
              <small className="text-muted">Today's Visitors</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Pending Override Requests */}
      {pendingOverrides.length > 0 && (
        <Card className="mb-4 border-0 shadow-sm border-left border-warning">
          <Card.Header className="bg-warning text-dark">
            <h5 className="mb-0">
              <AlertCircle className="me-2" size={20} />
              Pending Override Requests ({pendingOverrides.length})
            </h5>
          </Card.Header>
          <Card.Body>
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Visitor Name</th>
                    <th>Student</th>
                    <th>Guard</th>
                    <th>Purpose</th>
                    <th>Urgency</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOverrides.map((override) => (
                    <tr key={override._id}>
                      <td>
                        <strong>{override.visitorName}</strong>
                      </td>
                      <td>{override.studentId?.name}</td>
                      <td>{override.guardId?.name}</td>
                      <td>{override.purpose}</td>
                      <td>{getUrgencyBadge(override.urgency)}</td>
                      <td>{new Date(override.requestedAt).toLocaleDateString()}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleOverrideDetails(override)}
                        >
                          <Eye size={14} className="me-1" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Active Visitors */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-success text-white">
          <h5 className="mb-0">
            <Clock className="me-2" size={20} />
            Active Visitors ({activeVisitors.length})
          </h5>
        </Card.Header>
        <Card.Body>
          {activeVisitors.length === 0 ? (
            <div className="text-center py-4">
              <Users size={48} className="text-muted mb-3" />
              <h6 className="text-muted">No active visitors</h6>
            </div>
          ) : (
            <div className="table-responsive">
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Visitor Name</th>
                    <th>Student</th>
                    <th>Purpose</th>
                    <th>Entry Time</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeVisitors.map((visit) => (
                    <tr key={visit._id}>
                      <td>
                        <strong>{visit.visitorName}</strong>
                        {visit.isGroupVisit && (
                          <Badge bg="info" className="ms-2">
                            Group ({visit.groupSize})
                          </Badge>
                        )}
                      </td>
                      <td>{visit.studentName}</td>
                      <td>{visit.purpose}</td>
                      <td>{new Date(visit.entryTime).toLocaleString()}</td>
                      <td>{formatDuration(visit.entryTime)}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleViewDetails(visit)}
                        >
                          <Eye size={14} className="me-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Date Selection and Visitors */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <Calendar className="me-2" size={20} />
              Visitors by Date
            </h5>
            <div className="d-flex gap-2 align-items-center">
              <label className="form-label mb-0 me-2">Select Date:</label>
              <Form.Control
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: '200px' }}
              />
              <Form.Control
                type="text"
                placeholder="Search visitors..."
                size="sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '200px' }}
              />
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <h6 className="text-primary">
              {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} - {filteredDateVisitors.length} visitors
            </h6>
          </div>
          
          {filteredDateVisitors.length === 0 ? (
            <div className="text-center py-5">
              <Calendar size={48} className="text-muted mb-3" />
              <h6 className="text-muted">No visitors found for this date</h6>
              <p className="text-muted small">
                Try selecting a different date or check if visitors were recorded
              </p>
            </div>
          ) : (
            <div className="row g-3">
              {filteredDateVisitors.map((visitor, index) => (
                <div key={index} className="col-md-6">
                  <div className="card border h-100">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="card-title text-primary mb-1">{visitor.visitorName}</h6>
                          {visitor.isGroupVisit && (
                            <Badge bg="info" className="mb-2">
                              Group Visit ({visitor.groupSize} people)
                            </Badge>
                          )}
                        </div>
                        <Badge bg={visitor.status === 'active' ? 'success' : 'secondary'}>
                          {visitor.status}
                        </Badge>
                      </div>
                      
                      <div className="mb-2">
                        <small className="text-muted d-block">
                          <strong>Student:</strong> {visitor.studentName}
                        </small>
                        <small className="text-muted d-block">
                          <strong>Purpose:</strong> {visitor.purpose}
                        </small>
                        {visitor.visitorPhone && (
                          <small className="text-muted d-block">
                            <strong>Phone:</strong> {visitor.visitorPhone}
                          </small>
                        )}
                      </div>
                      
                      <div className="border-top pt-2">
                        <small className="text-muted d-block">
                          <strong>Entry:</strong> {new Date(visitor.entryTime).toLocaleTimeString()}
                        </small>
                        {visitor.exitTime && (
                          <small className="text-muted d-block">
                            <strong>Exit:</strong> {new Date(visitor.exitTime).toLocaleTimeString()}
                          </small>
                        )}
                        <small className="text-muted d-block">
                          <strong>Duration:</strong> {formatDuration(visitor.entryTime, visitor.exitTime)}
                        </small>
                      </div>
                      
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="mt-2 w-100"
                        onClick={() => handleViewDetails(visitor)}
                      >
                        <Eye size={14} className="me-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Override Details Modal */}
      <Modal show={showOverrideModal} onHide={() => setShowOverrideModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Override Request Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedOverride && (
            <>
              <Alert variant="warning" className="d-flex align-items-center">
                <AlertCircle className="me-2" size={20} />
                <span>This is an out-of-hours visit request requiring your approval.</span>
              </Alert>
              
              <Row className="mb-3">
                <Col md={6}>
                  <h6>Visitor Information</h6>
                  <p><strong>Name:</strong> {selectedOverride.visitorName}</p>
                  <p><strong>Phone:</strong> {selectedOverride.visitorPhone}</p>
                  <p><strong>Purpose:</strong> {selectedOverride.purpose}</p>
                </Col>
                <Col md={6}>
                  <h6>Request Information</h6>
                  <p><strong>Student:</strong> {selectedOverride.studentId?.name}</p>
                  <p><strong>Guard:</strong> {selectedOverride.guardId?.name}</p>
                  <p><strong>Urgency:</strong> {getUrgencyBadge(selectedOverride.urgency)}</p>
                  <p><strong>Requested:</strong> {new Date(selectedOverride.requestedAt).toLocaleString()}</p>
                </Col>
              </Row>

              <h6>Decision</h6>
              <Form.Group className="mb-3">
                <Form.Check
                  type="radio"
                  label="Approve Request"
                  name="decision"
                  value="approved"
                  checked={overrideDecision === 'approved'}
                  onChange={(e) => setOverrideDecision(e.target.value)}
                />
                <Form.Check
                  type="radio"
                  label="Reject Request"
                  name="decision"
                  value="rejected"
                  checked={overrideDecision === 'rejected'}
                  onChange={(e) => setOverrideDecision(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Notes (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Add any notes regarding this decision..."
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowOverrideModal(false)}>
            Close
          </Button>
          <Button
            variant={overrideDecision === 'approved' ? 'success' : 'danger'}
            onClick={handleProcessOverride}
            disabled={!overrideDecision || processingOverride}
          >
            {processingOverride ? 'Processing...' : 'Submit Decision'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Visit Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Visit Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedVisit && (
            <Row>
              <Col md={6}>
                <h6>Visitor Information</h6>
                <p><strong>Name:</strong> {selectedVisit.visitorName}</p>
                <p><strong>Phone:</strong> {selectedVisit.visitorPhone || 'N/A'}</p>
                <p><strong>Purpose:</strong> {selectedVisit.purpose}</p>
                {selectedVisit.isGroupVisit && (
                  <p><strong>Group Size:</strong> {selectedVisit.groupSize} people</p>
                )}
              </Col>
              <Col md={6}>
                <h6>Visit Information</h6>
                <p><strong>Student:</strong> {selectedVisit.studentName}</p>
                <p><strong>Entry Time:</strong> {new Date(selectedVisit.entryTime).toLocaleString()}</p>
                <p><strong>Exit Time:</strong> {
                  selectedVisit.exitTime 
                    ? new Date(selectedVisit.exitTime).toLocaleString()
                    : 'Still visiting'
                }</p>
                <p><strong>Duration:</strong> {formatDuration(selectedVisit.entryTime, selectedVisit.exitTime)}</p>
                <p><strong>Status:</strong> {getStatusBadge(selectedVisit)}</p>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Visitors;
