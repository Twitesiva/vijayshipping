-- Unified Schema Synchronization Migration
-- Standardize table and column names across Frontend, Backend, and Database

-- 1. Ensure 'employees' is the main table
-- If hrmss_employees exists, rename it (if employees doesn't exist)
DO $$ 
BEGIN
    -- Rename hrmss_employees to employees if employees doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hrmss_employees') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
        ALTER TABLE hrmss_employees RENAME TO employees;
    END IF;
END $$;

-- 2. Standardize columns in 'employees'
DO $$ 
BEGIN
    -- Rename employee_id or employee_code to standardized employee_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'employee_code') THEN
        ALTER TABLE employees RENAME COLUMN employee_code TO employee_id;
    END IF;

    -- Rename department to designation (per standards)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'department') THEN
        ALTER TABLE employees RENAME COLUMN department TO designation;
    END IF;

    -- Rename role to department (per standards)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'role') THEN
        ALTER TABLE employees RENAME COLUMN role TO department;
    END IF;

    -- Rename joining_date to join_date
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'joining_date') THEN
        ALTER TABLE employees RENAME COLUMN joining_date TO join_date;
    END IF;
    
    -- Rename is_active to status (if it's a string, otherwise cast)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'is_active') THEN
        ALTER TABLE employees RENAME COLUMN is_active TO status;
    END IF;
END $$;

-- 3. Standardize 'attendance' table
DO $$ 
BEGIN
    -- Rename attendance_logs to attendance if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_logs') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance') THEN
        ALTER TABLE attendance_logs RENAME TO attendance;
    END IF;
END $$;

DO $$ 
BEGIN
    -- Rename entry_time to check_in
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'entry_time') THEN
        ALTER TABLE attendance RENAME COLUMN entry_time TO check_in;
    END IF;

    -- Rename exit_time to check_out
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'exit_time') THEN
        ALTER TABLE attendance RENAME COLUMN exit_time TO check_out;
    END IF;
END $$;

-- 4. Standardize 'face_enrollments' table
DO $$ 
BEGIN
    -- Rename face_embeddings to face_enrollments if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'face_embeddings') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'face_enrollments') THEN
        ALTER TABLE face_embeddings RENAME TO face_enrollments;
    END IF;
END $$;
