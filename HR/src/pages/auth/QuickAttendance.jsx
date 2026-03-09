import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Camera,
    MapPin,
    RotateCw,
    Bell,
    UserRound,
    Menu,
    CheckCircle,
    AlertCircle,
    Search,
    Globe
} from "lucide-react";
import API_BASE_URL from "../../config";

export default function QuickAttendance() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    // States
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [address, setAddress] = useState("");
    const [coordinates, setCoordinates] = useState(null);
    const [locationStatus, setLocationStatus] = useState("Detecting location...");
    const [error, setError] = useState("");
    const [workMode, setWorkMode] = useState("Office"); // "Office" or "Field"

    // Identity states
    const [faceStatus, setFaceStatus] = useState("Camera not started");
    const [canMark, setCanMark] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [identifiedUser, setIdentifiedUser] = useState({ employeeId: "", fullName: "" });

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const watchIdRef = useRef(null);
    const isMountedRef = useRef(true);
    const isStartingRef = useRef(false);
    const cameraRequestIdRef = useRef(0);
    const detectionIntervalRef = useRef(null);

    const [locationWatchId, setLocationWatchId] = useState(null);

    useEffect(() => {
        isMountedRef.current = true;
        initializeLocation();
        return () => {
            isMountedRef.current = false;
            // Force stop everything on unmount
            stopCamera();
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []); // Run only once on mount

    useEffect(() => {
        if (videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    }, [cameraStream, submitted]);

    const stopCamera = () => {
        // 1. Thoroughly stop tracks in ref
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamRef.current = null;
        }

        // 2. Detach from video element
        if (videoRef.current) {
            videoRef.current.srcObject = null;
            try { videoRef.current.pause(); } catch (e) { }
        }

        // 3. Clear State & Lock
        isStartingRef.current = false;
        setCameraStream(null);
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }
        setCameraActive(false);
        setCanMark(false);
        setFaceStatus("Camera offline");
    };

    const initializeLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus("Geolocation not supported");
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setCoordinates({ latitude, longitude });

                // Only geocode once or when moved significantly
                if (locationStatus === "Detecting location..." || locationStatus.includes(",")) {
                    try {
                        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                        console.log("[Geocoding] Using API Key:", apiKey ? "Key Found" : "MISSING");

                        if (!apiKey) {
                            setLocationStatus("Address Service Unavailable (Missing Key)");
                            return;
                        }

                        const response = await fetch(
                            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
                        );
                        const data = await response.json();
                        console.log("[Geocoding] Result Status:", data.status);

                        if (data.status === "OK" && data.results?.[0]) {
                            const formattedAddress = data.results[0].formatted_address;
                            setAddress(formattedAddress);
                            setLocationStatus(formattedAddress);
                        } else {
                            console.error("[Geocoding] Failed:", data.error_message || data.status);
                            setLocationStatus(`Address not found (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
                        }
                    } catch (err) {
                        console.error("[Geocoding] Network/Fetch Error:", err);
                        setLocationStatus(`Location error (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
                    }
                }
            },
            (err) => {
                setLocationStatus("Location access denied");
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        watchIdRef.current = watchId;
        setLocationWatchId(watchId);

        // AUTO START CAMERA IMMEDIATELY - Don't wait for GPS
        startCamera();
    };

    const startCamera = async () => {
        if (!isMountedRef.current || isStartingRef.current) return;

        // Lock and increment ID
        isStartingRef.current = true;
        const currentId = ++cameraRequestIdRef.current;

        // Defense: Stop any existing stream first
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        setError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
            });

            // ABORT CHECK: If user left, or another request started, STOP THIS STREAM IMMEDIATELY
            if (!isMountedRef.current || currentId !== cameraRequestIdRef.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = stream;
            setCameraStream(stream);
            setCameraActive(true);
            setFaceStatus("Ready - Click Login/Logout");
            isStartingRef.current = false;
            // Live scanning loop removed - we now verify only on button click as requested
        } catch (err) {
            console.error("Camera fail:", err);
            isStartingRef.current = false;
            if (isMountedRef.current && currentId === cameraRequestIdRef.current) {
                setError("Camera access denied.");
                setFaceStatus("Camera error");
            }
        }
    };

    const performFaceDetection = async () => {
        if (!videoRef.current || isDetecting || loading || submitted) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || video.readyState < 2) return;

        setIsDetecting(true);
        const context = canvas.getContext("2d");

        // Fixed resolution (640max) for ultra-fast processing
        const targetWidth = 640;
        const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.drawImage(video, 0, 0, targetWidth, targetHeight);

        try {
            const base64Image = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
            if (!base64Image) throw new Error("Failed to capture image data");

            const response = await fetch(`${API_BASE_URL}/api/v1/attendance/detect-face`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                if (!result.is_real) {
                    setIdentifiedUser({ employee_id: "", fullName: "" });
                    setFaceStatus("⚠️ SPOOFING DETECTED");
                    setError("Warning: Live face not detected. Continuous violations will result in disciplinary action.");
                    setCanMark(false);
                    return;
                }

                if (result.has_face) {
                    const match = result.bounding_boxes?.find(box => box.recognized);
                    if (match) {
                        setIdentifiedUser({
                            employeeId: match.employee_id,
                            fullName: match.full_name
                        });
                        setFaceStatus(`Verified (${match.confidence?.toFixed(1)}%) — ${match.full_name}`);
                        setCanMark(true);
                        setIsLoggedIn(match.is_logged_in === true);
                        setError("");
                    } else {
                        setIdentifiedUser({ employeeId: "", fullName: "" });
                        setFaceStatus(result.bounding_boxes?.length ? "Face detected, not verified" : "No face detected");
                        setCanMark(false);
                    }
                } else {
                    setFaceStatus("No face detected");
                    setCanMark(false);
                }
            } else {
                setFaceStatus(result.message || "Detection failed");
                setCanMark(false);
            }
        } catch (err) {
            console.error("Face detection error:", err);
            setFaceStatus(`Detection error: ${err.message}`);
            setCanMark(false);
        } finally {
            setIsDetecting(false);
        }
    };

    const handleMarkAttendance = async (action) => {
        if (!coordinates || loading) return;
        setLoading(true);
        setError("");
        setFaceStatus("Verifying...");

        try {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const context = canvas.getContext("2d");

            // Limit resolution to 640 for fast transfer
            const targetWidth = 640;
            const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            context.drawImage(video, 0, 0, targetWidth, targetHeight);

            const finalImage = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

            // In Click-to-Verify mode, mark-quick handles identification, antispoof, and record creation
            const response = await fetch(`${API_BASE_URL}/api/v1/attendance/mark-quick`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    face_image: finalImage,
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                    location_address: address || undefined,
                    employee_id: undefined, // Let the backend identify from the image
                    action: action, // 'entry' or 'exit'
                    is_field_work: workMode === "Field"
                }),
            });

            const result = await response.json();
            if (result.success) {
                const empName = result.data?.full_name || "Employee";
                setSuccessMessage(`${empName} - ${action === 'entry' ? "Login" : "Logout"} successful!`);
                setSubmitted(true);
                stopCamera(); // Turn off camera IMMEDIATELY for instant privacy feedback

                setTimeout(() => {
                    setSubmitted(false);
                    setCanMark(false);
                    setIdentifiedUser({ employeeId: "", fullName: "" });
                    setFaceStatus("Verification stored - Camera off");
                }, 1000);
            } else {
                setFaceStatus("Verification Failed");
                setError(result.message || "Failed to mark attendance.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Removed early return for submitted state to keep video element in DOM

    return (
        <div className="min-h-screen relative flex items-center justify-center font-sans overflow-hidden">
            {/* Background Layer */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(background.png)` }}
            />
            {/* Overlay Layer */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            {/* Success Overlay */}
            {submitted && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl border p-12 max-w-md w-full text-center animate-in zoom-in duration-300">
                        <div className="mb-6 flex justify-center">
                            <div className="p-4 bg-green-100 rounded-full text-green-600">
                                <CheckCircle size={60} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">Success!</h3>
                        <p className="text-xl font-semibold text-indigo-600 mb-4">{successMessage?.split(' - ')[0]}</p>
                        <p className="text-gray-600 mb-8">{successMessage?.split(' - ')[1] || successMessage}</p>
                        <p className="text-gray-400 text-xs italic font-medium">Ready for next user in a second...</p>
                    </div>
                </div>
            )}

            {/* Back Button */}
            <button
                onClick={() => {
                    stopCamera();
                    navigate("/login", { replace: true });
                }}
                className="absolute top-8 left-8 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 active:scale-95 shadow-lg backdrop-blur-md border border-white/20"
                title="Back to Dashboard"
            >
                <ArrowLeft size={24} />
            </button>

            {/* Attendance Card Container */}
            <div className="relative z-10 w-full max-w-2xl px-6 py-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="bg-white rounded-[32px] shadow-2xl border-none overflow-hidden">
                    <div className="p-8 sm:p-10">
                        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">My Attendance</h2>
                                <p className="text-gray-500 text-sm mt-1 font-medium">Mark login and logout for Employees.</p>
                            </div>
                            <img src="/VijayShipping_Logo.png" alt="Vijay Shipping" className="h-10 w-auto" />
                        </div>

                        {/* Video Layer */}
                        <div className="mb-8 relative w-full aspect-video rounded-3xl overflow-hidden border border-gray-100 bg-[#0b1220] shadow-2xl group">
                            {cameraActive ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover scale-x-[-1]"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                                    <Camera size={56} className="opacity-20 mb-4" />
                                    <p className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Camera Inactive</p>
                                </div>
                            )}
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Scanning Pulse */}
                            {isDetecting && cameraActive && (
                                <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                                    <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] text-white font-bold tracking-widest uppercase">Live Scan</span>
                                </div>
                            )}
                        </div>

                        {/* Error Handling */}
                        {error && (
                            <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center gap-3 text-red-700 text-sm font-bold animate-in fade-in slide-in-from-left-2">
                                <AlertCircle size={20} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Work Mode Selector */}
                        <div className="mb-8 p-1 bg-gray-100 rounded-2xl flex items-center shadow-inner">
                            <button
                                onClick={() => setWorkMode("Office")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs tracking-wider transition-all ${workMode === "Office" ? "bg-white text-indigo-600 shadow-md scale-[1.02]" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                <CheckCircle size={16} className={workMode === "Office" ? "opacity-100" : "opacity-0"} />
                                IN OFFICE
                            </button>
                            <button
                                onClick={() => setWorkMode("Field")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs tracking-wider transition-all ${workMode === "Field" ? "bg-white text-emerald-600 shadow-md scale-[1.02]" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                <Globe size={16} className={workMode === "Field" ? "opacity-100" : "opacity-0"} />
                                FIELD WORK
                            </button>
                        </div>

                        {/* Operations Row */}
                        <div className="flex flex-wrap gap-4 mb-10">
                            <button
                                onClick={startCamera}
                                disabled={cameraActive}
                                className={`px-8 py-3.5 rounded-2xl font-black text-xs tracking-widest transition-all border-2 ${cameraActive ? "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed" : "bg-white text-gray-900 border-gray-900 hover:bg-gray-900 hover:text-white active:scale-95 shadow-lg"}`}
                            >
                                START CAMERA
                            </button>
                            <button
                                onClick={() => handleMarkAttendance('entry')}
                                disabled={!cameraActive || loading}
                                className={`flex-1 px-10 py-3.5 rounded-2xl font-black text-xs tracking-widest transition-all shadow-xl active:scale-95 ${(!cameraActive || loading) ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none" : "bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5"}`}
                            >
                                {loading && <RotateCw className="animate-spin mr-2 inline" size={16} />}
                                LOGIN
                            </button>
                            <button
                                onClick={() => handleMarkAttendance('exit')}
                                disabled={!cameraActive || loading}
                                className={`flex-1 px-10 py-3.5 rounded-2xl font-black text-xs tracking-widest transition-all shadow-xl active:scale-95 ${(!cameraActive || loading) ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none" : "bg-red-600 text-white hover:bg-red-700 hover:-translate-y-0.5"}`}
                            >
                                {loading && <RotateCw className="animate-spin mr-2 inline" size={16} />}
                                LOGOUT
                            </button>
                        </div>

                        {/* Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">FACE STATUS</span>
                                <span className="block text-sm font-extrabold text-slate-800 leading-tight">
                                    {faceStatus === "Camera not started" ? "No face detected" : faceStatus}
                                </span>
                            </div>
                            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col justify-center md:col-span-2">
                                <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">CURRENT LOCATION</span>
                                <span className="block text-sm font-extrabold text-slate-800 leading-tight line-clamp-2">
                                    {address || (coordinates ? `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}` : locationStatus)}
                                </span>
                                {(coordinates && !address) && (
                                    <span className="block text-[10px] text-emerald-600 mt-1">
                                        GPS: {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                body {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
            `}</style>
        </div >
    );
}


