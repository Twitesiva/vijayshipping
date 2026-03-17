'use client';

import * as React from 'react';
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Pagination,
    Stack,
    TextField,
    Typography,
    alpha,
    useTheme,
    InputAdornment,
    IconButton,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    People as PeopleIcon,
    VerifiedUser as VerifiedIcon,
    FiberManualRecord as DotIcon,
    WarningAmber as WarningIcon,
    EditOutlined as EditIcon,
    DeleteOutline as DeleteIcon,
    Download as DownloadIcon,
    CalendarMonth as CalendarIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import EmployeeTable from './EmployeeTable';
import FaceEnrollmentModal from './FaceEnrollmentModal';
import { TableSkeleton } from '../../components/common/Skeletons';
import Alerts, { AlertState } from '../../components/common/Alerts';
import { API_BASE } from '../../lib/api';
import { getToken } from '../../lib/storage';
import { formatDate, formatTime } from '../../lib/format';
import { useFaceEnrollment } from '../../hooks/useFaceEnrollment';
import { Employee } from '../../types';

export default function Employees() {
    const theme = useTheme();
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [alert, setAlert] = React.useState<AlertState>({ open: false, message: '', severity: 'info' });
    const [profileOpen, setProfileOpen] = React.useState(false);
    const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
    const [profileForm, setProfileForm] = React.useState({ full_name: '', department: '' });
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [pendingDelete, setPendingDelete] = React.useState<{ id: string; name: string } | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
    const [deleting, setDeleting] = React.useState(false);

    // List Filters
    const [dateFrom, setDateFrom] = React.useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = React.useState(new Date().toISOString().split('T')[0]);

    // Download states
    const [downloadDialogOpen, setDownloadDialogOpen] = React.useState(false);
    const [downloadOption, setDownloadOption] = React.useState('list');
    const [exporting, setExporting] = React.useState(false);



    const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
    const departmentOptions = departments.map((d: { id: string; name: string }) => d.name);

    const enrollment = useFaceEnrollment(() => {
        showAlert('Face enrollment completed!', 'success');
        loadEmployees();
    });

    const showAlert = (message: string, severity: AlertState['severity'] = 'info') => {
        setAlert({ open: true, message, severity });
    };

    const loadEmployees = async () => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`${API_BASE}/admin/employees`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setEmployees(data.employees || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadDepartments = async () => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`${API_BASE}/admin/departments`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setDepartments(data.departments || []);
            } else {
                setDepartments([]);
            }
        } catch (err) {
            console.error(err);
            setDepartments([]);
        }
    };

    React.useEffect(() => {
        loadEmployees();
        loadDepartments();
    }, []);





    const filteredEmployees = employees.filter((emp: Employee) =>
        emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: employees.length,
        active: employees.filter((e: Employee) => e.is_active).length,
        verified: employees.filter((e: Employee) => e.has_face_enrolled).length
    };

    const roleMeta = (role?: string) => {
        const normalized = (role || 'employee').toLowerCase();
        if (normalized === 'admin') return { label: 'Manager', color: theme.palette.error.main };
        if (normalized === 'boss') return { label: 'Boss', color: theme.palette.warning.main };
        if (normalized === 'manager') return { label: 'Manager', color: theme.palette.warning.main };
        return { label: 'Employee', color: theme.palette.primary.main };
    };



    const editEmployee = (employee: Employee) => {
        setSelectedEmployee(employee);
        setProfileForm({
            full_name: employee.full_name || '',
            department: employee.department || ''
        });
        setProfileOpen(true);
    };

    const updateEmployee = async (employeeId: string, updateData: any) => {
        try {
            const cleanData = Object.fromEntries(Object.entries(updateData).filter(([_, v]) => v !== undefined));
            const response = await fetch(`${API_BASE}/admin/employees/${employeeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify(cleanData)
            });

            if (response.ok) {
                showAlert('Profile updated', 'success');
                loadEmployees();
                return true;
            }
        } catch (error: any) {
            showAlert('Update failed', 'error');
        }
        return false;
    };

    const requestDeleteEmployee = (employeeId: string, employeeName: string) => {
        setPendingDelete({ id: employeeId, name: employeeName });
        setDeleteConfirmation('');
        setDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        if (deleting) return;
        setDeleteDialogOpen(false);
        setPendingDelete(null);
        setDeleteConfirmation('');
    };

    const confirmDeleteEmployee = async () => {
        if (!pendingDelete || deleteConfirmation !== 'DELETE') return;
        setDeleting(true);
        try {
            const response = await fetch(`${API_BASE}/admin/delete-employee/${pendingDelete.id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${getToken()}`
                }
            });

            if (response.ok) {
                showAlert(`${pendingDelete.name} removed from records`, 'success');
                loadEmployees();
                closeDeleteDialog();
                return;
            }
            showAlert('Removal failed', 'error');
        } catch (err) {
            showAlert('Removal failed', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleDownloadEmployeeList = (format: 'csv' | 'pdf') => {
        if (filteredEmployees.length === 0) return;
        
        if (format === 'csv') {
            const headers = ["ID", "Name", "Department", "Designation", "Joining Date", "Status"];
            const rows = filteredEmployees.map((e: Employee) => [
                e.employee_id || '',
                e.full_name || '',
                e.department || '',
                e.designation || '',
                e.join_date || '',
                e.is_active ? 'Active' : 'Inactive'
            ]);
            
            const csvContent = [headers, ...rows].map((e: string[]) => e.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Employee_List_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const doc = new jsPDF();
            doc.text("Employee Directory", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

            const tableColumn = ["ID", "Name", "Dept", "Designation", "Status"];
            const tableRows = filteredEmployees.map(e => [
                String(e.employee_id || ''),
                String(e.full_name || ''),
                String(e.department || ''),
                String(e.designation || ''),
                e.is_active ? 'Active' : 'Inactive'
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 30,
                theme: 'striped'
            });

            doc.save(`Employee_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    };

    const handleDownloadAttendanceLogs = async (format: 'csv' | 'pdf') => {
        setExporting(true);
        try {
            const token = getToken();
            const params = new URLSearchParams({
                date_from: dateFrom,
                date_to: dateTo,
                limit: '5000'
            });
            
            const response = await fetch(`${API_BASE}/admin/attendance-records?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to fetch records');
            const data = await response.json();
            const records = data.records || [];
            
            if (records.length === 0) {
                showAlert('No records found for the selected period', 'warning');
                return;
            }

            if (format === 'csv') {
                const headers = ["Date", "Employee Name", "ID", "Login", "Logout", "Duration", "Type", "Location"];
                const rows = records.map((r: any) => [
                    formatDate(r.check_in),
                    r.full_name,
                    r.employee_id,
                    formatTime(r.check_in),
                    formatTime(r.check_out),
                    r.formatted_duration,
                    r.is_field_work ? 'Field' : 'Office',
                    r.entry_location_display || 'Office'
                ]);
                
                const csvContent = "\uFEFF" + [headers, ...rows].map((e: (string|number)[]) => e.map((cell: any) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `Attendance_Logs_${dateFrom}_to_${dateTo}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const doc = new jsPDF('landscape');
                doc.text("Attendance Logs", 14, 15);
                doc.setFontSize(10);
                doc.text(`Period: ${dateFrom} to ${dateTo}`, 14, 22);

                const tableColumn = ["Date", "Name", "ID", "In", "Out", "Duration", "Type", "Location"];
                const tableRows = records.map((r: any) => [
                    String(formatDate(r.check_in) || ''),
                    String(r.full_name || ''),
                    String(r.employee_id || ''),
                    String(formatTime(r.check_in) || ''),
                    String(formatTime(r.check_out) || ''),
                    String(r.formatted_duration || ''),
                    r.is_field_work ? 'Field' : 'Office',
                    String(r.entry_location_display || 'Office')
                ]);

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 30,
                    theme: 'striped',
                    styles: { fontSize: 8 },
                    columnStyles: {
                        7: { cellWidth: 60 } // Location column wider
                    }
                });

                doc.save(`Attendance_Logs_${dateFrom}_to_${dateTo}.pdf`);
            }
            setDownloadDialogOpen(false);
        } catch (err) {
            showAlert('Failed to download: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
        } finally {
            setExporting(false);
        }
    };



    return (
        <Stack spacing={4}>
            {/* Page Header & Stats */}
            <Box>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                    spacing={{ xs: 2, md: 3 }}
                    sx={{ mb: 3.5 }}
                >
                    <Box>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 850,
                                color: 'text.primary',
                                letterSpacing: '-0.02em',
                                lineHeight: 1.15,
                                fontSize: { xs: '1.1rem', md: '1.3rem' }
                            }}
                        >
                            Employee Directory
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.8, color: 'text.secondary', fontWeight: 500 }}>
                            Manage employee profiles, face enrollment, and directory status in one place.
                        </Typography>
                        <Stack direction="row" spacing={2.25} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                <PeopleIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{stats.total} Total</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                <DotIcon sx={{ fontSize: 12, color: 'success.main' }} />
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{stats.active} Active</Typography>
                            </Box>
                        </Stack>
                    </Box>
                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={() => setDownloadDialogOpen(true)}
                            sx={{
                                borderRadius: '12px',
                                textTransform: 'none',
                                fontWeight: 700,
                                px: 3
                            }}
                        >
                            Download
                        </Button>
                    </Stack>
                </Stack>


            </Box>

            {/* List Control Panel */}
            <Card sx={{
                borderRadius: '24px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: 'none',
                overflow: 'visible'
            }}>
                <CardContent sx={{ p: 0 }}>
                    <Box sx={{ p: 3 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={5}>
                                <TextField
                                    fullWidth
                                    placeholder="Search by name, ID or department..."
                                    value={searchTerm}
                                    onChange={(e: any) => setSearchTerm(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ color: 'text.disabled' }} />
                                            </InputAdornment>
                                        ),
                                        sx: { borderRadius: '16px', bgcolor: 'action.hover', border: 'none', '& fieldset': { border: 'none' } }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6} md={3.5}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <TextField
                                        type="date"
                                        size="small"
                                        label="From"
                                        value={dateFrom}
                                        onChange={(e: any) => setDateFrom(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                    />
                                    <TextField
                                        type="date"
                                        size="small"
                                        label="To"
                                        value={dateTo}
                                        onChange={(e: any) => setDateTo(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                    />
                                </Stack>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Stack direction="row" spacing={2} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                                    <Box sx={{ px: 2, py: 1, borderRadius: '12px', bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <VerifiedIcon sx={{ fontSize: 18 }} />
                                        <Typography variant="caption" sx={{ fontWeight: 800 }}>{stats.verified} VERIFIED</Typography>
                                    </Box>
                                    <IconButton sx={{ bgcolor: 'action.hover' }} size="small">
                                        <FilterIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Box>

                    <Divider />

                    <Box sx={{ minHeight: 400 }}>
                        {loading ? (
                            <Box sx={{ p: 3 }}>
                                <TableSkeleton rows={8} columns={6} />
                            </Box>
                        ) : (
                            <EmployeeTable
                                employees={filteredEmployees}
                                onEnroll={enrollment.open}
                                onEdit={editEmployee}
                                onDelete={requestDeleteEmployee}
                            />
                        )}
                    </Box>
                </CardContent>
            </Card>

            <FaceEnrollmentModal
                open={enrollment.isOpen}
                step={enrollment.step}
                employeeLabel={enrollment.employee ? `${enrollment.employee.fullName} (${enrollment.employee.employeeId})` : ''}
                passportImage={enrollment.passportImage}
                capturedImages={enrollment.capturedImages}
                passportStatus={enrollment.passportStatus}
                faceVideoRef={enrollment.videoRef as React.RefObject<HTMLVideoElement>}
                enrollmentStatusMessage={enrollment.statusMessage}
                analysis={enrollment.analysis}
                onClose={enrollment.close}
                onUpload={enrollment.handlers.handlePassportUpload}
                onClearPassport={enrollment.handlers.clearPassport}
                onNextToLive={enrollment.handlers.nextToLive}
                onStartCamera={enrollment.handlers.startCamera}
                onCapture={enrollment.handlers.capture}
                onNextToVerify={enrollment.handlers.nextToVerify}
                onComplete={enrollment.handlers.complete}
                onRestart={enrollment.handlers.restart}
                nextToLiveEnabled={enrollment.flags.canNextToLive}
                nextToVerifyEnabled={enrollment.flags.canNextToVerify}
                completeEnabled={enrollment.flags.canComplete}
            />
            <Dialog
                open={profileOpen}
                onClose={() => setProfileOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '18px',
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider'
                    }
                }}
            >
                <DialogTitle
                    sx={{
                        px: 3,
                        py: 2.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                            sx={{
                                width: 44,
                                height: 44,
                                bgcolor: alpha(roleMeta(selectedEmployee?.role).color, 0.15),
                                color: roleMeta(selectedEmployee?.role).color,
                                fontWeight: 700
                            }}
                        >
                            {(selectedEmployee?.full_name || selectedEmployee?.username || 'E').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                Edit Employee Profile
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                                Update core profile details and review biometric documents.
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                        <Chip
                            label={roleMeta(selectedEmployee?.role).label}
                            size="small"
                            sx={{
                                bgcolor: alpha(roleMeta(selectedEmployee?.role).color, 0.12),
                                color: roleMeta(selectedEmployee?.role).color,
                                fontWeight: 700
                            }}
                        />
                        <Chip
                            label={selectedEmployee?.has_face_enrolled ? 'Face Verified' : 'Face Pending'}
                            size="small"
                            sx={{
                                bgcolor: selectedEmployee?.has_face_enrolled ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.warning.main, 0.12),
                                color: selectedEmployee?.has_face_enrolled ? 'success.main' : 'warning.main',
                                fontWeight: 700
                            }}
                        />
                    </Stack>
                </DialogTitle>
                <DialogContent sx={{ p: 3 }}>
                    <Card
                        variant="outlined"
                        sx={{
                            borderRadius: '14px',
                            borderColor: 'divider',
                            boxShadow: 'none'
                        }}
                    >
                        <CardContent sx={{ p: 2.25 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                                Profile Details
                            </Typography>
                            <Stack spacing={2}>
                                    <TextField
                                    label="Full Name"
                                    fullWidth
                                    value={profileForm.full_name}
                                    onChange={(e) => setProfileForm((p: any) => ({ ...p, full_name: e.target.value }))}
                                />
                                <TextField
                                    label="Email"
                                    fullWidth
                                    value={selectedEmployee?.email || ''}
                                    InputProps={{ readOnly: true }}
                                />
                                <TextField
                                    select
                                    label="Designation"
                                    fullWidth
                                    value={profileForm.department}
                                    onChange={(e) => setProfileForm((p: any) => ({ ...p, department: e.target.value }))}
                                >
                                    <MenuItem value="">Select Designation</MenuItem>
                                    {['Manager', 'Employee', 'Founder'].map((dept) => (
                                        <MenuItem key={dept} value={dept}>
                                            {dept}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    label="Employee ID"
                                    fullWidth
                                    value={selectedEmployee?.employee_id || ''}
                                    InputProps={{ readOnly: true }}
                                />
                                <TextField
                                    label="Date of Joining"
                                    fullWidth
                                    value={selectedEmployee?.join_date || ''}
                                    InputProps={{ readOnly: true }}
                                />
                                <TextField
                                    label="ID Series / Role"
                                    fullWidth
                                    value={selectedEmployee?.role || 'employee'}
                                    InputProps={{ readOnly: true }}
                                />
                            </Stack>
                        </CardContent>
                    </Card>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button onClick={() => setProfileOpen(false)} color="inherit">Close</Button>
                    <Button
                        variant="contained"
                        sx={{ px: 2.5, fontWeight: 700 }}
                        onClick={async () => {
                            if (!selectedEmployee?.id) {
                                showAlert('Unable to update: missing employee record ID', 'error');
                                return;
                            }
                            const ok = await updateEmployee(selectedEmployee.id, {
                                full_name: profileForm.full_name,
                                department: profileForm.department
                            });
                            if (ok) setProfileOpen(false);
                        }}
                    >
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={deleteDialogOpen}
                onClose={closeDeleteDialog}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '18px',
                        border: '1px solid',
                        borderColor: 'divider'
                    }
                }}
            >
                <DialogTitle sx={{ px: 3, py: 2.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                            sx={{
                                width: 34,
                                height: 34,
                                bgcolor: alpha(theme.palette.error.main, 0.12),
                                color: 'error.main'
                            }}
                        >
                            <WarningIcon fontSize="small" />
                        </Avatar>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                Delete Employee
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                                This action permanently removes the employee profile.
                            </Typography>
                        </Box>
                    </Stack>
                </DialogTitle>
                <DialogContent sx={{ px: 3, py: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                        Employee
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, mb: 2.5 }}>
                        {pendingDelete?.name || '-'}
                    </Typography>
                    <TextField
                        fullWidth
                        label={`Type DELETE to confirm`}
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        autoComplete="off"
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2.25, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button onClick={closeDeleteDialog} color="inherit" disabled={deleting}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={confirmDeleteEmployee}
                        disabled={deleteConfirmation !== 'DELETE' || deleting}
                        sx={{ fontWeight: 700 }}
                    >
                        {deleting ? 'Deleting...' : 'Delete Employee'}
                    </Button>
                </DialogActions>
            </Dialog>

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
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" gap={1}>
                            <DownloadIcon color="primary" />
                            <Typography variant="h6" fontWeight={800}>Download Records</Typography>
                        </Stack>
                        <IconButton onClick={() => !exporting && setDownloadDialogOpen(false)} size="small">
                            <CloseIcon />
                        </IconButton>
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
                            <MenuItem value="list">Employee List Only</MenuItem>
                            <MenuItem value="logs">Detailed Attendance Logs (All Records)</MenuItem>
                        </TextField>

                        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                CURRENT FILTERS
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Period: {formatDate(dateFrom)} to {formatDate(dateTo)}
                            </Typography>
                            {searchTerm && (
                                <Typography variant="body2">
                                    Search: "{searchTerm}"
                                </Typography>
                            )}
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            Downloading <b>{downloadOption === 'list' ? 'Employee List' : 'Detailed Records'}</b> for the current filters.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button 
                        fullWidth 
                        variant="outlined" 
                        onClick={() => downloadOption === 'list' ? handleDownloadEmployeeList('csv') : handleDownloadAttendanceLogs('csv')}
                        disabled={exporting}
                    >
                        CSV
                    </Button>
                    <Button 
                        fullWidth 
                        variant="contained" 
                        onClick={() => downloadOption === 'list' ? handleDownloadEmployeeList('pdf') : handleDownloadAttendanceLogs('pdf')}
                        disabled={exporting}
                    >
                        {exporting ? 'Processing...' : 'PDF'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Alerts alert={alert} onClose={() => setAlert((p: AlertState) => ({ ...p, open: false }))} />
        </Stack>
    );
}
