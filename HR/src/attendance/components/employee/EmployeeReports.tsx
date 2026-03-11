'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableContainer,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import HistoryTable, { HistoryRecord } from './HistoryTable';
import { apiFetch } from '../../lib/api';
import { getUser } from '../../lib/storage';
import { formatDate, formatTime, formatMinutesToHMM } from '../../lib/format';

function toDateOnly(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampRangeDaysForMonth(month: string, from?: string, to?: string) {
  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(y, (m || 1) - 1, 1);
  const monthEnd = new Date(y, (m || 1) - 1, daysInMonth(y, (m || 1) - 1));
  const fromDate = from ? new Date(`${from}T00:00:00`) : monthStart;
  const toDate = to ? new Date(`${to}T00:00:00`) : monthEnd;
  const start = fromDate > monthStart ? fromDate : monthStart;
  const end = toDate < monthEnd ? toDate : monthEnd;
  if (end < start) return 0;
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function enumerateMonths(from: string, to: string) {
  if (!from || !to) return [] as string[];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= limit) {
    out.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

type FilterMode = 'date' | 'week' | 'month';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatMonthInput(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function formatDisplayDate(value?: string) {
  if (!value) return '--';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
}

function getISOWeek(value: Date) {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function formatWeekInput(date: Date) {
  const { year, week } = getISOWeek(date);
  return `${year}-W${pad2(week)}`;
}

function weekRange(weekValue: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  if (!match) return { from: '', to: '' };
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + ((week - 1) * 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    from: formatDateInput(new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())),
    to: formatDateInput(new Date(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()))
  };
}

function monthRange(monthValue: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!match) return { from: '', to: '' };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    from: formatDateInput(start),
    to: formatDateInput(end)
  };
}

export default function EmployeeReports() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [filterMode, setFilterMode] = React.useState<FilterMode>('month');
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [selectedWeek, setSelectedWeek] = React.useState(formatWeekInput(new Date()));
  const [selectedMonth, setSelectedMonth] = React.useState(formatMonthInput(new Date()));
  const [{ dateFrom, dateTo }, setDateRange] = React.useState(() => {
    const range = monthRange(formatMonthInput(new Date()));
    return { dateFrom: range.from, dateTo: range.to };
  });
  const [loading, setLoading] = React.useState(false);
  const [records, setRecords] = React.useState<HistoryRecord[]>([]);
  const [error, setError] = React.useState('');
  const [selectedMonthKey, setSelectedMonthKey] = React.useState('');

  React.useEffect(() => {
    if (filterMode === 'date') {
      setDateRange({ dateFrom: selectedDate, dateTo: selectedDate });
      return;
    }
    if (filterMode === 'week') {
      const range = weekRange(selectedWeek);
      setDateRange({ dateFrom: range.from, dateTo: range.to });
      return;
    }
    const range = monthRange(selectedMonth);
    setDateRange({ dateFrom: range.from, dateTo: range.to });
  }, [filterMode, selectedDate, selectedWeek, selectedMonth]);

  const loadReport = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const user = getUser<{ employee_id?: string }>();
      const employeeId = user?.employee_id || '';
      const res = await apiFetch(`/attendance/my-attendance?employee_id=${employeeId}&limit=300`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to load report data');
      }
      const data = await res.json();
      const all: HistoryRecord[] = Array.isArray(data.records) ? data.records : [];
      const filtered = all.filter((r) => {
        const entry = toDateOnly(r.check_in);
        if (!entry) return false;
        if (dateFrom && entry < dateFrom) return false;
        if (dateTo && entry > dateTo) return false;
        return true;
      });
      setRecords(filtered);
    } catch (err: any) {
      setError(err?.message || 'Failed to load report data');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  const totalOfficeHours = React.useMemo(
    () => records.filter(r => !r.is_field_work).reduce((sum, r) => sum + Number(r.total_hours || 0), 0),
    [records]
  );

  const totalFieldHours = React.useMemo(
    () => records.filter(r => !!r.is_field_work).reduce((sum, r) => sum + Number(r.total_hours || 0), 0),
    [records]
  );

  const formatHours = (hours: number) => {
    if (!hours || hours <= 0) return '--';
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (mins === 0) return `${hrs} hr`;
    else if (hrs === 0) return `${mins} min`;
    else return `${hrs} hr ${mins} min`;
  };

  const officeHours = formatHours(totalOfficeHours);
  const fieldHours = formatHours(totalFieldHours);

  const totalDays = React.useMemo(() => {
    const days = new Set<string>();
    records.forEach((r) => {
      const day = toDateOnly(r.check_in);
      if (day) days.add(day);
    });
    return days.size;
  }, [records]);

  const monthlyAttendance = React.useMemo(() => {
    const effectiveTo = dateTo && dateTo > today ? today : dateTo;
    const months = enumerateMonths(dateFrom, effectiveTo || '');
    const presentByMonth = new Map<string, Set<string>>();

    records.forEach((r) => {
      const date = toDateOnly(r.check_in);
      if (!date) return;
      const key = date.slice(0, 7);
      const set = presentByMonth.get(key) || new Set<string>();
      set.add(date);
      presentByMonth.set(key, set);
    });

    return months.map((month) => {
      const presentDays = presentByMonth.get(month)?.size || 0;
      const totalDaysInScope = clampRangeDaysForMonth(month, dateFrom, effectiveTo);
      const absentDays = Math.max(totalDaysInScope - presentDays, 0);
      const attendancePct = totalDaysInScope > 0 ? (presentDays / totalDaysInScope) * 100 : 0;
      return {
        month,
        presentDays,
        absentDays,
        attendancePct
      };
    });
  }, [records, dateFrom, dateTo, today]);

  const totalAbsentDays = React.useMemo(
    () => monthlyAttendance.reduce((sum, row) => sum + Number(row.absentDays || 0), 0),
    [monthlyAttendance]
  );

  const selectedMonthDetails = React.useMemo(() => {
    if (!selectedMonthKey) return null;
    const match = /^(\d{4})-(\d{2})$/.exec(selectedMonthKey);
    if (!match) return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);

    const globalFrom = dateFrom ? new Date(`${dateFrom}T00:00:00`) : monthStart;
    const cappedTo = dateTo && dateTo > today ? today : dateTo;
    const globalTo = cappedTo ? new Date(`${cappedTo}T00:00:00`) : monthEnd;
    const start = globalFrom > monthStart ? globalFrom : monthStart;
    const end = globalTo < monthEnd ? globalTo : monthEnd;
    if (end < start) return null;

    const rangeDates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      rangeDates.push(formatDateInput(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const monthRecords = records
      .filter((r: any) => {
        const entry = toDateOnly(r.check_in);
        return !!entry && entry.slice(0, 7) === selectedMonthKey;
      })
      .map((r: any) => ({
        dateKey: toDateOnly(r.check_in) || '',
        sortKey: r.check_in ? String(r.check_in) : '',
        dateLabel: formatDate(r.check_in),
        login: formatTime(r.check_in) || '--',
        logout: r.check_out ? formatTime(r.check_out) : '--',
        work_type: r.is_field_work ? 'Field' : 'Office',
        entryLocation: r.entry_location_name || r.entry_location_display || r.location_name || r.zone_name || '--',
        exitLocation: r.exit_location_name || r.exit_location_display || (r.check_out ? (r.location_name || r.zone_name || 'Same as Entry') : '--'),
        duration: r.formatted_duration || formatHours(Number(r.total_hours) || 0),
        status: String(r.status || '').toLowerCase() === 'active' ? 'Logged In' : 'Logged Out'
      }))
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    const presentSet = new Set(monthRecords.map((r) => r.dateKey).filter(Boolean));
    const leaveDates = rangeDates.filter((d) => !presentSet.has(d));

    return {
      month: selectedMonthKey,
      leaveDates,
      logs: monthRecords
    };
  }, [selectedMonthKey, records, dateFrom, dateTo, today]);

  return (
    <Stack spacing={{ xs: 2, sm: 3 }} sx={{ position: 'relative', zIndex: 1 }}>
      <Card sx={{ borderRadius: '18px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper', width: { xs: '100%', md: 'fit-content' }, maxWidth: { xs: '100%', md: 820 }, mx: 'auto', position: 'relative', zIndex: 2 }}>
        <CardContent sx={{ p: { xs: 1.1, sm: 1.5 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.9} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ width: { xs: '100%', md: 'auto' }, maxWidth: { xs: '100%', md: 700 } }}>
            <ToggleButtonGroup
              value={filterMode}
              exclusive
              onChange={(_, mode: FilterMode | null) => mode && setFilterMode(mode)}
              sx={{
                width: { xs: '100%', md: 'auto' },
                '& .MuiToggleButton-root': {
                  flex: { xs: 1, md: 'initial' },
                  minHeight: { xs: 30, sm: 34 },
                  py: { xs: 0.1, sm: 0.2 },
                  fontSize: { xs: '0.7rem', sm: '0.76rem' },
                  fontWeight: 700
                }
              }}
            >
              <ToggleButton value="date">Date</ToggleButton>
              <ToggleButton value="week">Week</ToggleButton>
              <ToggleButton value="month">Month</ToggleButton>
            </ToggleButtonGroup>
            {filterMode === 'date' && (
              <TextField type="date" label="Select Date" InputLabelProps={{ shrink: true }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} size="small" sx={{ width: { xs: '100%', md: 200 }, '& .MuiInputBase-root': { minHeight: { xs: 32, sm: 34 } } }} />
            )}
            {filterMode === 'week' && (
              <TextField type="week" label="Select Week" InputLabelProps={{ shrink: true }} value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} size="small" sx={{ width: { xs: '100%', md: 200 }, '& .MuiInputBase-root': { minHeight: { xs: 32, sm: 34 } } }} />
            )}
            {filterMode === 'month' && (
              <TextField type="month" label="Select Month" InputLabelProps={{ shrink: true }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} size="small" sx={{ width: { xs: '100%', md: 200 }, '& .MuiInputBase-root': { minHeight: { xs: 32, sm: 34 } } }} />
            )}
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.7, color: 'text.secondary', fontSize: { xs: '0.74rem', sm: '0.82rem' } }}>
            Date Range: {formatDisplayDate(dateFrom)} - {formatDisplayDate(dateTo)}
          </Typography>
          {error && <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>{error}</Typography>}
        </CardContent>
      </Card>

      <Grid container spacing={{ xs: 1.4, sm: 2 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 1.15, sm: 2.25 }, minHeight: { xs: 88, sm: 120 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>Days Worked</Typography>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.28rem', sm: '1.7rem' }, mt: 0.15, textAlign: 'center' }}>{totalDays}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 1.15, sm: 2.25 }, minHeight: { xs: 88, sm: 120 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>Absent</Typography>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.28rem', sm: '1.7rem' }, mt: 0.15, textAlign: 'center' }}>{totalAbsentDays}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 1.15, sm: 2.25 }, minHeight: { xs: 88, sm: 120 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>Office Hours</Typography>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.18rem', sm: '1.7rem' }, mt: 0.15, textAlign: 'center' }}>{officeHours}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: '14px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 1.15, sm: 2.25 }, minHeight: { xs: 88, sm: 120 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>Field Hours</Typography>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: '1.18rem', sm: '1.7rem' }, mt: 0.15, textAlign: 'center' }}>{fieldHours}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: '18px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper', position: 'relative', zIndex: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Monthly Present / Absent</Typography>
          {monthlyAttendance.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>No monthly data for the selected range</Typography>
          ) : isMobile ? (
            <Stack spacing={0.85}>
              {monthlyAttendance.map((row) => (
                <Card key={row.month} variant="outlined" onClick={() => setSelectedMonthKey((prev) => prev === row.month ? '' : row.month)} sx={{ borderRadius: '12px', cursor: 'pointer', borderColor: selectedMonthKey === row.month ? 'primary.main' : 'divider', bgcolor: selectedMonthKey === row.month ? 'action.hover' : 'background.paper' }}>
                  <CardContent sx={{ p: 1.1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>{monthLabel(row.month)}</Typography>
                    <Grid container spacing={0.5} sx={{ mt: 0.2 }}>
                      <Grid item xs={4} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Present</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.15 }}>{row.presentDays}</Typography>
                      </Grid>
                      <Grid item xs={4} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Absent</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.15 }}>{row.absentDays}</Typography>
                      </Grid>
                      <Grid item xs={4} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Attendance</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.15 }}>{row.attendancePct.toFixed(1)}%</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover', '& th': { fontWeight: 700 } }}>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Present Days</TableCell>
                    <TableCell align="right">Absent Days</TableCell>
                    <TableCell align="right">Attendance %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthlyAttendance.map((row) => (
                    <TableRow key={row.month} hover onClick={() => setSelectedMonthKey((prev) => prev === row.month ? '' : row.month)} sx={{ cursor: 'pointer', bgcolor: selectedMonthKey === row.month ? 'action.hover' : 'inherit' }}>
                      <TableCell>{monthLabel(row.month)}</TableCell>
                      <TableCell align="right">{row.presentDays}</TableCell>
                      <TableCell align="right">{row.absentDays}</TableCell>
                      <TableCell align="right">{row.attendancePct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {selectedMonthDetails && (
            <Box sx={{ mt: 2.25, p: { xs: 1.25, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{monthLabel(selectedMonthDetails.month)} Details</Typography>
                <Button size="small" variant="outlined" onClick={() => setSelectedMonthKey('')} sx={{ textTransform: 'none', fontWeight: 700, cursor: 'pointer', position: 'relative', zIndex: 10 }}>
                  Close Details
                </Button>
              </Stack>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>Leave Dates ({selectedMonthDetails.leaveDates.length})</Typography>
              {selectedMonthDetails.leaveDates.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 1.8 }}>
                  {selectedMonthDetails.leaveDates.map((d) => (
                    <Box key={d} sx={{ px: 1, py: 0.5, borderRadius: '8px', bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.light' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{formatDisplayDate(d)}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.8 }}>No leave dates in this month.</Typography>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>Work Log</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Login</TableCell>
                      <TableCell>Logout</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Entry Location</TableCell>
                      <TableCell>Exit Location</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedMonthDetails.logs.length > 0 ? selectedMonthDetails.logs.map((log, idx) => (
                      <TableRow key={`${log.dateKey}-${idx}`}>
                        <TableCell>{log.dateLabel}</TableCell>
                        <TableCell>{log.login}</TableCell>
                        <TableCell>{log.logout}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={log.work_type || 'Office'}
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.65rem', height: 20 }}
                          />
                        </TableCell>
                        <TableCell>{log.entryLocation}</TableCell>
                        <TableCell>{log.exitLocation}</TableCell>
                        <TableCell>{log.duration}</TableCell>
                        <TableCell>{log.status}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            No work logs found for this month.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <HistoryTable
          loading={loading}
          records={records}
          showLocation={true}
          enablePagination
          rowsPerPage={6}
          formatDurationFromHours={(h) => {
            if (!h || h <= 0) return '--';
            const hrs = Math.floor(h);
            const mins = Math.round((h - hrs) * 60);
            if (mins === 0) return `${hrs} hr`;
            else if (hrs === 0) return `${mins} min`;
            else return `${hrs} hr ${mins} min`;
          }}
          formatDurationFromTimes={(entry, exit) => {
            if (!entry || !exit) return '--';
            const start = new Date(entry);
            const end = new Date(exit);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '--';
            const totalHours = (end.getTime() - start.getTime()) / 3600000;
            if (totalHours <= 0) return '--';
            const hrs = Math.floor(totalHours);
            const mins = Math.round((totalHours - hrs) * 60);
            if (mins === 0) return `${hrs} hr`;
            else if (hrs === 0) return `${mins} min`;
            else return `${hrs} hr ${mins} min`;
          }}
        />
      </Box>
    </Stack>
  );
}
