'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type FaceEnrollmentModalProps = {
  open: boolean;
  employeeLabel: string;
  step: number;
  passportImage: string | null;
  capturedImages: string[];
  faceVideoRef?: React.RefObject<HTMLVideoElement>;
  passportStatus: string;
  enrollmentStatusMessage?: string;
  analysis: {
    identityMatch: string;
    similarityScore: string;
    qualityAssessment: string;
    securityStatus: string;
  };
  onClose?: () => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearPassport: () => void;
  onNextToLive: () => void;
  onStartCamera: () => void | Promise<void>;
  onCapture: () => void;
  onNextToVerify: () => void;
  onComplete: () => void;
  onRestart: () => void;
  nextToLiveEnabled?: boolean;
  nextToVerifyEnabled?: boolean;
  completeEnabled?: boolean;
  flags?: {
    canNextToLive?: boolean;
    canNextToVerify?: boolean;
    canComplete?: boolean;
  };
};

export default function FaceEnrollmentModal({
  open,
  employeeLabel,
  step,
  passportImage,
  capturedImages,
  faceVideoRef,
  passportStatus,
  enrollmentStatusMessage,
  analysis,
  onClose,
  onUpload,
  onClearPassport,
  onNextToLive,
  onStartCamera,
  onCapture,
  onNextToVerify,
  onComplete,
  onRestart,
  nextToLiveEnabled,
  nextToVerifyEnabled,
  completeEnabled,
  flags
}: FaceEnrollmentModalProps) {
  const canNextToLive = nextToLiveEnabled ?? flags?.canNextToLive ?? false;
  const canNextToVerify = nextToVerifyEnabled ?? flags?.canNextToVerify ?? false;
  const canComplete = completeEnabled ?? flags?.canComplete ?? false;
  const handleClose = onClose ?? (() => {});

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }}>
      <DialogTitle sx={{ fontFamily: 'Segoe UI, sans-serif', fontWeight: 600, borderBottom: '1px solid #eee' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            Face Enrollment
            <Typography component="span" sx={{ display: 'block', mt: 0.5, fontSize: '0.9rem', color: '#666', fontWeight: 400 }}>
              {employeeLabel}
            </Typography>
          </Box>
          <Button
            aria-label="Close enrollment"
            onClick={handleClose}
            startIcon={<CloseIcon fontSize="small" />}
            sx={{ textTransform: 'none', minWidth: 'auto', color: '#555' }}
          >
            Close
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={4} sx={{ mt: 1 }}>
          {/* Progress Indicator */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['Passport Photo', 'Live Capture', 'Verification', 'Complete'].map((label, idx) => {
              const isActive = step === idx + 1;
              const isPast = step > idx + 1;
              return (
                <Box
                  key={label}
                  sx={{
                    px: 2,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor: isActive ? '#000' : isPast ? '#e0e0e0' : 'transparent',
                    color: isActive ? '#fff' : isPast ? '#333' : '#999',
                    fontSize: '0.85rem',
                    fontFamily: 'Segoe UI, sans-serif',
                    fontWeight: 500,
                    border: isActive || isPast ? 'none' : '1px solid #ddd'
                  }}
                >
                  {idx + 1}. {label}
                </Box>
              );
            })}
          </Box>

          <Divider sx={{ borderStyle: 'dashed' }} />

          {step === 1 ? (
            <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{ maxWidth: 400, width: '100%' }}>
                <Typography variant="h6" sx={{ mb: 1, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  Upload Passport Photo
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, color: '#666', fontFamily: 'Inter, sans-serif' }}>
                  Please upload a recent, clear passport-size photo.
                </Typography>

                {!passportImage ? (
                  <Button
                    variant="outlined"
                    component="label"
                    sx={{
                      p: 4,
                      border: '2px dashed #ccc',
                      borderRadius: 2,
                      width: '100%',
                      textTransform: 'none',
                      color: '#666',
                      '&:hover': {
                        border: '2px dashed #666',
                        bgcolor: '#fafafa'
                      }
                    }}
                  >
                    <Box>
                      <Typography sx={{ display: 'block', mb: 1, fontSize: '2rem' }}>📂</Typography>
                      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Click to upload file</Typography>
                    </Box>
                    <input type="file" accept="image/*" hidden onChange={onUpload} />
                  </Button>
                ) : (
                  <Stack spacing={2} alignItems="center">
                    <Box
                      component="img"
                      src={passportImage}
                      alt="Passport"
                      sx={{ width: 180, borderRadius: 1, border: '1px solid #ddd', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    />
                    <Typography variant="body2" sx={{ color: passportStatus.includes('Valid') ? 'success.main' : 'warning.main', fontWeight: 500 }}>
                      {passportStatus}
                    </Typography>
                    <Button variant="text" color="error" onClick={onClearPassport} sx={{ textTransform: 'none', fontFamily: 'Inter, sans-serif' }}>
                      Remove photo
                    </Button>
                  </Stack>
                )}
              </Box>

              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', pt: 2 }}>
                <Button
                  variant="contained"
                  onClick={onNextToLive}
                  disabled={!canNextToLive}
                  sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' }, fontFamily: 'Inter, sans-serif', textTransform: 'none' }}
                >
                  Continue to Live Capture →
                </Button>
              </Box>
            </Stack>
          ) : null}

          {step === 2 ? (
            <Stack spacing={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Live Face Capture</Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>Capture multiple angles for better accuracy</Typography>
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
                <Box sx={{ flex: 1, width: '100%' }}>
                <Box sx={{ position: 'relative', width: '100%', borderRadius: 2, overflow: 'hidden', bgcolor: '#000', mb: 2 }}>
                  <video ref={faceVideoRef} autoPlay muted playsInline style={{ width: '100%', display: 'block' }} />
                </Box>
                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Button variant="outlined" onClick={onStartCamera} sx={{ fontFamily: 'Inter, sans-serif', textTransform: 'none' }}>
                      Start Camera
                    </Button>
                    <Button variant="contained" onClick={onCapture} sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' }, fontFamily: 'Inter, sans-serif', textTransform: 'none' }}>
                      Capture Photo
                    </Button>
                  </Stack>
                </Box>

                <Box sx={{ width: { xs: '100%', md: 200 } }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Caught: {capturedImages.length}/7</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 1 }}>
                    {capturedImages.map((img, idx) => (
                      <Box
                        key={`capture-${idx}`}
                        component="img"
                        src={img}
                        sx={{ width: '100%', aspectRatio: '1/1', borderRadius: 1, border: '1px solid #ddd', objectFit: 'cover' }}
                      />
                    ))}
                  </Box>
                  {enrollmentStatusMessage && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', fontFamily: 'Inter, sans-serif' }}>
                      {enrollmentStatusMessage}
                    </Typography>
                  )}
                </Box>
              </Stack>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2 }}>
                <Button
                  variant="contained"
                  onClick={onNextToVerify}
                  disabled={!canNextToVerify}
                  sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' }, fontFamily: 'Inter, sans-serif', textTransform: 'none' }}
                >
                  Verify Photos →
                </Button>
              </Box>
            </Stack>
          ) : null}

          {step === 3 ? (
            <Stack spacing={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Verification Analysis</Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>Reviewing quality and matching score</Typography>
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} justifyContent="center" alignItems="center">
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    component="img"
                    src={passportImage || ''}
                    sx={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }}
                  />
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'Inter, sans-serif' }}>Passport</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: '#ccc' }}>↔</Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    component="img"
                    src={capturedImages[0] || ''}
                    sx={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }}
                  />
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'Inter, sans-serif' }}>Live Capture</Typography>
                </Box>
              </Stack>

              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <DialogContent>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Identity Match</Typography>
                      <Typography variant="body2" fontWeight={600}>{analysis.identityMatch}</Typography>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Similarity Score</Typography>
                      <Typography variant="body2" fontWeight={600}>{analysis.similarityScore}</Typography>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Quality</Typography>
                      <Typography variant="body2" fontWeight={600}>{analysis.qualityAssessment}</Typography>
                    </Box>
                  </Stack>
                </DialogContent>
              </Card>

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button variant="outlined" onClick={onRestart} sx={{ color: '#666', borderColor: '#ccc', fontFamily: 'Inter, sans-serif', textTransform: 'none' }}>
                  Start Over
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={onComplete}
                  disabled={!canComplete}
                  sx={{ fontFamily: 'Inter, sans-serif', textTransform: 'none', fontWeight: 500 }}
                >
                  Complete Enrollment
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {step === 4 ? (
            <Stack spacing={3} alignItems="center" sx={{ py: 4, textAlign: 'center' }}>
              <Box sx={{ fontSize: '4rem' }}>🎉</Box>
              <Box>
                <Typography variant="h5" sx={{ mb: 1, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Enrollment Successful</Typography>
                <Typography variant="body1" sx={{ color: '#666', fontFamily: 'Inter, sans-serif' }}>
                  Employee has been successfully enrolled in the system.
                </Typography>
              </Box>

              <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderRadius: 2, width: '100%', maxWidth: 400 }}>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Employee</Typography>
                    <Typography variant="body2" fontWeight={500}>{employeeLabel.split('(')[0]}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Total Photos</Typography>
                    <Typography variant="body2" fontWeight={500}>{capturedImages.length + (passportImage ? 1 : 0)}</Typography>
                  </Box>
                </Stack>
              </Box>

              <Button
                variant="contained"
                onClick={handleClose}
                sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' }, fontFamily: 'Inter, sans-serif', textTransform: 'none', px: 4 }}
              >
                Close & Return to Dashboard
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
