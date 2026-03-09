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
  useTheme
} from '@mui/material';
import { formatDate, formatTime } from '../../lib/format';

export type HistoryRecord = {
  check_in?: string;
  check_out?: string;
  location_name?: string;
  zone_name?: string;
  formatted_duration?: string;
  total_hours?: number;
  status?: string;
  is_field_work?: boolean;
  display_date?: string;
  date?: string;
};

type HistoryTableProps = {
  loading: boolean;
  records: HistoryRecord[];
  formatDurationFromHours: (hours?: number) => string;
  formatDurationFromTimes: (entry?: string, exit?: string) => string;
  enablePagination?: boolean;
  rowsPerPage?: number;
};

export default function HistoryTable({
  loading,
  records,
  formatDurationFromHours,
  formatDurationFromTimes,
  enablePagination = false,
  rowsPerPage = 10
}: HistoryTableProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [records, enablePagination, rowsPerPage]);

  const totalPages = enablePagination ? Math.max(1, Math.ceil(records.length / rowsPerPage)) : 1;
  const visibleRecords = enablePagination
    ? records.slice((page - 1) * rowsPerPage, page * rowsPerPage)
    : records;

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <Card sx={{
      position: 'relative',
      zIndex: 10,
      borderRadius: '24px',
      border: '1px solid',
      borderColor: 'divider',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      overflow: 'hidden'
    }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 900, color: '#1e293b', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="span" sx={{ bgcolor: '#f1f5f9', p: 1, borderRadius: '12px', display: 'flex' }}>📋</Box>
          Recent Attendance
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={32} sx={{ color: '#598791' }} />
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Loading your attendance history...</Typography>
          </Box>
        ) : records.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: '18px', border: '1px dashed #e2e8f0' }}>
            <Typography variant="body1" sx={{ color: '#94a3b8', fontWeight: 600 }}>
              No attendance records found for this period.
            </Typography>
          </Box>
        ) : isMobile ? (
          <Stack spacing={2}>
            {visibleRecords.map((record, idx) => {
              const rawStatus = String(record.status || 'active').toLowerCase();
              const isAbsent = rawStatus === 'absent';
              const isLoggedIn = rawStatus === 'active';

              const entryDate = isAbsent ? record.display_date || '-' : formatDate(record.check_in);
              const entryTime = isAbsent ? '--' : formatTime(record.check_in);
              const exitTime = isAbsent ? '--' : (record.check_out ? formatTime(record.check_out) : '-');
              const location = isAbsent ? '--' : (record.location_name || record.zone_name || 'Unknown');
              const hours = isAbsent ? '--' : (
                record.formatted_duration ||
                (record.check_in && record.check_out
                  ? formatDurationFromTimes(record.check_in, record.check_out)
                  : record.total_hours
                    ? formatDurationFromHours(record.total_hours)
                    : '-')
              );
              const workType = isAbsent ? '--' : (record.is_field_work ? 'Field' : 'Office');

              let statusLabel = 'Completed';
              if (isLoggedIn) statusLabel = 'Active';
              if (isAbsent) statusLabel = 'Absent';

              const statusColors = isAbsent
                ? { bg: '#fef2f2', text: '#dc2626' }
                : isLoggedIn
                  ? { bg: '#ecfdf5', text: '#059669' }
                  : { bg: '#f1f5f9', text: '#64748b' };

              return (
                <Box
                  key={`${record.check_in || 'row'}-${idx}`}
                  sx={{
                    p: 2.5,
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: '#f8fafc'
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>{entryDate}</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Login: {entryTime}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Logout: {exitTime}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={statusLabel}
                      sx={{
                        fontWeight: 700,
                        borderRadius: '8px',
                        bgcolor: statusColors.bg,
                        color: statusColors.text
                      }}
                    />
                  </Stack>
                  <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Work Type</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: record.is_field_work ? '#7c3aed' : '#598791' }}>{workType}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Location</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>{location}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>Total Time</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#598791' }}>{hours}</Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <TableContainer sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', py: 2.5 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Login</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Logout</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Duration</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRecords.map((record, idx) => {
                  const rawStatus = String(record.status || 'active').toLowerCase();
                  const isAbsent = rawStatus === 'absent';
                  const isLoggedIn = rawStatus === 'active';

                  const entryDate = isAbsent ? record.display_date || '-' : formatDate(record.check_in);
                  const entryTime = isAbsent ? '--' : formatTime(record.check_in);
                  const exitTime = isAbsent ? '--' : (record.check_out ? formatTime(record.check_out) : '-');
                  const location = isAbsent ? '--' : (record.location_name || record.zone_name || 'Unknown');
                  const hours = isAbsent ? '--' : (
                    record.formatted_duration ||
                    (record.check_in && record.check_out
                      ? formatDurationFromTimes(record.check_in, record.check_out)
                      : record.total_hours
                        ? formatDurationFromHours(record.total_hours)
                        : '-')
                  );
                  const workType = isAbsent ? '--' : (record.is_field_work ? 'Field' : 'Office');

                  let statusLabel = 'Completed';
                  if (isLoggedIn) statusLabel = 'Active';
                  if (isAbsent) statusLabel = 'Absent';

                  const statusColors = isAbsent
                    ? { bg: '#fef2f2', text: '#dc2626' }
                    : isLoggedIn
                      ? { bg: '#ecfdf5', text: '#059669' }
                      : { bg: '#f1f5f9', text: '#64748b' };

                  return (
                    <TableRow key={`${record.check_in || 'row'}-${idx}`} sx={{ '&:hover': { bgcolor: '#f1f5f9' }, transition: 'background-color 0.2s' }}>
                      <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>{entryDate}</TableCell>
                      <TableCell sx={{ color: '#475569', fontWeight: 600 }}>{entryTime}</TableCell>
                      <TableCell sx={{ color: '#475569', fontWeight: 600 }}>{exitTime}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={workType}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            height: 24,
                            bgcolor: record.is_field_work ? '#f5f3ff' : '#f0f9ff',
                            color: record.is_field_work ? '#7c3aed' : '#0ea5e9',
                            border: '1px solid transparent'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#475569', fontWeight: 600 }}>{location}</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#598791' }}>{hours}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={statusLabel}
                          sx={{
                            fontWeight: 700,
                            borderRadius: '8px',
                            bgcolor: statusColors.bg,
                            color: statusColors.text
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {enablePagination && records.length > rowsPerPage && !loading && (
          <Stack alignItems="center" sx={{ mt: 4 }}>
            <Pagination
              page={page}
              count={totalPages}
              onChange={(_, value) => setPage(value)}
              size={isMobile ? 'small' : 'medium'}
              sx={{
                '& .MuiPaginationItem-root': {
                  fontWeight: 700,
                  borderRadius: '12px',
                  '&.Mui-selected': {
                    bgcolor: '#598791',
                    color: 'white',
                    '&:hover': { bgcolor: '#4a727a' }
                  }
                }
              }}
              showFirstButton
              showLastButton
            />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
