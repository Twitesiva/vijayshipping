'use client';

import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Grid,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    alpha,
    useTheme,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tooltip,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import {
    Download as DownloadIcon,
    Clear as ClearIcon,
    Close as CloseIcon,
    CalendarMonth as MonthIcon,
    DateRange as WeekIcon,
    Visibility as ViewIcon,
    CheckCircle as PresentIcon,
    Cancel as AbsentIcon,
} from '@mui/icons-material'

import {
    ModernSummaryTable,
    ModernEmployeeDetailsTable,
    ModernSessionLogTable
} from './ModernReportComponents';
import { API_BASE } from '../../lib/api';
import { clearToken, clearUser, getToken } from '../../lib/storage';
import { formatDate, formatTime } from '../../lib/format';
import { SkeletonTable } from '../../../components/Preloader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type TimePeriod = 'day' | 'week' | 'month' | 'custom';

export default function Reports() {
    const theme = useTheme();
    const [timePeriod, setTimePeriod] = React.useState('day');
    const [dateFrom, setDateFrom] = React.useState('');
    const [dateTo, setDateTo] = React.useState('');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedEmployee, setSelectedEmployee] = React.useState('all'); // Changed from reportEmployee
    const [attendanceType, setAttendanceType] = React.useState('all'); // New state
    const [reportRecords, setReportRecords] = React.useState<any[]>([]);


    const [summary, setSummary] = React.useState({ total_present: 0, total_absent: 0 });
    const [generating, setGenerating] = React.useState(false);
    const [error, setError] = React.useState('');

    // Drill-down state
    const [summaryRecords, setSummaryRecords] = React.useState<any[]>([]); // For Level 1

    const filteredSummaryRecords = React.useMemo(() => {
        if (!searchTerm) return summaryRecords;
        const lowerSearch = searchTerm.toLowerCase();
        return summaryRecords.filter(r =>
            r.full_name?.toLowerCase().includes(lowerSearch) ||
            r.employee_id?.toLowerCase().includes(lowerSearch)
        );
    }, [summaryRecords, searchTerm]);
    const [employeeDetailsOpen, setEmployeeDetailsOpen] = React.useState(false); // Level 2 Modal
    const [selectedEmployeeName, setSelectedEmployeeName] = React.useState('');
    const [drillDownOpen, setDrillDownOpen] = React.useState(false); // Level 3 Modal
    const [selectedDaySessions, setSelectedDaySessions] = React.useState<any[]>([]);
    const [selectedDayInfo, setSelectedDayInfo] = React.useState<any>(null);


    // Download states
    const [downloadDialogOpen, setDownloadDialogOpen] = React.useState(false);
    const [downloadOption, setDownloadOption] = React.useState('summary');
    const [downloadDateFrom, setDownloadDateFrom] = React.useState('');
    const [downloadDateTo, setDownloadDateTo] = React.useState('');
    const [exporting, setExporting] = React.useState(false);

    const toInputDate = (date: Date) => {
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().split('T')[0];
    };

    const handleUnauthorized = () => {
        clearToken();
        clearUser();
        setError('Session expired. Please sign in again.');
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    };

    // Initialize dates and filter options
    React.useEffect(() => {
        const today = new Date();
        const todayStr = toInputDate(today);
        setDateFrom(todayStr);
        setDateTo(todayStr);
        setDownloadDateFrom(todayStr);
        setDownloadDateTo(todayStr);
    }, []);

    // Handle Time Period Presets
    React.useEffect(() => {
        const today = new Date();
        if (timePeriod === 'day') {
            const d = toInputDate(today);
            setDateFrom(d);
            setDateTo(d);
        } else if (timePeriod === 'week') {
            const first = today.getDate() - today.getDay();
            const last = first + 6;
            setDateFrom(toInputDate(new Date(today.setDate(first))));
            setDateTo(toInputDate(new Date(today.setDate(last))));
        } else if (timePeriod === 'month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setDateFrom(toInputDate(firstDay));
            setDateTo(toInputDate(lastDay));
        }
    }, [timePeriod]);

    const generateReport = React.useCallback(async () => {
        if (!dateFrom || !dateTo) return;
        setGenerating(true);
        setError('');
        try {
            const token = getToken();
            if (!token) return;

            const params = new URLSearchParams({
                date_from: dateFrom,
                date_to: dateTo
            });

            // Always fetch summary for level 1
            const summaryRes = await fetch(`${API_BASE}/admin/reports/employee-summary?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (summaryRes.status === 401) {
                handleUnauthorized();
                return;
            }
            if (summaryRes.ok) {
                const data = await summaryRes.json();
                const sorted = (data.records || []).sort((a: any, b: any) => (a.full_name || "").localeCompare(b.full_name || ""));
                setSummaryRecords(sorted);
            }

            // If an employee is selected, fetch their detailed records (for Level 2 modal)
            if (selectedEmployee && selectedEmployee !== 'all') {
                params.append('employee_id', selectedEmployee);
                if (attendanceType && attendanceType !== 'all') params.append('attendance_type', attendanceType);

                const detailRes = await fetch(`${API_BASE}/admin/reports/aggregated?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (detailRes.ok) {
                    const data = await detailRes.json();
                    setReportRecords(data.records || []);
                    setSummary(data.summary || { total_present: 0, total_absent: 0 });
                }
            } else {
                setReportRecords([]);
                setSummary({ total_present: 0, total_absent: 0 });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error generating report');
        } finally {
            setGenerating(false);
        }
    }, [dateFrom, dateTo, selectedEmployee, attendanceType]);

    React.useEffect(() => {
        const timer = setTimeout(() => generateReport(), 300);
        return () => clearTimeout(timer);
    }, [generateReport]);

    // Summary Report (Aggregated View) = one row per employee per date, first login + last logout
    // Converts YYYY-MM-DD or ISO timestamp to DD-MM-YYYY
    const fmtDate = (d: string | undefined) => {
        if (!d) return '--';
        const part = d.split('T')[0]; // handles full ISO timestamps
        const [y, m, dd] = part.split('-');
        return (y && m && dd) ? `${dd}-${m}-${y}` : d;
    };

    const getAggregatedRows = async () => {
        const token = getToken();
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: '5000' });
        if (selectedEmployee && selectedEmployee !== 'all') params.append('employee_id', selectedEmployee);
        if (attendanceType && attendanceType !== 'all') params.append('attendance_type', attendanceType);

        const res = await fetch(`${API_BASE}/admin/attendance-records?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch records');
        const data = await res.json();
        const records: any[] = data.records || [];
        if (records.length === 0) return [];

        // Group by employee + date to get first login, last logout, type, and total duration
        const grouped: Record<string, any> = {};
        for (const r of records) {
            const dateKey = r.check_in ? r.check_in.split('T')[0] : '';
            const key = `${r.employee_id}_${dateKey}`;
            if (!grouped[key]) {
                grouped[key] = {
                    full_name: r.full_name,
                    employee_id: r.employee_id,
                    date: dateKey,
                    first_login: r.check_in,
                    last_logout: r.check_out || null,
                    has_office: !r.is_field_work,
                    has_field: !!r.is_field_work,
                    total_hours: r.total_hours || 0
                };
            } else {
                if (r.check_in && r.check_in < grouped[key].first_login) grouped[key].first_login = r.check_in;
                if (r.check_out && (!grouped[key].last_logout || r.check_out > grouped[key].last_logout)) {
                    grouped[key].last_logout = r.check_out;
                }
                if (!r.is_field_work) grouped[key].has_office = true;
                if (r.is_field_work) grouped[key].has_field = true;
                grouped[key].total_hours += r.total_hours || 0;
            }
        }
        // Compute type label and formatted duration
        let finalRows = Object.values(grouped).map((g: any) => ({
            ...g,
            type: g.has_office && g.has_field ? 'Hybrid' : g.has_field ? 'Field' : 'Office',
            duration: (() => {
                const h = Math.floor(g.total_hours);
                const m = Math.round((g.total_hours - h) * 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            })()
        }));

        // Apply type filter client-side
        if (attendanceType && attendanceType !== 'all') {
            finalRows = finalRows.filter(r => r.type === attendanceType);
        }

        return finalRows.sort((a: any, b: any) =>
            a.date.localeCompare(b.date) || a.full_name.localeCompare(b.full_name)
        );
    };

    const handleDownloadAggregatedCSV = async () => {
        setExporting(true);
        try {
            const rows = await getAggregatedRows();
            if (rows.length === 0) { alert('No records found for the selected period'); return; }

            const headers = ['Employee Name', 'Employee ID', 'Date', 'Type', 'First Login', 'Last Logout', 'Duration'];
            const csvRows = rows.map((r: any) => [
                r.full_name, r.employee_id, fmtDate(r.date), r.type,
                formatTime(r.first_login), formatTime(r.last_logout) || '--', r.duration
            ]);
            const csvContent = "\uFEFF" + [headers, ...csvRows].map((e: any[]) =>
                e.map((cell: any) => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(',')
            ).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', `Summary_Aggregated_${dateFrom}_to_${dateTo}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setDownloadDialogOpen(false);
        } catch (err) {
            alert('Failed to download: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setExporting(false);
        }
    };

    const handleDownloadAggregatedPDF = async () => {
        setExporting(true);
        try {
            const rows = await getAggregatedRows();
            if (rows.length === 0) { alert('No records found for the selected period'); return; }

            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            (doc as any).setFont(undefined, 'bold');
            doc.text('Summary Attendance Report (Aggregated)', 14, 16);
            doc.setFontSize(10);
            (doc as any).setFont(undefined, 'normal');
            doc.text(`Period: ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}  |  Total Records: ${rows.length}`, 14, 24);

            autoTable(doc, {
                head: [['Employee Name', 'Employee ID', 'Date', 'Type', 'First Login', 'Last Logout', 'Duration']],
                body: rows.map((r: any) => [
                    r.full_name, r.employee_id, fmtDate(r.date), r.type,
                    formatTime(r.first_login),
                    formatTime(r.last_logout) || '--',
                    r.duration
                ]),
                startY: 30,
                theme: 'striped',
                headStyles: { fillColor: [89, 135, 145], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 250, 252] },
                styles: { fontSize: 9, cellPadding: 3 }
            });

            doc.save(`Summary_Aggregated_${dateFrom}_to_${dateTo}.pdf`);
            setDownloadDialogOpen(false);
        } catch (err) {
            alert('Failed to download: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setExporting(false);
        }
    };

    // Employee Attendance Totals = employee name + total present/absent count
    const handleDownloadTotalsCSV = () => {
        const filtered = selectedEmployee && selectedEmployee !== 'all'
            ? summaryRecords.filter((r: any) => r.employee_id === selectedEmployee)
            : summaryRecords;
        if (filtered.length === 0) { alert('No records found for the selected period'); return; }
        const headers = ['#', 'Employee Name', 'Employee ID', 'Total Present Days', 'Total Absent Days'];
        const rows = filtered.map((r: any, i: number) => [i + 1, r.full_name, r.employee_id, r.total_present, r.total_absent]);
        const csvContent = "\uFEFF" + [headers, ...rows].map((e: any[]) =>
            e.map((cell: any) => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `Employee_Attendance_Totals_${dateFrom}_to_${dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadTotalsPDF = () => {
        const filtered = selectedEmployee && selectedEmployee !== 'all'
            ? summaryRecords.filter((r: any) => r.employee_id === selectedEmployee)
            : summaryRecords;
        if (filtered.length === 0) { alert('No records found for the selected period'); return; }
        const doc = new jsPDF();
        doc.setFontSize(16);
        (doc as any).setFont(undefined, 'bold');
        doc.text('Employee Attendance Totals', 14, 16);
        doc.setFontSize(10);
        (doc as any).setFont(undefined, 'normal');
        doc.text(`Period: ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`, 14, 24);
        doc.text(`Total Employees: ${filtered.length}`, 14, 30);

        autoTable(doc, {
            head: [['#', 'Employee Name', 'Employee ID', 'Present Days', 'Absent Days']],
            body: filtered.map((r: any, i: number) => [i + 1, r.full_name, r.employee_id, r.total_present, r.total_absent]),
            startY: 36,
            theme: 'striped',
            headStyles: { fillColor: [89, 135, 145], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 250, 252] },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        doc.save(`Employee_Attendance_Totals_${dateFrom}_to_${dateTo}.pdf`);
    };

    const handleDownloadCSV = () => {
        if (downloadOption === 'summary') handleDownloadAggregatedCSV();
        else if (downloadOption === 'totals') handleDownloadTotalsCSV();
        else handleDownloadDetailedLogs('csv');
    };

    const handleDownloadPDF = () => {
        if (downloadOption === 'summary') handleDownloadAggregatedPDF();
        else if (downloadOption === 'totals') handleDownloadTotalsPDF();
        else handleDownloadDetailedLogs('pdf');
    };

    const handleDownloadDetailedLogs = async (format: 'csv' | 'pdf') => {
        setExporting(true);
        try {
            const token = getToken();
            const params = new URLSearchParams({
                date_from: dateFrom,
                date_to: dateTo,
                limit: '5000'
            });

            if (selectedEmployee && selectedEmployee !== 'all') {
                params.append('employee_id', selectedEmployee);
            }
            if (attendanceType && attendanceType !== 'all') {
                params.append('attendance_type', attendanceType);
            }

            const response = await fetch(`${API_BASE}/admin/attendance-records?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch records');
            const data = await response.json();
            let records = data.records || [];

            // Apply type filter client-side
            if (attendanceType && attendanceType !== 'all') {
                records = records.filter((r: any) => {
                    const rowType = r.is_field_work ? 'Field' : 'Office';
                    return rowType === attendanceType;
                });
            }

            if (records.length === 0) {
                // We'll use a standard alert for now
                alert('No records found for the selected period');
                return;
            }

            if (format === 'csv') {
                const headers = ["Date", "Employee Name", "ID", "Login", "Logout", "Duration", "Type", "Entry Location", "Exit Address"];
                const rows = records.map((r: any) => [
                    fmtDate(r.check_in),
                    r.full_name,
                    r.employee_id,
                    formatTime(r.check_in),
                    formatTime(r.check_out),
                    r.formatted_duration,
                    r.is_field_work ? 'Field' : 'Office',
                    r.entry_location_display || 'Office',
                    r.exit_location_display || '--'
                ]);

                const csvContent = "\uFEFF" + [headers, ...rows].map((e: (string | number)[]) => e.map((cell: any) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `Detailed_Attendance_${downloadDateFrom}_to_${downloadDateTo}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const doc = new jsPDF('landscape');
                doc.text("Detailed Attendance Logs", 14, 15);
                doc.setFontSize(10);
                doc.text(`Period: ${fmtDate(downloadDateFrom)} to ${fmtDate(downloadDateTo)}`, 14, 22);

                const tableColumn = ["Date", "Name", "ID", "In", "Out", "Duration", "Type", "Entry Location", "Exit Address"];
                const tableRows = records.map((r: any) => [
                    fmtDate(r.check_in),
                    r.full_name,
                    r.employee_id,
                    formatTime(r.check_in),
                    formatTime(r.check_out),
                    r.formatted_duration,
                    r.is_field_work ? 'Field' : 'Office',
                    r.entry_location_display || 'Office',
                    r.exit_location_display || '--'
                ]);

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 30,
                    theme: 'striped',
                    styles: { fontSize: 7 },
                    columnStyles: {
                        7: { cellWidth: 45 },
                        8: { cellWidth: 45 }
                    }
                });

                doc.save(`Detailed_Attendance_${downloadDateFrom}_to_${downloadDateTo}.pdf`);
            }
            setDownloadDialogOpen(false);
        } catch (err) {
            alert('Failed to download: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setExporting(false);
        }
    };

    const handleEmployeeClick = (emp: any) => {
        setSelectedEmployee(emp.employee_id);
        setSelectedEmployeeName(emp.full_name);
        setEmployeeDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setEmployeeDetailsOpen(false);
        setSelectedEmployee('all');
        setSelectedEmployeeName('');
    };

    const openDrillDown = (row: any) => {
        setSelectedDayInfo(row);
        setSelectedDaySessions(row.sessions || []);
        setDrillDownOpen(true);
    };

    const handleNavigateDate = (direction: 'next' | 'prev') => {
        const currentIndex = reportRecords.findIndex(r => r.date === selectedDayInfo?.date);
        if (currentIndex === -1) return;

        const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < reportRecords.length) {
            const nextRecord = reportRecords[nextIndex];
            setSelectedDayInfo(nextRecord);
            setSelectedDaySessions(nextRecord.sessions || []);
        }
    };


    return (
        <Stack spacing={3} sx={{ pb: 6 }}>
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2
            }}>
                <Typography variant="h4" sx={{
                    fontWeight: 800,
                    color: 'text.primary',
                    fontFamily: "'Segoe UI', sans-serif",
                    fontSize: { xs: '1.75rem', sm: '2.125rem' }
                }}>
                    Reports
                </Typography>
                <Tooltip title="Download Report">
                    <Box sx={{ alignSelf: { xs: 'flex-end', sm: 'auto' } }}>
                        <IconButton
                            onClick={(e) => {
                                (e.currentTarget as HTMLElement).blur();
                                setDownloadDialogOpen(true);
                            }}
                            disabled={summaryRecords.length === 0}
                            sx={{
                                bgcolor: alpha('#598791', 0.1),
                                color: '#598791',
                                '&:hover': { bgcolor: alpha('#598791', 0.2) },
                                borderRadius: '12px',
                                width: { xs: 34, sm: 38 },
                                height: { xs: 34, sm: 38 }
                            }}
                        >
                            <DownloadIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
                        </IconButton>
                    </Box>
                </Tooltip>
            </Box>

            {/* Filters Row */}
            <Box sx={{
                p: 2,
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid #e2e8f0', // Visible outline
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4} md={3}>
                        <TextField
                            id="time-period-select"
                            name="time-period"
                            select
                            fullWidth
                            size="small"
                            label="Time Period"
                            value={timePeriod}
                            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
                            variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    bgcolor: '#ffffff',
                                }
                            }}
                        >
                            <MenuItem value="day">Today</MenuItem>
                            <MenuItem value="week">This Week</MenuItem>
                            <MenuItem value="month">This Month</MenuItem>
                            <MenuItem value="custom">Custom Range</MenuItem>
                        </TextField>
                    </Grid>

                    {timePeriod === 'custom' && (
                        <>
                            <Grid item xs={6} sm={4} md={3}>
                                <TextField
                                    id="date-from-input"
                                    name="date-from"
                                    type="date"
                                    fullWidth
                                    size="small"
                                    label="From date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '12px',
                                            bgcolor: '#ffffff',
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                                <TextField
                                    id="date-to-input"
                                    name="date-to"
                                    type="date"
                                    fullWidth
                                    size="small"
                                    label="To date"
                                    value={dateTo}
                                    inputProps={{ min: dateFrom }}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '12px',
                                            bgcolor: '#ffffff',
                                        }
                                    }}
                                />
                            </Grid>
                        </>
                    )}


                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            id="employee-search-input"
                            name="employee-search"
                            size="small"
                            fullWidth
                            label="Search Employee (Name/ID)"
                            placeholder="Type name or ID to filter..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    bgcolor: '#ffffff',
                                }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            id="attendance-type-select"
                            name="attendance-type"
                            select
                            fullWidth
                            size="small"
                            label="Attendance Type"
                            value={attendanceType}
                            onChange={(e) => setAttendanceType(e.target.value)}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '12px',
                                    bgcolor: '#ffffff',
                                }
                            }}
                        >
                            <MenuItem value="all">All Types</MenuItem>
                            <MenuItem value="Office">Office</MenuItem>
                            <MenuItem value="Field">Field</MenuItem>
                            <MenuItem value="Hybrid">Hybrid</MenuItem>
                        </TextField>
                    </Grid>

                    <Grid item xs={6} sm={2} md={1}>
                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
                            <Tooltip title="Reset Filters">
                                <IconButton
                                    aria-label="Reset all filters"
                                    onClick={() => {
                                        setTimePeriod('day');
                                        setSearchTerm('');
                                        setAttendanceType('all');
                                        setSelectedEmployee('all');
                                        const today = new Date().toISOString().split('T')[0];
                                        setDateFrom(today);
                                        setDateTo(today);
                                        handleCloseDetails();
                                    }}
                                    sx={{
                                        height: 38, width: 38, borderRadius: '12px', border: '1px solid #f1f5f9',
                                        transition: 'all 0.2s',
                                        '&:hover': { bgcolor: '#fef2f2', color: '#ef4444', borderColor: '#fecaca' }
                                    }}
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Grid>
                </Grid>
            </Box>




            {/* Report Table */}
            {generating ? (
                <SkeletonTable rows={5} />
            ) : error ? (
                <Box sx={{ p: 3, borderRadius: '16px', bgcolor: alpha(theme.palette.error.main, 0.05), border: '1px solid', borderColor: theme.palette.error.main }}>
                    <Typography color="error" fontWeight={600}>{error}</Typography>
                </Box>
            ) : (
                <ModernSummaryTable
                    records={filteredSummaryRecords}
                    onEmployeeClick={handleEmployeeClick}
                    generating={generating}
                />
            )}

            {/* Level 2 Modal: Employee Details */}
            <Dialog
                open={employeeDetailsOpen}
                onClose={handleCloseDetails}
                maxWidth="lg"
                fullWidth
                aria-labelledby="employee-details-title"
                PaperProps={{
                    sx: {
                        borderRadius: '32px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
                    }
                }}
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography id="employee-details-title" variant="h5" fontWeight={900}>{selectedEmployeeName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Attendance Details for {selectedEmployee} | {formatDate(dateFrom)} to {formatDate(dateTo)}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Tooltip title="Download this employee's report">
                                <IconButton
                                    onClick={(e) => {
                                        (e.currentTarget as HTMLElement).blur();
                                        setDownloadDialogOpen(true);
                                    }}
                                    sx={{
                                        color: '#598791',
                                        bgcolor: alpha('#598791', 0.05),
                                        '&:hover': { bgcolor: alpha('#598791', 0.1) },
                                        borderRadius: '12px'
                                    }}
                                >
                                    <DownloadIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <IconButton
                                aria-label="Close details"
                                autoFocus
                                onClick={handleCloseDetails}
                                sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }, borderRadius: '12px' }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Stack>
                    </Box>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ px: 0, py: 0 }}>
                    <Box sx={{ p: 4 }}>
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} md={6}>
                                <Card sx={{
                                    borderRadius: '20px',
                                    background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, transparent 100%)`,
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.success.main, 0.1)
                                }}>
                                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                                        <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'success.main', color: 'white' }}>
                                            <PresentIcon fontSize="small" />
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" fontWeight={700}>PRESENT DAYS</Typography>
                                            <Typography variant="h5" fontWeight={900}>{summary.total_present}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Card sx={{
                                    borderRadius: '20px',
                                    background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.05)} 0%, transparent 100%)`,
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.error.main, 0.1)
                                }}>
                                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                                        <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'error.main', color: 'white' }}>
                                            <AbsentIcon fontSize="small" />
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" fontWeight={700}>ABSENT DAYS</Typography>
                                            <Typography variant="h5" fontWeight={900}>{summary.total_absent}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <ModernEmployeeDetailsTable
                            records={reportRecords}
                            onDrillDown={openDrillDown}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={handleCloseDetails} sx={{ fontWeight: 800 }}>Close Details</Button>
                </DialogActions>
            </Dialog>

            {/* Level 3 Modal: Session Details Drill-down */}
            <Dialog
                open={drillDownOpen}
                onClose={() => setDrillDownOpen(false)}
                maxWidth="md"
                fullWidth
                aria-labelledby="drilldown-dialog-title"
                PaperProps={{
                    sx: {
                        borderRadius: '32px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
                    }
                }}
            >
                <DialogTitle sx={{ py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
                    <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', sm: 'nowrap' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                            <Box sx={{ display: { xs: 'none', sm: 'block' }, p: 1.5, borderRadius: '14px', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                                <MonthIcon />
                            </Box>
                            <Box>
                                <Typography id="drilldown-dialog-title" variant="h6" fontWeight={900} sx={{ lineHeight: 1.1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>Attendance Logs</Typography>
                                <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                    {selectedDayInfo?.full_name}
                                </Typography>
                            </Box>
                        </Box>

                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flex: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" fontWeight={900} sx={{ color: 'primary.dark', letterSpacing: '0.5px', fontSize: { xs: '0.7rem', sm: '0.8rem' } }}>
                                        {selectedDayInfo ? formatDate(selectedDayInfo.date).toUpperCase() : ''}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Button
                                        size="small"
                                        onClick={() => handleNavigateDate('prev')}
                                        disabled={reportRecords.findIndex(r => r.date === selectedDayInfo?.date) <= 0}
                                        sx={{
                                            minWidth: 44,
                                            height: 32,
                                            px: 1,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: 'primary.main',
                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            border: '1px solid',
                                            borderColor: alpha(theme.palette.primary.main, 0.1),
                                            borderRadius: '8px',
                                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                                            textTransform: 'none'
                                        }}
                                    >
                                        Prev
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={() => handleNavigateDate('next')}
                                        disabled={reportRecords.findIndex(r => r.date === selectedDayInfo?.date) >= reportRecords.length - 1}
                                        sx={{
                                            minWidth: 44,
                                            height: 32,
                                            px: 1,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: 'primary.main',
                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            border: '1px solid',
                                            borderColor: alpha(theme.palette.primary.main, 0.1),
                                            borderRadius: '8px',
                                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                                            textTransform: 'none'
                                        }}
                                    >
                                        Next
                                    </Button>
                                </Stack>
                            </Box>
                            <IconButton
                                aria-label="Close logs"
                                autoFocus
                                onClick={() => setDrillDownOpen(false)}
                                sx={{
                                    bgcolor: alpha(theme.palette.error.main, 0.05),
                                    color: 'error.main',
                                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) },
                                    p: 0.75
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    </Box>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ p: 0 }}>
                    <ModernSessionLogTable sessions={selectedDaySessions} />
                </DialogContent>
                <DialogActions sx={{ p: 3, justifyContent: 'flex-end', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <Button onClick={() => setDrillDownOpen(false)} sx={{ fontWeight: 800, textTransform: 'none' }}>Close</Button>
                </DialogActions>
            </Dialog>


            {/* Download Dialog */}
            <Dialog
                open={downloadDialogOpen}
                onClose={() => !exporting && setDownloadDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                aria-labelledby="download-dialog-title"
                PaperProps={{
                    sx: { borderRadius: '20px', p: 1 }
                }}
            >
                <DialogTitle>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" gap={1}>
                            <DownloadIcon color="primary" />
                            <Typography id="download-dialog-title" variant="h6" fontWeight={800}>Download Report</Typography>
                        </Stack>
                        <IconButton
                            aria-label="Close download dialog"
                            autoFocus
                            onClick={() => !exporting && setDownloadDialogOpen(false)}
                            size="small"
                        >
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            id="download-option-select"
                            select
                            fullWidth
                            label="What would you like to download?"
                            value={downloadOption}
                            onChange={(e: any) => setDownloadOption(e.target.value as 'totals' | 'summary' | 'logs')}
                        >
                            <MenuItem value="totals">Employee Attendance Totals (Present/Absent Count)</MenuItem>
                            <MenuItem value="summary">Summary Report (Aggregated View)</MenuItem>
                            <MenuItem value="logs">Detailed Attendance Logs (All Records)</MenuItem>
                        </TextField>

                        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                CURRENT FILTERS
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Period: {formatDate(dateFrom)} to {formatDate(dateTo)}
                            </Typography>
                            {selectedEmployee !== 'all' && (
                                <Typography variant="body2">
                                    Employee: {selectedEmployeeName || selectedEmployee}
                                </Typography>
                            )}
                            {attendanceType !== 'all' && (
                                <Typography variant="body2">
                                    Type: {attendanceType}
                                </Typography>
                            )}
                        </Box>


                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => handleDownloadCSV()}
                        disabled={exporting}
                    >
                        CSV
                    </Button>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => handleDownloadPDF()}
                        disabled={exporting}
                    >
                        {exporting ? 'Processing...' : 'PDF'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}

