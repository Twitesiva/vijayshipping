'use client';

import * as React from 'react';
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Grid,
    LinearProgress,
    MenuItem,
    Paper,
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
    DialogContentText,
    IconButton,
    Menu,
    Tooltip
} from '@mui/material';
import {
    Assessment as DailyIcon,
    Summarize as SummaryIcon,
    Download as DownloadIcon,
    Print as PrintIcon,
    DeleteOutline as ClearIcon,
    Close as CloseIcon,
    Business as BusinessIcon,
    LocationOn as LocationIcon,
    CalendarMonth as MonthIcon,
    DateRange as WeekIcon,
    ChevronRight as ArrowIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { API_BASE } from '../../lib/api';
import { clearToken, clearUser, getToken } from '../../lib/storage';
import { formatDate, formatTime } from '../../lib/format';
import { SkeletonTable } from '../../../components/Preloader';

type ReportType = 'summary' | 'daily';
type ExportFormat = 'csv' | 'json' | 'excel';

type ReportLocationFilter = '' | 'inside_office' | 'outside_office';

export default function Reports() {
    const theme = useTheme();
    const [reportType] = React.useState<ReportType>('daily');
    const [dailyReportDate, setDailyReportDate] = React.useState('');
    const [reportDateTo, setReportDateTo] = React.useState('');
    const [reportEmployee, setReportEmployee] = React.useState('');
    const [reportLocation, setReportLocation] = React.useState<ReportLocationFilter>('');
    const [currentReport, setCurrentReport] = React.useState<any>(null);
    const [filterOptions, setFilterOptions] = React.useState<{
        departments: string[];
        employees: Array<{ employee_id: string; full_name?: string; department?: string }>;
        locations: string[];
    }>({ departments: [], employees: [], locations: [] });
    const [generating, setGenerating] = React.useState(false);
    const [error, setError] = React.useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
    const [recordToDelete, setRecordToDelete] = React.useState<string | null>(null);

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

    React.useEffect(() => {
        const today = new Date();
        setDailyReportDate(toInputDate(today));
        setReportDateTo(toInputDate(today));

        const loadOptions = async () => {
            try {
                const token = getToken();
                const res = await fetch(`${API_BASE}/admin/filter-options`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) return;
                const data = await res.json();
                setFilterOptions({
                    departments: data.departments || [],
                    employees: data.employees || [],
                    locations: data.locations || []
                });
            } catch (e) {
                console.error(e);
            }
        };

        loadOptions();
    }, []);

    const clearFilters = () => {
        const now = new Date();
        const today = toInputDate(now);
        setDailyReportDate(today);
        setReportDateTo(today);
        setReportEmployee('');
        setReportLocation('');
    };

    const isInsideOfficeLocation = React.useCallback((r: any) => {
        if (!r) return false;
        if (typeof r.is_field_work === 'boolean') return !r.is_field_work;
        const location = String(r.entry_location_display || r.entry_location_name || r.location_name || '').trim().toLowerCase();
        if (!location) return true;
        return (
            location.includes('vijay shipping office') ||
            location.includes('twite ai office') ||
            location.includes('inside office') ||
            location.includes('office')
        );
    }, []);

    const fetchFilteredAttendanceRecords = React.useCallback(async (token: string) => {
        const params = new URLSearchParams({
            limit: '3000',
            offset: '0',
            sort_by: 'check_in',
            sort_order: 'desc'
        });

        if (!dailyReportDate) return [] as any[];
        params.append('date_from', dailyReportDate);
        params.append('date_to', reportDateTo || dailyReportDate);

        if (reportEmployee) params.append('employee_id', reportEmployee);

        const response = await fetch(`${API_BASE}/admin/attendance-records?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 401) {
            handleUnauthorized();
            throw new Error('Session expired');
        }
        if (!response.ok) {
            throw new Error(`Failed to load records`);
        }
        const data = await response.json();
        let records = Array.isArray(data.records) ? data.records : [];
        if (reportLocation === 'inside_office') {
            records = records.filter((r: any) => isInsideOfficeLocation(r));
        } else if (reportLocation === 'outside_office') {
            records = records.filter((r: any) => !isInsideOfficeLocation(r));
        }
        return records;
    }, [dailyReportDate, reportDateTo, reportEmployee, reportLocation, isInsideOfficeLocation]);

    const buildReportFromRecords = (records: any[]) => {
        const details = records.map((r) => ({
            id: r.id,
            employee_id: r.employee_id,
            full_name: r.full_name,
            department: r.department,
            check_in: r.check_in,
            check_out: r.check_out,
            location: r.entry_location_display || r.entry_location_name || r.location_name || '--',
            exit_location: r.exit_location_display || r.exit_location_name || (r.check_out ? 'Same as Entry' : '--'),
            work_type: r.is_field_work ? 'Field' : 'Office',
            formatted_duration: r.formatted_duration || '--',
            total_hours: r.total_hours || 0,
            attendance_status: (r.status || '').toLowerCase() === 'active' ? 'Logged In' : 'Logged Out'
        }));

        return {
            attendance_details: details
        };
    };

    const generateReport = React.useCallback(async () => {
        setGenerating(true);
        setError('');
        try {
            const token = getToken();
            if (!token) {
                setError('Session expired. Please sign in again.');
                return;
            }
            const records = await fetchFilteredAttendanceRecords(token);
            setCurrentReport(buildReportFromRecords(records));
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Network issue while generating report.');
        } finally {
            setGenerating(false);
        }
    }, [fetchFilteredAttendanceRecords]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            generateReport();
        }, 250);
        return () => window.clearTimeout(timer);
    }, [
        generateReport,
        dailyReportDate,
        reportDateTo,
        reportEmployee,
        reportLocation
    ]);

    const handleDeleteRecord = async () => {
        if (!recordToDelete) return;
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/admin/attendance/${recordToDelete}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                generateReport();
                setDeleteConfirmOpen(false);
                setRecordToDelete(null);
            } else {
                setError('Failed to delete record.');
            }
        } catch (e) {
            console.error(e);
            setError('Error deleting record.');
        }
    };

    const detailRows = (currentReport?.attendance_details || []).slice(0, 100);

    return (
        <Stack spacing={4} sx={{ pb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography
                    variant="h4"
                    sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.01em', lineHeight: 1.2 }}
                >
                    Reports
                </Typography>
            </Box>

            <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent sx={{ p: 3 }}>
                    <Grid container spacing={2} alignItems="flex-end">
                        <Grid item xs={12} md={3}>
                            <TextField
                                type="date"
                                label="From Date"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={dailyReportDate}
                                onChange={(e) => setDailyReportDate(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                type="date"
                                label="To Date"
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={reportDateTo}
                                inputProps={{ min: dailyReportDate }}
                                onChange={(e) => setReportDateTo(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <TextField
                                select
                                label="Employee"
                                fullWidth
                                value={reportEmployee}
                                onChange={(e) => setReportEmployee(e.target.value)}
                            >
                                <MenuItem value="">All Employees</MenuItem>
                                {filterOptions.employees.map((emp) => (
                                    <MenuItem key={emp.employee_id} value={emp.employee_id}>
                                        ({emp.employee_id}) - {emp.full_name || 'N/A'}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <TextField
                                select
                                label="Location"
                                fullWidth
                                value={reportLocation}
                                onChange={(e) => setReportLocation(e.target.value as ReportLocationFilter)}
                            >
                                <MenuItem value="">All Locations</MenuItem>
                                <MenuItem value="inside_office">Inside Office</MenuItem>
                                <MenuItem value="outside_office">Outside Office</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<ClearIcon />}
                                onClick={clearFilters}
                                sx={{
                                    height: 56,
                                    borderRadius: '12px',
                                    borderColor: 'divider',
                                    color: 'text.primary',
                                    fontWeight: 700,
                                    bgcolor: 'background.paper',
                                    '&:hover': {
                                        borderColor: 'text.secondary',
                                        bgcolor: 'action.hover'
                                    }
                                }}
                            >
                                Reset Filters
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {generating ? (
                <SkeletonTable rows={5} />
            ) : error ? (
                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: alpha(theme.palette.error.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.25) }}>
                    <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700 }}>{error}</Typography>
                </Box>
            ) : null}

            {currentReport && !generating && (
                <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>Attendance Report</Typography>
                    </Box>

                    <Box sx={{ overflowX: 'auto' }}>
                        <Table sx={{ border: 'none', minWidth: 800 }}>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell>Employee</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Location</TableCell>
                                    <TableCell>Login</TableCell>
                                    <TableCell>Logout</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {detailRows.length > 0 ? detailRows.map((row: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell sx={{ fontWeight: 600 }}>{row.full_name || row.employee_id}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={row.work_type || 'Office'}
                                                variant="outlined"
                                                sx={{ fontWeight: 600, fontSize: '0.65rem', height: 20 }}
                                            />
                                        </TableCell>
                                        <TableCell>{row.location || '-'}</TableCell>
                                        <TableCell>{formatTime(row.check_in) || '--'}</TableCell>
                                        <TableCell>{formatTime(row.check_out) || '--'}</TableCell>
                                        <TableCell>{row.formatted_duration || (row.total_hours ? `${Number(row.total_hours).toFixed(2)} hrs` : '--')}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={row.attendance_status}
                                                color={row.attendance_status === 'Logged In' ? 'success' : 'error'}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => {
                                                    setRecordToDelete(row.id);
                                                    setDeleteConfirmOpen(true);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                No records found for this day.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                </Card>
            )}

            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>Delete Record</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this attendance record? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteRecord} color="error" autoFocus>Delete</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
