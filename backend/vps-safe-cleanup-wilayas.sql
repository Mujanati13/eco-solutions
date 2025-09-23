-- VPS Wilaya Cleanup - SAFE VERSION
-- This script safely removes extra wilayas and keeps only the official 58 Algerian wilayas

-- 1. Create backup
CREATE TABLE wilayas_cleanup_backup AS SELECT * FROM wilayas;

-- 2. First, update any orders that might reference invalid wilaya_ids
-- Move orders from wilayas > 58 to a default wilaya (you can change this)
UPDATE orders 
SET wilaya_id = 16, updated_at = NOW() 
WHERE wilaya_id > 58;

-- 3. Delete extra wilayas (keeping only 1-58)
DELETE FROM wilayas WHERE id > 58;

-- 4. Reset AUTO_INCREMENT to prevent gaps
ALTER TABLE wilayas AUTO_INCREMENT = 59;

-- 5. Final verification
SELECT 'Final Wilaya Count' as check_type, COUNT(*) as count FROM wilayas;
SELECT 'Wilaya ID Range' as check_type, MIN(id) as min_id, MAX(id) as max_id FROM wilayas;
SELECT 'Orders with invalid wilaya_id' as check_type, COUNT(*) as count FROM orders WHERE wilaya_id > 58;

-- 6. Show the official 58 wilayas structure
SELECT 
  CASE 
    WHEN id BETWEEN 1 AND 48 THEN 'Original 48 Wilayas (1-48)'
    WHEN id BETWEEN 49 AND 58 THEN 'New 10 Wilayas (49-58)'
  END as wilaya_group,
  COUNT(*) as count
FROM wilayas 
WHERE id <= 58
GROUP BY 
  CASE 
    WHEN id BETWEEN 1 AND 48 THEN 'Original 48 Wilayas (1-48)'
    WHEN id BETWEEN 49 AND 58 THEN 'New 10 Wilayas (49-58)'
  END;

-- ROLLBACK if needed:
-- DROP TABLE wilayas;
-- RENAME TABLE wilayas_cleanup_backup TO wilayas;