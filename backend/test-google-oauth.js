const googleAuthService = require('./src/services/googleAuth');

console.log('Testing Google Auth Configuration...');
console.log('================================');

// Check environment variables
console.log('Environment Variables:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || '✗ Missing');

// Test auth URL generation
try {
  const authUrl = googleAuthService.generateAuthUrl('123');
  console.log('\nAuth URL Generation: ✓ Success');
  console.log('Auth URL:', authUrl);
} catch (error) {
  console.log('\nAuth URL Generation: ✗ Failed');
  console.log('Error:', error.message);
}

console.log('\n================================');
console.log('Next Steps:');
console.log('1. Set up Google Cloud Console project');
console.log('2. Enable Google Sheets API and Google Drive API');
console.log('3. Create OAuth2 credentials');
console.log('4. Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
console.log('5. Make sure redirect URI matches: http://localhost:5000/api/google/auth/google/callback');
