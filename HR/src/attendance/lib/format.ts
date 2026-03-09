/**
 * Formats a date string or Date object to dd/mm/yyyy format.
 */
export const formatDate = (date?: string | Date) => {
    if (!date) return '-';
    try {
        // If it's just a time string (HH:MM:SS), it's not a date
        if (typeof date === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(date)) {
            return '-';
        }

        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        return `${day}/${month}/${year}`;
    } catch (e) {
        return '-';
    }
};

/**
 * Formats a date string or Date object to a region-aware time string.
 */
export const formatTime = (timeStr?: string | Date) => {
    if (!timeStr) return '-';
    try {
        let normalized = timeStr;

        // Handle ISO-like strings that might be missing a 'Z' or offset
        if (typeof normalized === 'string' && (normalized.includes('T') || normalized.includes(' '))) {
            if (!normalized.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
                // DB typically sends raw UTC here
                normalized = normalized.trim().replace(' ', 'T') + 'Z';
            }
        }

        const d = new Date(normalized);

        // Handle successfully parsed dates (will use local timezone conversion)
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        // Fallback for raw time strings like "07:43:31" (Treatment as UTC)
        if (typeof timeStr === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
            const [h, m, s] = timeStr.split(':').map(Number);
            const d = new Date();
            d.setUTCHours(h, m, s, 0);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        }

        return '-';
    } catch (e) {
        return '-';
    }
};

/**
 * Formats duration from decimal hours to a human-readable string.
 */
export const formatDuration = (totalHours?: number) => {
    if (totalHours === undefined || isNaN(totalHours)) return '-';
    return `${totalHours.toFixed(2)} hrs`;
};

/**
 * Formats total minutes to literal H.MM format (e.g. 0.37 for 37 mins).
 */
export const formatMinutesToHMM = (totalMinutes?: number) => {
    if (totalMinutes === undefined || isNaN(totalMinutes)) return '0.00';
    return (totalMinutes / 60).toFixed(2);
};
