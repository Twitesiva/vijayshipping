'use client';

import * as React from 'react';
import { Box, Card, CardContent, Grid, Stack, Typography, Chip, TextField, Button } from '@mui/material';
import HistoryTable, { HistoryRecord } from './HistoryTable';
import { apiFetch } from '../../lib/api';
import { getUser } from '../../lib/storage';

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

  const [dateFrom, setDateFrom] = React.useState(getFirstOfMonthISO());
  const [dateTo, setDateTo] = React.useState(getTodayISO());

  const user = getUser() as any;

  const loadDashboard = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    setError('');
    try {
      const empId = user?.employee_id;
      if (!empId) {
        throw new Error('Employee ID not found in session');
      }

      const [statusRes, statsRes, historyRes] = await Promise.all([
        apiFetch(`/attendance/status?employee_id=${empId}`),
        apiFetch(`/attendance/stats?employee_id=${empId}&date_from=${from}&date_to=${to}`),
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
    ? new Date(stats.last_activity).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : '--';

  const now = new Date();
  const monthDaysElapsed = now.getDate();
  const presentDaysThisMonth = stats?.present_days ?? 0;
  const absentDaysThisMonth = Math.max(monthDaysElapsed - presentDaysThisMonth, 0);
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
      const exists = records.some(r => r.check_in && new Date(r.check_in).toISOString().startsWith(dateStr));

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
    switch (selectedFilter) {
      case 'present':
        return records.filter((r) => r.check_in && new Date(r.check_in).toISOString().slice(0, 7) === monthPrefix);
      case 'absent':
        return generateAbsentRecords();
      case 'last_activity':
        return records.slice(0, 1);
      default:
        return records;
    }
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
      value: String(presentDaysThisMonth),
      subtitle: 'This month',
      accent: '#059669',
      bgColor: '#ecfdf5',
      onClick: () => handleCardClick('present')
    },
    {
      id: 'absent',
      label: 'Absent',
      value: String(absentDaysThisMonth),
      subtitle: 'This month',
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

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 2.5, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', letterSpacing: '-0.025em' }}>
                Dashboard
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, maxWidth: '400px' }}>
                Welcome, <Box component="span" sx={{ color: '#598791', fontWeight: 700 }}>{user?.full_name || user?.display_name || user?.username || 'Employee'}</Box>
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: 'white',
                    fontSize: '0.8rem'
                  },
                  '& input': { py: 0.75, fontSize: '0.8rem' }
                }}
              />
              <TextField
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: 'white',
                    fontSize: '0.8rem'
                  },
                  '& input': { py: 0.75, fontSize: '0.8rem' }
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
                  fontSize: '0.8rem',
                  '&:hover': { bgcolor: '#4a727a' }
                }}
              >
                Filter
              </Button>
            </Stack>

            {selectedFilter !== 'all' && (
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
                  bgcolor: 'background.paper',
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
                    bgcolor: card.bgColor,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: 110,
                    border: `1px solid ${card.accent}20`,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: card.bgColor,
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
        <HistoryTable
          loading={loading}
          records={filteredRecords}
          enablePagination={selectedFilter === 'all'} // specific filters might be short enough to skip pagination or keep it?
          rowsPerPage={selectedFilter === 'all' ? 3 : 10}
          formatDurationFromHours={(h) => `${(h || 0).toFixed(2)} hrs`}
          formatDurationFromTimes={(en, ex) => {
            if (!en || !ex) return '-';
            const start = new Date(en);
            const end = new Date(ex);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '-';
            const totalHours = (end.getTime() - start.getTime()) / 3600000;
            return `${totalHours.toFixed(2)} hrs`;
          }}
        />
      </Box>
    </Stack>
  );
}
