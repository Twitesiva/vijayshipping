'use client';

import * as React from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    Grid,
    MenuItem,
    Pagination,
    Stack,
    TextField,
    Typography,
    alpha,
    useTheme,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    DeleteSweep as ClearIcon
} from '@mui/icons-material';
import AttendanceTable from './AttendanceTable';
import { TableSkeleton } from '../../components/common/Skeletons';
import Alerts, { AlertState } from '../../components/common/Alerts';
import { API_BASE } from '../../lib/api';
import { getToken } from '../../lib/storage';
import { AttendanceRecord } from '../../types';
import { formatDuration } from '../../lib/format';

export default function Attendance() {
    const OFFICE_LOCATION = 'Vijay Shipping Office';
    const LOCATION_INSIDE = 'inside_office';
    const LOCATION_OUTSIDE = 'outside_office';
    const theme = useTheme();
    const [loading, setLoading] = React.useState(true);
    const [records, setRecords] = React.useState<AttendanceRecord[]>([]);
    const [totalRecords, setTotalRecords] = React.useState(0);
    const [currentPage, setCurrentPage] = React.useState(0);
    const [recordsPerPage] = React.useState(10);
    const [alert, setAlert] = React.useState<AlertState>({ open: false, message: '', severity: 'info' });

    const [filters, setFilters] = React.useState({
        employee_id: '',
        designation: '',
        location: '',
        department: '',
        date_from: '',
        date_to: '',
        sort_by: 'check_in',
        sort_order: 'desc'
    });

    const [filterOptions, setFilterOptions] = React.useState({
        employees: [] as any[],
        designations: [] as string[],
        departments: [] as string[],
        locations: [] as string[]
    });
    const latestRequestRef = React.useRef(0);

    const normalizeText = (value: unknown) => String(value || '').trim();

    const loadFilterOptions = async () => {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/admin/filter-options`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const employees = data.options?.employees || [];
                const derivedDesignations = Array.from(
                    new Set(
                        employees
                            .map((emp: any) =>
                                normalizeText(emp.designation) ||
                                normalizeText(emp.department) ||
                                normalizeText(emp.role)
                            )
                            .filter(Boolean)
                    )
                );
                const optionDesignations = Array.isArray(data.options?.designations)
                    ? data.options.designations.map((d: unknown) => normalizeText(d)).filter(Boolean)
                    : [];
                const fallbackDesignations = Array.isArray(data.options?.departments)
                    ? data.options.departments.map((d: unknown) => normalizeText(d)).filter(Boolean)
                    : [];
                const optionLocations = Array.isArray(data.options?.locations)
                    ? data.options.locations.map((l: unknown) => normalizeText(l)).filter(Boolean)
                    : [];
                const mergedLocations = Array.from(new Set([
                    'Vijay Shipping Office',
                    ...optionLocations
                ])).sort((a, b) => a.localeCompare(b));
                const mergedDesignations = Array.from(new Set([
                    ...optionDesignations,
                    ...derivedDesignations,
                    ...fallbackDesignations
                ])).sort((a, b) => a.localeCompare(b));
                setFilterOptions({
                    employees,
                    designations: mergedDesignations,
                    departments: data.options?.departments || [],
                    locations: mergedLocations
                });
            }
        } catch (err) { console.error(err); }
    };

    const loadRecords = async (page = currentPage, f = filters, rpp = recordsPerPage) => {
        const requestId = ++latestRequestRef.current;
        setLoading(true);
        try {
            const token = getToken();
            const params = new URLSearchParams({
                limit: String(rpp),
                offset: String(page * rpp),
                sort_by: f.sort_by,
                sort_order: f.sort_order
            });
            if (f.employee_id) params.append('employee_id', f.employee_id);
            if (f.date_from) params.append('date_from', f.date_from);
            if (f.date_to) params.append('date_to', f.date_to);
            if (f.department) params.append('department', f.department);
            if (f.location) params.append('location', f.location);
            if (f.designation) params.append('designation', f.designation);

            const response = await fetch(`${API_BASE}/admin/attendance-records?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (requestId === latestRequestRef.current) {
                    const allRecords: AttendanceRecord[] = data.records || [];
                    setRecords(allRecords);
                    setTotalRecords(data.pagination?.total || 0);
                }
            }
        } catch (err) { console.error(err); }
        finally {
            if (requestId === latestRequestRef.current) {
                setLoading(false);
            }
        }
    };

    React.useEffect(() => {
        loadFilterOptions();
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        setFilters(p => ({
            ...p,
            date_from: weekAgo.toISOString().split('T')[0],
            date_to: today.toISOString().split('T')[0]
        }));
    }, []);

    React.useEffect(() => {
        loadRecords(currentPage, filters, recordsPerPage);
    }, [filters, currentPage, recordsPerPage]);

    const updateFilter = (key: keyof typeof filters, value: string) => {
        setCurrentPage(0);
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilters({
            employee_id: '',
            designation: '',
            location: '',
            department: '',
            date_from: '',
            date_to: '',
            sort_by: 'check_in',
            sort_order: 'desc'
        });
        setCurrentPage(0);
    };

    const formatDurationFromHours = (totalHours?: number) => {
        return (totalHours || 0).toFixed(2) + ' hrs';
    };

    const formatDurationFromTimes = (entryTime?: string, exitTime?: string) => {
        if (!entryTime || !exitTime) return '-';
        try {
            const entry = new Date(entryTime);
            const exit = new Date(exitTime);
            const diffMs = exit.getTime() - entry.getTime();
            const diffHrs = diffMs / (1000 * 60 * 60);
            return diffHrs.toFixed(2) + ' hrs';
        } catch (e) { return '-'; }
    };

    const markExit = async (recordId: string) => {
        if (!confirm('Mark exit for this record?')) return;
        try {
            const response = await fetch(`${API_BASE}/admin/mark-exit/${recordId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (response.ok) {
                setAlert({ open: true, message: 'Exit recorded successfully', severity: 'success' });
                loadRecords();
            }
        } catch (err) { console.error(err); }
    };

    return (
        <Stack spacing={4}>
            {/* Header & Main Stats */}
            <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <Box>
                        <Typography
                            variant="h4"
                            sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.01em', lineHeight: 1.2 }}
                        >
                            Attendance History
                        </Typography>
                    </Box>
                </Stack>

                {/* Intelligent Filter Panel */}
                <Card sx={{
                    borderRadius: '24px',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                }}>
                    <CardContent sx={{ p: 3 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    select
                                    label="Staff Member"
                                    fullWidth
                                    value={filters.employee_id}
                                    onChange={e => updateFilter('employee_id', e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: 'background.paper' } }}
                                >
                                    <MenuItem value="">All Employees</MenuItem>
                                    {filterOptions.employees.map(emp => <MenuItem key={emp.employee_id} value={emp.employee_id}>{emp.full_name}</MenuItem>)}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <TextField
                                    select
                                    label="Designation"
                                    fullWidth
                                    value={filters.designation}
                                    onChange={e => updateFilter('designation', e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: 'background.paper' } }}
                                >
                                    <MenuItem value="">All Designations</MenuItem>
                                    {filterOptions.designations.map((designation) => (
                                        <MenuItem key={designation} value={designation}>
                                            {designation}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <TextField
                                    type="date"
                                    label="From"
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    value={filters.date_from}
                                    onChange={e => updateFilter('date_from', e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: 'background.paper' } }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <TextField
                                    type="date"
                                    label="To"
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    value={filters.date_to}
                                    onChange={e => updateFilter('date_to', e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: 'background.paper' } }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <TextField
                                    select
                                    label="Location"
                                    fullWidth
                                    value={filters.location}
                                    onChange={e => updateFilter('location', e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: 'background.paper' } }}
                                >
                                    <MenuItem value="">All Locations</MenuItem>
                                    <MenuItem value={LOCATION_INSIDE}>Inside Office</MenuItem>
                                    <MenuItem value={LOCATION_OUTSIDE}>Outside Office</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={1}>
                                <Stack direction="row" spacing={1} sx={{ height: '100%', pt: 1 }}>
                                    <Tooltip title="Reset Filters">
                                        <IconButton
                                            onClick={handleClearFilters}
                                            sx={{
                                                bgcolor: alpha(theme.palette.error.main, 0.05),
                                                color: 'error.main',
                                                borderRadius: '12px',
                                                width: '100%',
                                                height: 54
                                            }}
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            </Box>

            {/* List View */}
            <Card sx={{
                borderRadius: '24px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: 'none',
                overflow: 'visible'
            }}>
                <CardContent sx={{ p: 0 }}>
                    <Box
                        sx={{
                            p: 3,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: { xs: 'flex-start', md: 'center' },
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 1.5
                        }}
                    >
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <Typography variant="h6" sx={{ fontWeight: 400, color: 'text.primary' }}>Record Log</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                                {totalRecords === 0 ? '0 - 0 of 0' : `${currentPage * recordsPerPage + 1} - ${Math.min((currentPage + 1) * recordsPerPage, totalRecords)} of ${totalRecords}`}
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                Quick Filter
                            </Typography>
                            <Chip
                                label="Inside Office (Vijay Shipping Office)"
                                color={filters.location === LOCATION_INSIDE ? 'primary' : 'default'}
                                variant={filters.location === LOCATION_INSIDE ? 'filled' : 'outlined'}
                                onClick={() => updateFilter('location', filters.location === LOCATION_INSIDE ? '' : LOCATION_INSIDE)}
                                sx={{ fontWeight: 500 }}
                            />
                        </Stack>
                    </Box>
                    <Divider />
                    <Box sx={{ minHeight: 500 }}>
                        {loading ? (
                            <Box sx={{ p: 3 }}><TableSkeleton rows={10} columns={6} /></Box>
                        ) : (
                            <AttendanceTable
                                records={records}
                                formatDurationFromHours={formatDurationFromHours}
                                formatDurationFromTimes={formatDurationFromTimes}
                                onMarkExit={markExit}
                                onView={() => { }}
                            />
                        )}
                    </Box>
                    <Divider />
                    <Box sx={{ p: { xs: 1.5, md: 2 }, display: 'flex', justifyContent: 'center' }}>
                        <Pagination
                            page={currentPage + 1}
                            count={Math.max(1, Math.ceil(totalRecords / recordsPerPage))}
                            onChange={(_, page) => setCurrentPage(page - 1)}
                            color="primary"
                            shape="rounded"
                            size="small"
                            siblingCount={1}
                            boundaryCount={1}
                            showFirstButton
                            showLastButton
                        />
                    </Box>
                </CardContent>
            </Card>
            <Alerts alert={alert} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </Stack>
    );
}
