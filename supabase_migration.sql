-- Supabase Migration Script
-- This script updates your existing database tables to support the new features.
-- We did NOT need to create entirely new tables! We just need to add a few things to your existing tables.

-- 1. Add 'tutorial_completed' to the 'profiles' table
-- This allows the app to remember if a user has finished the welcome tour.
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT false;

-- 2. Update the 'entities' table to support the new 'scene' type
-- Note: If you created the 'type' column as a standard TEXT field, you can ignore this!
-- But if you created it as an ENUM or a CHECK constraint, you need to run this to allow 'scene'.

-- Attempt A: If you used an ENUM called 'entity_type'
-- (Uncomment the line below if you used an ENUM)
-- ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'scene';

-- Attempt B: If you used a CHECK constraint
-- (Uncomment the lines below if you used a CHECK constraint, make sure the constraint name matches yours)
-- ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_type_check;
-- ALTER TABLE entities ADD CONSTRAINT entities_type_check CHECK (type IN ('character', 'location', 'item', 'lore', 'scene'));
