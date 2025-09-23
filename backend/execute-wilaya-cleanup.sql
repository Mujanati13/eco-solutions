-- VPS Wilaya Cleanup - EXECUTE NOW
-- Safe to run since no orders reference wilayas > 58

-- 1. Create backup before cleanup
CREATE TABLE wilayas_cleanup_backup AS SELECT * FROM wilayas;

-- 2. Delete the 22 invalid wilayas (IDs 155-176)
DELETE FROM wilayas WHERE id > 58;

-- 3. Reset AUTO_INCREMENT to prevent future gaps
ALTER TABLE wilayas AUTO_INCREMENT = 59;

-- 4. Final verification
SELECT 'After Cleanup' as status, COUNT(*) as total_wilayas FROM wilayas;
SELECT 'Wilaya ID Range' as check_type, MIN(id) as min_id, MAX(id) as max_id FROM wilayas;

-- 5. Show final wilaya structure (should be exactly 58)
SELECT 
  CASE 
    WHEN id BETWEEN 1 AND 48 THEN 'Original 48 Wilayas (1-48)'
    WHEN id BETWEEN 49 AND 58 THEN 'New 10 Wilayas (49-58)'
  END as wilaya_group,
  COUNT(*) as count
FROM wilayas 
GROUP BY 
  CASE 
    WHEN id BETWEEN 1 AND 48 THEN 'Original 48 Wilayas (1-48)'
    WHEN id BETWEEN 49 AND 58 THEN 'New 10 Wilayas (49-58)'
  END;

-- 6. Verify critical wilayas are still there
SELECT 'Critical Wilayas Check' as info, id, name_fr, office_delivery_price 
FROM wilayas 
WHERE id IN (52, 57) 
ORDER BY id;

-- Success message
SELECT 'CLEANUP COMPLETE!' as status, 'Database now has exactly 58 official wilayas' as message;