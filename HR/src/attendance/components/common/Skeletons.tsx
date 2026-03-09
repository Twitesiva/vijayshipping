'use client';

import * as React from 'react';
import { Box, Card, CardContent, Grid, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

export function DashboardStatsSkeleton() {
    return (
        <Grid container spacing={3}>
            {[1, 2, 3, 4].map((i) => (
                <Grid item xs={12} md={3} key={i}>
                    <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <CardContent>
                            <Skeleton animation="wave" variant="text" width="40%" height={40} sx={{ mb: 1 }} />
                            <Skeleton animation="wave" variant="text" width="60%" height={20} />
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );
}

export function AdminDashboardSkeleton() {
    return (
        <Grid container spacing={3}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={`stat-${i}`}>
                    <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Stack spacing={2}>
                                <Skeleton animation="wave" variant="rounded" width={56} height={56} sx={{ borderRadius: '16px' }} />
                                <Skeleton animation="wave" variant="text" width="38%" height={46} />
                                <Skeleton animation="wave" variant="text" width="62%" height={22} />
                                <Skeleton animation="wave" variant="rounded" width="100%" height={6} />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            ))}

            <Grid item xs={12} lg={7}>
                <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <CardContent sx={{ p: 4 }}>
                        <Skeleton animation="wave" variant="text" width="40%" height={36} />
                        <Skeleton animation="wave" variant="text" width="68%" height={22} sx={{ mb: 2 }} />
                        <Stack spacing={2.5}>
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <Box key={`progress-${idx}`}>
                                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                                        <Skeleton animation="wave" variant="text" width="42%" height={22} />
                                        <Skeleton animation="wave" variant="text" width={36} height={22} />
                                    </Stack>
                                    <Skeleton animation="wave" variant="rounded" width="100%" height={10} />
                                </Box>
                            ))}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 2.5, flexWrap: 'wrap' }}>
                            <Skeleton animation="wave" variant="rounded" width={130} height={26} />
                            <Skeleton animation="wave" variant="rounded" width={145} height={26} />
                            <Skeleton animation="wave" variant="rounded" width={120} height={26} />
                        </Stack>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} lg={5}>
                <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
                    <CardContent sx={{ p: 4 }}>
                        <Skeleton animation="wave" variant="text" width="58%" height={34} />
                        <Skeleton animation="wave" variant="text" width="50%" height={22} sx={{ mb: 2.5 }} />
                        <Skeleton animation="wave" variant="rounded" width="100%" height={96} sx={{ borderRadius: '16px' }} />
                        <Skeleton animation="wave" variant="text" width="45%" height={24} sx={{ mt: 2.5 }} />
                        <Stack spacing={1}>
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <Skeleton key={`alert-${idx}`} animation="wave" variant="text" width="85%" height={20} />
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12}>
                <Card sx={{ borderRadius: '20px', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                    <CardContent sx={{ p: 4 }}>
                        <Skeleton animation="wave" variant="text" width="36%" height={34} sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Grid item xs={12} md={6} key={`dept-${i}`}>
                                    <Skeleton animation="wave" variant="rounded" width="100%" height={74} sx={{ borderRadius: '14px' }} />
                                </Grid>
                            ))}
                        </Grid>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
    return (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>
            <Table>
                <TableHead>
                    <TableRow>
                        {Array.from({ length: columns }).map((_, i) => (
                            <TableCell key={i}>
                                <Skeleton animation="wave" variant="text" width="80%" height={24} />
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <TableRow key={i}>
                            {Array.from({ length: columns }).map((_, j) => (
                                <TableCell key={j}>
                                    <Skeleton animation="wave" variant="text" width={j === 0 ? "40%" : "90%"} height={20} />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

export function FormSkeleton() {
    return (
        <Card sx={{ borderRadius: 2 }}>
            <CardContent>
                <Skeleton animation="wave" variant="text" width="30%" height={32} sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Grid item xs={12} md={4} key={i}>
                            <Skeleton animation="wave" variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
                        </Grid>
                    ))}
                </Grid>
                <Skeleton animation="wave" variant="rectangular" width={120} height={40} sx={{ mt: 3, borderRadius: 1 }} />
            </CardContent>
        </Card>
    );
}

export function PageSkeleton() {
    return (
        <Stack spacing={4}>
            <Box>
                <Skeleton animation="wave" variant="text" width="20%" height={40} sx={{ mb: 4 }} />
                <DashboardStatsSkeleton />
            </Box>
            <Box>
                <Skeleton variant="text" width="15%" height={32} sx={{ mb: 2 }} />
                <TableSkeleton />
            </Box>
        </Stack>
    );
}
