'use client';

import * as React from 'react';
import { Alert, Snackbar } from '@mui/material';

export type AlertState = {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
};

type AlertsProps = {
  alert: AlertState;
  onClose: () => void;
  autoHideDuration?: number;
};

export default function Alerts({ alert, onClose, autoHideDuration = 5000 }: AlertsProps) {
  return (
    <Snackbar
      open={alert.open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert onClose={onClose} severity={alert.severity} sx={{ width: '100%' }}>
        {alert.message}
      </Alert>
    </Snackbar>
  );
}
