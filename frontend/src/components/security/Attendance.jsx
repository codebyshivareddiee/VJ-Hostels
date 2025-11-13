import { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Home, 
  LogOut, 
  Calendar,
  TrendingUp,
  Building,
  Save,
  ArrowLeft,
  AlertCircle,
  Search,
  Clock
} from 'lucide-react';
import axios from 'axios';
import './AttendanceStyles.css';

const Attendance = () => {
  const [view, setView] = useState('floor'); // Skip dashboard, go directly to floor view
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editedRooms, setEditedRooms] = useState(new Set()); // Track which rooms have unsaved changes

  // Helper function to check if selected date is today
  const isToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return selectedDate === today;
  };

  // Filter and sort rooms based on search query and status
  const filteredRooms = rooms.filter(room => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    
    // Search by room number
    if (room.roomNumber.toLowerCase().includes(query)) return true;
    
    // Search by student names
    return room.students.some(student => 
      student.name.toLowerCase().includes(query) ||
      student.rollNumber.toLowerCase().includes(query)
    );
  }).sort((a, b) => {
    // Sort by room status: unmarked first, then marked
    const aIsMarked = a.isMarked;
    const bIsMarked = b.isMarked;
    
    // If one is unmarked and other is marked, prioritize unmarked
    if (!aIsMarked && bIsMarked) return -1; // a comes first
    if (aIsMarked && !bIsMarked) return 1;  // b comes first
    
    // If both have same marked status, sort by room number
    return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
  });

  useEffect(() => {
    fetchSummary();
    fetchFloors();
  }, [selectedDate]);

  useEffect(() => {
    if (selectedFloor !== null) {
      fetchRooms(selectedFloor);
    }
  }, [selectedFloor, selectedDate]);

  const getAuthHeaders = () => {
    // Check server URL
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    if (!serverUrl) {
      console.error('VITE_SERVER_URL environment variable is not set');
      showNotification('Server configuration error. Please contact administrator.', 'error');
    } else {
      console.log('Using server URL:', serverUrl);
    }

    // Check for guard_token first (security login), then fall back to token
    const token = localStorage.getItem('guard_token') || localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found in localStorage');
      showNotification('Authentication required. Please login again.', 'error');
    } else {
      // Decode token to check role (for debugging)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Using token with role:', payload.role, 'expires:', new Date(payload.exp * 1000));
        
        // Check if token is expired
        if (payload.exp * 1000 < Date.now()) {
          console.error('Token has expired');
          showNotification('Session expired. Please login again.', 'error');
        }
      } catch (e) {
        console.error('Failed to decode token:', e);
        showNotification('Invalid authentication token. Please login again.', 'error');
      }
    }
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/attendance-api/summary?date=${selectedDate}`,
        getAuthHeaders()
      );
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      showNotification('Failed to fetch attendance summary', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFloors = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/attendance-api/floors`,
        getAuthHeaders()
      );
      console.log('Floors response:', response.data);
      setFloors(response.data);
    } catch (error) {
      console.error('Error fetching floors:', error);
      console.error('Error details:', error.response?.data || error.message);
      showNotification(
        error.response?.data?.message || 'Failed to fetch floors. Please check console for details.',
        'error'
      );
    }
  };

  const fetchRooms = async (floorId) => {
    if (floorId === null || floorId === undefined) {
      console.error('No floor ID provided to fetchRooms');
      showNotification('Invalid floor selection. Please try again.', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching rooms for floor:', floorId, 'date:', selectedDate);
      
      const response = await axios.get(
        `${import.meta.env.VITE_SERVER_URL}/attendance-api/floor/${floorId}/rooms?date=${selectedDate}`,
        getAuthHeaders()
      );
      
      console.log('Rooms response:', response.data);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('Invalid rooms data received:', response.data);
        showNotification('Invalid data received from server. Please refresh and try again.', 'error');
        return;
      }
      
      setRooms(response.data);
      
      // Reset edited rooms state for new floor/date (isMarked comes from server)
      setEditedRooms(new Set());
    } catch (error) {
      console.error('Error fetching rooms:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      const errorMsg = error.response?.data?.message || 
                      error.response?.statusText || 
                      'Failed to fetch rooms. Please check your connection and try again.';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (roomId, studentId, newStatus) => {
    const updatedRooms = rooms.map(room => {
      if (room._id === roomId) {
        return {
          ...room,
          students: room.students.map(student => 
            student._id === studentId 
              ? { ...student, status: newStatus }
              : student
          )
        };
      }
      return room;
    });
    setRooms(updatedRooms);
    
    // Mark room as edited (has unsaved changes)
    setEditedRooms(prev => new Set([...prev, roomId]));
  };

  const saveRoomAttendance = async (room) => {
    // Prevent saving for past dates
    if (!isToday()) {
      showNotification('Cannot mark attendance for past dates. Only today\'s attendance can be marked.', 'error');
      return;
    }

    // Validate room data
    if (!room || !room.roomNumber || !room.students || !Array.isArray(room.students)) {
      console.error('Invalid room data:', room);
      showNotification('Invalid room data. Please refresh and try again.', 'error');
      return;
    }

    // Validate students data
    const invalidStudents = room.students.filter(student => 
      !student._id || !student.rollNumber || !student.name || !student.status
    );
    
    if (invalidStudents.length > 0) {
      console.error('Invalid student data found:', invalidStudents);
      showNotification('Invalid student data found. Please refresh and try again.', 'error');
      return;
    }

    try {
      setSaving(true);
      const studentsData = room.students.map(student => ({
        studentId: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        status: student.status
      }));

      const requestData = {
        roomNumber: room.roomNumber,
        floor: selectedFloor, // Use selectedFloor instead of room.floor for consistency
        students: studentsData,
        date: selectedDate
      };

      console.log('Sending attendance data:', requestData);

      const response = await axios.post(
        `${import.meta.env.VITE_SERVER_URL}/attendance-api/mark-room`,
        requestData,
        {
          ...getAuthHeaders(),
          timeout: 30000, // 30 second timeout for mobile networks
        }
      );
      
      console.log('Save response:', response.data);

      showNotification(`Attendance saved for Room ${room.roomNumber}`, 'success');
      
      // Remove from edited status and refresh room data to get updated isMarked status
      setEditedRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(room._id);
        return newSet;
      });
      
      // Refresh rooms data to get updated isMarked status from server
      fetchRooms(selectedFloor);
      fetchSummary();
    } catch (error) {
      console.error('Error saving attendance:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config
      });
      
      let errorMsg = 'Failed to save attendance. Please try again.';
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMsg = 'Request timed out. Please check your internet connection and try again.';
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorMsg = 'Network error. Please check your internet connection and try again.';
      } else if (error.response?.status === 401) {
        errorMsg = 'Authentication failed. Please login again.';
      } else if (error.response?.status === 403) {
        errorMsg = 'Access denied. Please check your permissions.';
      } else if (error.response?.status === 400) {
        errorMsg = error.response?.data?.message || 'Invalid request data. Please refresh and try again.';
      } else if (error.response?.status >= 500) {
        errorMsg = 'Server error. Please try again later.';
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      showNotification(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return '#4CAF50';
      case 'absent':
        return '#F44336';
      case 'home_pass_approved':
        return '#2196F3';
      case 'home_pass_used':
        return '#9C27B0';
      case 'late_pass_approved':
        return '#FF9800';
      case 'late_pass_used':
        return '#795548';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return <CheckCircle size={20} />;
      case 'absent':
        return <XCircle size={20} />;
      case 'home_pass_approved':
        return <Home size={20} />;
      case 'home_pass_used':
        return <LogOut size={20} />;
      case 'late_pass_approved':
        return <Clock size={20} />;
      case 'late_pass_used':
        return <Clock size={20} />;
      default:
        return <AlertCircle size={20} />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'absent':
        return 'Absent';
      case 'home_pass_approved':
        return 'Home Pass';
      case 'home_pass_used':
        return 'On Leave';
      default:
        return 'Unknown';
    }
  };

  // Dashboard removed - going directly to floor view

  const renderFloorView = () => (
    <div className="attendance-container">
      {/* Compact Header - Sticky */}
      <div className="floor-header-sticky">
        <div className="floor-header-top">
          <div className="floor-info">
            <div className="floor-selector-header">
              <Building size={20} />
              <select
                className="floor-dropdown-header"
                value={selectedFloor || ''}
                onChange={(e) => {
                  const floorId = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedFloor(floorId);
                  if (floorId === null) {
                    setRooms([]);
                  }
                }}
              >
                <option value="">Select Floor...</option>
                {floors.map((floor) => (
                  <option key={floor._id} value={floor._id}>
                    Floor {floor._id}
                  </option>
                ))}
              </select>
            </div>
            <div className="floor-date-selector">
              <Calendar size={16} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="date-input-compact"
              />
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search room number or student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Warning banner for past dates */}
      {!isToday() && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '12px 16px',
          margin: '16px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#856404'
        }}>
          <AlertCircle size={20} />
          <span><strong>View Only Mode:</strong> You are viewing past attendance records. Changes cannot be saved for dates other than today.</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <p>Loading rooms...</p>
        </div>
      ) : (
        <>
          {/* Search Results Info */}
          {searchQuery && (
            <div className="search-results-info">
              <p>
                {filteredRooms.length === 0 
                  ? `No rooms found for "${searchQuery}"` 
                  : `${filteredRooms.length} room${filteredRooms.length !== 1 ? 's' : ''} found for "${searchQuery}"`
                }
              </p>
            </div>
          )}

          {/* Rooms Grid */}
          <div className="rooms-grid">
            {filteredRooms.map((room, roomIndex) => {
              const isSaved = room.isMarked; // Use server-provided status
              const isEdited = editedRooms.has(room._id);
              const isUnmarked = !isSaved && !isEdited;
              
              // Determine room status class
              let roomStatusClass = '';
              if (isEdited) {
                roomStatusClass = 'room-edited';
              } else if (isSaved) {
                roomStatusClass = 'room-saved';
              } else {
                roomStatusClass = 'room-unmarked';
              }
              
              return (
                <div key={room._id} className={`room-card ${roomStatusClass}`}>
                  <div className="room-header">
                    <div className="room-title-section">
                      <h3>Room {room.roomNumber}</h3>
                      <div className="room-status-indicator">
                        {isEdited && (
                          <span className="status-badge edited">
                            <span className="status-dot"></span>
                            Edited
                          </span>
                        )}
                        {isSaved && !isEdited && (
                          <span className="status-badge saved">
                            <span className="status-dot"></span>
                            Saved
                          </span>
                        )}
                        {isUnmarked && (
                          <span className="status-badge unmarked">
                            <span className="status-dot"></span>
                            Unmarked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                {/* Students List */}
                <div className="students-list">
                  {room.students.map((student, studentIndex) => (
                    <div key={student._id} className="student-item">
                      <div className="student-info">
                        <div>
                          <p className="student-name">{student.name}</p>
                          <p className="student-roll">{student.rollNumber}</p>
                        </div>

                        {/* Status Buttons - Now inline with name */}
                        {(student.status === 'home_pass_used' || student.status === 'home_pass_approved' || 
                          student.status === 'late_pass_used' || student.status === 'late_pass_approved') ? (
                          <div className="status-badge" style={{ backgroundColor: getStatusColor(student.status) }}>
                            {getStatusIcon(student.status)}
                            <span>
                              {student.status.includes('home_pass') ? 'Home Pass' : 'Late Pass'}
                              {student.status.includes('_used') ? ' (Out)' : ' (Approved)'}
                            </span>
                          </div>
                        ) : (
                          <div className="status-buttons">
                          <button
                            className={`status-btn ${student.status === 'present' ? 'active' : ''}`}
                            style={{
                              backgroundColor: student.status === 'present' ? getStatusColor('present') : '#f5f5f5',
                              color: student.status === 'present' ? '#fff' : '#666',
                              opacity: !isToday() ? 0.6 : 1,
                              cursor: !isToday() ? 'not-allowed' : 'pointer'
                            }}
                            onClick={() => isToday() && handleStatusChange(room._id, student._id, 'present')}
                            disabled={!isToday()}
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            className={`status-btn ${student.status === 'absent' ? 'active' : ''}`}
                            style={{
                              backgroundColor: student.status === 'absent' ? getStatusColor('absent') : '#f5f5f5',
                              color: student.status === 'absent' ? '#fff' : '#666',
                              opacity: !isToday() ? 0.6 : 1,
                              cursor: !isToday() ? 'not-allowed' : 'pointer'
                            }}
                            onClick={() => isToday() && handleStatusChange(room._id, student._id, 'absent')}
                            disabled={!isToday()}
                          >
                            <XCircle size={16} />
                          </button>
                          {student.homePassInfo && (
                            <button
                              className={`status-btn ${student.status === 'home_pass_approved' ? 'active' : ''}`}
                              style={{
                                backgroundColor: student.status === 'home_pass_approved' ? getStatusColor('home_pass_approved') : '#f5f5f5',
                                color: student.status === 'home_pass_approved' ? '#fff' : '#666',
                                opacity: !isToday() ? 0.6 : 1,
                                cursor: !isToday() ? 'not-allowed' : 'pointer'
                              }}
                              onClick={() => isToday() && handleStatusChange(room._id, student._id, 'home_pass_approved')}
                              disabled={!isToday()}
                            >
                              <Home size={16} />
                            </button>
                          )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save Room Button */}
                <button
                  className="save-room-btn"
                  onClick={() => saveRoomAttendance(room)}
                  disabled={saving || !isToday()}
                  title={!isToday() ? 'Cannot edit past attendance' : ''}
                >
                  <Save size={16} />
                  {!isToday() ? 'View Only' : 'Save Room'}
                </button>
              </div>
              );
            })}
          </div>

        </>
      )}
    </div>
  );

  return (
    <div className="attendance-wrapper">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      {renderFloorView()}
    </div>
  );
};

export default Attendance;