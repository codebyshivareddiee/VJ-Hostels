import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdmin } from '../../context/AdminContext';
import StudentDetailsModal from './StudentDetailsModal';


const Rooms = () => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = useAdmin();

    // For student details modal
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedRollNumber, setSelectedRollNumber] = useState('');

    // For room creation form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        roomNumber: '',
        floor: 1,
        capacity: 3
    });
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // For room details
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [roomStudents, setRoomStudents] = useState([]);
    const [roomLoading, setRoomLoading] = useState(false);



    // For allocating rooms to students
    const [allocatingRooms, setAllocatingRooms] = useState(false);

    // For floor filtering
    const [selectedFloor, setSelectedFloor] = useState('all');

    // For changing student room
    const [showChangeRoomModal, setShowChangeRoomModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [newRoomNumber, setNewRoomNumber] = useState('');
    const [availableRooms, setAvailableRooms] = useState([]);
    const [changingRoom, setChangingRoom] = useState(false);

    // For unassigning student from room
    const [unassigningRoom, setUnassigningRoom] = useState(false);

    // For syncing rooms
    const [syncingRooms, setSyncingRooms] = useState(false);
    const [roomStats, setRoomStats] = useState(null);

    // Removed room exchange feature

    useEffect(() => {
        fetchRooms();
        fetchRoomStats();
    }, [activeTab, token]);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            let endpoint = 'rooms/all-with-students';

            if (activeTab === 'vacant') {
                endpoint = 'rooms/vacancy?status=vacant';
            } else if (activeTab === 'occupied') {
                endpoint = 'rooms/vacancy?status=occupied';
            }

            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/${endpoint}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setRooms(response.data);
            setError('');
        } catch (err) {
            setError('Failed to load rooms');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRoomStats = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/rooms/statistics`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setRoomStats(response.data);
        } catch (err) {
            console.error('Failed to load room statistics', err);
        }
    };

    const fetchRoomStudents = async (roomNumber) => {
        try {
            setRoomLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/room/${roomNumber}/students`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setRoomStudents(response.data);
        } catch (err) {
            console.error('Failed to load room students', err);
        } finally {
            setRoomLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: name === 'capacity' ? parseInt(value) : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        setFormLoading(true);

        try {
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/admin-api/room`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            setFormSuccess('Room created successfully!');
            setFormData({
                roomNumber: '',
                floor: 1,
                capacity: 3
            });
            fetchRooms();
            setTimeout(() => {
                setShowForm(false);
                setFormSuccess('');
            }, 2000);
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to create room');
            console.error(err);
        } finally {
            setFormLoading(false);
        }
    };

    const handleRoomClick = (room) => {
        setSelectedRoom(room);
        fetchRoomStudents(room.roomNumber);
    };



    const handleSyncRooms = async () => {
        if (!window.confirm('This will sync all students to their assigned rooms based on the database.\n\nAny missing rooms will be created automatically.\n\nContinue?')) {
            return;
        }

        try {
            setSyncingRooms(true);
            const response = await axios.post(`${import.meta.env.VITE_SERVER_URL}/admin-api/rooms/sync`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            
            const { sync, statistics, warnings } = response.data;
            
            let message = `✅ Student-Room Sync Complete!\n\n` +
                `👥 Students Synced: ${sync.studentsProcessed}\n` +
                `🔄 Rooms Updated: ${sync.roomsUpdated}\n` +
                `🏠 Unique Rooms: ${sync.uniqueRooms}\n`;
            
            if (sync.roomsCreated > 0) {
                message += `✨ Rooms Created: ${sync.roomsCreated}\n`;
            }
            
            message += `\n📊 Occupancy: ${statistics.totalOccupied}/${statistics.totalCapacity} (${statistics.occupancyRate}%)`;
            
            if (warnings) {
                message += `\n\n⚠️ Warning: ${warnings.message}`;
            }
            
            alert(message);
            
            fetchRooms();
            fetchRoomStats();
        } catch (err) {
            alert('Failed to sync rooms: ' + (err.response?.data?.error || err.message));
            console.error(err);
        } finally {
            setSyncingRooms(false);
        }
    };

    const handleAllocateRooms = async () => {
        if (!window.confirm('This will allocate rooms to students who don\'t have a room assigned. Continue?')) {
            return;
        }

        try {
            setAllocatingRooms(true);
            const response = await axios.post(`${import.meta.env.VITE_SERVER_URL}/admin-api/allocate-rooms`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            alert(response.data.message);
            fetchRooms();
            fetchRoomStats();
        } catch (err) {
            alert('Failed to allocate rooms: ' + (err.response?.data?.error || err.message));
            console.error(err);
        } finally {
            setAllocatingRooms(false);
        }
    };

    const handleOpenChangeRoomModal = (student) => {
        setSelectedStudent(student);
        setNewRoomNumber('');

        // Get available rooms (rooms with space)
        const vacantRooms = rooms.filter(room => room.occupants.length < room.capacity);
        setAvailableRooms(vacantRooms);

        setShowChangeRoomModal(true);
    };

    const handleChangeRoom = async () => {
        if (!selectedStudent || !newRoomNumber) {
            alert('Please select a room');
            return;
        }

        try {
            setChangingRoom(true);
            const response = await axios.put(`${import.meta.env.VITE_SERVER_URL}/admin-api/change-student-room`,
                {
                    studentId: selectedStudent._id,
                    newRoomNumber
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            alert(response.data.message);
            setShowChangeRoomModal(false);

            // Refresh the room data
            fetchRooms();
            if (selectedRoom) {
                fetchRoomStudents(selectedRoom.roomNumber);
            }
        } catch (err) {
            alert('Failed to change room: ' + (err.response?.data?.error || err.message));
            console.error(err);
        } finally {
            setChangingRoom(false);
        }
    };

    const handleUnassignRoom = async (student) => {
        if (!window.confirm(`Are you sure you want to unassign ${student.name} from room ${student.roomNumber}?`)) {
            return;
        }

        try {
            setUnassigningRoom(true);
            const response = await axios.put(`${import.meta.env.VITE_SERVER_URL}/admin-api/unassign-student-room`,
                {
                    studentId: student._id
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            alert(response.data.message);

            // Refresh the room data
            fetchRooms();
            if (selectedRoom) {
                fetchRoomStudents(selectedRoom.roomNumber);
            }
        } catch (err) {
            alert('Failed to unassign room: ' + (err.response?.data?.error || err.message));
            console.error(err);
        } finally {
            setUnassigningRoom(false);
        }
    };

    // Exchange room functionality removed

    // Filter rooms by search term and floor
    const filteredRooms = rooms.filter(room => {
        const matchesSearch = room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());

        if (selectedFloor === 'all') {
            return matchesSearch;
        }

        // Extract floor number from room number
        // For rooms 101-139, floor is 1
        // For rooms 1001-1039, floor is 10
        let floorNumber;
        if (room.roomNumber.length >= 4 && room.roomNumber.startsWith('1')) {
            // For floors 10-12 (1001-1239)
            floorNumber = room.roomNumber.substring(0, 2);
        } else {
            // For floors 1-9 (101-939)
            floorNumber = room.roomNumber.charAt(0);
        }

        return matchesSearch && floorNumber === selectedFloor;
    });

    // Group rooms by floor for better display
    const roomsByFloor = {};
    filteredRooms.forEach(room => {
        // Extract floor number from room number
        let floorNumber;
        if (room.roomNumber.length >= 4 && room.roomNumber.startsWith('1')) {
            // For floors 10-12 (1001-1239)
            floorNumber = room.roomNumber.substring(0, 2);
        } else {
            // For floors 1-9 (101-939)
            floorNumber = room.roomNumber.charAt(0);
        }

        if (!roomsByFloor[floorNumber]) {
            roomsByFloor[floorNumber] = [];
        }
        roomsByFloor[floorNumber].push(room);
    });

    // Sort rooms within each floor
    Object.keys(roomsByFloor).forEach(floor => {
        roomsByFloor[floor].sort((a, b) => {
            return parseInt(a.roomNumber) - parseInt(b.roomNumber);
        });
    });

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Room Management</h2>
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-success"
                        onClick={handleSyncRooms}
                        disabled={syncingRooms}
                        title="Sync students to their assigned rooms"
                    >
                        {syncingRooms ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Syncing...
                            </>
                        ) : '🔄 Sync Students to Rooms'}
                    </button>

                    <button
                        className="btn btn-warning text-nowrap"
                        onClick={handleAllocateRooms}
                        disabled={allocatingRooms}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        {allocatingRooms ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Allocating...
                            </>
                        ) : 'Allocate Unassigned Students'}
                    </button>

                    <button
                        className="btn btn-primary text-nowrap"
                        onClick={() => setShowForm(!showForm)}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        <i className={`bi bi-${showForm ? 'x-circle' : 'plus-circle'} me-2`}></i>
                        {showForm ? 'Cancel' : 'Add New Room'}
                    </button>
                </div>
            </div>

            {/* Room Statistics Card */}
            {roomStats && (
                <div className="card mb-4 bg-light">
                    <div className="card-body">
                        <div className="row text-center">
                            <div className="col-md-2">
                                <h5 className="text-primary">{roomStats.totalRooms}</h5>
                                <small className="text-muted">Total Rooms</small>
                            </div>
                            <div className="col-md-2">
                                <h5 className="text-success">{roomStats.totalOccupied}</h5>
                                <small className="text-muted">Students Housed</small>
                            </div>
                            <div className="col-md-2">
                                <h5 className="text-info">{roomStats.totalCapacity}</h5>
                                <small className="text-muted">Total Capacity</small>
                            </div>
                            <div className="col-md-2">
                                <h5 className="text-danger">{roomStats.fullyOccupiedRooms}</h5>
                                <small className="text-muted">Fully Occupied</small>
                            </div>
                            <div className="col-md-2">
                                <h5 className="text-warning">{roomStats.partiallyOccupiedRooms}</h5>
                                <small className="text-muted">Partially Filled</small>
                            </div>
                            <div className="col-md-2">
                                <h5 className="text-secondary">{roomStats.vacantRooms}</h5>
                                <small className="text-muted">Vacant</small>
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="progress" style={{ height: '25px' }}>
                                <div 
                                    className="progress-bar bg-success" 
                                    role="progressbar" 
                                    style={{ width: `${roomStats.occupancyRate}%` }}
                                    aria-valuenow={roomStats.occupancyRate} 
                                    aria-valuemin="0" 
                                    aria-valuemax="100"
                                >
                                    {roomStats.occupancyRate}% Occupancy
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="card mb-4">
                    <div className="card-header bg-primary text-white">
                        <h5 className="mb-0">Add New Room</h5>
                    </div>
                    <div className="card-body">
                        {formError && (
                            <div className="alert alert-danger" role="alert">
                                {formError}
                            </div>
                        )}
                        {formSuccess && (
                            <div className="alert alert-success" role="alert">
                                {formSuccess}
                            </div>
                        )}
                        <form onSubmit={handleSubmit}>
                            <div className="row g-3">
                                <div className="col-md-4">
                                    <label htmlFor="roomNumber" className="form-label">Room Number</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="roomNumber"
                                        name="roomNumber"
                                        value={formData.roomNumber}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 101, 1201"
                                        required
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label htmlFor="floor" className="form-label">Floor</label>
                                    <select
                                        className="form-select"
                                        id="floor"
                                        name="floor"
                                        value={formData.floor}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        {[...Array(12)].map((_, i) => (
                                            <option key={i+1} value={i+1}>Floor {i+1}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label htmlFor="capacity" className="form-label">Capacity</label>
                                    <select
                                        className="form-select"
                                        id="capacity"
                                        name="capacity"
                                        value={formData.capacity}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="2">2 Sharing</option>
                                        <option value="3">3 Sharing</option>
                                        <option value="4">4 Sharing</option>
                                    </select>
                                </div>
                                <div className="col-12 mt-4">
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={formLoading}
                                    >
                                        {formLoading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Creating...
                                            </>
                                        ) : 'Create Room'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="row">
                <div className="col-md-8">
                    <div className="card mb-4">
                        <div className="card-header bg-light">
                            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
                                <ul className="nav nav-tabs card-header-tabs mb-0 flex-nowrap" style={{ border: 'none' }}>
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('all')}
                                            style={{ 
                                                whiteSpace: 'nowrap',
                                                backgroundColor: activeTab === 'all' ? '#0d6efd' : '#e9ecef',
                                                color: activeTab === 'all' ? 'white' : '#495057',
                                                fontWeight: activeTab === 'all' ? '600' : '500',
                                                border: 'none',
                                                borderRadius: '6px 6px 0 0'
                                            }}
                                        >
                                            All Rooms
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link ${activeTab === 'vacant' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('vacant')}
                                            style={{ 
                                                whiteSpace: 'nowrap',
                                                backgroundColor: activeTab === 'vacant' ? '#198754' : '#e9ecef',
                                                color: activeTab === 'vacant' ? 'white' : '#495057',
                                                fontWeight: activeTab === 'vacant' ? '600' : '500',
                                                border: 'none',
                                                borderRadius: '6px 6px 0 0'
                                            }}
                                        >
                                            Vacant Rooms
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link ${activeTab === 'occupied' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('occupied')}
                                            style={{ 
                                                whiteSpace: 'nowrap',
                                                backgroundColor: activeTab === 'occupied' ? '#dc3545' : '#e9ecef',
                                                color: activeTab === 'occupied' ? 'white' : '#495057',
                                                fontWeight: activeTab === 'occupied' ? '600' : '500',
                                                border: 'none',
                                                borderRadius: '6px 6px 0 0'
                                            }}
                                        >
                                            Fully Occupied
                                        </button>
                                    </li>
                                </ul>
                                <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2" style={{ minWidth: 'fit-content' }}>
                                    <div>
                                        <select
                                            className="form-select"
                                            value={selectedFloor}
                                            onChange={(e) => setSelectedFloor(e.target.value)}
                                            style={{ minWidth: '120px' }}
                                        >
                                            <option value="all">All Floors</option>
                                            {[...Array(12)].map((_, i) => (
                                                <option key={i+1} value={(i+1).toString()}>
                                                    Floor {i+1}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search rooms..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ minWidth: '150px' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
                            ) : filteredRooms.length === 0 ? (
                                <div className="alert alert-info" role="alert">
                                    No rooms found.
                                </div>
                            ) : (
                                <div>
                                    {Object.keys(roomsByFloor).sort((a, b) => parseInt(a) - parseInt(b)).map(floor => (
                                        <div key={floor} className="mb-4">
                                            <h5 className="border-bottom pb-2">Floor {floor}</h5>
                                            <div className="row g-3">
                                                {roomsByFloor[floor].map(room => (
                                                    <div key={room._id} className="col-md-2 col-sm-3 col-6">
                                                        <div
                                                            className={`card h-100 ${selectedRoom?._id === room._id ? 'border-primary' : ''} ${room.occupants.length === room.capacity ? 'bg-light' : 'bg-white'}`}
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => handleRoomClick(room)}
                                                        >
                                                            <div className="card-body p-2 text-center">
                                                                <h6 className="mb-0">Room {room.roomNumber}</h6>
                                                                <small>{room.capacity} Sharing</small>
                                                                <div className="mt-2">
                                                                    <span className={`badge ${room.occupants.length === room.capacity ? 'bg-danger' : 'bg-success'}`}>
                                                                        {room.occupants.length}/{room.capacity}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card sticky-top" style={{ top: '20px' }}>
                        <div className="card-header bg-light">
                            <h5 className="mb-0">
                                {selectedRoom ? `Room ${selectedRoom.roomNumber} Details` : 'Room Details'}
                            </h5>
                        </div>
                        <div className="card-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                            {!selectedRoom ? (
                                <div className="alert alert-info" role="alert">
                                    Select a room to view details.
                                </div>
                            ) : roomLoading ? (
                                <div className="text-center my-4">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="card mb-3">
                                        <div className="card-header bg-primary text-white">
                                            <h5 className="mb-0">Room Information</h5>
                                        </div>
                                        <div className="card-body">
                                            <div className="text-center mb-4">
                                                <div className={`display-1 ${selectedRoom.occupants.length === selectedRoom.capacity ? 'text-danger' : 'text-success'}`}>
                                                    {selectedRoom.roomNumber}
                                                </div>
                                                <span className={`badge ${selectedRoom.occupants.length === selectedRoom.capacity ? 'bg-danger' : 'bg-success'} fs-6 mt-2`}>
                                                    {selectedRoom.occupants.length === selectedRoom.capacity ? 'Full' : 'Vacant'}
                                                </span>
                                            </div>

                                            <ul className="list-group list-group-flush">
                                                <li className="list-group-item d-flex justify-content-between align-items-center">
                                                    <strong>Floor:</strong>
                                                    <span>
                                                        {selectedRoom.roomNumber.length >= 4 && selectedRoom.roomNumber.startsWith('1')
                                                            ? selectedRoom.roomNumber.substring(0, 2)
                                                            : selectedRoom.roomNumber.charAt(0)}
                                                    </span>
                                                </li>
                                                <li className="list-group-item d-flex justify-content-between align-items-center">
                                                    <strong>Room Type:</strong>
                                                    <span>{selectedRoom.capacity} Sharing</span>
                                                </li>
                                                <li className="list-group-item d-flex justify-content-between align-items-center">
                                                    <strong>Occupancy:</strong>
                                                    <span>{selectedRoom.occupants.length}/{selectedRoom.capacity}</span>
                                                </li>
                                                <li className="list-group-item d-flex justify-content-between align-items-center">
                                                    <strong>Available Beds:</strong>
                                                    <span>{selectedRoom.capacity - selectedRoom.occupants.length}</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-header bg-primary text-white">
                                            <h5 className="mb-0">Occupants</h5>
                                        </div>
                                        <div className="card-body">
                                            {roomStudents.length === 0 ? (
                                                <div className="alert alert-info" role="alert">
                                                    No students assigned to this room.
                                                </div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <table className="table table-striped table-hover">
                                                        <thead>
                                                            <tr>
                                                                <th>Name</th>
                                                                <th>Roll Number</th>
                                                                <th>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {roomStudents.map(student => (
                                                                <tr key={student._id}>
                                                                    <td>{student.name}</td>
                                                                    <td>{student.rollNumber}</td>
                                                                    <td>
                                                                        <div className="d-flex gap-1">
                                                                            <button
                                                                                className="btn btn-sm btn-info"
                                                                                onClick={() => {
                                                                                    setSelectedRollNumber(student.rollNumber);
                                                                                    setShowDetailsModal(true);
                                                                                }}
                                                                            >
                                                                                View
                                                                            </button>
                                                                            <button
                                                                                className="btn btn-sm btn-warning"
                                                                                onClick={() => handleOpenChangeRoomModal(student)}
                                                                            >
                                                                                Change
                                                                            </button>
                                                                            <button
                                                                                className="btn btn-sm btn-danger"
                                                                                onClick={() => handleUnassignRoom(student)}
                                                                                disabled={unassigningRoom}
                                                                            >
                                                                                Unassign
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Student Details Modal */}
            <StudentDetailsModal
                show={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                rollNumber={selectedRollNumber}
            />

            {/* Change Room Modal */}
            {showChangeRoomModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header bg-warning">
                                <h5 className="modal-title">Change Room</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowChangeRoomModal(false)}
                                    disabled={changingRoom}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {selectedStudent && (
                                    <div className="mb-3">
                                        <p>
                                            <strong>Student:</strong> {selectedStudent.name} ({selectedStudent.rollNumber})
                                        </p>
                                        <p>
                                            <strong>Current Room:</strong> {selectedStudent.roomNumber || 'Not assigned'}
                                        </p>

                                        <div className="form-group mt-4">
                                            <label htmlFor="newRoom" className="form-label">Select New Room</label>
                                            <select
                                                id="newRoom"
                                                className="form-select"
                                                value={newRoomNumber}
                                                onChange={(e) => setNewRoomNumber(e.target.value)}
                                                disabled={changingRoom}
                                            >
                                                <option value="">-- Select a Room --</option>
                                                {availableRooms.map(room => (
                                                    <option key={room._id} value={room.roomNumber}>
                                                        Room {room.roomNumber} ({room.occupants.length}/{room.capacity} occupied)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowChangeRoomModal(false)}
                                    disabled={changingRoom}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-warning"
                                    onClick={handleChangeRoom}
                                    disabled={!newRoomNumber || changingRoom}
                                >
                                    {changingRoom ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Changing...
                                        </>
                                    ) : 'Change Room'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Exchange Room Modal removed */}
        </div>
    );
};

export default Rooms;
