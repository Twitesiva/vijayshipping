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
    TableContainer,
    TableHead,
    TableRow,
    GlobalStyles
} from '@mui/material';
import {
    People as PeopleIcon,
    CheckCircle as AttendanceIcon,
    Update as UpdateIcon,
    PersonOff as AbsentIcon
} from '@mui/icons-material';
import { API_BASE } from '../../lib/api';
import { clearToken, clearUser, getToken } from '../../lib/storage';
import { formatMinutesToHMM, formatDuration } from '../../lib/format';
import { 
    ModernDashboardDrillDownTable 
} from './ModernReportComponents';
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
            <Box sx={{ mb: 4 }}><Typography variant="h4" sx={{ fontWeight: 700, fontFamily: '"Segoe UI", sans-serif' }}>Overview</Typography></Box>
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
    const totalDetails = uniqueByEmployee(dailyDetails).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    const presentDetails = uniqueByEmployee(dailyDetails.filter((row: any) => row?.attendance_status === 'Present')).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    const absentDetails = uniqueByEmployee(dailyDetails.filter((row: any) => row?.attendance_status === 'Absent')).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

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
            icon: <PeopleIcon sx={{ fontSize: 28 }} />,
            color: '#0ea5e9',
            bg: alpha('#0ea5e9', 0.1)
        },
        {
            title: 'Today Present',
            count: stats.todayAttendance,
            icon: <AttendanceIcon sx={{ fontSize: 28 }} />,
            color: '#10b981',
            bg: alpha('#10b981', 0.1)
        },
        {
            title: 'Today Absent',
            count: stats.todayAbsent,
            icon: <AbsentIcon sx={{ fontSize: 28 }} />,
            color: '#ef4444',
            bg: alpha('#ef4444', 0.1)
        }
    ];

    return (
        <Box>
            <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                justifyContent="space-between" 
                alignItems={{ xs: 'flex-start', sm: 'center' }} 
                spacing={2}
                sx={{ mb: 3 }}
            >
                <Box>
                    <Typography variant="h5" sx={{ 
                        fontWeight: 900, 
                        color: '#0f172a', 
                        letterSpacing: '-0.02em',
                        fontSize: { xs: '1.5rem', sm: '1.875rem' },
                        fontFamily: '"Segoe UI", sans-serif'
                    }}>
                        Dashboard
                    </Typography>
                </Box>
                <IconButton 
                    onClick={() => loadStats(true)} 
                    size="small" 
                    sx={{ 
                        bgcolor: '#ffffff', 
                        border: '1px solid #f1f5f9',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        '&:hover': { bgcolor: '#f8fafc' },
                        alignSelf: { xs: 'flex-end', sm: 'auto' }
                    }} 
                    disabled={refreshing}
                >
                    <UpdateIcon fontSize="small" />
                </IconButton>
            </Stack>

            <Grid container spacing={2}>
                {cards.map((card, index) => (
                    <Grid item xs={12} sm={6} md={4} lg={4} key={index}>
                        <Card sx={{
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: alpha(card.color, 0.2),
                            bgcolor: '#ffffff',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                            height: '100%',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                borderColor: card.color,
                                boxShadow: `0 12px 20px -5px ${alpha(card.color, 0.12)}`
                            },
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0, left: 0, right: 0, height: 3,
                                bgcolor: card.color,
                                opacity: selectedDetail === (card.title === 'Today Present' ? 'present' : card.title === 'Today Absent' ? 'absent' : 'total') ? 1 : 0
                            }
                        }}
                            onClick={() => {
                                if (card.title === 'Today Present') setSelectedDetail('present');
                                if (card.title === 'Today Absent') setSelectedDetail('absent');
                                if (card.title === 'Total Employees') setSelectedDetail('total');
                            }}
                        >
                            <CardContent sx={{ p: 2.5 }}>
                                <Stack spacing={2}>
                                    <Box sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: '14px',
                                        bgcolor: card.bg,
                                        color: card.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.3s'
                                    }}>
                                        {card.icon}
                                    </Box>
                                    <Box>
                                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', lineHeight: 1.2, fontFamily: '"Segoe UI", sans-serif' }}>
                                            {card.count}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, mt: 0.5, letterSpacing: '0.05em', fontFamily: '"Segoe UI", sans-serif' }}>
                                            {card.title.toUpperCase()}
                                        </Typography>
                                    </Box>
                                    
                                    <Box sx={{ height: 4, width: '100%', bgcolor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                                        <Box sx={{
                                            height: '100%',
                                            width: stats.totalEmployees > 0 ? `${Math.min((card.count / stats.totalEmployees) * 100, 100)}%` : '5%',
                                            bgcolor: card.color,
                                            borderRadius: 2,
                                            transition: 'width 1s ease-out'
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
                            borderRadius: { xs: '24px', sm: '32px' },
                            border: '1px solid #f1f5f9',
                            bgcolor: '#ffffff',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.05)',
                            animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                                    <Typography variant="h5" sx={{ 
                                        fontWeight: 900, 
                                        color: '#0f172a',
                                        fontSize: { xs: '1.25rem', sm: '1.5rem' },
                                        fontFamily: '"Segoe UI", sans-serif'
                                    }}>
                                        {detailTitle}
                                    </Typography>
                                    <Button 
                                        variant="text" 
                                        onClick={() => setSelectedDetail('')} 
                                        sx={{ 
                                            textTransform: 'none', 
                                            fontWeight: 900, 
                                            color: '#ef4444',
                                            '&:hover': { bgcolor: alpha('#ef4444', 0.05) }
                                        }}
                                    >
                                        Dismiss
                                    </Button>
                                </Stack>
                                
                                <ModernDashboardDrillDownTable records={detailRows} />
                            </CardContent>
                        </Card>
                    </Grid>
                )}

            </Grid>
            
            <GlobalStyles styles={{
                '@keyframes slideUp': {
                    from: { transform: 'translateY(20px)', opacity: 0 },
                    to: { transform: 'translateY(0)', opacity: 1 },
                }
            }} />
        </Box>
    );
}
