import { useEffect, useState } from 'react';
import axios from 'axios';

const fmt = (d) => new Date(d).toISOString().split('T')[0];
const fmtLocal = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export default function AttendanceStats() {
  const [from, setFrom] = useState(() => {
    const end = new Date(); end.setHours(0,0,0,0);
    const start = new Date(end); start.setDate(start.getDate() - 29);
    return fmt(start);
  });
  const [to, setTo] = useState(() => fmt(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ present: 0, absent: 0, homePass: 0, totalMarked: 0, attendanceRate: 0, range: {}, series: [] });
  const [recent, setRecent] = useState([]);

  const headers = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('[Student Attendance] Fetching data with params:', { from, to });
      const [s, r] = await Promise.all([
        axios.get(`${import.meta.env.VITE_SERVER_URL}/student-api/attendance/stats`, { params: { from, to }, ...headers }),
        axios.get(`${import.meta.env.VITE_SERVER_URL}/student-api/attendance/recent`, { params: { limit: 20 }, ...headers })
      ]);
      console.log('[Student Attendance] ========== FULL API RESPONSE ==========');
      console.log('[Student Attendance] Stats API Response:', JSON.stringify(s.data, null, 2));
      console.log('[Student Attendance] Recent API Response:', r.data);
      console.log('[Student Attendance] ========================================');
      console.log('[Student Attendance] Summary - Present:', s.data?.present, 'Absent:', s.data?.absent, 'HomePass:', s.data?.homePass);
      console.log('[Student Attendance] Total Marked:', s.data?.totalMarked);
      console.log('[Student Attendance] Attendance Rate:', s.data?.attendanceRate);
      console.log('[Student Attendance] Date Range:', s.data?.range);
      console.log('[Student Attendance] Series length:', s.data?.series?.length);
      console.log('[Student Attendance] First 10 series entries:', s.data?.series?.slice(0, 10));
      console.log('[Student Attendance] Last 10 series entries:', s.data?.series?.slice(-10));
      
      setStats(s.data || {});
      setRecent(Array.isArray(r.data) ? r.data : []);
      
      console.log('[Student Attendance] State updated successfully');
    } catch (e) {
      console.error('[Student Attendance] Fetch error:', e);
      console.error('[Student Attendance] Error response:', e.response?.data);
      setError(e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [from, to]);

  const today = fmtLocal(new Date());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [monthRef, setMonthRef] = useState(() => {
    const d = new Date(to);
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d;
  });

  const monthStartEnd = (d) => {
    const start = new Date(d); start.setDate(1); start.setHours(0,0,0,0);
    const end = new Date(start); end.setMonth(end.getMonth()+1); end.setDate(0); end.setHours(0,0,0,0);
    return { start, end };
  };

  const goMonth = (delta) => {
    const d = new Date(monthRef); d.setMonth(d.getMonth()+delta);
    setMonthRef(d);
    const { start, end } = monthStartEnd(d);
    setFrom(fmt(start));
    setTo(fmt(end));
  };

  // Build a map date->status using stats.series (normalize to LOCAL date string)
  const statusByDate = new Map(
    (stats.series || []).map(day => {
      let status = 'none';
      if ((day.present || 0) > 0) status = 'present';
      else if ((day.homePass || 0) > 0) status = 'homePass';
      else if ((day.absent || 0) > 0) status = 'absent';
      // day.date is 'YYYY-MM-DD' from server (UTC date). Convert to local day key.
      const localKey = fmtLocal(new Date(day.date));
      console.log(`[Student Attendance] Calendar mapping: ${day.date} -> ${localKey} = ${status}`);
      return [localKey, status];
    })
  );
  
  console.log('[Student Attendance] Status map size:', statusByDate.size);
  console.log('[Student Attendance] Status map entries (first 5):', Array.from(statusByDate.entries()).slice(0, 5));

  const colorFor = (status) => {
    switch(status){
      case 'present': return '#10B981';
      case 'absent': return '#EF4444';
      case 'homePass': return '#8B5CF6';
      default: return '#CBD5E1';
    }
  };

  const weeksForMonth = (d) => {
    const { start, end } = monthStartEnd(d);
    const firstDayIdx = start.getDay(); // 0 Sun ... 6 Sat
    const daysInMonth = end.getDate();
    const cells = [];
    // leading blanks
    for (let i=0;i<firstDayIdx;i++) cells.push(null);
    // month days
    for (let day=1; day<=daysInMonth; day++) {
      const dateObj = new Date(start); dateObj.setDate(day);
      cells.push(dateObj);
    }
    // trailing blanks to complete weeks
    while (cells.length % 7 !== 0) cells.push(null);
    // chunk into weeks
    const weeks = [];
    for (let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));
    return weeks;
  };
  return (
    <div style={{ padding: '16px', maxWidth: 1100, margin: '0 auto' }}>
      {/* <h2 style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontSize: '1.5rem',
        fontWeight: 600,
        margin: '12px 0 8px'
      }}>My Attendance</h2> */}
      {/* <p style={{ color: '#64748b', marginTop: 0 }}>View your attendance over a selected period.</p> */}

      {/* Month navigation only */}

      {loading ? (
        <div style={{ padding: '20px' }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #ef4444', color: '#7f1d1d', borderRadius: 8 }}>{error}</div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? 8 : 12,
            marginBottom: 16
          }}>
            <KPI title="Present" value={stats.present || 0} color="#10B981" />
            <KPI title="Absent" value={stats.absent || 0} color="#EF4444" />
            <KPI title="Home Pass" value={stats.homePass || 0} color="#8B5CF6" />
            <KPI title="Attendance Rate" value={`${stats.attendanceRate || 0}%`} color="#3B82F6" />
          </div>

          {/* Calendar View */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: isMobile ? 12 : 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => goMonth(-1)} style={{ ...btnStyle, padding: isMobile ? '8px 10px' : '10px 12px' }}>{'<'}</button>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16 }}>
                {monthRef.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => goMonth(1)} style={{ ...btnStyle, padding: isMobile ? '8px 10px' : '10px 12px' }}>{'>'}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 4 : 6, marginBottom: isMobile ? 4 : 6, color: '#334155', fontWeight: 600, fontSize: isMobile ? 10 : 12 }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d)=> (<div key={d} style={{ textAlign: 'center' }}>{d}</div>))}
            </div>
            {weeksForMonth(monthRef).map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 4 : 6, marginBottom: isMobile ? 4 : 6 }}>
                {week.map((d, di) => {
                  const cellH = isMobile ? 56 : 84;
                  if (!d) return <div key={di} style={{ height: cellH, background: '#f8fafc', borderRadius: 10, border: '1px dashed #e2e8f0' }} />;
                  const key = fmtLocal(d);
                  const status = statusByDate.get(key) || 'none';
                  const isTodayCell = key === today;
                  const now = new Date(); now.setHours(0,0,0,0);
                  const isFuture = d.setHours(0,0,0,0) > now.getTime();
                  const bgColor = isFuture ? '#E5E7EB' : colorFor(status); // future: gray
                  const textColor = isFuture ? '#64748B' : (status === 'none' ? '#334155' : '#ffffff');
                  return (
                    <div key={di} style={{
                      height: cellH,
                      borderRadius: 10,
                      border: `2px solid ${isTodayCell ? '#3B82F6' : '#e2e8f0'}`,
                      borderStyle: isFuture ? 'dashed' : 'solid',
                      backgroundColor: bgColor,
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }} title={isFuture ? `${key}: Future date` : `${key}: ${status === 'homePass' ? 'Home/Late Pass' : status}`}>
                      <div style={{
                        fontSize: isMobile ? 18 : 24,
                        lineHeight: 1,
                        color: textColor,
                        fontWeight: 800,
                        textShadow: (status === 'none' || isFuture) ? 'none' : '0 1px 1px rgba(0,0,0,0.25)'
                      }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, color: '#475569', fontSize: isMobile ? 11 : 12, flexWrap: 'wrap' }}>
              <LegendDot color="#10B981" label="Present" />
              <LegendDot color="#EF4444" label="Absent" />
              <LegendDot color="#8B5CF6" label="Home Pass" />
              <LegendDot color="#CBD5E1" label="No Record" />
            </div>
          </div>

          {/* Recent records
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Recent records</h3>
            {recent.length === 0 ? (
              <div style={{ color: '#64748b' }}>No recent records.</div>
            ) : (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Status</th>
                      <th style={th}>Marked At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, i) => (
                      <tr key={i}>
                        <td style={td}>{fmt(r.date)}</td>
                        <td style={{ ...td, textTransform: 'capitalize' }}>{String(r.status).replaceAll('_',' ')}</td>
                        <td style={td}>{r.markedAt ? new Date(r.markedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div> */}
        </>
      )}
    </div>
  );
}

function KPI({ title, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `5px solid ${color}`, borderRadius: 12, padding: 16 }}>
      <div style={{ color: '#475569', fontSize: 12, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function LegendDot({ color, label }){
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 9999, display: 'inline-block' }} />
      <span>{label}</span>
    </div>
  );
}

const inputStyle = { padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10 };
const btnStyle = { padding: '10px 12px', border: '1px solid #cbd5e1', background: 'white', borderRadius: 10, cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const th = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb', color: '#334155', fontWeight: 600 };
const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: '#0f172a' };
