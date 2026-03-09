import { useEffect, useState } from "react";
import AttendanceReportsModule from "../../attendance/components/admin/Reports";
import { ensureAttendanceSession } from "../../attendance/lib/bridgeAuth";

export default function AttendanceReports() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await ensureAttendanceSession();
      if (mounted) setReady(true);
    };
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <div className="text-sm text-slate-500">Loading attendance...</div>;
  return <AttendanceReportsModule />;
}


