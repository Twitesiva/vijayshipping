import { useEffect, useState } from "react";
import AttendanceEmployeesModule from "../../attendance/components/admin/Employees";
import { ensureAttendanceSession } from "../../attendance/lib/bridgeAuth";

export default function AttendanceEmployees() {
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
  return <AttendanceEmployeesModule />;
}


