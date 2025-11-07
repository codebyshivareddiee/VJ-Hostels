const axios = require('axios');

const SERVER_URL = 'http://localhost:6201';

async function testEndpoints() {
    console.log('🔍 Testing QR Scanner Endpoints...\n');

    // Test 1: Health check
    try {
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${SERVER_URL}/outpass-api/health`);
        console.log('✅ Health check passed:', healthResponse.data);
    } catch (error) {
        console.log('❌ Health check failed:', error.response?.data || error.message);
    }

    // Test 2: Verify QR with invalid data
    try {
        console.log('\n2. Testing verify-qr with invalid data...');
        const verifyResponse = await axios.post(`${SERVER_URL}/outpass-api/verify-qr`, {
            qrCodeData: 'invalid-qr-code-data'
        });
        console.log('Response:', verifyResponse.data);
    } catch (error) {
        console.log('Expected error for invalid QR:', error.response?.status, error.response?.data?.message);
    }

    // Test 3: Verify QR with missing data
    try {
        console.log('\n3. Testing verify-qr with missing data...');
        const verifyResponse = await axios.post(`${SERVER_URL}/outpass-api/verify-qr`, {});
        console.log('Response:', verifyResponse.data);
    } catch (error) {
        console.log('Expected error for missing data:', error.response?.status, error.response?.data?.message);
    }

    // Test 4: Get active passes
    try {
        console.log('\n4. Testing active-passes endpoint...');
        const activeResponse = await axios.get(`${SERVER_URL}/outpass-api/active-passes`);
        console.log('✅ Active passes:', activeResponse.data.activePasses?.length || 0, 'passes found');
    } catch (error) {
        console.log('❌ Active passes failed:', error.response?.data || error.message);
    }

    console.log('\n🏁 Test completed!');
}

// Run the tests
testEndpoints().catch(console.error);