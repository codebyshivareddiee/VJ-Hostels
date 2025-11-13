import { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Home,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Building,
  Eye,
  FileText,
  PieChart,
  Activity
} from 'lucide-react';
import axios from 'axios';
import StudentDetailsModal from './StudentDetailsModal';

const AttendanceAnalytics = () => {
  // State management
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDate, setCompareDate] = useState('');
  
  // Data states
  const [kpiData, setKpiData] = useState({});
  const [floorData, setFloorData] = useState([]);
  const [roomData, setRoomData] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [guardActivity, setGuardActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [homePassFlow, setHomePassFlow] = useState({});
  const [homePassList, setHomePassList] = useState([]);
  const [studentsBase, setStudentsBase] = useState([]); // all active students
  const [attendanceMap, setAttendanceMap] = useState({}); // rollNumber -> { status, markedBy, markedAt, roomNumber, floor }
  const [attendanceList, setAttendanceList] = useState([]); // raw attendance records for selected date
  const [studentsList, setStudentsList] = useState([]); // merged + filtered view list
  const [studentSearch, setStudentSearch] = useState('');
  const [studentView, setStudentView] = useState('absent'); // 'absent' | 'present' | 'home_pass' | 'unmarked'
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRollNumber, setSelectedRollNumber] = useState('');
  
  // Filter states
  const [floors, setFloors] = useState([]);
  const [expandedFloors, setExpandedFloors] = useState(new Set());

  useEffect(() => {
    fetchAllData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchAllData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedDate, selectedFloor, autoRefresh]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchKPIData(),
        fetchFloorData(),
        fetchRoomData(),
        fetchTimeSeriesData(),
        fetchGuardActivity(),
        fetchAlerts(),
        fetchHomePassFlow(),
        fetchHomePassList(), // Added fetch for Home Pass (Used) students list
        fetchFilters(),
        fetchActiveStudents(),
        fetchAttendanceForDate()
      ]);
      recomputeStudentsList();
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveStudents = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/get-active-students`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setStudentsBase(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching active students:', error);
      setStudentsBase([]);
    }
  };

  const fetchAttendanceForDate = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/export`, {
        params: { date: selectedDate, format: 'json' },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const list = Array.isArray(res.data) ? res.data : [];
      const map = {};
      list.forEach(r => {
        // latest record wins if duplicates
        map[r.rollNumber] = {
          status: r.status,
          markedBy: r.markedBy,
          markedByName: r.markedByName,
          markedAt: r.markedAt,
          roomNumber: r.roomNumber,
          floor: r.floor
        };
      });
      setAttendanceMap(map);
      setAttendanceList(list);
    } catch (error) {
      console.error('Error fetching attendance map:', error);
      setAttendanceMap({});
    }
  };

  const recomputeStudentsList = () => {
    // roomNumber -> floor map from roomData
    const roomFloorMap = new Map(roomData.map(r => [String(r.roomNumber), r.floor]));
    const q = studentSearch.toLowerCase();

    const merged = studentsBase.map(s => {
      const att = attendanceMap[s.rollNumber] || {};
      const roomNum = s.room || att.roomNumber || '';
      const floor = att.floor ?? roomFloorMap.get(String(roomNum));
      const statusRaw = att.status || null;
      // normalize home pass bucket
      const status = statusRaw && (String(statusRaw).includes('home_pass') || String(statusRaw).includes('late_pass'))
        ? 'home_pass'
        : statusRaw;
      return {
        name: s.name,
        rollNumber: s.rollNumber,
        roomNumber: roomNum,
        branch: s.branch,
        year: s.year,
        email: s.email,
        phoneNumber: s.phoneNumber,
        floor: floor,
        status: status,
        markedBy: att.markedBy,
        markedByName: att.markedByName,
        markedAt: att.markedAt
      };
    });

    // If viewing present: derive from attendance records
    if (studentView === 'present') {
      const fromAttendance = attendanceList.filter(r => {
        const status = String(r.status || '').toLowerCase();
        const floorMatch = selectedFloor !== '' ? String(r.floor) === String(selectedFloor) : true;
        return status === 'present' && floorMatch;
      }).map(r => {
        const s = studentsBase.find(x => x.rollNumber === r.rollNumber) || {};
        return {
          name: s.name || r.studentName || '-',
          rollNumber: r.rollNumber,
          roomNumber: r.roomNumber,
          floor: r.floor,
          status: 'present',
          markedBy: r.markedBy,
          markedByName: r.markedByName,
          markedAt: r.markedAt
        };
      });
      const searched = fromAttendance.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.rollNumber || '').toLowerCase().includes(q) ||
        (s.roomNumber ? String(s.roomNumber) : '').toLowerCase().includes(q)
      ).sort((a, b) => (parseInt(a.roomNumber) || 999999) - (parseInt(b.roomNumber) || 999999));
      setStudentsList(searched);
      return;
    }

    // If viewing home_pass: derive from homePassList to include students without AttendanceRecord
    if (studentView === 'home_pass') {
      const base = homePassList.filter(h => {
        const floorMatch = selectedFloor !== '' ? String(h.floor) === String(selectedFloor) : true;
        return floorMatch;
      }).map(h => ({
        name: h.name || '-',
        rollNumber: h.rollNumber,
        roomNumber: h.roomNumber || '',
        floor: h.floor,
        status: 'home_pass',
        markedAt: h.outTime
      }));
      const searched = base.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.rollNumber || '').toLowerCase().includes(q) ||
        (s.roomNumber ? String(s.roomNumber) : '').toLowerCase().includes(q)
      ).sort((a, b) => (parseInt(a.roomNumber) || 999999) - (parseInt(b.roomNumber) || 999999));
      setStudentsList(searched);
      return;
    }

    // For absent/unmarked view, continue with merged base
    const byFloor = selectedFloor !== ''
      ? merged.filter(s => String(s.floor) === String(selectedFloor))
      : merged;

    // Absent: explicitly absent only. Unmarked: no status only.
    const byView = (studentView === 'unmarked')
      ? byFloor.filter(s => !s.status)
      : byFloor.filter(s => s.status === 'absent');

    // search
    const searched = byView.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.rollNumber || '').toLowerCase().includes(q) ||
      (s.roomNumber ? String(s.roomNumber) : '').toLowerCase().includes(q) ||
      (s.status || '').toLowerCase().includes(q)
    );

    // sort by room number
    searched.sort((a, b) => (parseInt(a.roomNumber) || 999999) - (parseInt(b.roomNumber) || 999999));
    setStudentsList(searched);
  };

  useEffect(() => {
    recomputeStudentsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsBase, attendanceMap, homePassList, roomData, selectedFloor, studentSearch, studentView]);

  // Refetch latest attendance records when switching tabs to present/home_pass/absent
  useEffect(() => {
    fetchAttendanceForDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentView]);

  const fetchKPIData = async () => {
    try {
      console.log('Frontend - Fetching KPI data for:', { date: selectedDate, floors: selectedFloor });
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/kpi`, {
        params: { date: selectedDate, floors: selectedFloor },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      console.log('Frontend - Received KPI data:', response.data);
      setKpiData(response.data);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    }
  };

  const fetchFloorData = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/floors`, {
        params: { date: selectedDate },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setFloorData(response.data);
    } catch (error) {
      console.error('Error fetching floor data:', error);
    }
  };

  const fetchRoomData = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/rooms`, {
        params: { date: selectedDate, floors: selectedFloor },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setRoomData(response.data);
    } catch (error) {
      console.error('Error fetching room data:', error);
    }
  };

  const fetchTimeSeriesData = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/timeseries`, {
        params: { date: selectedDate, days: 7 },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setTimeSeriesData(response.data);
    } catch (error) {
      console.error('Error fetching time series data:', error);
    }
  };

  const fetchGuardActivity = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/guards`, {
        params: { date: selectedDate },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setGuardActivity(response.data);
    } catch (error) {
      console.error('Error fetching guard activity:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/alerts`, {
        params: { date: selectedDate },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchHomePassFlow = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/homepass-flow`, {
        params: { date: selectedDate },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setHomePassFlow(response.data);
    } catch (error) {
      console.error('Error fetching home pass flow:', error);
    }
  };

  const fetchHomePassList = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/homepass-list`, {
        params: { date: selectedDate, floors: selectedFloor },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setHomePassList(response.data || []);
    } catch (error) {
      console.error('Error fetching home pass list:', error);
      setHomePassList([]);
    }
  };

  const fetchFilters = async () => {
    try {
      const floorsRes = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/floors-list`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setFloors(floorsRes.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const exportData = async (format = 'csv') => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/admin-api/attendance/export`, {
        params: { 
          date: selectedDate, 
          floors: selectedFloor,
          format 
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-report-${selectedDate}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const getFloorCompletionColor = (completion) => {
    if (completion >= 90) return '#10b981';
    if (completion >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const toggleFloorExpansion = (floorId) => {
    const newExpanded = new Set(expandedFloors);
    if (newExpanded.has(floorId)) {
      newExpanded.delete(floorId);
    } else {
      newExpanded.add(floorId);
    }
    setExpandedFloors(newExpanded);
  };

  if (loading) {
    return (
      <div style={styles.loaderContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading analytics data...</p>
        <style>{keyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>
            Attendance Analytics
          </h2>
          <p style={styles.subtitle}>Comprehensive statistics and insights for security attendance management</p>
        </div>
        
        <div style={styles.headerActions}>
          <button 
            style={{
              ...styles.actionBtn,
              ...(autoRefresh ? styles.activeBtnStyle : {})
            }}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw size={16} />
            Auto Refresh
          </button>
          
          <button style={styles.exportBtn} onClick={() => exportData('csv')}>
            <Download size={16} />
            CSV
          </button>
          
          {/* <button style={styles.exportBtn} onClick={() => exportData('pdf')}>
            <FileText size={16} />
            PDF
          </button> */}
        </div>
      </header>

      {/* Filters */}
      <div style={styles.filtersCard}>
        <div style={styles.filtersGrid}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>
              <Calendar size={16} style={{ marginRight: '0.5rem' }} />
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={styles.filterInput}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>
              <Building size={16} style={{ marginRight: '0.5rem' }} />
              Floors
            </label>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">All Floors</option>
              {floors.map(floor => (
                <option key={floor._id} value={floor._id}>
                  Floor {floor._id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={{...styles.card, borderLeft: '5px solid #3B82F6'}}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardTitle}>Total</p>
              <h3 style={styles.cardValue}>{kpiData.totalStudents ?? 0}</h3>
            </div>
            <div style={{...styles.iconBox, backgroundColor: '#3B82F615', color: '#3B82F6'}}>
              <Users size={24} />
            </div>
          </div>
          <p style={styles.subtitleSmall}>
            {selectedFloor ? `Students on Floor ${selectedFloor}` : 'All active students'}
          </p>
        </div>

        <div style={{...styles.card, borderLeft: '5px solid #10B981'}}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardTitle}>Present</p>
              <h3 style={styles.cardValue}>{kpiData.presentCount ?? 0}</h3>
            </div>
            <div style={{...styles.iconBox, backgroundColor: '#10B98115', color: '#10B981'}}>
              <CheckCircle size={24} />
            </div>
          </div>
          <p style={styles.subtitleSmall}>Marked as present</p>
        </div>

        <div style={{...styles.card, borderLeft: '5px solid #EF4444'}}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardTitle}>Absent</p>
              <h3 style={styles.cardValue}>{kpiData.absentCount ?? 0}</h3>
            </div>
            <div style={{...styles.iconBox, backgroundColor: '#EF444415', color: '#EF4444'}}>
              <XCircle size={24} />
            </div>
          </div>
          <p style={styles.subtitleSmall}>Marked as absent</p>
        </div>

        <div style={{...styles.card, borderLeft: '5px solid #8B5CF6'}}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardTitle}>Home Pass (Used)</p>
              <h3 style={styles.cardValue}>{kpiData.homePassUsedCount ?? 0}</h3>
            </div>
            <div style={{...styles.iconBox, backgroundColor: '#8B5CF615', color: '#8B5CF6'}}>
              <Home size={24} />
            </div>
          </div>
          <p style={styles.subtitleSmall}>Students currently out</p>
        </div>

        <div style={{...styles.card, borderLeft: '5px solid #06B6D4'}}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardTitle}>Rooms Completed</p>
              <h3 style={styles.cardValue}>
                {kpiData.roomsCompleted ?? 0}
                <span style={{fontSize: '1.25rem', color: '#64748B', fontWeight: '500', marginLeft: '0.5rem'}}>
                  / {kpiData.totalRooms ?? 0}
                </span>
              </h3>
            </div>
            <div style={{...styles.iconBox, backgroundColor: '#06B6D415', color: '#06B6D4'}}>
              <Activity size={24} />
            </div>
          </div>
          <p style={styles.subtitleSmall}>
            {selectedFloor !== ''
              ? `Rooms on Floor ${selectedFloor} with attendance submitted`
              : 'Rooms with attendance submitted'}
          </p>
        </div>

      </div>

      <div style={styles.listCard}>
        <div style={styles.listHeaderRow}>
          <h3 style={styles.listTitle}>Students</h3>
          <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
            <div style={styles.filterButtons}>
              <button
                style={{...styles.filterBtn, ...(studentView==='absent'?styles.filterBtnActive:{})}}
                onClick={() => setStudentView('absent')}
              >Absent</button>
              <button
                style={{...styles.filterBtn, ...(studentView==='present'?styles.filterBtnActive:{})}}
                onClick={() => setStudentView('present')}
              >Present</button>
              <button
                style={{...styles.filterBtn, ...(studentView==='home_pass'?styles.filterBtnActive:{})}}
                onClick={() => setStudentView('home_pass')}
              >Home Pass</button>
              <button
                style={{...styles.filterBtn, ...(studentView==='unmarked'?styles.filterBtnActive:{})}}
                onClick={() => setStudentView('unmarked')}
              >Unmarked</button>
            </div>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by name, roll, room, email..."
              style={styles.searchInput}
            />
          </div>
        </div>
        {studentsList.length === 0 ? (
          <div style={styles.emptyState}>No records found.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Roll</th>
                  <th style={styles.th}>Room</th>
                  <th style={styles.th}>Status</th>
                  {/* <th style={styles.th}>Marked By</th> */}
                  <th style={styles.th}>Marked At</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentsList.map((s, idx) => (
                  <tr key={`${s.rollNumber}-${idx}`}>
                    <td style={styles.td}>{s.name}</td>
                    <td style={styles.td}>{s.rollNumber}</td>
                    <td style={styles.td}>{s.roomNumber}</td>
                    <td style={{...styles.td, ...styles.statusCell(s.status)}}>{s.status || 'unmarked'}</td>
                    {/* <td style={styles.td}>{s.markedByName || s.markedBy || '-'}</td> */}
                    <td style={styles.td}>{s.markedAt ? new Date(s.markedAt).toLocaleTimeString() : '-'}</td>
                    <td style={styles.td}>
                      <button
                        style={styles.viewBtn}
                        onClick={() => { setSelectedRollNumber(s.rollNumber); setShowDetailsModal(true); }}
                      >View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentDetailsModal
        show={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        rollNumber={selectedRollNumber}
        onStudentUpdated={() => { fetchActiveStudents(); fetchAttendanceForDate(); }}
        allowEdit={false}
      />
    </div>
  );
};

// Styles object matching admin UI patterns
const styles = {
  container: { 
    padding: '0', 
    background: 'transparent', 
    minHeight: 'auto' 
  },
  header: { 
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem'
  },
  title: { 
    fontSize: '1.875rem', 
    fontWeight: '700', 
    color: '#1E293B',
    display: 'flex',
    alignItems: 'center',
    margin: 0
  },
  subtitle: { 
    color: '#64748B', 
    fontSize: '0.95rem',
    margin: '0.5rem 0 0 0'
  },
  loaderContainer: { 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '60vh', 
    flexDirection: 'column', 
    gap: '1rem' 
  },
  spinner: { 
    width: '48px', 
    height: '48px', 
    border: '4px solid #E0E7FF', 
    borderTop: '4px solid #4F46E5', 
    borderRadius: '50%', 
    animation: 'spin 1s linear infinite' 
  },
  loadingText: { 
    color: '#64748B', 
    fontSize: '0.95rem' 
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center'
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    background: 'white',
    color: '#475569',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.2s ease'
  },
  activeBtnStyle: {
    background: '#4F46E5',
    color: 'white',
    borderColor: '#4F46E5'
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.625rem 1rem',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    background: 'white',
    color: '#475569',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.2s ease'
  },
  filtersCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #E5E7EB',
    marginBottom: '2rem'
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    fontWeight: '600',
    color: '#374151',
    fontSize: '0.875rem'
  },
  filterInput: {
    padding: '0.75rem',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '0.875rem',
    transition: 'border-color 0.2s ease'
  },
  filterSelect: {
    padding: '0.75rem',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '0.875rem',
    background: 'white',
    transition: 'border-color 0.2s ease'
  },
  compareContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  checkbox: {
    width: '16px',
    height: '16px'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #E5E7EB',
    transition: 'all 0.3s ease'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: 0
  },
  cardValue: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#1E293B',
    margin: '0.25rem 0 0 0'
  },
  iconBox: {
    padding: '0.75rem',
    borderRadius: '12px'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.75rem'
  },
  subtitleSmall: {
    fontSize: '0.75rem',
    color: '#94A3B8',
    margin: 0
  },
  trend: {
    fontSize: '0.75rem',
    color: '#10B981',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontWeight: '600'
  },
  alertsPanel: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #E5E7EB',
    marginBottom: '2rem',
    overflow: 'hidden'
  },
  alertsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1.5rem',
    background: '#FEF3C7',
    borderBottom: '1px solid #FDE68A',
    fontWeight: '600',
    color: '#92400E'
  },
  alertsList: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  alertItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #F1F5F9'
  },
  alertSeverity: (severity) => ({
    borderLeft: `4px solid ${
      severity === 'high' ? '#EF4444' : 
      severity === 'medium' ? '#F59E0B' : '#06B6D4'
    }`,
    background: 
      severity === 'high' ? '#FEF2F2' : 
      severity === 'medium' ? '#FFFBEB' : '#F0F9FF'
  }),
  alertTime: {
    fontSize: '0.75rem',
    color: '#94A3B8',
    whiteSpace: 'nowrap'
  },
  summaryCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #E5E7EB',
    textAlign: 'center'
  },
  listCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #E5E7EB',
    marginBottom: '2rem'
  },
  listHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  },
  listTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#1E293B'
  },
  searchInput: {
    padding: '0.5rem 0.75rem',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '0.875rem',
    width: '280px'
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto'
  },
  filterButtons: {
    display: 'inline-flex',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  filterBtn: {
    padding: '0.5rem 0.75rem',
    background: 'white',
    border: 'none',
    borderRight: '1px solid #E5E7EB',
    cursor: 'pointer',
    color: '#475569',
    fontWeight: 600
  },
  filterBtnActive: {
    background: '#EEF2FF',
    color: '#4F46E5'
  },
  viewBtn: {
    padding: '0.4rem 0.75rem',
    background: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    fontSize: '0.85rem',
    color: '#64748B',
    borderBottom: '1px solid #E5E7EB',
    background: '#F8FAFC'
  },
  td: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #F1F5F9',
    fontSize: '0.9rem',
    color: '#0F172A'
  },
  emptyState: {
    padding: '1rem',
    color: '#64748B'
  },
  statusCell: (status) => ({
    color: status === 'present' ? '#10B981' : status === 'absent' ? '#EF4444' : '#64748B',
    fontWeight: 600,
    textTransform: 'capitalize'
  }),
  summaryTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1E293B',
    margin: '0 0 1rem 0'
  },
  summaryText: {
    color: '#64748B',
    fontSize: '0.95rem',
    lineHeight: '1.6',
    margin: 0
  }
};

const keyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export default AttendanceAnalytics;
