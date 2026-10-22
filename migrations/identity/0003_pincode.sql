-- Optional postal PIN code for people and staff.
ALTER TABLE persons ADD COLUMN pincode TEXT;
ALTER TABLE users ADD COLUMN pincode TEXT;
