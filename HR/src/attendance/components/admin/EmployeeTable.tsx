'use client';

import * as React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  alpha,
  useTheme,
  Tooltip,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Face as FaceIcon,
  CheckCircle as ActiveIcon,
  PauseCircle as InactiveIcon,
  Fingerprint as EnrollIcon
} from '@mui/icons-material';
import { Employee } from '../../types';

type EmployeeTableProps = {
  employees: Employee[];
  onEnroll: (employeeId: string, fullName: string) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string, employeeName: string) => void;
};

export default function EmployeeTable({ employees, onEnroll, onEdit, onDelete }: EmployeeTableProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedEmp, setSelectedEmp] = React.useState<Employee | null>(null);
  const [page, setPage] = React.useState(0);
  const rowsPerPage = 5;

  const sortedEmployees = React.useMemo(() => {
    const list = [...employees];
    list.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
    return list;
  }, [employees]);

  const maxPage = Math.max(0, Math.ceil(sortedEmployees.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);

  React.useEffect(() => {
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [maxPage, page]);

  const paginatedEmployees = React.useMemo(() => {
    const start = safePage * rowsPerPage;
    return sortedEmployees.slice(start, start + rowsPerPage);
  }, [sortedEmployees, safePage]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, emp: Employee) => {
    setAnchorEl(event.currentTarget);
    setSelectedEmp(emp);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedEmp(null);
  };

  if (employees.length === 0) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          No employees found in the directory.
        </Typography>
      </Box>
    );
  }

  const getRoleColor = (role: string | undefined) => {
    switch (role?.toLowerCase()) {
      case 'boss': return theme.palette.error.main;
      case 'manager': return theme.palette.warning.main;
      default: return theme.palette.primary.main;
    }
  };

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Table sx={{ minWidth: 800 }}>
        <TableHead>
          <TableRow sx={{
            '& th': {
              bgcolor: 'transparent',
              borderBottom: '1px solid',
              borderColor: 'divider',
              color: 'text.secondary',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              py: 2
            }
          }}>
            <TableCell>Employee</TableCell>
            <TableCell>Department</TableCell>
            <TableCell>Designation</TableCell>
            <TableCell>Face ID</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedEmployees.map((employee) => (
            <TableRow
              key={employee.id || employee.employee_id}
              sx={{
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                transition: 'background-color 0.2s ease'
              }}
            >
              <TableCell>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: alpha(getRoleColor(employee.role), 0.1),
                      color: getRoleColor(employee.role),
                      fontWeight: 700,
                      fontSize: '1rem',
                      border: `2px solid ${alpha(getRoleColor(employee.role), 0.2)}`
                    }}
                  >
                    {employee.full_name ? employee.full_name.charAt(0) : (employee.username ? employee.username.charAt(0) : 'E')}
                  </Avatar>
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500, color: 'text.primary', letterSpacing: '0.01em' }}
                    >
                      {employee.full_name || 'Anonymous User'}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>

              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {employee.department || 'General'}
                </Typography>
              </TableCell>

              <TableCell>
                <Chip
                  label={employee.role || 'Employee'}
                  size="small"
                  sx={{
                    bgcolor: alpha(getRoleColor(employee.role), 0.08),
                    color: getRoleColor(employee.role),
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.65rem'
                  }}
                />
              </TableCell>

              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {employee.has_face_enrolled ? (
                    <Tooltip title="Face biometric verified">
                      <FaceIcon sx={{ color: 'success.main', fontSize: 20 }} />
                    </Tooltip>
                  ) : (
                    <Tooltip title="Pending face enrollment">
                      <FaceIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                    </Tooltip>
                  )}
                  <Typography variant="caption" sx={{ fontWeight: 600, color: employee.has_face_enrolled ? 'success.main' : 'text.secondary' }}>
                    {employee.has_face_enrolled ? 'VERIFIED' : 'PENDING'}
                  </Typography>
                </Box>
              </TableCell>

              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    bgcolor: employee.is_active ? 'success.main' : 'text.disabled'
                  }} />
                  <Typography variant="body2" sx={{
                    fontWeight: 600,
                    color: employee.is_active ? 'text.primary' : 'text.secondary',
                    fontSize: '0.8rem'
                  }}>
                    {employee.is_active ? 'Active' : 'Offline'}
                  </Typography>
                </Box>
              </TableCell>

              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Tooltip title="Enroll Face ID">
                    <IconButton
                      size="small"
                      onClick={() => onEnroll(employee.employee_id, employee.full_name || employee.employee_id)}
                      sx={{ color: employee.has_face_enrolled ? 'success.main' : 'primary.main' }}
                    >
                      <EnrollIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, employee)}>
                    <MoreIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={sortedEmployees.length}
        page={safePage}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[5]}
        labelDisplayedRows={({ from, to, count }) => `${from} - ${to} of ${count}`}
      />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            borderRadius: '12px',
            minWidth: 160
          }
        }}
      >
        <MenuItem onClick={() => { if (selectedEmp) onEdit(selectedEmp); handleMenuClose(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Edit Profile" />
        </MenuItem>
        <MenuItem onClick={() => { if (selectedEmp) onDelete(selectedEmp.employee_id, selectedEmp.full_name || selectedEmp.employee_id); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="Delete Employee" />
        </MenuItem>
      </Menu>
    </Box>
  );
}

// Missing import fix
import PeopleIcon from '@mui/icons-material/People';
