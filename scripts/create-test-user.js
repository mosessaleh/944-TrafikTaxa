const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('Creating/updating test user 1...');
    
    // Create/update a test user with ID 1
    const testUser = await prisma.user.upsert({
      where: { id: 1 },
      update: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '+4512345678',
        address: 'Test Address 123',
        canPayByInvoice: true,
      },
      create: {
        id: 1,
        email: 'test@example.com',
        hashedPassword: 'hashed_password_for_test',
        firstName: 'Test',
        lastName: 'User',
        phone: '+4512345678',
        address: 'Test Address 123',
        role: 'USER',
        emailVerified: true,
        canPayByInvoice: true,
      }
    });
    
    console.log('✅ Test user 1 created/updated:', testUser);
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();