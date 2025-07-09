// Test script to verify Ecotrack integration setup
const ecotrackService = require('./src/services/ecotrackService');

console.log('🧪 Testing Ecotrack Service Configuration...\n');

// Test 1: Credential validation
console.log('1. Checking credential validation...');
const isValid = ecotrackService.validateCredentials();
console.log(`   Credentials valid: ${isValid ? '✅' : '❌'}\n`);

// Test 2: Service configuration
console.log('2. Service configuration:');
console.log(`   Base URL: ${ecotrackService.baseURL}`);
console.log(`   API Key: ${ecotrackService.apiKey ? '✅ Set' : '❌ Missing'}`);
console.log(`   GUID: ${ecotrackService.guid ? '✅ Set' : '❌ Missing'}`);
console.log(`   Token: ${ecotrackService.token ? '✅ Set' : '❌ Missing'}\n`);

// Test 3: Headers configuration
console.log('3. HTTP Client headers:');
const headers = ecotrackService.client.defaults.headers;
console.log(`   Authorization: ${headers.Authorization ? '✅ Set' : '❌ Missing'}`);
console.log(`   X-Ecotrack-GUID: ${headers['X-Ecotrack-GUID'] ? '✅ Set' : '❌ Missing'}`);
console.log(`   X-Ecotrack-Token: ${headers['X-Ecotrack-Token'] ? '✅ Set' : '❌ Missing'}`);
console.log(`   Content-Type: ${headers['Content-Type']}\n`);

console.log('🎯 Setup Instructions:');
console.log('1. Copy .env.example to .env');
console.log('2. Set your Ecotrack credentials:');
console.log('   - ECOTRACK_API_KEY=your_api_key');
console.log('   - ECOTRACK_GUID=your_guid');
console.log('   - ECOTRACK_TOKEN=your_token');
console.log('3. Restart the server\n');

console.log('📝 Test completed!');
