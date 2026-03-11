-- Add work_status, exit_date, and reason_for_leave columns to employees table
-- These fields are needed to track inactive employees and their exit reasons

-- Add work_status column (Active/Inactive)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS work_status TEXT DEFAULT 'Active';

-- Add exit_date column (Date when employee left)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS exit_date DATE;

-- Add reason_for_leave column (Resigned, Terminated, Absconded, Other)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS reason_for_leave TEXT;

-- Add document_url column (for storing exit documents like resignation letter)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Create index on work_status for faster filtering
CREATE INDEX IF NOT EXISTS idx_employees_work_status ON employees(work_status);

-- Create index on exit_date for reporting
CREATE INDEX IF NOT EXISTS idx_employees_exit_date ON employees(exit_date);

-- Optional: Update existing records that have status = 'Inactive' to have work_status = 'Inactive'
UPDATE employees 
SET work_status = 'Inactive' 
WHERE LOWER(status) = 'inactive' 
AND (work_status IS NULL OR work_status = 'Active');

