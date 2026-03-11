-- 1. Add username and password columns to employees table if they don't exist
ALTER TABLE employees ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Populate username for existing employees using their employee_id as an initial value
UPDATE employees SET username = employee_id WHERE username IS NULL;

-- 3. Add index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);

-- 4. One-time password migration from 'users' table to 'employees' table (if users table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        UPDATE employees e
        SET password = u.hashed_password
        FROM users u
        WHERE (e.employee_id = u.employee_id OR LOWER(e.email) = LOWER(u.email))
        AND e.password IS NULL;
    END IF;
END $$;

-- 5. Function to update/set password directly in employees table (Sync handle)
CREATE OR REPLACE FUNCTION upsert_employee_account(
    p_employee_id TEXT,
    p_password TEXT,
    p_username TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL
) 
RETURNS VOID AS $$
BEGIN
    UPDATE employees 
    SET 
        password = p_password,
        username = COALESCE(p_username, username),
        email = COALESCE(p_email, email)
    WHERE employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Updated verify_login_json to verify from employees table (Case-Insensitive Identifier)
DROP FUNCTION IF EXISTS verify_login_json(text,text,text,text);
CREATE OR REPLACE FUNCTION verify_login_json(
    p_role TEXT,
    p_identifier TEXT,
    p_admin_id TEXT DEFAULT NULL,
    p_secret TEXT DEFAULT NULL
) 
RETURNS JSON AS $$
DECLARE
    v_employee_id TEXT;
    v_full_name TEXT;
    v_designation TEXT;
    v_stored_pass TEXT;
BEGIN
    -- 1. Find employee and stored password in 'employees' table (Case-Insensitive lookup)
    RAISE NOTICE 'Attempting login for identifier: %', p_identifier;
    
    SELECT employee_id, full_name, designation, password 
    INTO v_employee_id, v_full_name, v_designation, v_stored_pass
    FROM employees
    WHERE (LOWER(username) = LOWER(p_identifier) OR LOWER(employee_id) = LOWER(p_identifier) OR LOWER(email) = LOWER(p_identifier))
    AND (LOWER(designation) = LOWER(p_role) OR p_role IS NULL OR LOWER(designation) = 'admin' OR LOWER(designation) = 'founder')
    LIMIT 1;

    IF v_employee_id IS NULL THEN
        RAISE NOTICE 'No employee found matching identifier and role: %', p_role;
        RETURN json_build_object('error', 'User not found or role mismatch');
    END IF;

    -- 2. Verify password (Direct comparison as per system design)
    IF v_stored_pass IS NULL OR v_stored_pass != p_secret THEN
        RAISE NOTICE 'Password mismatch for employee: %', v_employee_id;
        RETURN json_build_object('error', 'Invalid password');
    END IF;

    RAISE NOTICE 'Login successful for employee: %', v_employee_id;
    RETURN json_build_object(
        'employee_id', v_employee_id,
        'full_name', v_full_name,
        'designation', v_designation,
        'status', 'success'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Updated manager_login_js - only matches Manager / Founder / HR designations
DROP FUNCTION IF EXISTS manager_login_js(text,text);
CREATE OR REPLACE FUNCTION manager_login_js(
    p_email TEXT,
    p_password TEXT
) 
RETURNS JSON AS $$
DECLARE
    v_employee_id TEXT;
    v_full_name TEXT;
    v_designation TEXT;
    v_stored_pass TEXT;
BEGIN
    -- Only match users with management-level designations
    SELECT employee_id, full_name, designation, password 
    INTO v_employee_id, v_full_name, v_designation, v_stored_pass
    FROM employees
    WHERE (LOWER(username) = LOWER(p_email) OR LOWER(employee_id) = LOWER(p_email) OR LOWER(email) = LOWER(p_email))
    AND (
        LOWER(designation) LIKE '%manager%' OR
        LOWER(designation) LIKE '%founder%' OR
        LOWER(designation) LIKE '%hr%' OR
        LOWER(designation) LIKE '%admin%' OR
        LOWER(designation) LIKE '%boss%'
    )
    LIMIT 1;

    IF v_employee_id IS NULL THEN
        RETURN NULL; -- Not a manager/founder/HR
    END IF;

    IF v_stored_pass IS NULL OR v_stored_pass != p_password THEN
        RETURN NULL; -- Wrong password
    END IF;

    RETURN json_build_object(
        'employee_id', v_employee_id,
        'full_name', v_full_name,
        'designation', v_designation,
        'status', 'success'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
