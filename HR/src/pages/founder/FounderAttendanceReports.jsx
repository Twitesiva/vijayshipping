import { useEffect, useState } from "react";
import AttendanceReportsModule from "../../attendance/components/admin/Reports";
import { ensureAttendanceSession } from "../../attendance/lib/bridgeAuth";

export default function FounderAttendanceReports() {
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

    if (!ready) return <div className="text-sm text-slate-500 p-8">Loading attendance systems...</div>;

    return (
        <div className="space-y-6">
            <AttendanceReportsModule />
        </div>
    );
}
