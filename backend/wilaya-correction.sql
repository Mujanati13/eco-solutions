-- VPS Wilaya Correction SQL Script
-- Run these commands on your production database to fix wilaya mappings

-- 1. Create backup table first (IMPORTANT!)
CREATE TABLE wilayas_backup_production AS SELECT * FROM wilayas;

-- 2. Update incorrect wilaya mappings
UPDATE wilayas SET name_fr = 'Bordj Badji Mokhtar', name_ar = 'برج باجي مختار', updated_at = NOW() WHERE id = 50;
UPDATE wilayas SET name_fr = 'Ouled Djellal', name_ar = 'أولاد جلال', updated_at = NOW() WHERE id = 51;
UPDATE wilayas SET name_fr = 'Beni Abbes', name_ar = 'بني عباس', updated_at = NOW() WHERE id = 52;
UPDATE wilayas SET name_fr = 'In Salah', name_ar = 'عين صالح', updated_at = NOW() WHERE id = 53;
UPDATE wilayas SET name_fr = 'In Guezzam', name_ar = 'عين قزام', updated_at = NOW() WHERE id = 54;
UPDATE wilayas SET name_fr = 'Touggourt', name_ar = 'تقرت', updated_at = NOW() WHERE id = 55;
UPDATE wilayas SET name_fr = 'Djanet', name_ar = 'جانت', updated_at = NOW() WHERE id = 56;
UPDATE wilayas SET name_fr = 'El M''Ghair', name_ar = 'المغير', updated_at = NOW() WHERE id = 57;
UPDATE wilayas SET name_fr = 'El Meniaa', name_ar = 'المنيعة', updated_at = NOW() WHERE id = 58;

-- 3. Insert missing wilayas if they don't exist (safe inserts)
INSERT IGNORE INTO wilayas (id, code, name_fr, name_ar, name_en, is_active, created_at, updated_at) 
VALUES (50, '50', 'Bordj Badji Mokhtar', 'برج باجي مختار', 'Bordj Badji Mokhtar', 1, NOW(), NOW());

INSERT IGNORE INTO wilayas (id, code, name_fr, name_ar, name_en, is_active, created_at, updated_at) 
VALUES (54, '54', 'In Guezzam', 'عين قزام', 'In Guezzam', 1, NOW(), NOW());

-- 4. Verification queries (run these to check results)
SELECT id, name_fr, name_ar FROM wilayas WHERE id BETWEEN 50 AND 58 ORDER BY id;

-- 5. Check order assignments
SELECT wilaya_id, COUNT(*) as order_count 
FROM orders 
WHERE wilaya_id IN (50, 51, 52, 53, 54, 55, 56, 57, 58) 
GROUP BY wilaya_id 
ORDER BY wilaya_id;

-- 6. Verify critical mappings
SELECT 'Djanet Check' as check_type, id, name_fr 
FROM wilayas 
WHERE id = 56 AND name_fr = 'Djanet'
UNION ALL
SELECT 'El M''Ghair Check' as check_type, id, name_fr 
FROM wilayas 
WHERE id = 57 AND name_fr = 'El M''Ghair';

-- ROLLBACK COMMANDS (if needed):
-- DROP TABLE IF EXISTS wilayas_old;
-- RENAME TABLE wilayas TO wilayas_old;
-- RENAME TABLE wilayas_backup_production TO wilayas;