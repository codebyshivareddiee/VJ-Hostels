import { useState, useEffect } from 'react';
import axios from 'axios';
import { List, RefreshCw, Search, User, Phone, Calendar, Clock } from 'lucide-react';

const ActivePasses = () => {
    const [activePasses, setActivePasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchActivePasses();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchActivePasses, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchActivePasses = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_SERVER_URL}/outpass-api/active-passes`);
            setActivePasses(response.data.activePasses || []);
        } catch (error) {
            console.error('Error fetching active passes:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPasses = activePasses.filter(pass =>
        pass.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pass.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const approvedPasses = filteredPasses.filter(p => p.status === 'approved');
    const outPasses = filteredPasses.filter(p => p.status === 'out');

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    <List size={32} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
                    Active Passes
                </h1>
                <p style={{ color: '#666', fontSize: '1rem' }}>
                    View all approved and currently active student passes
                </p>
            </div>

            {/* Controls */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '1.5rem',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                    <Search 
                        size={20} 
                        style={{ 
                            position: 'absolute', 
                            left: '12px', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            color: '#666'
                        }} 
                    />
                    <input
                        type="text"
                        placeholder="Search by name or roll number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 40px',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            fontSize: '1rem'
                        }}
                    />
                </div>

                <button
                    onClick={fetchActivePasses}
                    disabled={loading}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#2196F3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ 
                display: 'flex', 
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div style={{
                    flex: '1',
                    backgroundColor: '#e8f5e9',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    borderLeft: '4px solid #4CAF50'
                }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 0.5rem 0' }}>Approved (Not Left)</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{approvedPasses.length}</p>
                </div>

                <div style={{
                    flex: '1',
                    backgroundColor: '#fff3e0',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    borderLeft: '4px solid #FF9800'
                }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 0.5rem 0' }}>Currently Out</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{outPasses.length}</p>
                </div>
            </div>

            {loading && activePasses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                    <p>Loading active passes...</p>
                </div>
            ) : filteredPasses.length === 0 ? (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '3rem', 
                    backgroundColor: '#f5f5f5',
                    borderRadius: '12px'
                }}>
                    <p style={{ color: '#666' }}>
                        {searchTerm ? 'No passes found matching your search.' : 'No active passes at the moment.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Approved Passes Section */}
                    {approvedPasses.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#4CAF50' }}>
                                Approved (Waiting to Leave) - {approvedPasses.length}
                            </h2>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', 
                                gap: '1rem' 
                            }}>
                                {approvedPasses.map((pass) => (
                                    <PassCard key={pass._id} pass={pass} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Out Passes Section */}
                    {outPasses.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#FF9800' }}>
                                Currently Out - {outPasses.length}
                            </h2>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', 
                                gap: '1rem' 
                            }}>
                                {outPasses.map((pass) => (
                                    <PassCard key={pass._id} pass={pass} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const PassCard = ({ pass }) => {
    const statusColor = pass.status === 'approved' ? '#4CAF50' : '#FF9800';
    const bgColor = pass.status === 'approved' ? '#e8f5e9' : '#fff3e0';

    return (
        <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            borderLeft: `4px solid ${statusColor}`
        }}>
            <div style={{
                backgroundColor: bgColor,
                padding: '1rem',
                borderBottom: '1px solid #e0e0e0'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{pass.name}</h3>
                    <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        backgroundColor: statusColor,
                        color: '#fff'
                    }}>
                        {pass.status.toUpperCase()}
                    </span>
                </div>
            </div>

            <div style={{ padding: '1rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.9rem' }}>
                        <User size={16} />
                        <span><strong>Roll:</strong> {pass.rollNumber}</span>
                    </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.9rem' }}>
                        <Phone size={16} />
                        <span><strong>Parent:</strong> {pass.parentMobileNumber}</span>
                    </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.9rem' }}>
                        <Calendar size={16} />
                        <span><strong>Type:</strong> {pass.type}</span>
                    </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.9rem' }}>
                        <Clock size={16} />
                        <span><strong>Out:</strong> {new Date(pass.outTime).toLocaleString()}</span>
                    </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '0.9rem' }}>
                        <Clock size={16} />
                        <span><strong>In:</strong> {new Date(pass.inTime).toLocaleString()}</span>
                    </div>
                </div>

                {pass.actualOutTime && (
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        backgroundColor: '#fff3e0',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                    }}>
                        <strong>Left at:</strong> {new Date(pass.actualOutTime).toLocaleString()}
                    </div>
                )}

                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                }}>
                    <strong>Reason:</strong> {pass.reason}
                </div>
            </div>
        </div>
    );
};

export default ActivePasses;
