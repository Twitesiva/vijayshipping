'use client';

import * as React from 'react';
import { Box, Button, Card, CardContent, Divider, Stack, Typography, alpha, useTheme } from '@mui/material';

type CameraBoxProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onStart: () => void;
  onMarkEntry: () => void;
  onMarkExit: () => void;
  canStart: boolean;
  canMarkEntry: boolean;
  canMarkExit: boolean;
  cameraActive: boolean;
  faceStatus: string;
  attendanceStatus?: string;
};

export default function CameraBox({
  videoRef,
  canvasRef,
  onStart,
  onMarkEntry,
  onMarkExit,
  canStart,
  canMarkEntry,
  canMarkExit,
  cameraActive,
  faceStatus,
  attendanceStatus
}: CameraBoxProps) {
  const theme = useTheme();
  const faceStatusPrefix = React.useMemo(() => {
    const status = String(faceStatus || '').toLowerCase();
    if (status.startsWith('verified')) return '✅';
    if (status.includes('wrong person') || status.includes('not recognized') || status.includes('error')) return '❌';
    if (status.includes('loading') || status.includes('started')) return '⏳';
    return 'ℹ️';
  }, [faceStatus]);

  return (
    <Card sx={{ borderRadius: '18px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 800 }}>
          Mark Attendance
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          Camera verification is active. Record login or logout.
        </Typography>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              position: 'relative',
              display: 'inline-block',
              width: '100%',
              maxWidth: 640,
              aspectRatio: '4 / 3',
              borderRadius: '14px',
              overflow: 'hidden',
              bgcolor: '#000',
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.18),
              boxShadow: '0 10px 24px rgba(0,0,0,0.06)'
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                transform: 'scaleX(-1)' // Mirror for natural look
              }}
            />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />
          </Box>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            sx={{ mt: 2, justifyContent: 'center' }}
          >
            {!cameraActive ? (
              <Button 
                variant="outlined" 
                onClick={onStart} 
                disabled={!canStart} 
                sx={{ 
                  fontWeight: 700, 
                  py: 1.5,
                  width: { xs: '100%', sm: 'auto' } 
                }}
              >
                Start Camera
              </Button>
            ) : null}
            <Button 
              variant="contained" 
              color="success" 
              onClick={onMarkEntry} 
              disabled={!canMarkEntry} 
              sx={{ 
                fontWeight: 700, 
                py: 1.5,
                width: { xs: '100%', sm: 'auto' } 
              }}
            >
              Login
            </Button>
            <Button 
              variant="contained" 
              color="error" 
              onClick={onMarkExit} 
              disabled={!canMarkExit} 
              sx={{ 
                fontWeight: 700, 
                py: 1.5,
                width: { xs: '100%', sm: 'auto' } 
              }}
            >
              Logout
            </Button>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: '12px', textAlign: 'left' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {faceStatusPrefix} {faceStatus}
            </Typography>
            {attendanceStatus ? <Typography variant="body2">{attendanceStatus}</Typography> : null}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
