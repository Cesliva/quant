/**
 * Quick script to call the setup-beta-access API
 */

const http = require('http');

const data = JSON.stringify({
  enabled: false,
  codes: ["BETA2024", "QUANT2024", "STEEL2024"],
  message: "Beta access code is required. Please contact support for access."
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/setup-beta-access',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Calling setup API...');
console.log('Config:', JSON.stringify(JSON.parse(data), null, 2));
console.log('');

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(responseData);
      console.log('✅ Success! Beta access configuration created.');
      console.log('');
      console.log('Configuration:');
      console.log(JSON.stringify(result.config, null, 2));
      console.log('');
      console.log('Beta codes to share:', result.config.codes.join(', '));
    } else {
      console.error('❌ Error:', res.statusCode);
      try {
        const error = JSON.parse(responseData);
        console.error('Message:', error.error || error.message);
      } catch (e) {
        console.error('Response:', responseData);
      }
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('');
  console.error('Make sure:');
  console.error('  1. Your dev server is running: npm run dev');
  console.error('  2. Server is accessible at http://localhost:3000');
  process.exit(1);
});

req.write(data);
req.end();

