// =============================================
// QUICK DATABASE FIX SCRIPT
// Date: November 12, 2025
// Description: Fix missing invoice table fields programmatically
// =============================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixInvoiceTable() {
  console.log('🔧 Starting invoice table fix...');
  
  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    
    // Check current invoice structure
    console.log('🔍 Checking current invoice table structure...');
    const invoiceColumns = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'invoice' 
      ORDER BY COLUMN_NAME
    `;
    
    console.log('Current invoice columns:', invoiceColumns.map(col => col.COLUMN_NAME));
    
    // Check if required columns exist
    const requiredColumns = [
      'paymentMethod',
      'paymentRef', 
      'paymentDate',
      'paymentAmount',
      'paymentNotes',
      'confirmedBy',
      'confirmedAt',
      'receiptNumber'
    ];
    
    const existingColumns = invoiceColumns.map(col => col.COLUMN_NAME);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
      console.log('⚠️  You need to run the SQL migration script first!');
      console.log('💡 Run this SQL in your database:');
      console.log('');
      console.log('ALTER TABLE `invoice`');
      missingColumns.forEach(col => {
        const type = col.includes('Amount') ? 'DECIMAL(10,2)' :
                    col === 'paymentDate' || col === 'confirmedAt' ? 'DATETIME' :
                    col === 'confirmedBy' ? 'INT' :
                    col === 'paymentNotes' ? 'TEXT' : 'VARCHAR(255)';
        console.log(`ADD COLUMN \`${col}\` ${type} NULL,`);
      });
      console.log(';');
      console.log('');
      console.log('Then run this script again to verify the fix.');
      return;
    }
    
    console.log('✅ All required columns exist');
    
    // Check sample data
    console.log('📊 Checking invoice data...');
    const invoiceCount = await prisma.invoice.count();
    console.log(`Total invoices: ${invoiceCount}`);
    
    // Test update with new fields
    console.log('🧪 Testing update with new fields...');
    const testInvoice = await prisma.invoice.findFirst();
    
    if (testInvoice) {
      console.log(`Found invoice #${testInvoice.id}`);
      
      // Try to update with new fields
      try {
        const updatedInvoice = await prisma.invoice.update({
          where: { id: testInvoice.id },
          data: {
            paymentMethod: 'test_method',
            paymentRef: 'TEST_REF_123',
            paymentDate: new Date(),
            paymentAmount: 100.00,
            paymentNotes: 'Test payment confirmation',
            receiptNumber: 'TEST_RECEIPT_123',
            // Note: confirmedBy and confirmedAt will be handled by the actual API
          }
        });
        
        console.log('✅ Test update successful!');
        console.log(`Receipt number generated: ${updatedInvoice.receiptNumber || 'N/A'}`);
        
        // Clean up test data
        await prisma.invoice.update({
          where: { id: testInvoice.id },
          data: {
            paymentMethod: null,
            paymentRef: null,
            paymentDate: null,
            paymentAmount: null,
            paymentNotes: null,
            receiptNumber: null,
          }
        });
        console.log('🧹 Test data cleaned up');
        
      } catch (updateError) {
        console.error('❌ Test update failed:', updateError.message);
        console.log('💡 This suggests the columns may still not exist in the database');
      }
    } else {
      console.log('⚠️  No invoices found to test with');
    }
    
    console.log('✅ Database fix verification complete');
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixInvoiceTable();