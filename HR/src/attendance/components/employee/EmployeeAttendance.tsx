'use client';

import * as React from 'react';
import { Box, Card, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import CameraBox from './CameraBox';
import StatusCards from './StatusCards';
import HistoryTable from './HistoryTable';
import ModernHistoryTable from './ModernHistoryTable';
import Alerts, { AlertState } from '../../components/common/Alerts';
import { API_BASE, apiFetch } from '../../lib/api';
import { getToken, getUser, setUser } from '../../lib/storage';
import { formatMinutesToHMM } from '../../lib/format';

type EmployeeAttendanceProps = {
  showHistory?: boolean;
  showOverview?: boolean;
  autoStartCamera?: boolean;
};

export default function EmployeeAttendance({ showHistory = true, showOverview = true, autoStartCamera = false }: EmployeeAttendanceProps) {
  const DETECTION_INTERVAL_MS = 500;
  const { pathname } = useLocation();
  const videoRef = React.useRef<HTMLVideoElement>(null!);
  const canvasRef = React.useRef<HTMLCanvasElement>(null!);
  const ctxRef = React.useRef<CanvasRenderingContext2D | null>(null);
  const faceDetectionInterval = React.useRef<number | null>(null);
  const locationWatchRef = React.useRef<number | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const startingCameraRef = React.useRef(false);
  const detectingRef = React.useRef(false);

  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [faceStatus, setFaceStatus] = React.useState('Camera not started');
  const [faceRecognitionStatus, setFaceRecognitionStatus] = React.useState('Not Active');
  const [cameraActive, setCameraActive] = React.useState(false);

  const [sessionStatus, setSessionStatus] = React.useState('Not Checked');
  const [sessionStatusColor, setSessionStatusColor] = React.useState('info.main');
  const [hasActiveSession, setHasActiveSession] = React.useState(false);
  const [locationStatus, setLocationStatus] = React.useState('Detecting...');
  const [locationColor, setLocationColor] = React.useState('info.main');
  const [networkStatus, setNetworkStatus] = React.useState('Detecting...');
  const [networkColor, setNetworkColor] = React.useState('info.main');
  const [isWithinOffice, setIsWithinOffice] = React.useState<boolean | null>(null);
  const [officeDistanceMeters, setOfficeDistanceMeters] = React.useState<number | null>(null);

  const [currentLocation, setCurrentLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = React.useState<string>('');
  const [currentNetwork, setCurrentNetwork] = React.useState<any>(null);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const [historyRecords, setHistoryRecords] = React.useState<any[]>([]);
  const [buttonsEnabled, setButtonsEnabled] = React.useState(false);
  const [alert, setAlert] = React.useState<AlertState>({ open: false, message: '', severity: 'info' });
  const [expectedEmployeeId, setExpectedEmployeeId] = React.useState('');
  const [isFieldWork, setIsFieldWork] = React.useState(false);

  const resolveCurrentUser = React.useCallback(async (): Promise<any | null> => {
    const localUser = getUser();
    if (localUser && ((localUser as any).employee_id || (localUser as any).username || (localUser as any).full_name)) {
      setCurrentUser(localUser);
      return localUser as any;
    }
    try {
      const token = getToken();
      if (!token) return null;
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      setUser(data);
      setCurrentUser(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  React.useEffect(() => {
    void resolveCurrentUser();

    initializeLocation();
    void initializeNetwork();
    loadAttendanceStatus();
    loadAttendanceHistory();

    const canvas = canvasRef.current;
    if (canvas) ctxRef.current = canvas.getContext('2d');

    return () => {
      stopCamera();
      if (locationWatchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [resolveCurrentUser]);

  React.useEffect(() => {
    if (!autoStartCamera) return;
    if ((pathname || '').includes('/attendance/my-attendance')) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [autoStartCamera, pathname]);

  React.useEffect(() => {
    if (!(pathname || '').includes('/attendance/my-attendance')) {
      stopCamera();
    }
  }, [pathname]);

  const showAlert = (message: string, severity: AlertState['severity'] = 'info') => {
    setAlert({ open: true, message, severity });
  };

  const startCamera = async () => {
    if (cameraActive || streamRef.current || videoRef.current?.srcObject || startingCameraRef.current) return;
    startingCameraRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          setFaceStatus('Camera started...');
          setCameraActive(true);
          startFaceDetection();
        };
      }
    } catch (err) {
      showAlert('Camera error', 'error');
    } finally {
      startingCameraRef.current = false;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null;
    }
    if (faceDetectionInterval.current) {
      window.clearInterval(faceDetectionInterval.current);
      faceDetectionInterval.current = null;
    }
    setCameraActive(false);
    setButtonsEnabled(false);
    setFaceStatus('Camera stopped');
    setFaceRecognitionStatus('Not Active');
    detectingRef.current = false;
  };

  const startFaceDetection = () => {
    if (faceDetectionInterval.current) window.clearInterval(faceDetectionInterval.current);
    void detectFaces(); // run first scan immediately for faster feedback
    faceDetectionInterval.current = window.setInterval(detectFaces, DETECTION_INTERVAL_MS);
  };

  const detectFaces = async () => {
    if (detectingRef.current) return;
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!ctx || !canvas || !video || video.readyState < 2) return;

    detectingRef.current = true;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.65);

    try {
      const res = await fetch(`${API_BASE}/attendance/detect-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ image: imageData })
      });
      const result = await res.json();

      if (result.success) {
        if (result.is_real === false) {
          setFaceStatus('⚠️ SPOOFING DETECTED');
          setButtonsEnabled(false);
          setFaceRecognitionStatus('Not Active');
          return;
        }

        if (result.bounding_boxes?.length > 0) {
          updateFaceStatus(result.bounding_boxes);
        } else {
          setFaceStatus(result.message || 'No face detected');
          setButtonsEnabled(false);
          setFaceRecognitionStatus('Not Active');
        }
      }
    } catch (err) {
      console.error('Face detection error:', err);
      setButtonsEnabled(false);
      setFaceStatus('Detection error');
    } finally {
      detectingRef.current = false;
    }
  };

  const normalizeIdentifier = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const getEmailLocal = (value: unknown) => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw.includes('@')) return '';
    return raw.split('@')[0].trim();
  };
  const readAppSession = () => {
    try {
      const raw = localStorage.getItem('HRMSS_AUTH_SESSION');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const getCurrentUserIdentifiers = (sourceUser?: any) => {
    const targetUser = sourceUser || currentUser;
    const appSession = readAppSession();
    const values = [
      targetUser?.employee_id,
      targetUser?.username,
      targetUser?.full_name,
      targetUser?.email,
      getEmailLocal(targetUser?.email),
      appSession?.employee_id,
      appSession?.employeeId,
      appSession?.id,
      appSession?.user_id,
      appSession?.userId,
      appSession?.identifier,
      appSession?.email,
      getEmailLocal(appSession?.email)
    ];
    return values
      .map((v) => normalizeIdentifier(v))
      .filter(Boolean);
  };

  const getBoxEmployeeId = (box: any) => {
    const directId = box?.employee_id;
    if (directId) return String(directId);

    const label = String(box?.label ?? '').trim();
    if (!label) return '';
    const idFromLabel = label.split('(')[0].trim();
    if (!idFromLabel || idFromLabel.toLowerCase() === 'unknown') return '';
    return idFromLabel;
  };

  const getBoxDisplayName = (box: any) => {
    const fullName = String(box?.full_name ?? '').trim();
    if (fullName) return fullName;
    const label = String(box?.label ?? '').trim();
    if (label) {
      const fromLabel = label.split('(')[0].trim();
      if (fromLabel && fromLabel.toLowerCase() !== 'unknown') return fromLabel;
    }
    const employeeId = getBoxEmployeeId(box);
    return employeeId || 'Unknown';
  };

  const updateFaceStatus = (boxes: any[]) => {
    let resolvedUser = currentUser;
    if (!resolvedUser) {
      const local = getUser();
      if (local) {
        resolvedUser = local as any;
        setCurrentUser(local);
      }
    }

    const statusEmployeeId = normalizeIdentifier(expectedEmployeeId);
    const appSession = readAppSession();
    const appSessionEmployeeId = normalizeIdentifier(appSession?.employee_id || appSession?.employeeId || appSession?.id);
    const fallbackEmployeeId = normalizeIdentifier(resolvedUser?.employee_id);
    const expectedId = statusEmployeeId || appSessionEmployeeId || fallbackEmployeeId;
    const expectedName = normalizeIdentifier(resolvedUser?.full_name || appSession?.full_name || appSession?.name);

    if (!expectedId) {
      setFaceStatus('Loading user profile...');
      setButtonsEnabled(false);
      setFaceRecognitionStatus('Not Active');
      return;
    }
    const match = boxes.find((b: any) => {
      const isRecognized = b.recognized === true || b.color === 'green';
      if (!isRecognized) return false;
      const recognizedId = normalizeIdentifier(b?.employee_id || getBoxEmployeeId(b));
      if (!!recognizedId && recognizedId === expectedId) return true;

      // Fallback for legacy name-based face mappings: allow exact full-name match only.
      const recognizedName = normalizeIdentifier(
        b?.full_name ||
        (typeof b?.label === 'string' ? b.label.split('(')[0].trim() : '')
      );
      return !!expectedName && !!recognizedName && recognizedName === expectedName;
    });

    if (match) {
      const displayName = match?.full_name || currentUser?.full_name || getBoxDisplayName(match) || 'User';
      setFaceStatus(`Verified: ${displayName} (${Number(match.confidence || 0).toFixed(1)}%)`);
      setButtonsEnabled(true);
      setFaceRecognitionStatus('Active');
    } else {
      const anyFace = boxes.find((b: any) => {
        const recognizedId = normalizeIdentifier(b?.employee_id || getBoxEmployeeId(b));
        return (b.recognized === true || b.color === 'green') &&
          recognizedId &&
          recognizedId !== 'unknown' &&
          recognizedId !== expectedId;
      });
      if (anyFace) {
        const detectedName = getBoxDisplayName(anyFace) || 'Unknown';
        setFaceStatus(`Wrong person detected: ${detectedName} (${Number(anyFace.confidence || 0).toFixed(1)}%)`);
      } else if (boxes.length > 0) {
        const unknownBox = boxes[0];
        setFaceStatus(`Face not recognized (${unknownBox.label || 'Unknown'})`);
      } else {
        setFaceStatus('No face detected');
      }
      setButtonsEnabled(false);
      setFaceRecognitionStatus('Not Active');
    }
  };

  const cleanCoordinateString = (str: string) => {
    if (!str) return '';
    // Format: "Lat: 12.3456789, Lng: 80.1234567" or similar
    // We want to detect if it's JUST coordinates and format them nicely.
    const coordPattern = /Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i;
    const match = str.match(coordPattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    }
    return str;
  };

  const markAttendance = async (type: 'entry' | 'exit') => {
    if (!currentLocation) return showAlert('Location required', 'error');
    if (!buttonsEnabled) return showAlert('Face verification required', 'error');
    // Enforce geofence for office attendance
    if (!isFieldWork && isWithinOffice === false) {
      const dist = officeDistanceMeters !== null ? ` (${Math.round(officeDistanceMeters)}m away)` : '';
      return showAlert(`You are outside the office zone${dist}. Switch to Field Work or move within 500m of the office.`, 'error');
    }
    if (type === 'entry' && hasActiveSession) return showAlert('Already logged in. Please logout first.', 'info');
    if (type === 'exit' && !hasActiveSession) return showAlert('No active session. Please login first.', 'info');

    ctxRef.current?.drawImage(videoRef.current!, 0, 0);
    const faceImage = canvasRef.current?.toDataURL('image/jpeg', 0.8);

    try {
      const res = await fetch(`${API_BASE}/attendance/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          location_address: currentLocationAddress || undefined,
          face_image: faceImage,
          wifi_ssid: currentNetwork?.ssid || 'VijayShipping-Office',
          network_type: currentNetwork?.type || 'wifi',
          action: type,
          is_field_work: isFieldWork
        })
      });
      const result = await res.json();
      if (result.success) {
        showAlert(type === 'entry' ? 'Login recorded successfully.' : 'Logout recorded successfully.', 'success');
        loadAttendanceStatus();
        loadAttendanceHistory();
      } else {
        showAlert(result.message, 'error');
      }
    } catch (err) { showAlert('Error marking attendance', 'error'); }
  };

  const checkGeofence = async (latitude: number, longitude: number) => {
    try {
      const res = await apiFetch(
        `/attendance/check-geofence?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`
      );
      const data = await res.json();
      if (res.ok && data?.success) {
        setIsWithinOffice(!!data.is_within_geofence);
        setOfficeDistanceMeters(typeof data.distance_meters === 'number' ? data.distance_meters : null);
      }
    } catch (err) {
      console.error('Geofence check error:', err);
    }
  };

  const resolveLocationAddress = async (latitude: number, longitude: number) => {
    // Run geofence check in parallel with address lookup
    void checkGeofence(latitude, longitude);
    try {
      const res = await apiFetch(
        `/attendance/geocode?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`
      );
      const data = await res.json();
      const address = typeof data?.address === 'string' ? data.address.trim() : '';
      if (res.ok && data?.success && address) {
        const cleaned = cleanCoordinateString(address);
        setCurrentLocationAddress(cleaned);
        setLocationStatus(cleaned);
        setLocationColor('success.main');
        return;
      }
    } catch (err) {
      console.error('Geocode error:', err);
    }

    const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    setCurrentLocationAddress('');
    setLocationStatus(fallback);
    setLocationColor('warning.main');
  };

  const initializeLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Location not supported');
      setLocationColor('error.main');
      return;
    }
    setLocationStatus('Acquiring location...');
    setLocationColor('info.main');
    let bestPos: GeolocationPosition | null = null;
    let finalized = false;

    const finalize = () => {
      if (finalized) return;
      finalized = true;
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      if (bestPos) {
        const loc = { latitude: bestPos.coords.latitude, longitude: bestPos.coords.longitude };
        setCurrentLocation(loc);
        void resolveLocationAddress(loc.latitude, loc.longitude);
        return;
      }
      // Final fallback: try a single low-accuracy getCurrentPosition
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCurrentLocation(loc);
          void resolveLocationAddress(loc.latitude, loc.longitude);
        },
        () => {
          setLocationStatus('Location unavailable – please enable location access');
          setLocationColor('error.main');
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    locationWatchRef.current = navigator.geolocation.watchPosition(
      pos => {
        if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
          bestPos = pos;
        }
        // Accept any fix with accuracy ≤ 100m immediately
        if (bestPos.coords.accuracy <= 100) {
          finalize();
        }
      },
      (err) => {
        // Don't finalize on error — let timeout handle it so we keep trying.
        // Only finalize immediately if permission was denied (code 1).
        console.warn('Location watch error:', err.message, 'code:', err.code);
        if (err.code === 1) {
          // PERMISSION_DENIED — no point waiting
          finalized = true;
          if (locationWatchRef.current !== null) {
            navigator.geolocation.clearWatch(locationWatchRef.current);
            locationWatchRef.current = null;
          }
          setLocationStatus('Location access denied – please enable in browser settings');
          setLocationColor('error.main');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 30000
      }
    );

    // Fallback timeout: use whatever best fix we have after 15s
    window.setTimeout(finalize, 15000);
  };

  const initializeNetwork = async () => {
    const nav = navigator as Navigator & {
      connection?: { type?: string; effectiveType?: string };
    };
    const connection = nav.connection;
    const connectionType = String(connection?.type || '').toLowerCase();
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();

    if (connectionType === 'wifi') {
      setNetworkStatus('WiFi Connected');
      setNetworkColor('success.main');
      setCurrentNetwork({ type: 'wifi', ssid: null });
    } else if (connectionType === 'cellular' || effectiveType.includes('g')) {
      setNetworkStatus(`${effectiveType ? effectiveType.toUpperCase() : 'Mobile'} Data`);
      setNetworkColor('warning.main');
      setCurrentNetwork({ type: 'cellular', ssid: null });
    } else {
      setNetworkStatus('Network Detected');
      setNetworkColor('info.main');
      setCurrentNetwork({ type: 'unknown', ssid: null });
    }
  };

  const loadAttendanceStatus = async () => {
    try {
      const userObj = await resolveCurrentUser();
      const empId = userObj?.employee_id;
      if (!empId) return;

      const res = await apiFetch(`/attendance/status/${empId}`);
      const data = await res.json();
      if (data?.employee_id || data?.full_name) {
        if (data?.employee_id) {
          setExpectedEmployeeId(String(data.employee_id));
        }
        setCurrentUser((prev: any) => ({
          ...(prev || {}),
          employee_id: data.employee_id || prev?.employee_id,
          full_name: data.full_name || prev?.full_name
        }));
      }
      if (data.has_active_session) {
        setHasActiveSession(true);
        setSessionStatus('Active Session');
        setSessionStatusColor('success.main');
      } else {
        setHasActiveSession(false);
        setSessionStatus('No Active Session');
        setSessionStatusColor('info.main');
      }
    } catch (err) { }
  };

  const loadAttendanceHistory = async () => {
    try {
      const userObj = await resolveCurrentUser();
      const empId = userObj?.employee_id;
      if (!empId) return;

      const res = await apiFetch(`/attendance/my-attendance?employee_id=${empId}&limit=10`);
      const data = await res.json();
      if (data.records) setHistoryRecords(data.records);
    } catch (err) { } finally { setHistoryLoading(false); }
  };

  const employeeName = currentUser?.full_name || currentUser?.username || 'Employee';
  const getLocalDateKey = (value: Date | string) => {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayKey = getLocalDateKey(new Date());
  const todayRecords = historyRecords.filter((record) => {
    if (!record?.check_in) return false;
    return getLocalDateKey(record.check_in) === todayKey;
  });
  const dashboardHistoryRecords = todayRecords.length > 0
    ? todayRecords
    : historyRecords;
  const totalOfficeHoursRaw = todayRecords.filter(r => !r.is_field_work).reduce((sum, r) => sum + Number(r.total_hours || 0), 0);
  const totalFieldHoursRaw = todayRecords.filter(r => !!r.is_field_work).reduce((sum, r) => sum + Number(r.total_hours || 0), 0);

  const formatHours = (hours: number) => {
    if (!hours || hours <= 0) return '--';
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (mins === 0) return `${hrs} hr`;
    else if (hrs === 0) return `${mins} min`;
    else return `${hrs} hr ${mins} min`;
  };

  const todayOfficeHours = formatHours(totalOfficeHoursRaw);
  const todayFieldHours = formatHours(totalFieldHoursRaw);
  const todayPermissionHours = todayRecords.reduce((sum, record) => sum + Number(record.permission_hours || 0), 0);

  const latestRecord = historyRecords[0];
  const lastEntryTime = latestRecord?.check_in ? new Date(latestRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

  return (
    <Stack spacing={3}>
      {showOverview && (
        <>
          <Card sx={{
            borderRadius: '24px',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            bgcolor: 'background.paper',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
                Welcome, <Box component="span" sx={{ color: '#598791', fontWeight: 700, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{employeeName}</Box>
              </Typography>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            {[
              { label: 'Today Logs', value: String(todayRecords.length), helper: 'Total punches recorded', accent: '#598791', bg: 'linear-gradient(135deg, rgba(89, 135, 145, 0.1) 0%, rgba(89, 135, 145, 0.05) 100%)' },
              { label: 'Office Hours', value: todayOfficeHours, helper: 'Time at designated office', accent: '#059669', bg: 'linear-gradient(135deg, rgba(5, 150, 105, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)' },
              { label: 'Field Work', value: todayFieldHours, helper: 'Time spent on field duty', accent: '#7c3aed', bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)' }
            ].map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.label}>
                <Card sx={{
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                  height: '100%',
                  background: item.bg,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-2px)' }
                }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="overline" sx={{ color: item.accent, fontWeight: 900, mb: 0.5, letterSpacing: '0.05em' }}>
                      {item.label}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', mt: 0.5 }}>
                      <Typography variant="h4" sx={{ fontWeight: 900, color: '#1e293b' }}>
                        {item.value}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#64748b', mt: 1, fontWeight: 500, display: 'block' }}>
                      {item.helper}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      <CameraBox
        videoRef={videoRef}
        canvasRef={canvasRef}
        onStart={startCamera}
        onMarkEntry={() => markAttendance('entry')}
        onMarkExit={() => markAttendance('exit')}
        canStart={!cameraActive}
        canMarkEntry={buttonsEnabled && !hasActiveSession && (isFieldWork || isWithinOffice === true || isWithinOffice === null)}
        canMarkExit={buttonsEnabled && hasActiveSession && (isFieldWork || isWithinOffice === true || isWithinOffice === null)}
        cameraActive={cameraActive}
        faceStatus={faceStatus}
        attendanceStatus={
          !isFieldWork && isWithinOffice === false
            ? `⛔ Office attendance blocked — you are outside the office zone${officeDistanceMeters !== null ? ` (${Math.round(officeDistanceMeters)}m away)` : ''}. Switch to Field Work or move closer.`
            : buttonsEnabled
              ? (hasActiveSession ? 'Verification complete. Logout is enabled.' : 'Verification complete. Login is enabled.')
              : 'Verification required before attendance action.'
        }
      />
      <Box sx={{ px: 3, mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <input
            type="checkbox"
            id="field-work-toggle"
            checked={isFieldWork}
            onChange={(e) => setIsFieldWork(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="field-work-toggle" style={{ fontSize: '14px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            Mark as Field Work (Record Location)
          </label>
        </Stack>
      </Box>
      <StatusCards
        items={[
          { label: 'Session Status', value: sessionStatus, color: sessionStatusColor },
          { label: 'Location', value: locationStatus, color: locationColor },
          { label: 'Face Recognition', value: faceRecognitionStatus, color: faceRecognitionStatus === 'Active' ? 'success.main' : 'info.main' },
          {
            label: 'Office Zone',
            value: isWithinOffice === null
              ? 'Checking…'
              : isWithinOffice
                ? `✅ Within range${officeDistanceMeters !== null ? ` (${Math.round(officeDistanceMeters)}m)` : ''}`
                : `❌ Outside range${officeDistanceMeters !== null ? ` (${Math.round(officeDistanceMeters)}m away)` : ''}`,
            color: isWithinOffice === null ? 'info.main' : isWithinOffice ? 'success.main' : 'error.main'
          }
        ]}
      />
      {showHistory && (
        <ModernHistoryTable
          loading={historyLoading}
          records={pathname?.startsWith('/employee-dashboard/dashboard') ? dashboardHistoryRecords : historyRecords.slice(0, 5)}
          showLocation={false}
          enablePagination={pathname?.startsWith('/employee-dashboard/dashboard')}
          rowsPerPage={5}
          formatDurationFromHours={(h) => {
            if (!h || h <= 0) return '--';
            const hrs = Math.floor(h);
            const mins = Math.round((h - hrs) * 60);
            if (mins === 0) return `${hrs} hr`;
            else if (hrs === 0) return `${mins} min`;
            else return `${hrs} hr ${mins} min`;
          }}
          formatDurationFromTimes={(en, ex) => {
            if (!en || !ex) return '--';
            const start = new Date(en);
            const end = new Date(ex);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '--';
            const totalHours = (end.getTime() - start.getTime()) / 3600000;
            if (totalHours <= 0) return '--';
            const hrs = Math.floor(totalHours);
            const mins = Math.round((totalHours - hrs) * 60);
            if (mins === 0) return `${hrs} hr`;
            else if (hrs === 0) return `${mins} min`;
            else return `${hrs} hr ${mins} min`;
          }}
        />
      )}
      <Alerts alert={alert} onClose={() => setAlert(p => ({ ...p, open: false }))} />
    </Stack>
  );
}
