-- Additive only: existing users, authentication, roles, and permit records are unchanged.
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;