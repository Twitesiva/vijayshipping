'use client';

import * as React from 'react';
import {
    Grid,
    Card,
    CardContent,
    Typography,
    Box,
    alpha,
    useTheme,
    Stack,
    IconButton,
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow
} from '@mui/material';
import {
    People as PeopleIcon,
    CheckCircle as AttendanceIcon,
    Update as UpdateIcon,
    PersonOff as AbsentIcon
} from '@mui/icons-material';
import { API_BASE } from '../../lib/api';
import { clearToken, clearUser, getToken } from '../../lib/storage';
import { formatMinutesToHMM } from '../../lib/format';
import { AdminDashboardSkeleton } from '../../components/common/Skeletons';

export default function Dashboard() {
    const theme = useTheme();
    const [stats, setStats] = React.useState({
        totalEmployees: 0,
        activeEmployees: 0,
        todayAttendance: 0,
        todayAbsent: 0,
        faceEnrolled: 0
    });
    const [summaryReport, setSummaryReport] = React.useState<any>(null);
    const [dailyDetails, setDailyDetails] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [selectedDetail, setSelectedDetail] = React.useState<'present' | 'absent' | 'total' | ''>('');

    const loadStats = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            const token = getToken();
            if (!token) return;

            const today = new Date();
            const lastWeek = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
            const dateFrom = lastWeek.toISOString().split('T')[0];
            const dateTo = today.toISOString().split('T')[0];

            const statsResponse = await fetch(`${API_BASE}/admin/dashboard-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (statsResponse.status === 401) {
                clearToken();
                clearUser();
                window.location.href = '/login';
                return;
            }

            if (statsResponse.ok) {
                const data = await statsResponse.json();
                const s = data.stats;
                setStats({
                    totalEmployees: s.total_users || 0,
                    activeEmployees: s.active_users || 0,
                    todayAttendance: s.today_attendance || 0,
                    todayAbsent: s.today_absent || 0,
                    faceEnrolled: s.face_enrolled || 0
                });
            }

            const summaryResponse = await fetch(`${API_BASE}/admin/reports/summary?date_from=${dateFrom}&date_to=${dateTo}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                setSummaryReport(summaryData.report || null);
            }

            const todayStr = today.toISOString().split('T')[0];
            const dailyResponse = await fetch(`${API_BASE}/admin/reports/daily?date=${todayStr}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (dailyResponse.ok) {
                const dailyData = await dailyResponse.json();
                setDailyDetails(dailyData?.report?.attendance_details || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    React.useEffect(() => {
        loadStats();
    }, []);

    if (loading) return (
        <Box sx={{ p: 1 }}>
            <Box sx={{ mb: 4 }}><Typography variant="h5" sx={{ fontWeight: 700 }}>Overview</Typography></Box>
            <AdminDashboardSkeleton />
        </Box>
    );

    const uniqueByEmployee = (rows: any[]) => {
        const uniqueMap = new Map<string, any>();
        rows.forEach((row) => {
            const key = String(row?.employee_id || row?.full_name || '').trim().toLowerCase();
            if (!key) return;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, row);
                return;
            }
            const existing = uniqueMap.get(key);
            const existingDesignation = String(existing?.designation || '').trim();
            const nextDesignation = String(row?.designation || '').trim();
            if (!existingDesignation && nextDesignation) {
                uniqueMap.set(key, row);
            }
        });
        return Array.from(uniqueMap.values());
    };
    const totalDetails = uniqueByEmployee(dailyDetails);
    const presentDetails = uniqueByEmployee(dailyDetails.filter((row: any) => row?.attendance_status === 'Present'));
    const absentDetails = uniqueByEmployee(dailyDetails.filter((row: any) => row?.attendance_status === 'Absent'));

    const detailRows = selectedDetail === 'present' ? presentDetails
        : selectedDetail === 'absent' ? absentDetails
            : selectedDetail === 'total' ? totalDetails
                : [];

    const detailTitle = selectedDetail === 'present' ? 'Today Present Details'
        : selectedDetail === 'absent' ? 'Today Absent Details'
            : 'Total Employees Details';

    const cards = [
        {
            title: 'Total Employees',
            count: stats.totalEmployees,
            icon: <PeopleIcon sx={{ fontSize: 32 }} />,
            color: theme.palette.primary.main,
            bg: alpha(theme.palette.primary.main, 0.15)
        },
        {
            title: 'Today Present',
            count: stats.todayAttendance,
            icon: <AttendanceIcon sx={{ fontSize: 32 }} />,
            color: theme.palette.success.main,
            bg: alpha(theme.palette.success.main, 0.15)
        },
        {
            title: 'Today Absent',
            count: stats.todayAbsent,
            icon: <AbsentIcon sx={{ fontSize: 32 }} />,
            color: theme.palette.error.main,
            bg: alpha(theme.palette.error.main, 0.15)
        }
    ];

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        Dashboard Overview
                    </Typography>
                </Box>
                <IconButton onClick={() => loadStats(true)} size="small" sx={{ bgcolor: 'action.hover' }} disabled={refreshing}>
                    <UpdateIcon fontSize="small" />
                </IconButton>
            </Stack>

            <Grid container spacing={3}>
                {cards.map((card, index) => (
                    <Grid item xs={12} sm={6} md={4} lg={4} key={index}>
                        <Card sx={{
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: alpha(card.color, 0.35),
                            bgcolor: alpha(card.color, 0.08),
                            boxShadow: 'none',
                            height: '100%',
                            cursor: 'pointer',
                            transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                borderColor: alpha(card.color, 0.45),
                                boxShadow: `0 14px 32px ${alpha(card.color, 0.20)}`
                            }
                        }}
                            onClick={() => {
                                if (card.title === 'Today Present') setSelectedDetail('present');
                                if (card.title === 'Today Absent') setSelectedDetail('absent');
                                if (card.title === 'Total Employees') setSelectedDetail('total');
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Stack spacing={2}>
                                    <Box sx={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: '16px',
                                        bgcolor: card.bg,
                                        color: card.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {card.icon}
                                    </Box>
                                    <Box>
                                        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                            {card.count}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                            {card.title}
                                        </Typography>
                                    </Box>
                                    {/* Mini visual trend - fixed static for aesthetic but tied to concept */}
                                    <Box sx={{ height: 4, width: '100%', bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
                                        <Box sx={{
                                            height: '100%',
                                            width: stats.totalEmployees > 0 ? `${Math.min((card.count / stats.totalEmployees) * 100, 100)}%` : '5%',
                                            bgcolor: card.color
                                        }} />
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}

                {selectedDetail && (
                    <Grid item xs={12}>
                        <Card sx={{
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            boxShadow: 'none'
                        }}>
                            <CardContent sx={{ p: 3 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                        {detailTitle}
                                    </Typography>
                                    <Button size="small" variant="outlined" onClick={() => setSelectedDetail('')} sx={{ textTransform: 'none', fontWeight: 700 }}>
                                        Close
                                    </Button>
                                </Stack>
                                <Table sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden' }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell>Employee</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Duration</TableCell>
                                            <TableCell>Session Types</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {detailRows.length > 0 ? detailRows.map((row: any, idx: number) => (
                                            <TableRow key={`${row.employee_id || 'emp'}-${idx}`}>
                                                <TableCell>{row.full_name || row.employee_id || '--'}</TableCell>
                                                <TableCell>{row.attendance_status || '--'}</TableCell>
                                                <TableCell>{row.formatted_duration || `${Number(row.total_hours || 0).toFixed(2)} hrs`}</TableCell>
                                                <TableCell>
                                                    {row.session_types || (row.is_field_work ? 'Field' : 'Office')}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={6}>
                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                        No records found for today.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

            </Grid>
        </Box>
    );
}
