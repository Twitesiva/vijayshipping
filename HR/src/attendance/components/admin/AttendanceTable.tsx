'use client';

import * as React from 'react';
import {
  Avatar,
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { AttendanceRecord } from '../../types';
import { formatDate, formatTime } from '../../lib/format';

type AttendanceTableProps = {
  records: AttendanceRecord[];
  formatDurationFromHours: (hours?: number) => string;
  formatDurationFromTimes: (entry?: string, exit?: string) => string;
  onView: (recordId: string) => void;
  onMarkExit: (recordId: string) => void;
};

export default function AttendanceTable({
  records,
  formatDurationFromHours,
  formatDurationFromTimes,
}: AttendanceTableProps) {
  const theme = useTheme();

  if (records.length === 0) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          No attendance logs found for this period.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Table sx={{ minWidth: 1120 }}>
        <TableHead>
          <TableRow sx={{
            '& th': {
              bgcolor: 'transparent',
              borderBottom: '1px solid',
              borderColor: 'divider',
              color: 'common.white',
              fontSize: '0.95rem',
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: 0,
              py: 2
            }
          }}>
            <TableCell>Employee</TableCell>
            <TableCell>Login</TableCell>
            <TableCell>Logout</TableCell>
            <TableCell>Entry Location</TableCell>
            <TableCell>Exit Location</TableCell>
            <TableCell>Total Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((record) => {
            const entryDate = formatDate(record.check_in);
            const entryTime = formatTime(record.check_in);
            const exitTime = record.check_out ? formatTime(record.check_out) : '---';
            const exitDate = record.check_out ? formatDate(record.check_out) : '...';

            const duration = record.formatted_duration ||
              (record.check_in && record.check_out ? formatDurationFromTimes(record.check_in, record.check_out) :
                record.total_hours ? formatDurationFromHours(record.total_hours) : '--');

            const entryLoc = record.entry_location_display || record.entry_location_name || record.location_name || 'Office';
            const exitLoc = record.exit_location_display || record.exit_location_name || (record.check_out ? 'Office' : '---');

            return (
              <TableRow
                key={record.id}
                sx={{
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                  transition: 'background-color 0.2s ease',
                  '& td': { color: 'text.primary' }
                }}
              >
                <TableCell>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: 'action.hover',
                        color: 'text.primary',
                        fontSize: '0.8rem',
                        fontWeight: 400
                      }}
                    >
                      {record.full_name?.charAt(0) || record.employee_id?.charAt(0) || 'E'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 400, color: 'text.primary' }}>
                        {record.full_name || 'Staff Member'}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack spacing={0.2}>
                    <Typography variant="body2" sx={{ fontWeight: 400, color: 'text.primary' }}>{entryTime}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{entryDate}</Typography>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack spacing={0.2}>
                    <Typography variant="body2" sx={{ fontWeight: 400, color: 'text.primary' }}>{exitTime}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{exitDate}</Typography>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <LocationIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 400,
                        color: 'text.primary'
                      }}
                    >
                      {entryLoc}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell>
                  {record.check_out ? (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <LocationIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 400,
                          color: 'text.primary'
                        }}
                      >
                        {exitLoc}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                      ---
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TimeIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
                    <Typography variant="body2" sx={{ fontWeight: 400, color: 'text.primary' }}>
                      {duration}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
