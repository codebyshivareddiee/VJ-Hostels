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
        fetchFilters()
      ]);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

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
          
          <button style={styles.exportBtn} onClick={() => exportData('pdf')}>
            <FileText size={16} />
            PDF
          </button>
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

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>
              <Filter size={16} style={{ marginRight: '0.5rem' }} />
              Compare
            </label>
            <div style={styles.compareContainer}>
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
                style={styles.checkbox}
              />
              {compareMode && (
                <input
                  type="date"
                  value={compareDate}
                  onChange={(e) => setCompareDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  style={styles.filterInput}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={{...styles.card, borderLeft: '5px solid #3B82F6'}}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardTitle}>Campus Total</p>
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
          <p style={styles.subtitleSmall}>Rooms with attendance submitted</p>
        </div>

      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div style={styles.alertsPanel}>
          <div style={styles.alertsHeader}>
            <AlertTriangle size={20} />
            <span>Alerts & Exceptions</span>
          </div>
          <div style={styles.alertsList}>
            {alerts.map((alert, index) => (
              <div key={index} style={{...styles.alertItem, ...styles.alertSeverity(alert.severity)}}>
                <div>
                  <strong>{alert.title}</strong>
                  <p style={{margin: '0.25rem 0 0 0', fontSize: '0.875rem'}}>{alert.message}</p>
                </div>
                <div style={styles.alertTime}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Message */}
      <div style={styles.summaryCard}>
        <h3 style={styles.summaryTitle}>Analytics Summary</h3>
        <p style={styles.summaryText}>
          This attendance analytics dashboard provides comprehensive insights into daily attendance patterns, 
          home pass usage, and security guard activity. Use the filters above to analyze specific dates and floors.
        </p>
      </div>
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
