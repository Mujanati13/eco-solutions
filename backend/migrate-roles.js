#!/usr/bin/env node

const MultiRolePermissionMigration = require('./migrations/add_multi_role_permissions');

async function runMigration() {
  console.log('🚀 Starting multi-role and permission migration...');
  
  try {
    await MultiRolePermissionMigration.up();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function rollbackMigration() {
  console.log('🔄 Rolling back multi-role and permission migration...');
  
  try {
    await MultiRolePermissionMigration.down();
    console.log('✅ Rollback completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

// Check command line arguments
const command = process.argv[2];

if (command === 'rollback') {
  rollbackMigration();
} else {
  runMigration();
}
