import { useEffect, useState } from "react";
import EmployeeReportsModule from "../../attendance/components/employee/EmployeeReports";
import { ensureAttendanceSession } from "../../attendance/lib/bridgeAuth";

export default function EmployeeAttendanceReports() {
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
  return <EmployeeReportsModule />;
}


