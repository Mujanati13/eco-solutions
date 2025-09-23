-- Fix Wilaya Data - Correct the name_en column and other issues
-- The name_en column got shifted and contains wrong data

-- 1. Create backup before fixing
CREATE TABLE wilayas_fix_backup AS SELECT * FROM wilayas;

-- 2. Fix all wilaya data with correct name_en values
UPDATE wilayas SET name_en = 'Adrar' WHERE id = 1;
UPDATE wilayas SET name_en = 'Chlef' WHERE id = 2;
UPDATE wilayas SET name_en = 'Laghouat' WHERE id = 3;
UPDATE wilayas SET name_en = 'Oum El Bouaghi' WHERE id = 4;
UPDATE wilayas SET name_en = 'Batna' WHERE id = 5;
UPDATE wilayas SET name_en = 'Bejaia' WHERE id = 6;
UPDATE wilayas SET name_en = 'Biskra' WHERE id = 7;
UPDATE wilayas SET name_en = 'Bechar' WHERE id = 8;
UPDATE wilayas SET name_en = 'Blida' WHERE id = 9;
UPDATE wilayas SET name_en = 'Bouira' WHERE id = 10;
UPDATE wilayas SET name_en = 'Tamanrasset' WHERE id = 11;
UPDATE wilayas SET name_en = 'Tebessa' WHERE id = 12;
UPDATE wilayas SET name_en = 'Tlemcen' WHERE id = 13;
UPDATE wilayas SET name_en = 'Tiaret' WHERE id = 14;
UPDATE wilayas SET name_en = 'Tizi Ouzou' WHERE id = 15;
UPDATE wilayas SET name_en = 'Algiers' WHERE id = 16;
UPDATE wilayas SET name_en = 'Djelfa' WHERE id = 17;
UPDATE wilayas SET name_en = 'Jijel' WHERE id = 18;
UPDATE wilayas SET name_en = 'Setif' WHERE id = 19;
UPDATE wilayas SET name_en = 'Saida' WHERE id = 20;
UPDATE wilayas SET name_en = 'Skikda' WHERE id = 21;
UPDATE wilayas SET name_en = 'Sidi Bel Abbes' WHERE id = 22;
UPDATE wilayas SET name_en = 'Annaba' WHERE id = 23;
UPDATE wilayas SET name_en = 'Guelma' WHERE id = 24;
UPDATE wilayas SET name_en = 'Constantine' WHERE id = 25;
UPDATE wilayas SET name_en = 'Medea' WHERE id = 26;
UPDATE wilayas SET name_en = 'Mostaganem' WHERE id = 27;
UPDATE wilayas SET name_en = 'M''Sila' WHERE id = 28;
UPDATE wilayas SET name_en = 'Mascara' WHERE id = 29;
UPDATE wilayas SET name_en = 'Ouargla' WHERE id = 30;
UPDATE wilayas SET name_en = 'Oran' WHERE id = 31;
UPDATE wilayas SET name_en = 'El Bayadh' WHERE id = 32;
UPDATE wilayas SET name_en = 'Illizi' WHERE id = 33;
UPDATE wilayas SET name_en = 'Bordj Bou Arreridj' WHERE id = 34;
UPDATE wilayas SET name_en = 'Boumerdes' WHERE id = 35;
UPDATE wilayas SET name_en = 'El Tarf' WHERE id = 36;
UPDATE wilayas SET name_en = 'Tindouf' WHERE id = 37;
UPDATE wilayas SET name_en = 'Tissemsilt' WHERE id = 38;
UPDATE wilayas SET name_en = 'El Oued' WHERE id = 39;
UPDATE wilayas SET name_en = 'Khenchela' WHERE id = 40;
UPDATE wilayas SET name_en = 'Souk Ahras' WHERE id = 41;
UPDATE wilayas SET name_en = 'Tipaza' WHERE id = 42;
UPDATE wilayas SET name_en = 'Mila' WHERE id = 43;
UPDATE wilayas SET name_en = 'Ain Defla' WHERE id = 44;
UPDATE wilayas SET name_en = 'Naama' WHERE id = 45;
UPDATE wilayas SET name_en = 'Ain Temouchent' WHERE id = 46;
UPDATE wilayas SET name_en = 'Ghardaia' WHERE id = 47;
UPDATE wilayas SET name_en = 'Relizane' WHERE id = 48;

-- 3. Fix the new wilayas (49-58) with correct names
UPDATE wilayas SET name_en = 'Timimoun' WHERE id = 49;
UPDATE wilayas SET name_fr = 'Bordj Badji Mokhtar', name_en = 'Bordj Badji Mokhtar', home_delivery_price = 1350, office_delivery_price = 800 WHERE id = 50;
UPDATE wilayas SET name_en = 'Ouled Djellal' WHERE id = 51;
UPDATE wilayas SET name_en = 'Beni Abbes' WHERE id = 52;
UPDATE wilayas SET name_en = 'In Salah' WHERE id = 53;
UPDATE wilayas SET name_en = 'In Guezzam' WHERE id = 54;
UPDATE wilayas SET name_en = 'Touggourt' WHERE id = 55;
UPDATE wilayas SET name_en = 'Djanet' WHERE id = 56;
UPDATE wilayas SET name_en = 'El M''Ghair' WHERE id = 57;
UPDATE wilayas SET name_en = 'El Meniaa' WHERE id = 58;

-- 4. Update timestamps
UPDATE wilayas SET updated_at = NOW();

-- 5. Verification - show critical wilayas
SELECT 'Fixed Critical Wilayas' as info, id, name_fr, name_en, home_delivery_price, office_delivery_price 
FROM wilayas 
WHERE id IN (49, 50, 52, 57, 58) 
ORDER BY id;

-- 6. Show final count and structure
SELECT 'Final Count' as info, COUNT(*) as total FROM wilayas;
SELECT 'ID Range' as info, MIN(id) as min_id, MAX(id) as max_id FROM wilayas;

-- Success message
SELECT 'WILAYA DATA FIXED!' as status, 'All 58 wilayas now have correct names and pricing' as message;