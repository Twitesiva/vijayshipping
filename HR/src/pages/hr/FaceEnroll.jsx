import { useEffect, useRef, useState, useCallback } from "react";
import API_BASE_URL from "../../config";

const API = `${API_BASE_URL}/api/v1`;

export default function FaceEnroll() {
  // ── Search ──────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [allEmployees, setAllEmployees] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null); // { employee_id, full_name }

  // ── Enrollment state ─────────────────────────────────────────────────────
  const [enrollStatus, setEnrollStatus] = useState("idle");
  // idle | enrolled | deleting | deleted | camera | submitting | done | error

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // success | error | info | warning

  // ── Camera ───────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Load all employees once ───────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/admin/employees`)
      .then((r) => r.json())
      .then((data) => setAllEmployees(data.employees || []))
      .catch(() => {});
  }, []);

  // ── Live search filter ────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    setSuggestions(
      allEmployees
        .filter(
          (e) =>
            e.full_name?.toLowerCase().includes(q) ||
            e.employee_id?.toLowerCase().includes(q)
        )
        .slice(0, 8)
    );
  }, [query, allEmployees]);

  // ── Select an employee from dropdown ─────────────────────────────────────
  const handleSelect = useCallback(async (emp) => {
    setSelectedEmployee(emp);
    setQuery(`${emp.full_name} (${emp.employee_id})`);
    setSuggestions([]);
    setMessage("");
    setMessageType("");
    setEnrollStatus("checking");

    try {
      const res = await fetch(`${API}/attendance/check-enrollment/${emp.employee_id}`);
      if (res.ok) {
        // Not enrolled yet — ready to start
        setEnrollStatus("idle");
      } else {
        const data = await res.json();
        const msg = data?.detail || "";
        if (res.status === 400 && msg.toLowerCase().includes("already enrolled")) {
          setEnrollStatus("enrolled");
        } else {
          setEnrollStatus("error");
          setMessage(msg || "Could not check enrollment status.");
          setMessageType("error");
        }
      }
    } catch {
      setEnrollStatus("error");
      setMessage("Cannot connect to the server. Make sure the backend is running.");
      setMessageType("error");
    }
  }, []);

  // ── Delete enrollment ────────────────────────────────────────────────────
  const handleDeleteEnrollment = async () => {
    if (!selectedEmployee) return;
    setEnrollStatus("deleting");
    setMessage("");
    try {
      const res = await fetch(
        `${API}/admin/delete-face-enrollment/${selectedEmployee.employee_id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrollStatus("deleted");
        setMessage(`✅ Enrollment for ${selectedEmployee.full_name} has been deleted. You can now add a new face below.`);
        setMessageType("success");
      } else {
        setEnrollStatus("enrolled");
        setMessage(`❌ Could not delete enrollment: ${data.detail || data.message || "Unknown error"}`);
        setMessageType("error");
      }
    } catch {
      setEnrollStatus("enrolled");
      setMessage("❌ Cannot connect to the server.");
      setMessageType("error");
    }
  };

  // ── Start camera for enrollment ──────────────────────────────────────────
  const startCamera = () => {
    setEnrollStatus("camera");
    setMessage("");
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setEnrollStatus("deleted");
        setMessage("❌ Camera access denied. Please allow camera permissions and try again.");
        setMessageType("error");
      });
  };

  const startFreshEnrollment = async () => {
    if (!selectedEmployee) return;
    setMessage("Checking eligibility...");
    setMessageType("info");
    try {
      const res = await fetch(`${API}/attendance/check-enrollment/${selectedEmployee.employee_id}`);
      if (res.ok) {
        startCamera();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data?.detail || "Enrollment check failed."}`);
        setMessageType("error");
      }
    } catch {
      setMessage("❌ Cannot connect to the server.");
      setMessageType("error");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // ── Submit enrollment ────────────────────────────────────────────────────
  const handleFinishEnrollment = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

    setEnrollStatus("submitting");
    setMessage("Enrolling face… please wait.");
    setMessageType("info");

    try {
      const res = await fetch(`${API}/attendance/enroll-face-enhanced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmployee.employee_id, image: base64 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        stopCamera();
        setEnrollStatus("done");
        setMessage(`✅ Face enrolled successfully for ${selectedEmployee.full_name} (${selectedEmployee.employee_id}).`);
        setMessageType("success");
      } else {
        setEnrollStatus("camera");
        setMessage(`❌ Enrollment failed: ${data.detail || data.message || "Unknown error"}`);
        setMessageType("error");
      }
    } catch {
      setEnrollStatus("camera");
      setMessage("❌ Cannot connect to the server.");
      setMessageType("error");
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    stopCamera();
    setSelectedEmployee(null);
    setQuery("");
    setSuggestions([]);
    setEnrollStatus("idle");
    setMessage("");
    setMessageType("");
  };

  useEffect(() => () => stopCamera(), []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const msgClass =
    messageType === "success"
      ? "text-green-700 bg-green-50 border-green-200"
      : messageType === "error"
      ? "text-red-600 bg-red-50 border-red-200"
      : messageType === "warning"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-gray-600 bg-gray-50 border-gray-200";

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Face Enroll</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Search for an employee by name or ID to manage their face enrollment.
        </p>
      </div>

      {/* ── Search ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Search Employee
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedEmployee) {
                // User is editing after selecting — reset selection
                setSelectedEmployee(null);
                setEnrollStatus("idle");
                setMessage("");
              }
            }}
            placeholder="Type employee name or ID…"
            disabled={enrollStatus === "camera" || enrollStatus === "submitting"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#598791] focus:ring-2 focus:ring-[#598791]/20 disabled:bg-gray-50 disabled:text-gray-400"
          />

          {/* Dropdown suggestions */}
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
              {suggestions.map((emp) => (
                <li
                  key={emp.employee_id}
                  onClick={() => handleSelect(emp)}
                  className="flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-[#598791]/10 transition"
                >
                  <span className="font-medium text-gray-900">{emp.full_name}</span>
                  <span className="text-xs text-gray-400 font-mono">{emp.employee_id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {enrollStatus === "checking" && (
          <p className="text-xs text-gray-500 animate-pulse">Checking enrollment status…</p>
        )}
      </div>

      {/* ── Already Enrolled Warning ── */}
      {enrollStatus === "enrolled" && selectedEmployee && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {selectedEmployee.full_name} ({selectedEmployee.employee_id}) is already enrolled.
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Do you want to delete the current enrollment and add a new face?
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleDeleteEnrollment}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              🗑 Delete Enrollment
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {enrollStatus === "deleting" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600 animate-pulse">🗑 Deleting enrollment… please wait.</p>
        </div>
      )}

      {/* ── Inline message banner ── */}
      {message && enrollStatus !== "enrolled" && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${msgClass}`}>
          {message}
        </div>
      )}

      {/* ── Add New Face button (after deletion or first time) ── */}
      {(enrollStatus === "deleted" || enrollStatus === "idle") && selectedEmployee && (
        <div className="rounded-xl border border-[#598791]/30 bg-[#598791]/5 p-5 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Ready to enroll face for{" "}
            <span className="font-semibold text-[#598791]">
              {selectedEmployee.full_name}
            </span>{" "}
            <span className="text-gray-400 text-xs font-mono">({selectedEmployee.employee_id})</span>
          </p>
          <button
            type="button"
            onClick={startFreshEnrollment}
            className="inline-flex items-center gap-2 rounded-lg bg-[#598791] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4a727a]"
          >
            📷 Add Face
          </button>
        </div>
      )}

      {/* ── Camera ── */}
      {(enrollStatus === "camera" || enrollStatus === "submitting") && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <p className="text-sm font-medium text-gray-700">
            Camera active — position your face clearly in the frame.
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-black" style={{ maxWidth: 480 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl"
              style={{ display: "block", maxHeight: 360, objectFit: "cover" }}
            />
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
          {message && (
            <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${msgClass}`}>{message}</div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleFinishEnrollment}
              disabled={enrollStatus === "submitting"}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enrollStatus === "submitting" ? "Enrolling…" : "✓ Finish Enrollment"}
            </button>
            <button
              type="button"
              onClick={() => { stopCamera(); setEnrollStatus("deleted"); setMessage(""); }}
              disabled={enrollStatus === "submitting"}
              className="inline-flex items-center rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {enrollStatus === "done" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <p className="font-semibold text-green-800">Enrollment Successful!</p>
              <p className="text-sm text-green-700 mt-0.5">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center rounded-lg border border-[#598791] px-4 py-2 text-sm font-semibold text-[#598791] transition hover:bg-[#598791]/10"
          >
            Enroll Another Employee
          </button>
        </div>
      )}
    </div>
  );
}
