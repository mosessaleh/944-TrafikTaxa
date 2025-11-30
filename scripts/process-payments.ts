#!/usr/bin/env node

/**
 * Payment Processing Cron Job
 * This script should be run periodically (e.g., every 15 minutes) to process
 * completed trip payments.
 *
 * Usage:
 * - Manual run: node scripts/process-payments.js
 * - Cron job: Add to crontab - *\/15 * * * * \/path\/to\/node \/path\/to\/scripts\/process-payments.js
 */

const { processCompletedTripPayments, retryFailedPayments } = require('../lib/payment-processor');

async function main() {
  console.log(`[${new Date().toISOString()}] Starting payment processing...`);

  try {
    // Process completed trip payments
    console.log('Processing completed trip payments...');
    const results = await processCompletedTripPayments();

    console.log(`Payment processing completed:`);
    console.log(`- Processed: ${results.processed}`);
    console.log(`- Successful: ${results.successful}`);
    console.log(`- Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('Errors encountered:');
      results.errors.forEach((error: string) => console.log(`  - ${error}`));
    }

    // Process retry payments (optional - can be run less frequently)
    if (process.argv.includes('--retry')) {
      console.log('Processing failed payment retries...');
      const retryResults = await retryFailedPayments();

      console.log(`Retry processing completed:`);
      console.log(`- Retried: ${retryResults.retried}`);
      console.log(`- Successful: ${retryResults.successful}`);
      console.log(`- Still failed: ${retryResults.stillFailed}`);
    }

    console.log(`[${new Date().toISOString()}] Payment processing finished successfully`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Payment processing failed:`, error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main };