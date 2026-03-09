import { useEffect, useState } from "react";
import AttendanceDashboardModule from "../../attendance/components/admin/Dashboard";
import { ensureAttendanceSession } from "../../attendance/lib/bridgeAuth";

export default function FounderHome() {
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

    if (!ready) return <div className="text-sm text-slate-500 p-8">Loading attendance dashboard...</div>;

    return (
        <div className="space-y-6">
            <div className="border-b pb-4 mb-4">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Attendance Overview</h2>
                <p className="text-sm text-slate-500 font-bold">Real-time attendance status for all employees.</p>
            </div>
            <AttendanceDashboardModule />
        </div>
    );
}
