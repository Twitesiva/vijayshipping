'use client';

import * as React from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Stack,
    Typography,
    alpha,
    useTheme,
    IconButton,
    useMediaQuery,
    Pagination
} from '@mui/material';
import {
    Visibility as ViewIcon,
    Person as PersonIcon,
    CheckCircle as PresentIcon,
    Cancel as AbsentIcon,
    AccessTime as TimeIcon,
    LocationOn as LocationIcon,
    CalendarMonth as DateIcon,
    Work as WorkIcon
} from '@mui/icons-material';
import { formatDate, formatTime } from '../../lib/format';

// --- Level 1: Summary Table (Bento Grid Style) ---

export function ModernSummaryTable({ records, onEmployeeClick, generating }: any) {
    const isMobile = useMediaQuery('(max-width:600px)');
    const [page, setPage] = React.useState(1);
    const rowsPerPage = 6;
    
    if (generating) return null; // Let skeleton show

    const paginatedRecords = records.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    const totalPages = Math.ceil(records.length / rowsPerPage);

    const handlePageChange = (_event: any, value: number) => {
        setPage(value);
    };

    return (
        <Stack spacing={2.5}>
            {paginatedRecords.length > 0 ? (
                <>
                    {paginatedRecords.map((row: any, idx: number) => (
                        <Box
                            key={idx}
                            onClick={(e) => {
                                (e.currentTarget as HTMLElement).blur();
                                onEmployeeClick(row);
                            }}
                            role="button"
                            aria-label={`View details for ${row.full_name}`}
                            sx={{
                                position: 'relative',
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 0.5fr',
                                alignItems: 'center',
                                p: 2.5,
                                px: 4,
                                borderRadius: '24px',
                                bgcolor: '#ffffff',
                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    transform: 'translateY(-2px) scale(1.005)',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
                                    borderColor: '#0ea5e9',
                                    '& .view-btn': { bgcolor: '#0ea5e9', color: 'white' }
                                }
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: alpha('#0ea5e9', 0.1), color: '#0ea5e9' }}>
                                    <PersonIcon />
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 800, color: '#0f172a' }}>{row.full_name}</Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>ID: {row.employee_id}</Typography>
                                </Box>
                            </Stack>

                            {isMobile ? (
                                <Stack direction="row" spacing={3} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f8fafc' }}>
                                    <Box>
                                        <Typography variant="caption" display="block" sx={{ color: '#94a3b8', fontWeight: 800, mb: 0.25 }}>PRESENT</Typography>
                                        <Typography variant="body1" sx={{ color: '#10b981', fontWeight: 900 }}>{row.total_present}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" display="block" sx={{ color: '#94a3b8', fontWeight: 800, mb: 0.25 }}>ABSENT</Typography>
                                        <Typography variant="body1" sx={{ color: '#ef4444', fontWeight: 900 }}>{row.total_absent}</Typography>
                                    </Box>
                                </Stack>
                            ) : (
                                <>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" display="block" sx={{ color: '#94a3b8', fontWeight: 800, mb: 0.5 }}>PRESENT</Typography>
                                        <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 900 }}>{row.total_present}</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" display="block" sx={{ color: '#94a3b8', fontWeight: 800, mb: 0.5 }}>ABSENT</Typography>
                                        <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 900 }}>{row.total_absent}</Typography>
                                    </Box>
                                </>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <IconButton 
                                    className="view-btn" 
                                    aria-label="View employee report"
                                    sx={{ borderRadius: '12px', transition: 'all 0.2s' }}
                                >
                                    <ViewIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    ))}
                    {totalPages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, pb: 2 }}>
                            <Pagination 
                                count={totalPages} 
                                page={page} 
                                onChange={handlePageChange} 
                                color="primary" 
                                sx={{ 
                                    '& .MuiPaginationItem-root': {
                                        borderRadius: '12px',
                                        fontWeight: 700
                                    }
                                }}
                            />
                        </Box>
                    )}
                </>
            ) : (
                <Box sx={{ py: 10, textAlign: 'center', opacity: 0.6 }}>
                    <Typography variant="body1" fontWeight={700}>No records match your filters.</Typography>
                </Box>
            )}
        </Stack>
    );
}

// --- Level 2: Employee Details (Daily Slabs) ---

export function ModernEmployeeDetailsTable({ records, onDrillDown }: any) {
    const isMobile = useMediaQuery('(max-width:600px)');

    return (
        <Stack spacing={2}>
            {!isMobile && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 0.5fr', px: 4, opacity: 0.4 }}>
                    {['DATE', 'TYPE', 'LOGIN', 'LOGOUT', 'DURATION', ''].map(h => (
                        <Typography key={h} variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.1em' }}>{h}</Typography>
                    ))}
                </Box>
            )}
            {records.map((row: any, idx: number) => {
                const isAbsent = !row.first_login;
                return (
                    <Box
                        key={idx}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr 0.5fr' : '1.2fr 1fr 1fr 1fr 1fr 0.5fr',
                            alignItems: 'center',
                            gap: isMobile ? 1 : 0,
                            p: 2, px: isMobile ? 3 : 4,
                            borderRadius: '20px',
                            bgcolor: isAbsent ? alpha('#ef4444', 0.02) : '#ffffff',
                            border: '1px solid',
                            borderColor: isAbsent ? alpha('#ef4444', 0.1) : '#f1f5f9',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: isAbsent ? alpha('#ef4444', 0.05) : '#f8fafc', borderColor: isAbsent ? '#ef4444' : '#0ea5e9' }
                        }}
                    >
                        {/* Mobile: Date and Type in a Stack */}
                        <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatDate(row.date)}</Typography>
                            {isMobile && (
                                <Box>
                                    <Chip 
                                        label={row.attendance_type || (isAbsent ? 'N/A' : 'Office')} 
                                        size="small" 
                                        sx={{ 
                                            fontWeight: 900, fontSize: '0.65rem', height: 18,
                                            bgcolor: isAbsent ? '#f1f5f9' : '#eff6ff', 
                                            color: isAbsent ? '#64748b' : '#0ea5e9' 
                                        }} 
                                    />
                                </Box>
                            )}
                        </Stack>

                        {!isMobile && (
                            <Box>
                                <Chip 
                                    label={row.attendance_type || (isAbsent ? 'N/A' : 'Office')} 
                                    size="small" 
                                    sx={{ 
                                        fontWeight: 900, fontSize: '0.65rem', height: 20,
                                        bgcolor: isAbsent ? '#f1f5f9' : '#eff6ff', 
                                        color: isAbsent ? '#64748b' : '#0ea5e9' 
                                    }} 
                                />
                            </Box>
                        )}

                        {/* In/Out Times */}
                        {isMobile ? (
                            <>
                                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3 }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'block', mb: 0.25 }}>IN</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatTime(row.first_login) || '--'}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'block', mb: 0.25 }}>OUT</Typography>
                                        {row.is_active ? (
                                            <Chip label="ACTIVE" size="small" sx={{ fontWeight: 900, fontSize: '0.6rem', height: 18, bgcolor: '#ecfdf5', color: '#059669', boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }} />
                                        ) : (
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatTime(row.last_login) || '--'}</Typography>
                                        )}
                                    </Box>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800, display: 'block', mb: 0.25 }}>DURATION</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#0ea5e9' }}>{row.formatted_duration || '--'}</Typography>
                                </Box>
                            </>
                        ) : (
                            <>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatTime(row.first_login) || '--'}</Typography>
                                <Box>
                                    {row.is_active ? (
                                        <Chip label="ACTIVE" size="small" sx={{ fontWeight: 900, fontSize: '0.6rem', height: 18, bgcolor: '#ecfdf5', color: '#059669', boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }} />
                                    ) : (
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatTime(row.last_login) || '--'}</Typography>
                                    )}
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 900, color: '#0ea5e9' }}>{row.formatted_duration || '--'}</Typography>
                            </>
                        )}

                        <Box sx={{ textAlign: 'right' }}>
                            {!isAbsent && (
                                <IconButton 
                                    onClick={(e) => {
                                        (e.currentTarget as HTMLElement).blur();
                                        onDrillDown(row);
                                    }} 
                                    size="small" 
                                    aria-label={`View sessions for ${formatDate(row.date)}`}
                                    sx={{ color: '#64748b', '&:hover': { color: '#0ea5e9' } }}
                                >
                                    <ViewIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                );
            })}
        </Stack>
    );
}

// --- Level 3: Session Logs (Ultra Granular) ---

export function ModernSessionLogTable({ sessions }: any) {
    return (
        <Stack spacing={2} sx={{ p: 4 }}>
            <Box sx={{ 
                display: { xs: 'none', md: 'grid' }, 
                gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr', 
                px: 2, 
                opacity: 0.4 
            }}>
                    {['LOGIN', 'LOGOUT', 'LOCATION', 'TYPE', 'DURATION'].map(h => (
                        <Typography key={h} variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.05em' }}>{h}</Typography>
                    ))}
            </Box>
            {sessions.map((s: any, i: number) => (
                <Box
                    key={i}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1.2fr 1.2fr 1fr', md: '1fr 1fr 2fr 1fr 1fr' },
                        alignItems: 'center',
                        gap: { xs: 1.5, md: 0 },
                        p: 2, borderRadius: '16px',
                        border: '1px solid #f1f5f9',
                        bgcolor: '#ffffff',
                        '&:hover': { borderColor: '#0ea5e9', bgcolor: '#f8fafc' }
                    }}
                >
                    <Box>
                        <Typography variant="body2" sx={{ fontWeight: 800, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>{formatTime(s.check_in)}</Typography>
                        <Box component="span" sx={{ display: { xs: 'block', md: 'none' }, fontSize: '0.65rem', color: 'text.secondary', fontWeight: 700 }}>LOGIN</Box>
                    </Box>
                    <Box>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: s.check_out ? 'inherit' : '#10b981', fontSize: { xs: '0.8rem', md: '0.875rem' } }}>{formatTime(s.check_out) || 'ACTIVE'}</Typography>
                        <Box component="span" sx={{ display: { xs: 'block', md: 'none' }, fontSize: '0.65rem', color: 'text.secondary', fontWeight: 700 }}>LOGOUT</Box>
                    </Box>
                    
                    <Box sx={{ gridColumn: { xs: 'span 3', md: 'span 1' }, mt: { xs: 0.5, md: 0 }, pt: { xs: 1, md: 0 }, borderTop: { xs: '1px solid #f1f5f9', md: 'none' } }}>
                        <Box component="span" sx={{ display: { xs: 'block', md: 'none' }, fontSize: '0.65rem', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>LOCATION</Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>{s.entry_location_display || 'Office'}</Typography>
                        {s.exit_location_display && (
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#94a3b8' }}>↳ {s.exit_location_display}</Typography>
                        )}
                    </Box>

                    <Box sx={{ gridColumn: { xs: 'span 2', md: 'span 1' }, mt: { xs: 0.5, md: 0 } }}>
                        <Box component="span" sx={{ display: { xs: 'block', md: 'none' }, fontSize: '0.65rem', color: 'text.secondary', fontWeight: 700, mb: 0.5 }}>TYPE</Box>
                        <Chip 
                            label={s.is_field_work ? 'FIELD' : 'OFFICE'} 
                            size="small" 
                            sx={{ 
                                fontWeight: 900, fontSize: '0.6rem', height: 18,
                                bgcolor: s.is_field_work ? '#fdf2f8' : '#f0f9ff',
                                color: s.is_field_work ? '#ec4899' : '#0ea5e9',
                                border: '1px solid currentColor'
                            }} 
                        />
                    </Box>

                    <Box sx={{ textAlign: { xs: 'right', md: 'left' } }}>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: '#0ea5e9', fontSize: { xs: '0.8rem', md: '0.875rem' } }}>{s.formatted_duration}</Typography>
                        <Box component="span" sx={{ display: { xs: 'block', md: 'none' }, fontSize: '0.65rem', color: 'text.secondary', fontWeight: 700 }}>DUR</Box>
                    </Box>
                </Box>
            ))}
        </Stack>
    );
}

// --- Dashboard Drill-down Table (Compact Slab Style) ---

export function ModernDashboardDrillDownTable({ records }: any) {
    const isMobile = useMediaQuery('(max-width:600px)');

    return (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
            {!isMobile && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr', px: 3, opacity: 0.4 }}>
                    {['EMPLOYEE', 'STATUS', 'DURATION', 'TYPE'].map(h => (
                        <Typography key={h} variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.05em', fontFamily: '"Segoe UI", sans-serif' }}>{h}</Typography>
                    ))}
                </Box>
            )}
            {records.map((row: any, idx: number) => {
                const isAbsent = row.attendance_status === 'Absent';
                return (
                    <Box
                        key={idx}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr 1.2fr',
                            alignItems: 'center',
                            p: 2, px: 3,
                            borderRadius: '16px',
                            bgcolor: isAbsent ? alpha('#fef2f2', 0.5) : '#ffffff',
                            border: '1px solid',
                            borderColor: isAbsent ? alpha('#fee2e2', 0.8) : '#f1f5f9',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                            '&:hover': { 
                                borderColor: isAbsent ? '#ef4444' : '#0ea5e9',
                                transform: 'translateX(4px)',
                                transition: 'all 0.2s ease'
                            }
                        }}
                    >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                             <Box sx={{ 
                                width: 32, height: 32, 
                                borderRadius: '10px', 
                                bgcolor: alpha(isAbsent ? '#ef4444' : '#0ea5e9', 0.1),
                                color: isAbsent ? '#ef4444' : '#0ea5e9',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                             }}>
                                <PersonIcon sx={{ fontSize: 18 }} />
                             </Box>
                             <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', fontFamily: '"Segoe UI", sans-serif' }}>
                                {row.full_name || row.employee_id || '--'}
                             </Typography>
                        </Stack>

                        <Box>
                            <Chip 
                                label={row.attendance_status || (isAbsent ? 'Absent' : 'Present')} 
                                size="small" 
                                sx={{ 
                                    fontWeight: 900, fontSize: '0.6rem', height: 18,
                                    bgcolor: isAbsent ? '#fee2e2' : '#ecfdf5', 
                                    color: isAbsent ? '#ef4444' : '#10b981',
                                    fontFamily: '"Segoe UI", sans-serif'
                                }} 
                            />
                        </Box>

                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#64748b', fontFamily: '"Segoe UI", sans-serif' }}>
                            {row.formatted_duration || '--'}
                        </Typography>

                        <Box>
                            <Chip 
                                label={row.session_types || (row.is_field_work ? 'Field' : 'Office')} 
                                size="small" 
                                variant="outlined"
                                sx={{ 
                                    fontWeight: 800, fontSize: '0.6rem', height: 18,
                                    borderColor: alpha('#94a3b8', 0.3),
                                    color: '#64748b',
                                    fontFamily: '"Segoe UI", sans-serif'
                                }} 
                            />
                        </Box>
                    </Box>
                );
            })}
        </Stack>
    );
}
