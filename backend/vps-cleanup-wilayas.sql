-- VPS Wilaya Cleanup Script
-- This script removes extra wilayas and keeps only the official 58 Algerian wilayas (IDs 1-58)

-- 1. Create backup before cleanup
CREATE TABLE wilayas_backup_before_cleanup AS SELECT * FROM wilayas;

-- 2. Check current state
SELECT 'Before Cleanup' as status, COUNT(*) as total_wilayas FROM wilayas;
SELECT 'Extra Wilayas' as status, COUNT(*) as extra_count FROM wilayas WHERE id > 58;

-- 3. Show which wilayas will be deleted (for verification)
SELECT 'Wilayas to be deleted:' as info, id, name_fr, name_ar FROM wilayas WHERE id > 58 ORDER BY id;

-- 4. Check if any orders reference wilayas > 58 (IMPORTANT!)
SELECT 'Orders with wilaya_id > 58' as check_type, COUNT(*) as count FROM orders WHERE wilaya_id > 58;

-- 5. If there are orders with wilaya_id > 58, show them for review
SELECT 'Orders to review:' as info, id, wilaya_id, customer_city, baladia_name 
FROM orders 
WHERE wilaya_id > 58 
LIMIT 10;

-- 6. Delete extra wilayas (only if no orders reference them)
-- UNCOMMENT THE NEXT LINE ONLY AFTER VERIFYING NO ORDERS REFERENCE WILAYAS > 58
-- DELETE FROM wilayas WHERE id > 58;

-- 7. Verification after cleanup
-- SELECT 'After Cleanup' as status, COUNT(*) as total_wilayas FROM wilayas;
-- SELECT 'Remaining Wilayas Range' as info, MIN(id) as min_id, MAX(id) as max_id FROM wilayas;

-- 8. Show final wilaya count by range
-- SELECT 
--   CASE 
--     WHEN id BETWEEN 1 AND 48 THEN 'Original 48 Wilayas'
--     WHEN id BETWEEN 49 AND 58 THEN 'New 10 Wilayas (49-58)'
--     ELSE 'Other'
--   END as wilaya_group,
--   COUNT(*) as count
-- FROM wilayas 
-- GROUP BY 
--   CASE 
--     WHEN id BETWEEN 1 AND 48 THEN 'Original 48 Wilayas'
--     WHEN id BETWEEN 49 AND 58 THEN 'New 10 Wilayas (49-58)'
--     ELSE 'Other'
--   END;