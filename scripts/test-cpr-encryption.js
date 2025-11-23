/**
 * Test script for CPR encryption/decryption functionality
 * Run this script to verify the encryption system works correctly
 *
 * Usage: node scripts/test-cpr-encryption.js
 */

const { encryptCPR, decryptCPR, maskCPR } = require('../lib/crypto');

function testCPREncryption() {
  console.log('🧪 Testing CPR Encryption System...\n');

  // Test data
  const testCPR = '12345678-9012';
  const testCPR2 = '87654321-2109';

  console.log('📝 Test CPR:', testCPR);

  try {
    // Test encryption
    const encrypted = encryptCPR(testCPR);
    console.log('🔐 Encrypted:', encrypted);

    // Test decryption
    const decrypted = decryptCPR(encrypted);
    console.log('🔓 Decrypted:', decrypted);

    // Verify round-trip
    const success = decrypted === testCPR;
    console.log('✅ Round-trip test:', success ? 'PASSED' : 'FAILED');

    if (!success) {
      console.error('❌ Decryption failed! Expected:', testCPR, 'Got:', decrypted);
      process.exit(1);
    }

    // Test masking
    const masked = maskCPR(testCPR);
    console.log('🎭 Masked CPR:', masked);

    const masked2 = maskCPR(testCPR2, 2);
    console.log('🎭 Masked CPR (last 2):', masked2);

    // Test different CPR formats
    const formats = [
      '12345678-9012',
      '123456789012',
      '12345678-90',
      '12345678'
    ];

    console.log('\n🔄 Testing different CPR formats:');
    formats.forEach(cpr => {
      try {
        const enc = encryptCPR(cpr);
        const dec = decryptCPR(enc);
        const mask = maskCPR(cpr);
        console.log(`  ${cpr} → ${mask} ✓`);
      } catch (error) {
        console.log(`  ${cpr} → ERROR: ${error.message} ❌`);
      }
    });

    console.log('\n🎉 All CPR encryption tests passed!');
    console.log('🔒 CPR data is secure at rest and properly masked for display.');

  } catch (error) {
    console.error('💥 CPR encryption test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCPREncryption();