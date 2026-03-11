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
    Delete as DeleteIcon
} from '@mui/icons-material';
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
    const [selectedEmployee, setSelectedEmployee] = React.useState('all'); // Changed from reportEmployee
    const [attendanceType, setAttendanceType] = React.useState('all'); // New state
    const [reportRecords, setReportRecords] = React.useState<any[]>([]);
    const [summary, setSummary] = React.useState({ total_present: 0, total_absent: 0 });
    const [filterOptions, setFilterOptions] = React.useState<{ employees: any[] }>({ employees: [] });
    const [generating, setGenerating] = React.useState(false);
    const [error, setError] = React.useState('');
    
    // Drill-down state
    const [drillDownOpen, setDrillDownOpen] = React.useState(false);
    const [selectedDaySessions, setSelectedDaySessions] = React.useState<any[]>([]);
    const [selectedDayInfo, setSelectedDayInfo] = React.useState<any>(null);
    
    // Delete state
    const [selectedSessionIds, setSelectedSessionIds] = React.useState<string[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

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

        const loadOptions = async () => {
            try {
                const token = getToken();
                const res = await fetch(`${API_BASE}/admin/filter-options`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) return;
                const data = await res.json();
                setFilterOptions({ employees: data.employees || [] });
            } catch (e) {
                console.error(e);
            }
        };
        loadOptions();
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
            if (selectedEmployee && selectedEmployee !== 'all') params.append('employee_id', selectedEmployee);
            if (attendanceType && attendanceType !== 'all') params.append('attendance_type', attendanceType);

            const response = await fetch(`${API_BASE}/admin/reports/aggregated?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            if (!response.ok) throw new Error('Failed to fetch report');

            const data = await response.json();
            setReportRecords(data.records || []);
            setSummary(data.summary || { total_present: 0, total_absent: 0 });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error generating report');
        } finally {
            setGenerating(false);
        }
    }, [dateFrom, dateTo, selectedEmployee, attendanceType]); // Updated dependencies

    React.useEffect(() => {
        const timer = setTimeout(() => generateReport(), 300);
        return () => clearTimeout(timer);
    }, [generateReport]);

    const handleDownloadCSV = () => {
        if (reportRecords.length === 0) return;
        
        const headers = ["Date", "Employee Name", "Employee ID", "Attendance Type", "Login", "Logout", "Duration (hrs)"];
        const rows = reportRecords.map(r => [
            r.date,
            r.full_name,
            r.employee_id,
            r.attendance_type,
            formatTime(r.first_login),
            formatTime(r.last_login),
            r.total_hours.toFixed(2)
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Attendance_Report_${dateFrom}_to_${dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text("Attendance Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Period: ${dateFrom} to ${dateTo}`, 14, 22);
        if (selectedEmployee && selectedEmployee !== 'all') { // Updated from reportEmployee
            const empName = filterOptions.employees.find(e => e.employee_id === selectedEmployee)?.full_name || selectedEmployee;
            doc.text(`Employee: ${empName}`, 14, 27);
        }

        const tableColumn = ["Date", "Employee", "Type", "Login", "Logout", "Duration"];
        const tableRows = reportRecords.map(r => [
            r.date,
            r.full_name,
            r.attendance_type,
            formatTime(r.first_login),
            formatTime(r.last_login),
            r.formatted_duration
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'striped'
        });

        doc.save(`Attendance_Report_${dateFrom}_to_${dateTo}.pdf`);
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
            const records = data.records || [];
            
            if (records.length === 0) {
                // We'll use a standard alert for now
                alert('No records found for the selected period');
                return;
            }

            if (format === 'csv') {
                const headers = ["Date", "Employee Name", "ID", "Login", "Logout", "Duration", "Type", "Location"];
                const rows = records.map((r: any) => [
                    formatDate(r.check_in),
                    r.full_name,
                    r.employee_id,
                    formatTime(r.check_in),
                    formatTime(r.check_out),
                    r.formatted_duration,
                    r.is_field_work ? 'Field' : 'Office',
                    r.entry_location_display || 'Office'
                ]);
                
                const csvContent = "\uFEFF" + [headers, ...rows].map((e: (string|number)[]) => e.map((cell: any) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
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
                doc.text(`Period: ${downloadDateFrom} to ${downloadDateTo}`, 14, 22);

                const tableColumn = ["Date", "Name", "ID", "In", "Out", "Duration", "Type", "Location"];
                const tableRows = records.map((r: any) => [
                    formatDate(r.check_in),
                    r.full_name,
                    r.employee_id,
                    formatTime(r.check_in),
                    formatTime(r.check_out),
                    r.formatted_duration,
                    r.is_field_work ? 'Field' : 'Office',
                    r.entry_location_display || 'Office'
                ]);

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 30,
                    theme: 'striped',
                    styles: { fontSize: 8 },
                    columnStyles: {
                        7: { cellWidth: 60 } // Location column wider
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

    const openDrillDown = (row: any) => {
        setSelectedDayInfo(row);
        setSelectedDaySessions(row.sessions || []);
        setSelectedSessionIds([]);
        setDrillDownOpen(true);
    };

    // Handle checkbox toggle for session selection
    const handleSessionSelect = (sessionId: string) => {
        setSelectedSessionIds(prev => {
            if (prev.includes(sessionId)) {
                return prev.filter(id => id !== sessionId);
            } else {
                return [...prev, sessionId];
            }
        });
    };

    // Handle select all sessions
    const handleSelectAll = () => {
        if (selectedSessionIds.length === selectedDaySessions.length) {
            setSelectedSessionIds([]);
        } else {
            setSelectedSessionIds(selectedDaySessions.map((s: any) => s.id).filter(Boolean));
        }
    };

    // Open delete confirmation dialog
    const openDeleteDialog = () => {
        if (selectedSessionIds.length > 0) {
            setDeleteDialogOpen(true);
        }
    };

    // Delete selected sessions
    const handleDeleteSessions = async () => {
        if (selectedSessionIds.length === 0) return;
        
        setDeleting(true);
        try {
            const token = getToken();
            if (!token) return;

            let deletedCount = 0;
            for (const sessionId of selectedSessionIds) {
                const response = await fetch(`${API_BASE}/admin/attendance/${sessionId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) {
                    deletedCount++;
                }
            }

            // Refresh the report after deletion
            await generateReport();
            
            // Update the drill-down sessions
            const updatedSessions = selectedDaySessions.filter((s: any) => !selectedSessionIds.includes(s.id));
            setSelectedDaySessions(updatedSessions);
            setSelectedSessionIds([]);
            setDeleteDialogOpen(false);
            
            // Show success message (you could add a snackbar here)
            console.log(`Successfully deleted ${deletedCount} session(s)`);
        } catch (err) {
            console.error('Error deleting sessions:', err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Stack spacing={4} sx={{ pb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: "'Segoe UI', sans-serif" }}>
                    Reports
                </Typography>
                <Stack direction="row" spacing={2}>
                    <Button 
                        variant="contained" 
                        startIcon={<DownloadIcon />} 
                        onClick={() => setDownloadDialogOpen(true)}
                        disabled={reportRecords.length === 0}
                        sx={{ bgcolor: '#598791', '&:hover': { bgcolor: '#466c74' }, borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 3 }}
                    >
                        Download
                    </Button>
                </Stack>
            </Box>

            {/* Summary Cards - Only shown for individual employees */}
            {selectedEmployee && selectedEmployee !== 'all' && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Card sx={{ borderRadius: '16px', bgcolor: alpha(theme.palette.success.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.1) }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'success.main', color: 'white' }}>
                                    <PresentIcon />
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary" fontWeight={600}>Total Present Days</Typography>
                                    <Typography variant="h4" fontWeight={800}>{summary.total_present}</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Card sx={{ borderRadius: '16px', bgcolor: alpha(theme.palette.error.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.1) }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'error.main', color: 'white' }}>
                                    <AbsentIcon />
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary" fontWeight={600}>Total Absent Days</Typography>
                                    <Typography variant="h4" fontWeight={800}>{summary.total_absent}</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Filters */}
            <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent sx={{ p: 3 }}>
                    <Grid container spacing={2} alignItems="flex-end">
                        <Grid item xs={12} md={2}>
                            <TextField
                                select
                                label="Time Period"
                                fullWidth
                                value={timePeriod}
                                onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
                            >
                                <MenuItem value="day">Today</MenuItem>
                                <MenuItem value="week">This Week</MenuItem>
                                <MenuItem value="month">This Month</MenuItem>
                                <MenuItem value="custom">Custom Range</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid item xs={12} md={2}>
                            <TextField
                                select
                                label="Employee"
                                fullWidth
                                value={selectedEmployee}
                                onChange={(e) => setSelectedEmployee(e.target.value)}
                            >
                                <MenuItem value="all">All Employees</MenuItem>
                                {filterOptions.employees.map((emp) => (
                                    <MenuItem key={emp.employee_id} value={emp.employee_id}>
                                        {emp.full_name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>

                        <Grid item xs={12} md={2}>
                            <TextField
                                select
                                label="Type"
                                fullWidth
                                value={attendanceType}
                                onChange={(e) => setAttendanceType(e.target.value)}
                            >
                                <MenuItem value="all">All Types</MenuItem>
                                <MenuItem value="Office">Office</MenuItem>
                                <MenuItem value="Field">Field</MenuItem>
                                <MenuItem value="Hybrid">Hybrid</MenuItem>
                            </TextField>
                        </Grid>

                        {timePeriod === 'custom' && (
                            <>
                                <Grid item xs={12} md={2.5}>
                                    <TextField
                                        type="date"
                                        label="From"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} md={2.5}>
                                    <TextField
                                        type="date"
                                        label="To"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={dateTo}
                                        inputProps={{ min: dateFrom }}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                </Grid>
                            </>
                        )}

                        <Grid item xs={12} md={1}>
                            <Tooltip title="Reset Filters">
                                <IconButton onClick={() => {
                                    setTimePeriod('day');
                                    setSelectedEmployee('all');
                                    setAttendanceType('all');
                                    const today = new Date().toISOString().split('T')[0];
                                    setDateFrom(today);
                                    setDateTo(today);
                                }} sx={{ height: 56, width: 56, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
                                    <ClearIcon />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Report Table */}
            {generating ? (
                <SkeletonTable rows={5} />
            ) : error ? (
                <Box sx={{ p: 3, borderRadius: '16px', bgcolor: alpha(theme.palette.error.main, 0.05), border: '1px solid', borderColor: theme.palette.error.main }}>
                    <Typography color="error" fontWeight={600}>{error}</Typography>
                </Box>
            ) : (
                <Card sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table sx={{ minWidth: 900 }}>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Employee Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Login</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Logout</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>Details</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reportRecords.length > 0 ? reportRecords.map((row, idx) => (
                                    <TableRow key={idx} hover>
                                        <TableCell sx={{ fontWeight: 600 }}>{formatDate(row.date)}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={700}>{row.full_name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{row.employee_id}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={row.attendance_type} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                                        </TableCell>
                                        <TableCell>{formatTime(row.first_login)}</TableCell>
                                        <TableCell>{row.is_active ? <Chip label="Still In" size="small" color="success" /> : formatTime(row.last_login)}</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#598791' }}>{row.formatted_duration}</TableCell>
                                        <TableCell align="center">
                                            <IconButton size="small" onClick={() => openDrillDown(row)}>
                                                <ViewIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">No records found for the selected period.</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                </Card>
            )}

            {/* Drill-down Modal */}
            <Dialog open={drillDownOpen} onClose={() => setDrillDownOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h6" fontWeight={800}>Attendance Logs</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {selectedDayInfo?.full_name} | {formatDate(selectedDayInfo?.date)}
                            </Typography>
                        </Box>
                        <IconButton onClick={() => setDrillDownOpen(false)}><CloseIcon /></IconButton>
                    </Box>
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={selectedDaySessions.length > 0 && selectedSessionIds.length === selectedDaySessions.length}
                                        indeterminate={selectedSessionIds.length > 0 && selectedSessionIds.length < selectedDaySessions.length}
                                        onChange={handleSelectAll}
                                    />
                                </TableCell>
                                <TableCell>Login</TableCell>
                                <TableCell>Logout</TableCell>
                                <TableCell>Location</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell align="right">Duration</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {selectedDaySessions.length > 0 ? selectedDaySessions.map((s: any, i: number) => (
                                <TableRow key={i} hover selected={selectedSessionIds.includes(s.id)}>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedSessionIds.includes(s.id)}
                                            onChange={() => handleSessionSelect(s.id)}
                                        />
                                    </TableCell>
                                    <TableCell>{formatTime(s.check_in)}</TableCell>
                                    <TableCell>{formatTime(s.check_out) || 'Active'}</TableCell>
                                    <TableCell sx={{ minWidth: 200, py: 1.5 }}>
                                        <Typography variant="body2" sx={{ whiteSpace: 'normal', lineBreak: 'anywhere' }}>
                                            {s.entry_location_display}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{s.is_field_work ? 'Field' : 'Office'}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{s.formatted_duration}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                        <Typography color="text.secondary">No sessions found for this date.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                    <Box>
                        {selectedSessionIds.length > 0 && (
                            <Typography variant="body2" color="text.secondary">
                                {selectedSessionIds.length} session(s) selected
                            </Typography>
                        )}
                    </Box>
                    <Box>
                        <Button 
                            color="error" 
                            startIcon={<DeleteIcon />} 
                            onClick={openDeleteDialog}
                            disabled={selectedSessionIds.length === 0}
                            sx={{ mr: 1 }}
                        >
                            Delete Selected
                        </Button>
                        <Button onClick={() => setDrillDownOpen(false)}>Close</Button>
                    </Box>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete {selectedSessionIds.length} selected session(s)? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button 
                        color="error" 
                        variant="contained" 
                        onClick={handleDeleteSessions}
                        disabled={deleting}
                    >
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Download Dialog */}
            <Dialog 
                open={downloadDialogOpen} 
                onClose={() => !exporting && setDownloadDialogOpen(false)}
                maxWidth="xs" 
                fullWidth
                PaperProps={{
                    sx: { borderRadius: '20px', p: 1 }
                }}
            >
                <DialogTitle>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" gap={1}>
                            <DownloadIcon color="primary" />
                            <Typography variant="h6" fontWeight={800}>Download Report</Typography>
                        </Stack>
                        <IconButton onClick={() => !exporting && setDownloadDialogOpen(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            select
                            fullWidth
                            label="What would you like to download?"
                            value={downloadOption}
                            onChange={(e: any) => setDownloadOption(e.target.value as 'summary' | 'logs')}
                        >
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
                                    Employee: {filterOptions.employees.find(e => e.employee_id === selectedEmployee)?.full_name || selectedEmployee}
                                </Typography>
                            )}
                            {attendanceType !== 'all' && (
                                <Typography variant="body2">
                                    Type: {attendanceType}
                                </Typography>
                            )}
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            Downloading <b>{downloadOption === 'summary' ? 'Summary' : 'Detailed Records'}</b> for the current filters.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button 
                        fullWidth 
                        variant="outlined" 
                        onClick={() => downloadOption === 'summary' ? handleDownloadCSV() : handleDownloadDetailedLogs('csv')}
                        disabled={exporting}
                    >
                        CSV
                    </Button>
                    <Button 
                        fullWidth 
                        variant="contained" 
                        onClick={() => downloadOption === 'summary' ? handleDownloadPDF() : handleDownloadDetailedLogs('pdf')}
                        disabled={exporting}
                    >
                        {exporting ? 'Processing...' : 'PDF'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}

