'use client';

import * as React from 'react';
import { Box, Button, Card, CardContent, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Alerts, { AlertState } from '../../components/common/Alerts';
import { API_BASE } from '../../lib/api';
import { getToken, getUser } from '../../lib/storage';

type AdminSelfAttendanceCardProps = {
    autoStartCamera?: boolean;
};

export default function AdminSelfAttendanceCard({ autoStartCamera = true }: AdminSelfAttendanceCardProps) {
    const theme = useTheme();
    const { pathname } = useLocation();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const ctxRef = React.useRef<CanvasRenderingContext2D | null>(null);
    const faceDetectionInterval = React.useRef<number | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const startingCameraRef = React.useRef(false);
    const detectingRef = React.useRef(false);
    const currentUserRef = React.useRef<any>(null);

    const [currentUser, setCurrentUser] = React.useState<any>(null);
    const [faceStatus, setFaceStatus] = React.useState('Camera not started');
    const [cameraActive, setCameraActive] = React.useState(false);
    const [canMark, setCanMark] = React.useState(false);
    const [currentLocation, setCurrentLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
    const [currentLocationAddress, setCurrentLocationAddress] = React.useState<string>('');
    const [locationStatus, setLocationStatus] = React.useState('Detecting location...');
    const [alert, setAlert] = React.useState<AlertState>({ open: false, message: '', severity: 'info' });
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);

    const cleanCoordinateString = (str: string) => {
        if (!str) return '';
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

    const fetchAttendanceStatus = async (empId: string) => {
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/attendance/status/${encodeURIComponent(empId)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                setIsLoggedIn(data.is_active);
            }
        } catch (err) {
            console.error('Status fetch error:', err);
        }
    };

    const resolveLocationAddress = async (latitude: number, longitude: number) => {
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/attendance/geocode?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data?.success && data?.address) {
                const cleaned = cleanCoordinateString(data.address);
                setCurrentLocationAddress(cleaned);
                setLocationStatus(cleaned);
                return;
            }
        } catch (err) {
            console.error('Geocode error:', err);
        }
        setLocationStatus(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    };

    React.useEffect(() => {
        const user = getUser<any>();
        if (user) {
            setCurrentUser(user);
            currentUserRef.current = user;
            const empId = user.employee_id || user.id || user.user_id;
            if (empId) void fetchAttendanceStatus(empId);
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setCurrentLocation(loc);
                void resolveLocationAddress(loc.latitude, loc.longitude);
            }, () => {
                setLocationStatus('Location access denied');
            });
        }

        const canvas = canvasRef.current;
        if (canvas) ctxRef.current = canvas.getContext('2d');

        return () => {
            stopCamera();
            if (faceDetectionInterval.current) window.clearInterval(faceDetectionInterval.current);
        };
    }, []);

    React.useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser]);

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
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    if (canvasRef.current && videoRef.current) {
                        canvasRef.current.width = videoRef.current.videoWidth;
                        canvasRef.current.height = videoRef.current.videoHeight;
                    }
                    void videoRef.current?.play?.();
                    setFaceStatus('Camera started');
                    setCameraActive(true);
                    startFaceDetection();
                };
            }
        } catch {
            showAlert('Unable to access camera', 'error');
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
        setCanMark(false);
        setFaceStatus('Camera stopped');
        detectingRef.current = false;
    };

    const startFaceDetection = () => {
        if (faceDetectionInterval.current) window.clearInterval(faceDetectionInterval.current);
        void detectFaces();
        faceDetectionInterval.current = window.setInterval(detectFaces, 1000);
    };

    const detectFaces = async () => {
        if (detectingRef.current || canMark === null) return; // canMark === null could be a loading state if we added it
        // Better: check a local marking state if we had one. 
        // For now let's just use the result pattern.
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!ctx || !canvas || !video || video.readyState < 2) return;

        detectingRef.current = true;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);

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
                    setCanMark(false);
                    return;
                }

                const boxes = result?.bounding_boxes || [];
                const match = boxes.find((b: any) => b.color === 'green' && b.recognized === true);
                if (match) {
                    setFaceStatus(`Verified (${match.confidence?.toFixed?.(1) || match.confidence || 0}%) — ${match.full_name || match.employee_id}`);
                    setCanMark(true);
                    setIsLoggedIn(match.is_logged_in === true);
                    return;
                }
                setCanMark(false);
                setFaceStatus(boxes.length ? 'Face detected, not verified' : 'No face detected');
            } else {
                setCanMark(false);
                setFaceStatus(result.message || 'Detection failed');
            }
        } catch {
            setCanMark(false);
            setFaceStatus('Face detection error');
        } finally {
            detectingRef.current = false;
        }
    };

    const markAttendance = async (action: 'entry' | 'exit') => {
        if (!currentLocation) {
            showAlert('Location is required to mark attendance', 'error');
            return;
        }
        if (!canMark) {
            showAlert('Face verification required', 'error');
            return;
        }

        if (videoRef.current) {
            ctxRef.current?.drawImage(videoRef.current, 0, 0);
        }
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
                    wifi_ssid: 'VijayShipping-Office',
                    network_type: 'wifi',
                    action
                })
            });
            const result = await res.json();
            if (result?.success) {
                showAlert(`${action === 'entry' ? 'Login' : 'Logout'} marked successfully`, 'success');
            } else {
                showAlert(result?.message || 'Failed to mark attendance', 'error');
            }
        } catch {
            showAlert('Failed to mark attendance', 'error');
        }
    };

    return (
        <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            My Attendance
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Mark admin login and logout from dashboard.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            width: '100%',
                            maxWidth: 560,
                            borderRadius: '14px',
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: alpha(theme.palette.primary.main, 0.25)
                        }}
                    >
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{ width: '100%', height: 'auto', display: 'block', background: '#0b1220' }}
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                        <Button variant="contained" onClick={startCamera} disabled={cameraActive}>Start Camera</Button>
                        <Button variant="contained" color="success" onClick={() => markAttendance('entry')} disabled={!canMark || isLoggedIn}>Login</Button>
                        <Button variant="contained" color="error" onClick={() => markAttendance('exit')} disabled={!canMark || !isLoggedIn}>Logout</Button>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <Box sx={{ p: 1.5, flex: 1, borderRadius: '12px', bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                                FACE STATUS
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {faceStatus}
                            </Typography>
                        </Box>
                        <Box sx={{ p: 1.5, flex: 2, borderRadius: '12px', bgcolor: alpha(theme.palette.success.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.1) }}>
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                                CURRENT LOCATION
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                                {locationStatus}
                            </Typography>
                        </Box>
                    </Stack>
                </Stack>
            </CardContent>
            <Alerts alert={alert} onClose={() => setAlert((p) => ({ ...p, open: false }))} />
        </Card>
    );
}
