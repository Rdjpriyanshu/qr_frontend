import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';

export default function TeacherDashboard() {
  const { user, token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(15);
  const [activeSession, setActiveSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timer, setTimer] = useState('');
  const [viewingSession, setViewingSession] = useState(null);

  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` 
  };

  // Fetch sessions on load
  useEffect(() => {
    fetchSessions();
  }, []);

  // Socket.IO for real-time attendance updates
  useEffect(() => {
    const socket = io('https://qr-backend-9g7m.onrender.com');
    
    socket.on('attendance-marked', (data) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setAttendees(prev => [...prev, {
          name: data.studentName,
          email: data.studentEmail,
          marked_at: data.markedAt
        }]);
      }
    });

    return () => socket.disconnect();
  }, [activeSession]);

  // Timer countdown
  useEffect(() => {
    if (!activeSession) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const expires = new Date(activeSession.expiresAt);
      const diff = expires - now;
      
      if (diff <= 0) {
        setTimer('Expired');
        clearInterval(interval);
        return;
      }
      
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimer(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('https://qr-backend-9g7m.onrender.com/api/teacher/sessions', { headers });
      const data = await res.json();
      if (res.ok) setSessions(data.sessions);
    } catch (err) {
      console.error('Fetch sessions error:', err);
    }
  };

  const createSession = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!subject.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('https://qr-backend-9g7m.onrender.com/api/teacher/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject: subject.trim(), durationMinutes: parseInt(duration) })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setActiveSession(data.session);
      setAttendees([]);
      setSuccess('Session created! Share the QR code with students.');
      setSubject('');
      fetchSessions();
    } catch (err) {
      setError('Failed to create session');
    }
    setLoading(false);
  };

  const viewAttendance = async (sessionId) => {
    try {
      const res = await fetch(`https://qr-backend-9g7m.onrender.com/api/teacher/session/${sessionId}/attendance`, { headers });
      const data = await res.json();
      if (res.ok) {
        setViewingSession(data.session);
        setAttendees(data.attendees);
        setTotalStudents(data.totalStudents);
      }
    } catch (err) {
      console.error('View attendance error:', err);
    }
  };

  const exportExcel = async (sessionId) => {
    try {
      const res = await fetch(`https://qr-backend-9g7m.onrender.com/api/teacher/session/${sessionId}/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <>
      <Navbar />
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Welcome, <span className="welcome-greeting">{user.name}</span> 👋</h1>
          <p>Manage your attendance sessions</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{sessions.length}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{activeSession ? '🟢' : '⚪'}</div>
            <div className="stat-label">Active Session</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {sessions.reduce((sum, s) => sum + (s.attendee_count || 0), 0)}
            </div>
            <div className="stat-label">Total Scans</div>
          </div>
        </div>

        {/* Create Session */}
        <div className="section-card">
          <h2>📝 Create Attendance Session</h2>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          
          <form className="create-session-form" onSubmit={createSession}>
            <input
              type="text"
              placeholder="Subject name (e.g. Mathematics)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              id="input-subject"
            />
            <input
              type="number"
              placeholder="Duration (min)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="120"
              style={{ maxWidth: '140px' }}
              id="input-duration"
            />
            <button type="submit" className="btn-success" disabled={loading} id="btn-create-session">
              {loading ? 'Creating...' : '+ Create'}
            </button>
          </form>
        </div>

        {/* Active QR Code */}
        {activeSession && (
          <div className="section-card">
            <h2>📱 Active QR Code</h2>
            <div className="qr-display">
              <QRCodeSVG
                value={activeSession.sessionCode}
                size={250}
                level="H"
                bgColor="#ffffff"
                fgColor="#0a0a1a"
              />
              <div className="qr-session-info">
                <div className="session-code">{activeSession.sessionCode}</div>
                <div className="session-detail">
                  {activeSession.subject} • Share this QR code with students
                </div>
                <div className="qr-timer">🕐 Time remaining: {timer}</div>
              </div>
            </div>

            {/* Live attendance count */}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <span className="session-count">
                <span className="live-dot"></span>
                {attendees.length} student{attendees.length !== 1 ? 's' : ''} marked
              </span>
            </div>
          </div>
        )}

        {/* View Attendance Details */}
        {viewingSession && (
          <div className="section-card">
            <h2>📊 Attendance — {viewingSession.subject}</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div className="stats-grid" style={{ flex: 1, marginBottom: 0 }}>
                <div className="stat-card">
                  <div className="stat-value">{attendees.length}</div>
                  <div className="stat-label">Present</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{totalStudents - attendees.length}</div>
                  <div className="stat-label">Absent</div>
                </div>
              </div>
              <button 
                className="btn-export" 
                onClick={() => exportExcel(viewingSession.id)}
                id="btn-export"
              >
                📥 Export Excel
              </button>
            </div>

            {attendees.length > 0 ? (
              <div className="attendance-table-wrap">
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map((a, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{a.name}</td>
                        <td>{a.email}</td>
                        <td>{new Date(a.marked_at).toLocaleTimeString()}</td>
                        <td className="status-present">✓ Present</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No students have marked attendance yet</p>
              </div>
            )}

            <button 
              className="btn-secondary" 
              style={{ marginTop: '16px' }}
              onClick={() => setViewingSession(null)}
            >
              ← Back
            </button>
          </div>
        )}

        {/* Session History */}
        {!viewingSession && (
          <div className="section-card">
            <h2>📚 Session History</h2>
            {sessions.length > 0 ? (
              <div className="session-list">
                {sessions.map((s) => (
                  <div 
                    key={s.id} 
                    className="session-item" 
                    onClick={() => viewAttendance(s.id)}
                  >
                    <div>
                      <div className="session-subject">{s.subject}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Code: {s.session_code} • {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="session-meta">
                      <span className="session-count">
                        👤 {s.attendee_count || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <p>No sessions created yet. Create your first one above!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
