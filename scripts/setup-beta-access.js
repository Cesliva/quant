/**
 * Setup Beta Access Configuration Script
 * 
 * This script initializes the beta access configuration in Firebase.
 * 
 * Usage:
 *   node scripts/setup-beta-access.js
 * 
 * Or with custom config:
 *   node scripts/setup-beta-access.js --enabled=false --codes=BETA2024,QUANT2024
 */

const https = require('https');
const http = require('http');

// Get the API URL from environment or use default
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const endpoint = `${API_URL}/api/setup-beta-access`;

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  enabled: false, // Default: require codes
  codes: ["BETA2024", "QUANT2024", "STEEL2024"],
  message: "Beta access code is required. Please contact support for access.",
};

args.forEach(arg => {
  if (arg.startsWith('--enabled=')) {
    config.enabled = arg.split('=')[1] === 'true';
  } else if (arg.startsWith('--codes=')) {
    config.codes = arg.split('=')[1].split(',');
  } else if (arg.startsWith('--message=')) {
    config.message = arg.split('=')[1];
  }
});

const postData = JSON.stringify(config);

const url = new URL(endpoint);
const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const client = url.protocol === 'https:' ? https : http;

console.log('Setting up beta access configuration...');
console.log('Config:', JSON.stringify(config, null, 2));
console.log('');

const req = client.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log('✅ Success! Beta access configuration created.');
        console.log('');
        console.log('Configuration:');
        console.log(JSON.stringify(response.config, null, 2));
        console.log('');
        console.log('You can now:');
        console.log('  - Share beta codes with testers:', response.config.codes.join(', '));
        console.log('  - Update codes in Firebase Console: /betaAccess/config');
        console.log('  - Disable requirement: Set enabled=true in Firebase');
      } else {
        console.error('❌ Error:', response.error);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  console.error('');
  console.error('Make sure:');
  console.error('  1. Your Next.js server is running');
  console.error('  2. Firebase is configured in .env.local');
  console.error('  3. The API URL is correct:', endpoint);
  process.exit(1);
});

req.write(postData);
req.end();

