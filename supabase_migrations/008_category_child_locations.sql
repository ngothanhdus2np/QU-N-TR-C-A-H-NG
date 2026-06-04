-- Store shelf/storage location only for child product categories.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS location TEXT;

-- Top-level categories must not carry a group location.
UPDATE categories
SET location = NULL
WHERE path NOT LIKE '% >> %';
