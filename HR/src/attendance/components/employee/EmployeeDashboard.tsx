'use client';

import * as React from 'react';
import { Box, Card, CardContent, Grid, Stack, Typography, Chip, TextField, Button, Dialog, DialogTitle, DialogContent, Divider, IconButton, Table, TableHead, TableRow, TableCell, TableBody, MenuItem, DialogActions, alpha } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HistoryTable, { HistoryRecord } from './HistoryTable';
import ModernHistoryTable from './ModernHistoryTable';
import { ModernSessionLogTable } from '../admin/ModernReportComponents';
import { apiFetch, API_BASE } from '../../lib/api';
import { getUser, getToken } from '../../lib/storage';
import { formatDate, formatTime } from '../../lib/format';

const getTodayISO = () => new Date().toISOString().split('T')[0];
const getFirstOfMonthISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function EmployeeDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [records, setRecords] = React.useState<HistoryRecord[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [sessionActive, setSessionActive] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState<'all' | 'present' | 'absent' | 'last_activity'>('all');
  const [timePeriod, setTimePeriod] = React.useState<string>('month');

  const [dateFrom, setDateFrom] = React.useState(getFirstOfMonthISO());
  const [dateTo, setDateTo] = React.useState(getTodayISO());
  const [attendanceType, setAttendanceType] = React.useState('all');

  // Drill-down state
  const [drillDownOpen, setDrillDownOpen] = React.useState(false);
  const [selectedDaySessions, setSelectedDaySessions] = React.useState<any[]>([]);
  const [selectedDayInfo, setSelectedDayInfo] = React.useState<any>(null);

  // Download states
  const [downloadDialogOpen, setDownloadDialogOpen] = React.useState(false);
  const [downloadOption, setDownloadOption] = React.useState('summary');
  const [exporting, setExporting] = React.useState(false);

  const user = getUser() as any;

  const handleTimePeriodChange = (period: string) => {
    setTimePeriod(period);
    const today = new Date();
    let from = getTodayISO();
    let to = getTodayISO();

    if (period === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(today.setDate(diff));
      from = monday.toISOString().split('T')[0];
      to = getTodayISO();
    } else if (period === 'month') {
      from = getFirstOfMonthISO();
      to = getTodayISO();
    } else if (period === 'custom') {
      return; // Handled by date pickers
    }

    setDateFrom(from);
    setDateTo(to);
    loadDashboard(from, to);
  };

  const loadDashboard = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    setError('');
    try {
      const empId = user?.employee_id;
      if (!empId) {
        throw new Error('Employee ID not found in session');
      }

      const [statusRes, statsRes, historyRes] = await Promise.all([
        apiFetch(`/attendance/status/${empId}`),
        apiFetch(`/attendance/stats/${empId}?date_from=${from}&date_to=${to}`),
        apiFetch(`/attendance/my-attendance?employee_id=${empId}&date_from=${from}&date_to=${to}&limit=50`)
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSessionActive(Boolean(statusData?.has_active_session));
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.stats);
      }

      if (!historyRes.ok) {
        const body = await historyRes.text();
        throw new Error(body || 'Failed to load attendance history');
      }
      const historyData = await historyRes.json();
      setRecords(Array.isArray(historyData?.records) ? historyData.records : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDashboard();
  }, []);

  const lastActionTime = stats?.last_activity
    ? new Date(stats.last_activity).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', hour12: true })
    : '--';

  const now = new Date();
  const presentDays = stats?.present_days ?? 0;
  const absentDays = stats?.absent_days ?? 0;
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Generate absent records
  const generateAbsentRecords = (): HistoryRecord[] => {
    const absentRecords: HistoryRecord[] = [];
    const today = new Date();

    // Start from 1st of current month
    for (let d = 1; d <= today.getDate(); d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      // check if this date exists in records (ignoring time) 
      // Note: with limit=50, we might miss old records if there are many entries per day.
      // But for simple "Absent" list in dashboard, this is usually sufficient.
      const exists = records.some((r: any) => r.check_in && new Date(r.check_in).toISOString().startsWith(dateStr));

      if (!exists && d !== today.getDate()) {
        absentRecords.push({
          id: `absent-${dateStr}`,
          date: dateStr,
          check_in: null,
          check_out: null,
          total_hours: 0,
          status: 'Absent',
          display_date: dateStr,
          employee_id: user?.employee_id || '',
          full_name: user?.full_name || ''
        } as any);
      }
    }
    return absentRecords.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
  };


  const getFilteredRecords = () => {
    let list = records;
    if (selectedFilter === 'present') {
      list = records.filter((r: any) => r.check_in && new Date(r.check_in).toISOString().slice(0, 7) === monthPrefix);
    } else if (selectedFilter === 'absent') {
      return generateAbsentRecords();
    }

    // Now aggregate into daily summaries
    const grouped: Record<string, any> = {};
    list.forEach((r: any) => {
      const date = r.date || (r.check_in ? r.check_in.split('T')[0] : '');
      if (!date) return;

      if (!grouped[date]) {
        grouped[date] = {
          ...r,
          date,
          sessions: [r],
          check_in: r.check_in,
          check_out: r.check_out,
          total_hours: r.total_hours || 0,
          attendance_type: r.is_field_work ? 'Field' : 'Office'
        };
      } else {
        const existing = grouped[date];
        existing.sessions.push(r);
        if (r.check_in && (!existing.check_in || new Date(r.check_in) < new Date(existing.check_in))) {
          existing.check_in = r.check_in;
        }
        if (!r.check_out) {
          existing.check_out = null; // Still active
        } else if (existing.check_out && new Date(r.check_out) > new Date(existing.check_out)) {
          existing.check_out = r.check_out;
        }
        existing.total_hours += (r.total_hours || 0);
        const currentType = r.is_field_work ? 'Field' : 'Office';
        if (existing.attendance_type !== currentType && existing.attendance_type !== 'Hybrid') {
          existing.attendance_type = 'Hybrid';
        }
      }
    });

    // Finalize formatted duration for aggregated rows
    const aggregated = Object.values(grouped).map((r: any) => {
      const hours = r.total_hours || 0;
      let formatted_duration = '--';
      if (hours > 0) {
        const hrs = Math.floor(hours);
        const mins = Math.round((hours - hrs) * 60);
        if (mins === 0) {
          formatted_duration = `${hrs} hr`;
        } else if (hrs === 0) {
          formatted_duration = `${mins} min`;
        } else {
          formatted_duration = `${hrs} hr ${mins} min`;
        }
      }
      return {
        ...r,
        formatted_duration
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (selectedFilter === 'last_activity') {
      return aggregated.slice(0, 1);
    }

    if (attendanceType !== 'all') {
      return aggregated.filter((r: any) => r.attendance_type === attendanceType);
    }
    return aggregated;
  };

  const filteredRecords = getFilteredRecords();

  const handleCardClick = (type: 'present' | 'absent' | 'session' | 'last_activity') => {
    if (type === 'session') {
      loadDashboard(); // Refresh
      // flash toast? or just re-load
      return;
    }

    if (selectedFilter === type) {
      setSelectedFilter('all'); // Toggle off
    } else {
      setSelectedFilter(type);
    }
  };

  const cards = [
    {
      id: 'present',
      label: 'Present',
      value: String(presentDays),
      subtitle: timePeriod === 'month' ? 'This month' : timePeriod === 'week' ? 'This week' : 'Selected range',
      accent: '#059669',
      bgColor: '#ecfdf5',
      onClick: () => handleCardClick('present')
    },
    {
      id: 'absent',
      label: 'Absent',
      value: String(absentDays),
      subtitle: timePeriod === 'month' ? 'This month' : timePeriod === 'week' ? 'This week' : 'Selected range',
      accent: '#dc2626',
      bgColor: '#fef2f2',
      onClick: () => handleCardClick('absent')
    },
    {
      id: 'session',
      label: 'Session',
      value: sessionActive ? 'Active' : 'Inactive',
      subtitle: 'Click to refresh',
      accent: sessionActive ? '#2563eb' : '#6b7280',
      bgColor: sessionActive ? '#eff6ff' : '#f3f4f6',
      onClick: () => handleCardClick('session')
    },
    {
      id: 'last_activity',
      label: 'Last Activity',
      value: lastActionTime,
      subtitle: 'Recent action',
      accent: '#7c3aed',
      bgColor: '#f5f3ff',
      onClick: () => handleCardClick('last_activity')
    }
  ];

  const openDrillDown = (record: any) => {
    const dayRecords = records.filter((r: any) => 
      (r.check_in && r.check_in.split('T')[0] === record.date) || 
      (r.date === record.date)
    );
    
    setSelectedDaySessions(dayRecords);
    setSelectedDayInfo({
      full_name: user?.full_name,
      date: record.date || record.check_in?.split('T')[0]
    });
    setDrillDownOpen(true);
  };

  const handleNavigateDate = (direction: 'next' | 'prev') => {
    // We need to navigate through the filtered records (aggregated daily records)
    const aggregated = getFilteredRecords();
    const currentIndex = aggregated.findIndex((r: any) => r.date === selectedDayInfo?.date);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < aggregated.length) {
      const nextRecord = aggregated[nextIndex];
      openDrillDown(nextRecord);
    }
  };

  const handleDownloadCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = ["Date", "Login", "Logout", "Duration", "Type"];
    const rows = filteredRecords.map((r: any) => [
      formatDate(r.date || r.check_in),
      r.check_in ? formatTime(r.check_in) : '--',
      r.check_out ? formatTime(r.check_out) : (r.check_in ? 'Active' : '--'),
      r.formatted_duration,
      r.attendance_type
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map((e: any[]) => e.map((cell: any) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `My_Attendance_Summary_${dateFrom}_to_${dateTo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadDialogOpen(false);
  };

  const handleDownloadPDF = () => {
    if (filteredRecords.length === 0) return;
    const doc = new jsPDF();
    doc.text("My Attendance Summary", 14, 15);
    doc.setFontSize(10);
    doc.text(`Employee: ${user?.full_name || user?.username}`, 14, 22);
    doc.text(`Period: ${dateFrom} to ${dateTo}`, 14, 28);

    const tableColumn = ["Date", "Login", "Logout", "Duration", "Type"];
    const tableRows = filteredRecords.map((r: any) => [
      formatDate(r.date || r.check_in),
      r.check_in ? formatTime(r.check_in) : '--',
      r.check_out ? formatTime(r.check_out) : (r.check_in ? 'Active' : '--'),
      r.formatted_duration,
      r.attendance_type
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'striped',
      styles: { fontSize: 9 }
    });

    doc.save(`My_Attendance_Summary_${dateFrom}_to_${dateTo}.pdf`);
    setDownloadDialogOpen(false);
  };

  const handleDownloadDetailedLogs = async (format: 'csv' | 'pdf') => {
    setExporting(true);
    try {
      const token = getToken();
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        employee_id: user?.employee_id,
        limit: '5000'
      });

      const response = await fetch(`${API_BASE}/admin/attendance-records?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch detailed records');
      const data = await response.json();
      const records = data.records || [];

      if (records.length === 0) {
        alert('No records found for the selected period.');
        return;
      }

      if (format === 'csv') {
        const headers = ["Date", "Login", "Logout", "Duration", "Type", "Login Location", "Exit Address"];
        const rows = records.map((r: any) => [
          formatDate(r.check_in),
          formatTime(r.check_in),
          formatTime(r.check_out),
          r.formatted_duration,
          r.is_field_work ? 'Field' : 'Office',
          r.entry_location_display || 'Office',
          r.exit_location_display || (r.check_out ? 'Office' : '--')
        ]);

        const csvContent = "\uFEFF" + [headers, ...rows].map((e: any[]) => e.map((cell: any) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `My_Detailed_Attendance_${dateFrom}_to_${dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const doc = new jsPDF('landscape');
        doc.text("My Detailed Attendance Logs", 14, 15);
        doc.setFontSize(10);
        doc.text(`Employee: ${user?.full_name || user?.username} (ID: ${user?.employee_id})`, 14, 22);
        doc.text(`Period: ${dateFrom} to ${dateTo}`, 14, 28);

        const tableColumn = ["Date", "Login", "Logout", "Duration", "Type", "Login Location", "Exit Address"];
        const tableRows = records.map((r: any) => [
          formatDate(r.check_in),
          formatTime(r.check_in),
          formatTime(r.check_out),
          r.formatted_duration,
          r.is_field_work ? 'Field' : 'Office',
          r.entry_location_display || 'Office',
          r.exit_location_display || (r.check_out ? 'Office' : '--')
        ]);

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 35,
          theme: 'striped',
          styles: { fontSize: 8 },
          columnStyles: { 5: { cellWidth: 70 } }
        });

        doc.save(`My_Detailed_Attendance_${dateFrom}_to_${dateTo}.pdf`);
      }
      setDownloadDialogOpen(false);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack spacing={2}>
      {/* Drill-down Dialog */}
      <Dialog open={drillDownOpen} onClose={() => setDrillDownOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flex: 1 }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e293b', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              {selectedDayInfo?.date ? new Date(selectedDayInfo.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : ''}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Button 
                                size="small" 
                                onClick={() => handleNavigateDate('prev')}
                                disabled={getFilteredRecords().findIndex((r: any) => r.date === selectedDayInfo?.date) <= 0}
                                sx={{ 
                                    minWidth: 44, 
                                    height: 32,
                                    px: 1,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#598791',
                                    bgcolor: alpha('#598791', 0.05),
                                    border: '1px solid',
                                    borderColor: alpha('#598791', 0.1),
                                    borderRadius: '8px',
                                    '&:hover': { bgcolor: alpha('#598791', 0.1) },
                                    textTransform: 'none'
                                }}
                            >
                                Prev
                            </Button>
                            <Button 
                                size="small" 
                                onClick={() => handleNavigateDate('next')}
                                disabled={getFilteredRecords().findIndex((r: any) => r.date === selectedDayInfo?.date) >= getFilteredRecords().length - 1}
                                sx={{ 
                                    minWidth: 44, 
                                    height: 32,
                                    px: 1,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#598791',
                                    bgcolor: alpha('#598791', 0.05),
                                    border: '1px solid',
                                    borderColor: alpha('#598791', 0.1),
                                    borderRadius: '8px',
                                    '&:hover': { bgcolor: alpha('#598791', 0.1) },
                                    textTransform: 'none'
                                }}
                            >
                                Next
                            </Button>
                        </Stack>
                    </Box>
              </Box>

              <IconButton 
                autoFocus
                onClick={() => setDrillDownOpen(false)} 
                size="small" 
                sx={{ bgcolor: '#fee2e2', color: '#dc2626', '&:hover': { bgcolor: '#fecaca' }, p: 0.75 }}
              >
                <Box sx={{ fontSize: '1rem', p: 0.5 }}>✕</Box>
              </IconButton>
            </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 0 }}>
          <ModernSessionLogTable sessions={selectedDaySessions} />
        </DialogContent>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setDrillDownOpen(false)} 
            variant="outlined" 
            size="small"
            sx={{ borderRadius: '8px', fontWeight: 700, textTransform: 'none' }}
          >
            Close
          </Button>
        </Box>
      </Dialog>
      <Card sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 2.5, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <Stack 
            direction={{ xs: 'column', md: 'row' }} 
            justifyContent="space-between" 
            alignItems={{ xs: 'stretch', md: 'center' }} 
            gap={2}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', letterSpacing: '-0.025em', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Dashboard
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Welcome, <Box component="span" sx={{ color: '#598791', fontWeight: 700 }}>{user?.full_name || user?.display_name || user?.username || 'Employee'}</Box>
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => setDownloadDialogOpen(true)}
                sx={{
                  height: 34,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2,
                  borderColor: '#598791',
                  color: '#598791',
                  '&:hover': { borderColor: '#4a727a', bgcolor: 'rgba(89, 135, 145, 0.04)' },
                  fontSize: '0.75rem',
                  flex: { xs: '100%', sm: 'none' }
                }}
              >
                Download
              </Button>
              <TextField
                select
                size="small"
                label="Type"
                value={attendanceType}
                onChange={(e: any) => setAttendanceType(e.target.value)}
                SelectProps={{ native: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: 'white',
                    fontSize: '0.75rem',
                    minWidth: { xs: '80px', sm: 100 }
                  },
                  '& select': { py: 0.75, fontSize: '0.75rem' },
                  '& label': { fontSize: '0.75rem' },
                  flex: { xs: 1, sm: 'none' }
                }}
              >
                <option value="all">All Types</option>
                <option value="Office">Office</option>
                <option value="Field">Field</option>
                <option value="Hybrid">Hybrid</option>
              </TextField>
              <TextField
                select
                size="small"
                value={timePeriod}
                onChange={(e) => handleTimePeriodChange(e.target.value)}
                SelectProps={{ native: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: 'white',
                    fontSize: '0.75rem',
                    minWidth: { xs: '100px', sm: 120 }
                  },
                  '& select': { py: 0.75, fontSize: '0.75rem' },
                  flex: { xs: 1.5, sm: 'none' }
                }}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </TextField>

              {timePeriod === 'custom' && (
                <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}>
                  <TextField
                    type="date"
                    size="small"
                    value={dateFrom}
                    onChange={(e: any) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        bgcolor: 'white',
                        fontSize: '0.75rem'
                      },
                      '& input': { py: 0.75, fontSize: '0.75rem' },
                      flex: 1
                    }}
                  />
                  <TextField
                    type="date"
                    size="small"
                    value={dateTo}
                    onChange={(e: any) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        bgcolor: 'white',
                        fontSize: '0.75rem'
                      },
                      '& input': { py: 0.75, fontSize: '0.75rem' },
                      flex: 1
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => loadDashboard(dateFrom, dateTo)}
                    sx={{
                      height: 34,
                      borderRadius: '8px',
                      bgcolor: '#598791',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2,
                      fontSize: '0.75rem',
                      '&:hover': { bgcolor: '#4a727a' }
                    }}
                  >
                    Filter
                  </Button>
                </Stack>
              )}
            </Stack>

            {selectedFilter !== 'all' && (
              <Box>
                <Chip
                  label="Clear"
                  size="small"
                  onDelete={() => setSelectedFilter('all')}
                  sx={{
                    borderRadius: '8px',
                    fontWeight: 600,
                    bgcolor: '#f1f5f9',
                    color: '#598791',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.7rem'
                  }}
                />
              </Box>
            )}
          </Stack>

          {error && (
            <Typography variant="body2" color="error" sx={{ mt: 1.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.8rem' }}>
              <Box component="span" sx={{ width: 6, height: 6, bgcolor: 'error.main', borderRadius: 'full', display: 'inline-block' }} />
              {error}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {cards.map((card) => {
          const isSelected = selectedFilter === card.id;
          return (
            <Grid item xs={6} sm={3} md={3} key={card.label}>
              <Card
                onClick={card.onClick}
                sx={{
                  borderRadius: '24px',
                  border: '2px solid',
                  borderColor: isSelected ? card.accent : 'transparent',
                  boxShadow: isSelected ? `0 10px 15px -3px ${card.accent}33` : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                  height: '100%',
                  cursor: 'pointer',
                  bgcolor: card.bgColor,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    borderColor: card.accent,
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 25px -5px ${card.accent}22`
                  }
                }}>
                <CardContent
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: 110,
                    border: `1px solid ${card.accent}20`,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: card.accent
                    }
                  }}
                >
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{
                        fontWeight: 700,
                        color: card.accent,
                        fontSize: '0.65rem',
                        letterSpacing: '0.08em',
                        display: 'block',
                        mb: 0.5
                      }}
                    >
                      {card.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontSize: card.id === 'last_activity' ? '1rem' : '1.75rem' }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.7rem', mt: 0.5 }}>
                    {card.subtitle}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Box>
        <ModernHistoryTable
          loading={loading}
          records={filteredRecords}
          showLocation={false}
          onViewDetails={openDrillDown}
          enablePagination={selectedFilter === 'all'} 
          rowsPerPage={5}
          formatDurationFromHours={(h) => {
            if (!h || h <= 0) return '--';
            const hrs = Math.floor(h);
            const mins = Math.round((h - hrs) * 60);
            if (mins === 0) return `${hrs} hr`;
            else if (hrs === 0) return `${mins} min`;
            else return `${hrs} hr ${mins} min`;
          }}
          formatDurationFromTimes={(en, ex) => {
            if (!en || !ex) return '--';
            const start = new Date(en);
            const end = new Date(ex);
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
          <Stack direction="row" alignItems="center" gap={1}>
            <DownloadIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>Download Records</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              label="What would you like to download?"
              value={downloadOption}
              onChange={(e: any) => setDownloadOption(e.target.value)}
            >
              <MenuItem value="summary">Attendance Summary (Aggregated View)</MenuItem>
              <MenuItem value="logs">Detailed Attendance Logs (All Records)</MenuItem>
            </TextField>

            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                CURRENT FILTERS
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Period: {formatDate(dateFrom)} to {formatDate(dateTo)}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Downloading {downloadOption === 'summary' ? 'Summary' : 'Detailed Records'} for the current filters.
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
            sx={{ bgcolor: '#598791', '&:hover': { bgcolor: '#4a727a' } }}
          >
            {exporting ? 'Processing...' : 'PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
