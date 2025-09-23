-- VPS Simple Wilaya Update (compatible with older MySQL versions)
-- This version uses simple ALTER TABLE statements

-- 1. Create backup table
CREATE TABLE wilayas_backup_simple AS SELECT * FROM wilayas;

-- 2. Try to add pricing columns (ignore errors if they exist)
-- Run these one by one, ignore error 1060 (Duplicate column name)
ALTER TABLE wilayas ADD COLUMN home_delivery_price DECIMAL(8,2) DEFAULT 0;
ALTER TABLE wilayas ADD COLUMN office_delivery_price DECIMAL(8,2) DEFAULT 0;
ALTER TABLE wilayas ADD COLUMN pickup_delivery_price DECIMAL(8,2) DEFAULT 0;
ALTER TABLE wilayas ADD COLUMN express_delivery_price DECIMAL(8,2) DEFAULT 0;

-- 3. Update all wilaya records with pricing data
UPDATE wilayas SET name_fr = 'Adrar', name_ar = 'أدرار', home_delivery_price = 1150, office_delivery_price = 750, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 1;
UPDATE wilayas SET name_fr = 'Chlef', name_ar = 'الشلف', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 2;
UPDATE wilayas SET name_fr = 'Laghouat', name_ar = 'الأغواط', home_delivery_price = 750, office_delivery_price = 450, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 3;
UPDATE wilayas SET name_fr = 'Oum El Bouaghi', name_ar = 'أم البواقي', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 4;
UPDATE wilayas SET name_fr = 'Batna', name_ar = 'باتنة', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 5;
UPDATE wilayas SET name_fr = 'Béjaïa', name_ar = 'بجاية', home_delivery_price = 580, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 6;
UPDATE wilayas SET name_fr = 'Biskra', name_ar = 'بسكرة', home_delivery_price = 750, office_delivery_price = 450, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 7;
UPDATE wilayas SET name_fr = 'Béchar', name_ar = 'بشار', home_delivery_price = 900, office_delivery_price = 550, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 8;
UPDATE wilayas SET name_fr = 'Blida', name_ar = 'البليدة', home_delivery_price = 500, office_delivery_price = 300, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 9;
UPDATE wilayas SET name_fr = 'Bouira', name_ar = 'البويرة', home_delivery_price = 500, office_delivery_price = 300, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 10;
UPDATE wilayas SET name_fr = 'Tamanrasset', name_ar = 'تمنراست', home_delivery_price = 1550, office_delivery_price = 1150, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 11;
UPDATE wilayas SET name_fr = 'Tébessa', name_ar = 'تبسة', home_delivery_price = 650, office_delivery_price = 400, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 12;
UPDATE wilayas SET name_fr = 'Tlemcen', name_ar = 'تلمسان', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 13;
UPDATE wilayas SET name_fr = 'Tiaret', name_ar = 'تيارت', home_delivery_price = 650, office_delivery_price = 400, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 14;
UPDATE wilayas SET name_fr = 'Tizi Ouzou', name_ar = 'تيزي وزو', home_delivery_price = 500, office_delivery_price = 300, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 15;
UPDATE wilayas SET name_fr = 'Alger', name_ar = 'الجزائر', home_delivery_price = 500, office_delivery_price = 300, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 16;
UPDATE wilayas SET name_fr = 'Djelfa', name_ar = 'الجلفة', home_delivery_price = 750, office_delivery_price = 450, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 17;
UPDATE wilayas SET name_fr = 'Jijel', name_ar = 'جيجل', home_delivery_price = 550, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 18;
UPDATE wilayas SET name_fr = 'Sétif', name_ar = 'سطيف', home_delivery_price = 450, office_delivery_price = 250, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 19;
UPDATE wilayas SET name_fr = 'Saïda', name_ar = 'سعيدة', home_delivery_price = 650, office_delivery_price = 400, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 20;
UPDATE wilayas SET name_fr = 'Skikda', name_ar = 'سكيكدة', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 21;
UPDATE wilayas SET name_fr = 'Sidi Bel Abbès', name_ar = 'سيدي بلعباس', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 22;
UPDATE wilayas SET name_fr = 'Annaba', name_ar = 'عنابة', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 23;
UPDATE wilayas SET name_fr = 'Guelma', name_ar = 'قالمة', home_delivery_price = 650, office_delivery_price = 400, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 24;
UPDATE wilayas SET name_fr = 'Constantine', name_ar = 'قسنطينة', home_delivery_price = 550, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 25;
UPDATE wilayas SET name_fr = 'Médéa', name_ar = 'المدية', home_delivery_price = 570, office_delivery_price = 300, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 26;
UPDATE wilayas SET name_fr = 'Mostaganem', name_ar = 'مستغانم', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 27;
UPDATE wilayas SET name_fr = 'M''Sila', name_ar = 'المسيلة', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 28;
UPDATE wilayas SET name_fr = 'Mascara', name_ar = 'معسكر', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 29;
UPDATE wilayas SET name_fr = 'Ouargla', name_ar = 'ورقلة', home_delivery_price = 850, office_delivery_price = 500, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 30;
UPDATE wilayas SET name_fr = 'Oran', name_ar = 'وهران', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 31;
UPDATE wilayas SET name_fr = 'El Bayadh', name_ar = 'البيض', home_delivery_price = 900, office_delivery_price = 550, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 32;
UPDATE wilayas SET name_fr = 'Illizi', name_ar = 'إليزي', home_delivery_price = 1550, office_delivery_price = 1150, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 33;
UPDATE wilayas SET name_fr = 'Bordj Bou Arreridj', name_ar = 'برج بوعريريج', home_delivery_price = 500, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 34;
UPDATE wilayas SET name_fr = 'Boumerdès', name_ar = 'بومرداس', home_delivery_price = 500, office_delivery_price = 300, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 35;
UPDATE wilayas SET name_fr = 'El Tarf', name_ar = 'الطارف', home_delivery_price = 650, office_delivery_price = 400, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 36;
UPDATE wilayas SET name_fr = 'Tindouf', name_ar = 'تندوف', home_delivery_price = 1350, office_delivery_price = 800, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 37;
UPDATE wilayas SET name_fr = 'Tissemsilt', name_ar = 'تيسمسيلت', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 38;
UPDATE wilayas SET name_fr = 'El Oued', name_ar = 'الوادي', home_delivery_price = 850, office_delivery_price = 500, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 39;
UPDATE wilayas SET name_fr = 'Khenchela', name_ar = 'خنشلة', home_delivery_price = 650, office_delivery_price = 400, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 40;
UPDATE wilayas SET name_fr = 'Souk Ahras', name_ar = 'سوق أهراس', home_delivery_price = 650, office_delivery_price = 400, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 41;
UPDATE wilayas SET name_fr = 'Tipaza', name_ar = 'تيبازة', home_delivery_price = 550, office_delivery_price = 300, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 42;
UPDATE wilayas SET name_fr = 'Mila', name_ar = 'ميلة', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 43;
UPDATE wilayas SET name_fr = 'Aïn Defla', name_ar = 'عين الدفلى', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 44;
UPDATE wilayas SET name_fr = 'Naâma', name_ar = 'النعامة', home_delivery_price = 900, office_delivery_price = 550, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 45;
UPDATE wilayas SET name_fr = 'Aïn Témouchent', name_ar = 'عين تموشنت', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 46;
UPDATE wilayas SET name_fr = 'Ghardaïa', name_ar = 'غرداية', home_delivery_price = 850, office_delivery_price = 500, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 47;
UPDATE wilayas SET name_fr = 'Relizane', name_ar = 'غليزان', home_delivery_price = 600, office_delivery_price = 350, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 48;
UPDATE wilayas SET name_fr = 'Timimoun', name_ar = 'تيميمون', home_delivery_price = 1150, office_delivery_price = 750, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 49;
UPDATE wilayas SET name_fr = 'Ouled Djellal', name_ar = 'أولاد جلال', home_delivery_price = 750, office_delivery_price = 450, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 51;
UPDATE wilayas SET name_fr = 'Beni Abbes', name_ar = 'بني عباس', home_delivery_price = 900, office_delivery_price = 0, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 52;
UPDATE wilayas SET name_fr = 'In Salah', name_ar = 'عين صالح', home_delivery_price = 1450, office_delivery_price = 950, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 53;
UPDATE wilayas SET name_fr = 'In Guezzam', name_ar = 'عين قزام', home_delivery_price = 1550, office_delivery_price = 1150, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 54;
UPDATE wilayas SET name_fr = 'Touggourt', name_ar = 'تقرت', home_delivery_price = 850, office_delivery_price = 500, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 55;
UPDATE wilayas SET name_fr = 'Djanet', name_ar = 'جانت', home_delivery_price = 1550, office_delivery_price = 1150, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 56;
UPDATE wilayas SET name_fr = 'El M''Ghair', name_ar = 'المغير', home_delivery_price = 850, office_delivery_price = 0, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 57;
UPDATE wilayas SET name_fr = 'El Meniaa', name_ar = 'المنيعة', home_delivery_price = 850, office_delivery_price = 500, pickup_delivery_price = 300, express_delivery_price = 300, updated_at = NOW() WHERE id = 58;

-- 4. Insert missing wilayas if they don't exist
INSERT IGNORE INTO wilayas (id, code, name_fr, name_ar, name_en, home_delivery_price, office_delivery_price, pickup_delivery_price, express_delivery_price, is_active, created_at, updated_at) VALUES (54, '54', 'In Guezzam', 'عين قزام', 'In Guezzam', 1550, 1150, 300, 300, 1, NOW(), NOW());
INSERT IGNORE INTO wilayas (id, code, name_fr, name_ar, name_en, home_delivery_price, office_delivery_price, pickup_delivery_price, express_delivery_price, is_active, created_at, updated_at) VALUES (56, '56', 'Djanet', 'جانت', 'Djanet', 1550, 1150, 300, 300, 1, NOW(), NOW());

-- 5. Fix any El M'Ghair orders that might have wrong wilaya_id
UPDATE orders SET wilaya_id = 57, updated_at = NOW() 
WHERE (customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%' OR baladia_name LIKE '%M''Ghair%' OR baladia_name LIKE '%Mghair%' OR baladia_name LIKE '%المغير%') 
AND wilaya_id != 57;

-- 6. Verification queries
SELECT 'Wilaya Count' as check_type, COUNT(*) as count FROM wilayas;
SELECT 'Critical Wilayas' as check_type, id, name_fr, home_delivery_price, office_delivery_price FROM wilayas WHERE id IN (52, 53, 55, 57, 58);
SELECT 'El M''Ghair Orders' as check_type, COUNT(*) as count FROM orders WHERE (customer_city LIKE '%M''Ghair%' OR baladia_name LIKE '%M''Ghair%') AND wilaya_id = 57;