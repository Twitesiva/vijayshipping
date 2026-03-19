'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableContainer,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
  IconButton,
  alpha
} from '@mui/material';
import { 
    Visibility as ViewIcon, 
    AccessTime as TimeIcon, 
    LocationOn as LocationIcon,
    Work as WorkIcon,
    Event as DateIcon
} from '@mui/icons-material';
import { formatDate, formatTime } from '../../lib/format';

export type HistoryRecord = {
  check_in?: string;
  check_out?: string;
  entry_location_display?: string;
  exit_location_display?: string;
  display_date?: string;
  date?: string;
  status?: string;
  total_hours?: number;
  formatted_duration?: string;
  attendance_type?: string;
  is_field_work?: boolean;
};

type ModernHistoryTableProps = {
  loading: boolean;
  records: HistoryRecord[];
  formatDurationFromHours: (hours?: number) => string;
  formatDurationFromTimes: (entry?: string, exit?: string) => string;
  enablePagination?: boolean;
  rowsPerPage?: number;
  showLocation?: boolean;
  onViewDetails?: (record: HistoryRecord) => void;
};

export default function ModernHistoryTable({
  loading,
  records,
  formatDurationFromHours,
  formatDurationFromTimes,
  enablePagination = false,
  rowsPerPage = 5,
  showLocation = false,
  onViewDetails
}: ModernHistoryTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage] = React.useState(1);

  const totalPages = enablePagination ? Math.max(1, Math.ceil(records.length / rowsPerPage)) : 1;
  const visibleRecords = enablePagination
    ? records.slice((page - 1) * rowsPerPage, page * rowsPerPage)
    : records;

  React.useEffect(() => {
    setPage(1);
  }, [records, enablePagination, rowsPerPage]);

  const getStatusConfig = (status?: string) => {
    const s = String(status || 'active').toLowerCase();
    if (s === 'absent') return { color: '#ef4444', label: 'ABSENT', glow: 'rgba(239, 68, 68, 0.2)' };
    if (s === 'active') return { color: '#10b981', label: 'ACTIVE', glow: 'rgba(16, 185, 129, 0.2)' };
    return { color: '#6366f1', label: 'COMPLETED', glow: 'rgba(99, 102, 241, 0.2)' };
  };

  return (
    <Box sx={{ position: 'relative' }}>
        {/* Background Decorative Mesh (Subtle) */}
        <Box sx={{ 
            position: 'absolute', 
            top: -20, right: -20, 
            width: 150, height: 150, 
            borderRadius: '50%', 
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%)',
            zIndex: 0 
        }} />

        <Card sx={{
            position: 'relative',
            zIndex: 1,
            borderRadius: '32px',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden'
        }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.04em', mb: 0.5 }}>
                            Attendance History
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                            Review your recent activity and logs
                        </Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: '#f1f5f9', color: '#0ea5e9', display: 'flex' }}>
                        <TimeIcon />
                    </Box>
                </Stack>

                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
                        <CircularProgress size={40} thickness={5} sx={{ color: '#0ea5e9' }} />
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>SYNCING RECORDS...</Typography>
                    </Box>
                ) : records.length === 0 ? (
                    <Box sx={{ py: 10, textAlign: 'center', bgcolor: alpha('#f1f5f9', 0.5), borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <Typography variant="body1" sx={{ color: '#94a3b8', fontWeight: 700 }}>
                            Everything looks quiet here.
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={2.5}>
                        {/* Desktop Header Slabs (Hidden on Mobile) */}
                        {!isMobile && (
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 0.5fr', px: 3, opacity: 0.6 }}>
                                {['DATE', 'LOGIN', 'LOGOUT', 'TYPE', 'DURATION', ''].map((h) => (
                                    <Typography key={h} variant="caption" sx={{ fontWeight: 900, color: '#475569', letterSpacing: '0.1em' }}>{h}</Typography>
                                ))}
                            </Box>
                        )}

                        {visibleRecords.map((record: any, idx: number) => {
                            const config = getStatusConfig(record.status);
                            const isAbsent = String(record.status).toLowerCase() === 'absent';
                            const entryDate = isAbsent ? record.display_date || '-' : formatDate(record.check_in);
                            const entryTime = isAbsent ? '--' : formatTime(record.check_in);
                            const exitTime = isAbsent ? '--' : (record.check_out ? formatTime(record.check_out) : (record.status === 'active' ? 'Active' : '-'));
                            const hours = isAbsent ? '--' : (record.formatted_duration || formatDurationFromHours(record.total_hours || 0));
                            const workType = matches(record.attendance_type, 'Hybrid') ? 'HYBRID'
                                            : matches(record.attendance_type, 'Field') || record.is_field_work ? 'FIELD' 
                                            : 'OFFICE';

                            function matches(val: string, target: string) {
                                return String(val || '').toLowerCase().includes(target.toLowerCase());
                            }

                            return (
                                <Box
                                    key={`${record.check_in || 'row'}-${idx}`}
                                    sx={{
                                        position: 'relative',
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 1fr 1fr 1fr 0.5fr',
                                        alignItems: 'center',
                                        p: isMobile ? 3 : 2.5,
                                        px: 3,
                                        borderRadius: '24px',
                                        bgcolor: isAbsent ? 'rgba(254, 242, 242, 0.5)' : '#ffffff',
                                        border: '1px solid',
                                        borderColor: isAbsent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(226, 232, 240, 0.8)',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
                                            borderColor: isAbsent ? 'rgba(239, 68, 68, 0.2)' : '#0ea5e9'
                                        }
                                    }}
                                >
                                    {/* Row Left Accent */}
                                    <Box sx={{ 
                                        position: 'absolute', 
                                        left: 8, top: '20%', bottom: '20%', 
                                        width: 4, borderRadius: '10px', 
                                        bgcolor: config.color,
                                        boxShadow: `0 0 10px ${config.glow}`
                                    }} />

                                    {/* Content Grouping for Mobile */}
                                    <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 2 : 0} sx={{ display: 'contents' }}>
                                        {/* Date */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Box sx={{ p: 1, borderRadius: '10px', bgcolor: alpha(config.color, 0.05), color: config.color, display: isMobile ? 'flex' : 'none' }}>
                                                <DateIcon sx={{ fontSize: '1rem' }} />
                                            </Box>
                                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>{entryDate}</Typography>
                                        </Box>

                                        {/* In/Out */}
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                                            {isMobile && <Box component="span" sx={{ opacity: 0.5, mr: 1 }}>IN:</Box>}
                                            {entryTime}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                                            {isMobile && <Box component="span" sx={{ opacity: 0.5, mr: 1 }}>OUT:</Box>}
                                            <Box component="span" sx={{ color: exitTime === 'Active' ? '#10b981' : 'inherit' }}>{exitTime}</Box>
                                        </Typography>

                                        {/* Type */}
                                        <Box>
                                            <Chip 
                                                label={workType} 
                                                size="small" 
                                                sx={{ 
                                                    fontWeight: 900, fontSize: '0.65rem', 
                                                    letterSpacing: '0.05em', height: 22,
                                                    bgcolor: workType === 'FIELD' ? '#f5f3ff' : workType === 'HYBRID' ? '#fdf4ff' : '#eff6ff', 
                                                    color: workType === 'FIELD' ? '#7c3aed' : workType === 'HYBRID' ? '#a21caf' : '#0ea5e9',
                                                    border: '1px solid currentColor',
                                                    '& .MuiChip-label': { px: 1 }
                                                }} 
                                            />
                                        </Box>

                                        {/* Duration + Progress */}
                                        <Box sx={{ position: 'relative' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 900, color: '#0f172a' }}>{hours}</Typography>
                                        </Box>

                                        {/* Actions & Status */}
                                        <Stack direction="row" alignItems="center" justifyContent={isMobile ? 'space-between' : 'flex-end'} spacing={1}>
                                            <Chip 
                                                label={config.label}
                                                size="small"
                                                sx={{ 
                                                    fontWeight: 900, fontSize: '0.6rem', 
                                                    height: 20, borderRadius: '6px',
                                                    bgcolor: alpha(config.color, 0.1), 
                                                    color: config.color,
                                                    boxShadow: `0 0 15px ${config.glow}`
                                                }}
                                            />
                                            {onViewDetails && !isAbsent && (
                                                <IconButton 
                                                    size="small" 
                                                    onClick={() => onViewDetails(record)}
                                                    sx={{ 
                                                        color: '#64748b', 
                                                        '&:hover': { bgcolor: '#f1f5f9', color: '#0ea5e9' } 
                                                    }}
                                                >
                                                    <ViewIcon sx={{ fontSize: '1.2rem' }} />
                                                </IconButton>
                                            )}
                                        </Stack>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}

                {enablePagination && records.length > rowsPerPage && !loading && (
                    <Stack alignItems="center" sx={{ mt: 6 }}>
                        <Pagination
                            page={page}
                            count={totalPages}
                            onChange={(_, value) => setPage(value)}
                            sx={{
                                '& .MuiPaginationItem-root': {
                                    fontWeight: 900,
                                    borderRadius: '14px',
                                    border: '1px solid transparent',
                                    transition: 'all 0.2s',
                                    '&.Mui-selected': {
                                        background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                                        color: 'white',
                                        boxShadow: '0 10px 15px -3px rgba(14, 165, 233, 0.3)',
                                        '&:hover': { transform: 'scale(1.05)' }
                                    },
                                    '&:hover': {
                                        borderColor: '#e2e8f0',
                                        bgcolor: '#f8fafc'
                                    }
                                }
                            }}
                        />
                    </Stack>
                )}
            </CardContent>
        </Card>
    </Box>
  );
}
