const axios = require('axios');

async function testPerformanceEndpoint() {
  try {
    // Test without authentication first to see the structure
    const response = await axios.get('http://localhost:5000/api/dashboard/performance?days=30', {
      timeout: 5000,
      validateStatus: function (status) {
        return status < 500; // Resolve only if the status code is less than 500
      }
    });
    
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error testing performance endpoint:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data || error.message);
  }
}

testPerformanceEndpoint();
