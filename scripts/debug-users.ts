import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Debugging Users & Accounts ---');

  const targetEmails = ['info@mammajumboshrimp.com', 'acquah@mammajumboshrimp.com'];

  for (const email of targetEmails) {
    console.log(`\nChecking email: [${email}]`);
    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (!user) {
      console.log(`  -> User NOT FOUND.`);
    } else {
      console.log(`  -> User FOUND:`);
      console.log(`     ID: ${user.id}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Name: ${user.name}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Accounts: ${user.accounts.length}`);
      user.accounts.forEach(acc => {
        console.log(`       - Provider: ${acc.provider}`);
        console.log(`       - ProviderAccountId: ${acc.providerAccountId}`);
      });
    }
  }
  console.log('\n--- End Debugging ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


