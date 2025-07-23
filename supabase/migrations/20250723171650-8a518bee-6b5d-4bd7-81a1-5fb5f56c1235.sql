-- First, let's try to create the auth user directly (this may need manual signup)
-- Insert admin user record (you'll need to sign up with admin@example.com first)
INSERT INTO admin_users (id, email, full_name, role, is_active) 
SELECT 
    id, 
    'admin@example.com',
    'System Administrator',
    'admin',
    true
FROM auth.users 
WHERE email = 'admin@example.com'
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- If the user doesn't exist in auth.users yet, insert a placeholder that will be updated when they sign up
INSERT INTO admin_users (id, email, full_name, role, is_active)
SELECT 
    gen_random_uuid(),
    'admin@example.com',
    'System Administrator', 
    'admin',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@example.com'
)
ON CONFLICT (email) DO NOTHING;