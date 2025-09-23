# VPS Wilaya Correction Deployment Guide

## 📋 Prerequisites

1. **Node.js** installed on your VPS
2. **MySQL/MariaDB** access credentials
3. **SSH access** to your VPS
4. **Database backup** recommended before running

## 🚀 Deployment Steps

### Step 1: Upload the Script to Your VPS

```bash
# Option A: Direct file upload (if you have the file locally)
scp vps-wilaya-correction.js your_user@your_vps_ip:/path/to/your/app/

# Option B: Create the file directly on VPS
ssh your_user@your_vps_ip
cd /path/to/your/app/
nano vps-wilaya-correction.js
# Copy and paste the script content
```

### Step 2: Install Dependencies

```bash
# On your VPS, navigate to your app directory
cd /path/to/your/app/

# Install required packages if not already installed
npm install mysql2 dotenv
```

### Step 3: Configure Environment Variables

```bash
# Create or update your .env file
nano .env

# Add or verify these variables:
DB_HOST=localhost
DB_USER=eco_user
DB_PASSWORD=your_database_password
DB_NAME=eco_system
```

### Step 4: Make the Script Executable

```bash
chmod +x vps-wilaya-correction.js
```

### Step 5: Run the Correction Script

```bash
# Run the script
node vps-wilaya-correction.js
```

## 🔍 What the Script Does

1. **🔌 Connects** to your production database
2. **💾 Creates backup** of current wilayas table
3. **📊 Analyzes** current state and problematic mappings
4. **🔧 Applies corrections** to wilaya names and mappings
5. **✅ Verifies** all changes were applied correctly
6. **📋 Reports** final status and provides rollback instructions

## 📊 Expected Output

```bash
🚀 VPS Wilaya Correction Script Starting...
============================================================
🔌 Connecting to production database...
📡 Host: localhost
🗄️  Database: eco_system
✅ Database connection established

🔍 Analyzing current wilaya state...
📋 Current problematic wilaya mappings:
   ID: 50 = Ouled Djellal (أولاد جلال)
   ID: 51 = Ouled Djellal (أولاد جلال)
   ID: 52 = Beni Abbes (بني عباس)
   ...

💾 Creating backup of current wilayas table...
✅ Backup created: wilayas_backup_1693747200000 (58 records)

🔧 Applying wilaya corrections...
🔧 Updating wilaya 50:
   From: Ouled Djellal (أولاد جلال)
   To:   Bordj Badji Mokhtar (برج باجي مختار)
...

✅ Corrections applied: 8 updated, 0 inserted

🔍 Verifying corrections...
📋 Corrected wilaya mappings:
   ID: 50 = Bordj Badji Mokhtar (برج باجي مختار)
   ID: 51 = Ouled Djellal (أولاد جلال)
   ...

🔍 Critical mapping verification:
   ✅ Wilaya 56: Djanet (correct)
   ✅ Wilaya 57: El M'Ghair (correct)

🔍 Order assignment verification:
   El M'Ghair orders: 1 orders in wilaya_id = 57 ✅
   Djanet orders: 5 orders in wilaya_id = 56 ✅

============================================================
🎉 WILAYA CORRECTION COMPLETED SUCCESSFULLY!

✅ Benefits achieved:
   • Ecotrack API errors resolved
   • Accurate wilaya mappings
   • Improved delivery processing
   • Data consistency with official structure
```

## 🔄 Rollback Instructions

If anything goes wrong, you can rollback using the backup:

```sql
-- Connect to your database
mysql -u eco_user -p eco_system

-- Rollback commands (use the actual backup table name from output)
DROP TABLE IF EXISTS wilayas_old;
RENAME TABLE wilayas TO wilayas_old;
RENAME TABLE wilayas_backup_1693747200000 TO wilayas;
```

## 🚨 Safety Features

- ✅ **Automatic backup** before any changes
- ✅ **Verification steps** to ensure correctness
- ✅ **Rollback instructions** provided
- ✅ **No data loss** - only updates existing records
- ✅ **Connection safety** - script fails safely if DB issues

## 🐛 Troubleshooting

### Connection Error
```bash
❌ Database connection failed: Access denied for user 'eco_user'@'localhost'
```
**Solution**: Check your database credentials in .env file

### Permission Error
```bash
❌ Error: ER_ACCESS_DENIED_ERROR
```
**Solution**: Ensure your database user has UPDATE/INSERT permissions on wilayas table

### Missing Dependencies
```bash
Error: Cannot find module 'mysql2'
```
**Solution**: Run `npm install mysql2 dotenv`

## 📞 Support

If you encounter any issues:

1. **Check the backup** was created successfully
2. **Review the verification output** for any warnings
3. **Contact support** with the full script output
4. **Use rollback** if needed for safety

---

**⚠️ Important**: Always test on a staging environment first if possible!