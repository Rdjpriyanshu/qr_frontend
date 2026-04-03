import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { io } from 'socket.io-client';

export default function StudentDashboard() {
  const { user, token } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text: '' }
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [markedSession, setMarkedSession] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  // Socket.IO for real-time session notifications
  useEffect(() => {
    const socket = io('https://qr-backend-9g7m.onrender.com');

    socket.on('new-session', (session) => {
      setNotification(session);
      // Auto-hide after 10 seconds
      setTimeout(() => setNotification(null), 10000);
    });

    return () => socket.disconnect();
  }, []);

  const fetchAttendance = async () => {
    try {
      const res = await fetch('https://qr-backend-9g7m.onrender.com/api/student/attendance', { headers });
      const data = await res.json();
      if (res.ok) setAttendance(data.attendance);
    } catch (err) {
      console.error('Fetch attendance error:', err);
    }
  };

  const markAttendance = async (sessionCode) => {
    if (!sessionCode.trim()) return;
    
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('https://qr-backend-9g7m.onrender.com/api/student/mark-attendance', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionCode: sessionCode.trim().toUpperCase() })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error });
        setLoading(false);
        return;
      }

      setMessage({ type: 'success', text: data.message });
      setMarkedSession(data.session);
      setManualCode('');
      stopScanner();
      fetchAttendance();
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
    setLoading(false);
  };

  const startScanner = async () => {
    setScanning(true);
    setMessage(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Small delay to let DOM render
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          markAttendance(decodedText);
          html5QrCode.stop();
        },
        () => {} // ignore errors during scanning
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setMessage({ type: 'error', text: 'Camera access denied or not available. Use manual entry instead.' });
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    markAttendance(manualCode);
  };

  return (
    <>
      <Navbar />

      {/* Real-time notification */}
      {notification && (
        <div className="live-notification">
          <div className="notif-title">
            <span className="live-dot"></span>
            New Attendance Session!
          </div>
          <div className="notif-body">
            <strong>{notification.subject}</strong> by {notification.teacherName}
            <br />
            Code: <strong>{notification.sessionCode}</strong>
          </div>
        </div>
      )}

      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Welcome, <span className="welcome-greeting">{user.name}</span> 👋</h1>
          <p>Scan QR code to mark your attendance</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{attendance.length}</div>
            <div className="stat-label">Classes Attended</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">📱</div>
            <div className="stat-label">Ready to Scan</div>
          </div>
        </div>

        {/* Success State */}
        {markedSession && message?.type === 'success' && (
          <div className="section-card">
            <div className="attendance-success">
              <div className="check-icon">✅</div>
              <h2>Attendance Marked!</h2>
              <p><strong>{markedSession.subject}</strong></p>
              <p>Session Code: {markedSession.sessionCode}</p>
              <button 
                className="btn-secondary" 
                style={{ marginTop: '16px' }}
                onClick={() => { setMarkedSession(null); setMessage(null); }}
              >
                Mark Another
              </button>
            </div>
          </div>
        )}

        {/* Scanner Section */}
        {!markedSession && (
          <div className="section-card">
            <h2>📷 Scan QR Code</h2>
            
            {message && !markedSession && (
              <div className={`alert alert-${message.type}`}>{message.text}</div>
            )}

            <div className="qr-scanner-container">
              {scanning ? (
                <>
                  <div id="qr-reader" ref={scannerRef}></div>
                  <button className="btn-secondary" onClick={stopScanner}>
                    ✕ Stop Scanner
                  </button>
                </>
              ) : (
                <button className="btn-success" onClick={startScanner} id="btn-start-scan" style={{ width: '100%', maxWidth: '350px' }}>
                  📷 Open Camera to Scan
                </button>
              )}

              <div className="or-divider">OR</div>

              <form className="manual-entry" onSubmit={handleManualSubmit}>
                <input
                  type="text"
                  placeholder="Enter code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  id="input-manual-code"
                />
                <button type="submit" className="btn-success" disabled={loading || !manualCode} id="btn-submit-code">
                  {loading ? '...' : '✓'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Attendance History */}
        <div className="section-card">
          <h2>📚 My Attendance History</h2>
          {attendance.length > 0 ? (
            <div className="attendance-table-wrap">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{a.subject}</td>
                      <td>{a.teacher_name}</td>
                      <td>{new Date(a.session_date).toLocaleDateString()}</td>
                      <td className="status-present">✓ Present</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No attendance records yet. Scan a QR code to get started!</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
