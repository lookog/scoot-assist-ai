-- Create admin user record for existing user
INSERT INTO admin_users (id, email, full_name, role, is_active)
VALUES (
    '30dc6753-8405-4518-9866-245d428bc7d5',
    'admin@example.com',
    'System Administrator',
    'admin',
    true
)
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;