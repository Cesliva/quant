/**
 * Script to set up CORS for Firebase Storage
 * 
 * This script helps configure CORS for Firebase Storage to allow
 * file uploads from localhost and production domains.
 * 
 * Prerequisites:
 * 1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
 * 2. Run: gcloud auth login
 * 3. Set your project: gcloud config set project YOUR_PROJECT_ID
 * 
 * Usage:
 * node scripts/setup-storage-cors.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read environment variables (try dotenv if available, otherwise read .env.local directly)
let projectId, storageBucket;
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
} catch (error) {
  // If dotenv is not available, try reading .env.local directly
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    envLines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID') projectId = value;
        if (key === 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') storageBucket = value;
      }
    });
  }
}

const corsConfigPath = path.join(__dirname, '..', 'storage-cors.json');

function checkPrerequisites() {
  console.log('Checking prerequisites...\n');
  
  // Check if gsutil is installed
  try {
    execSync('gsutil --version', { stdio: 'ignore' });
    console.log('✓ gsutil is installed');
  } catch (error) {
    console.error('✗ gsutil is not installed');
    console.error('\nPlease install Google Cloud SDK:');
    console.error('https://cloud.google.com/sdk/docs/install\n');
    process.exit(1);
  }

  // Check if CORS config file exists
  if (!fs.existsSync(corsConfigPath)) {
    console.error(`✗ CORS config file not found: ${corsConfigPath}`);
    console.error('Please create storage-cors.json first.\n');
    process.exit(1);
  }
  console.log('✓ CORS config file exists');

  // Check environment variables
  if (!projectId) {
    console.error('✗ NEXT_PUBLIC_FIREBASE_PROJECT_ID not found in .env.local');
    process.exit(1);
  }
  console.log(`✓ Project ID: ${projectId}`);

  if (!storageBucket) {
    console.error('✗ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not found in .env.local');
    process.exit(1);
  }
  console.log(`✓ Storage Bucket: ${storageBucket}\n`);
}

function setCors() {
  console.log('Setting CORS configuration...\n');
  
  try {
    const command = `gsutil cors set "${corsConfigPath}" "gs://${storageBucket}"`;
    console.log(`Running: ${command}\n`);
    
    execSync(command, { stdio: 'inherit' });
    
    console.log('\n✓ CORS configuration applied successfully!\n');
    
    // Verify the configuration
    console.log('Verifying CORS configuration...\n');
    const verifyCommand = `gsutil cors get "gs://${storageBucket}"`;
    execSync(verifyCommand, { stdio: 'inherit' });
    
    console.log('\n✓ CORS setup complete!');
    console.log('\nNext steps:');
    console.log('1. Restart your development server');
    console.log('2. Try uploading an avatar in the profile page');
    console.log('3. Check the browser console - CORS errors should be gone\n');
    
  } catch (error) {
    console.error('\n✗ Failed to set CORS configuration');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you\'re logged in: gcloud auth login');
    console.error('2. Set your project: gcloud config set project', projectId);
    console.error('3. Check that the bucket name is correct:', storageBucket);
    process.exit(1);
  }
}

// Main execution
console.log('========================================');
console.log('Firebase Storage CORS Setup');
console.log('========================================\n');

checkPrerequisites();
setCors();
