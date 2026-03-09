import { useEffect, useRef, useState } from "react";
import API_BASE_URL from "../../config";

export default function FaceEnroll() {
  const [employeeId, setEmployeeId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" | "error" | "info"
  const [cameraOpen, setCameraOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Start camera when cameraOpen becomes true
  useEffect(() => {
    if (cameraOpen) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          setMessage("Camera access denied. Please allow camera permission and try again.");
          setMessageType("error");
          setCameraOpen(false);
        });
    }
  }, [cameraOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Capture a frame from the video and return as base64 JPEG
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Returns "data:image/jpeg;base64,..." — backend needs the raw base64
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  };

  const handleStartEnrollment = async () => {
    const id = employeeId.trim();
    if (!id) {
      setMessage("Please enter an Employee ID.");
      setMessageType("error");
      return;
    }

    setMessage("Checking employee status...");
    setMessageType("info");
    setFinished(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/attendance/check-enrollment/${id}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setMessage("");
        setMessageType("");
        setCameraOpen(true);
      } else {
        setMessage(`❌ Warning: ${result.detail || result.message || "Enrollment check failed"}`);
        setMessageType("error");
      }
    } catch {
      setMessage("❌ Could not connect to the server. Make sure the backend is running.");
      setMessageType("error");
    }
  };

  const handleFinish = async () => {
    const base64Image = captureFrame();
    if (!base64Image) {
      setMessage("Could not capture image from camera. Please try again.");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setMessage("Enrolling face... please wait.");
    setMessageType("info");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/attendance/enroll-face-enhanced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId.trim(),
          image: base64Image,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        stopCamera();
        setCameraOpen(false);
        setFinished(true);
        setMessage(`✅ Face enrolled successfully for Employee ID: ${employeeId.trim()}.`);
        setMessageType("success");
      } else {
        setMessage(`❌ Enrollment failed: ${result.detail || result.message || "Unknown error"}`);
        setMessageType("error");
      }
    } catch {
      setMessage("❌ Could not connect to the server. Make sure the backend is running.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    stopCamera();
    setCameraOpen(false);
    setFinished(false);
    setEmployeeId("");
    setMessage("");
    setMessageType("");
  };

  const messageClass =
    messageType === "success"
      ? "text-green-600 font-medium"
      : messageType === "error"
        ? "text-red-500 font-medium"
        : "text-gray-600";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Face Enroll</h1>
      </div>

      {/* Input Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <label
          htmlFor="face-enroll-employee-id"
          className="block text-sm font-medium text-gray-700"
        >
          Employee ID
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="face-enroll-employee-id"
            type="text"
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setMessage("");
              setMessageType("");
              setFinished(false);
            }}
            placeholder="Enter Employee ID"
            disabled={cameraOpen}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#598791] focus:ring-2 focus:ring-[#598791]/20 disabled:bg-gray-50 disabled:text-gray-400"
          />
          {!cameraOpen && !finished && (
            <button
              type="button"
              onClick={handleStartEnrollment}
              disabled={!employeeId.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-[#598791] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#75b0bd] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start Face Enrollment
            </button>
          )}
          {(cameraOpen || (employeeId.trim() && !finished)) && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
            >
              {/* Reset button} */}
             Reset
            </button>
          )}
          {finished && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-lg border border-[#598791] px-4 py-2 text-sm font-semibold text-[#598791] transition hover:bg-[#598791]/10"
            >
              Enroll Another
            </button>
          )}
        </div>
        {message && (
          <p className={`mt-3 text-sm ${messageClass}`}>{message}</p>
        )}
      </div>

      {/* Camera Section */}
      {cameraOpen && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <p className="text-sm font-medium text-gray-700">
            Camera is active — Employee ID:{" "}
            <span className="font-semibold text-[#598791]">{employeeId.trim()}</span>
          </p>

          {/* Video Feed */}
          <div
            className="overflow-hidden rounded-xl border border-gray-200 bg-black"
            style={{ maxWidth: 480 }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl"
              style={{ display: "block", maxHeight: 360, objectFit: "cover" }}
            />
          </div>

          {/* Hidden canvas used to capture frame */}
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Finish Button */}
          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enrolling..." : "✓ Finish Enrollment"}
          </button>
        </div>
      )}
    </div>
  );
}

