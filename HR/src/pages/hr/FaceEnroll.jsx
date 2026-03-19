import { useEffect, useRef, useState, useCallback } from "react";
import API_BASE_URL from "../../config";

const API = `${API_BASE_URL}/api/v1`;

export default function FaceEnroll() {
  const [query, setQuery] = useState("");
  const [allEmployees, setAllEmployees] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [enrollStatus, setEnrollStatus] = useState("idle");
  const [updateMode, setUpdateMode] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Fetch employees ──
  const refreshEmployeeList = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/employees`);
      const data = await res.json();
      const cleanedEmployees = (data.employees || []).map(emp => ({
        ...emp,
        employee_id: (emp.employee_id || "").replace(/\s/g, "")
      })).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      setAllEmployees(cleanedEmployees);
    } catch {}
  }, []);

  useEffect(() => {
    refreshEmployeeList();
  }, [refreshEmployeeList]);

  // ── Search filter ──
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
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

  const handleSelect = (emp) => {
    setSelectedEmployee(emp);
    setQuery(`${emp.full_name} (${emp.employee_id})`);
    setSuggestions([]);
    setEnrollStatus("idle");
    setMessage("");
  };

  // ── CAMERA ──
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = () => {
    stopCamera(); // important fix

    setEnrollStatus("camera");
    setMessage("");

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setEnrollStatus("error");
        setMessage("❌ Camera access denied.");
        setMessageType("error");
      });
  };

  // ── MAIN ACTION (Enroll / Update) ──
  const handleEnrollAction = useCallback(async (emp) => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    setSelectedEmployee(emp);
    setEnrollStatus("checking");
    setMessage("");

    try {
      const res = await fetch(`${API}/attendance/check-enrollment/${emp.employee_id}`);

      if (res.ok) {
        // NOT ENROLLED
        startCamera();
      } else {
        const data = await res.json();
        const msg = data?.detail || "";

        if (res.status === 400 && msg.toLowerCase().includes("already enrolled")) {
          // UPDATE MODE - NO DELETE YET
          setUpdateMode(true);
          setMessage("🔄 Update mode - capture new photo to replace existing enrollment. Cancel to keep current.");
          setMessageType("warning");
          startCamera();
        } else {
          setEnrollStatus("error");
          setMessage(msg || "Error checking enrollment.");
          setMessageType("error");
        }
      }
    } catch {
      setEnrollStatus("error");
      setMessage("❌ Server connection failed.");
      setMessageType("error");
    }
  }, []);

  // ── DELETE ──
  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete enrollment for ${emp.full_name}?`)) return;

    const res = await fetch(`${API}/admin/delete-face-enrollment/${emp.employee_id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setMessage(`✅ Enrollment deleted for ${emp.full_name}`);
      setMessageType("success");
      refreshEmployeeList();
      if (selectedEmployee?.employee_id === emp.employee_id) {
        handleReset();
      }
    }
  };

  // ── SUBMIT ──
    const handleFinishEnrollment = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    // mirror fix
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

    setEnrollStatus("submitting");
    if (updateMode) {
      setMessage("🔄 Deleting old enrollment and enrolling new...");
    } else {
      setMessage("Enrolling...");
    }

    try {
      // Delete old enrollment first if in update mode
      if (updateMode) {
        await fetch(`${API}/admin/delete-face-enrollment/${selectedEmployee.employee_id}`, {
          method: "DELETE",
        });
      }

      const res = await fetch(`${API}/attendance/enroll-face-enhanced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmployee.employee_id, image: base64 }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        stopCamera();
        setEnrollStatus("done");
        setMessage("✅ Face enrolled successfully!");
        setMessageType("success");
        refreshEmployeeList();
      } else {
        setEnrollStatus("camera");
        setMessage("❌ Enrollment failed.");
        setMessageType("error");
      }
    } catch {
      setEnrollStatus("camera");
      setMessage("❌ Server error.");
      setMessageType("error");
    }
  };

  const handleReset = () => {
    stopCamera();
    setUpdateMode(false);
    setSelectedEmployee(null);
    setQuery("");
    setEnrollStatus("idle");
    setMessage("");
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ── FILTER LIST ──
  const q = query.toLowerCase().trim();
  const filteredList = selectedEmployee
    ? [selectedEmployee]
    : q
    ? allEmployees.filter(
        (e) =>
          e.full_name?.toLowerCase().includes(q) ||
          e.employee_id?.toLowerCase().includes(q)
      )
    : allEmployees;

  const isEnrollmentActive = enrollStatus === "camera" || enrollStatus === "submitting" || enrollStatus === "done";
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
          {isEnrollmentActive 
            ? "Complete the face enrollment process below."
            : "Search for an employee by name or ID to manage their face enrollment."}
        </p>
      </div>

      {/* ── Search & List (Hidden during active enrollment) ── */}
      {!isEnrollmentActive && (
        <>
          {/* ── Search ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Search Employee
            </label>
            <div className="relative group">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selectedEmployee) {
                    setSelectedEmployee(null);
                    setEnrollStatus("idle");
                    setMessage("");
                  }
                }}
                placeholder="Type employee name or ID…"
                className="w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-900 outline-none transition focus:border-[#598791] focus:ring-2 focus:ring-[#598791]/20"
              />
              
              {query && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition p-1"
                  title="Clear search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

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

          {/* ── Employee List (below filter) ── */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Enrollment Management</h2>
              <button 
                type="button"
                onClick={refreshEmployeeList}
                className="text-xs font-semibold text-[#598791] hover:underline"
              >
                ↻ Refresh List
              </button>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-6 text-center text-sm text-gray-400 italic">
                        {query ? `No employees found matching "${query}".` : "No employees found."}
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((emp) => (
                      <tr key={emp.employee_id} className={`hover:bg-slate-50/50 transition-colors ${selectedEmployee?.employee_id === emp.employee_id ? 'bg-[#598791]/5' : ''}`}>
                        <td className="px-6 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">{emp.full_name}</span>
                            <span className="text-xs font-mono text-slate-400">{emp.employee_id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          {emp.has_face_enrolled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100 uppercase tracking-tighter">
                              ● Enrolled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-100 uppercase tracking-tighter">
                              ○ Not Enrolled
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEnrollAction(emp); }}
                              className={`inline-flex items-center rounded-lg border px-3 py-1 text-xs font-bold transition ${
                                !emp.has_face_enrolled 
                                  ? 'bg-[#598791] text-white border-[#598791] hover:bg-[#4a727a]' 
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              {!emp.has_face_enrolled ? 'Enroll' : 'Edit'}
                            </button>
                            {emp.has_face_enrolled && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDelete(emp); }}
                                className="inline-flex items-center rounded-lg border border-red-100 px-3 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50 hover:border-red-200"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Camera Interface (Active Enrollment) ── */}
      {(enrollStatus === "camera" || enrollStatus === "submitting") && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Camera active for <span className="text-[#598791] font-semibold">{selectedEmployee?.full_name}</span>
              {updateMode && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-xs font-bold text-yellow-800 border border-yellow-200">
                  UPDATE MODE
                </span>
              )}
            </p>
            <span className="animate-pulse flex items-center gap-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span> REC
            </span>
          </div>
          
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-inner group" style={{ maxWidth: 480 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl scale-x-[-1]" 
              style={{ display: "block", maxHeight: 360, objectFit: "cover" }}
            />
            {enrollStatus === "submitting" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
                <p className="mt-3 text-sm font-bold text-white tracking-wide">ENROLLING FACE...</p>
              </div>
            )}
          </div>
          
          <canvas ref={canvasRef} style={{ display: "none" }} />
          
          {message && (
            <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${msgClass}`}>{message}</div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleFinishEnrollment}
              disabled={enrollStatus === "submitting"}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-green-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enrollStatus === "submitting" ? "Enrolling..." : "✓ Finish Enrollment"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={enrollStatus === "submitting"}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Success/Done View ── */}
      {enrollStatus === "done" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-4 shadow-sm animate-in fade-in zoom-in duration-300">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
            🎉
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-green-900">Success!</h3>
            <p className="text-sm text-green-700">{message}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg bg-[#598791] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#4a727a] shadow-md hover:shadow-lg"
          >
            Enroll Another Employee
          </button>
        </div>
      )}

      {/* ── Error/Message Banner (Idle/General) ── */}
      {message && !isEnrollmentActive && enrollStatus !== "done" && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm animate-in slide-in-from-top-2 duration-200 ${msgClass}`}>
          {message}
        </div>
      )}
    </div>
  );
}