'use client';

import * as React from 'react';
import { Card, CardContent, Grid, Stack, Typography, alpha, useTheme } from '@mui/material';

type StatusItem = {
  label: string;
  value: string;
  color?: string;
};

type StatusCardsProps = {
  items: StatusItem[];
};

export default function StatusCards({ items }: StatusCardsProps) {
  const theme = useTheme();
  return (
    <Card sx={{ borderRadius: '18px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
          Current Status
        </Typography>
        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.label}>
              <Stack
                spacing={0.8}
                sx={{
                  p: 2,
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.14),
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  minHeight: 92
                }}
              >
                <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}>
                  {item.label}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: item.color || 'text.primary' }}>
                  {item.value}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
