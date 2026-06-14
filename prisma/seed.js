const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database roommates...');

  // Truncate tables in dependency order to avoid foreign key constraint errors
  await prisma.expenseShare.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.importAnomaly.deleteMany();
  await prisma.user.deleteMany();

  const roommates = [
    { name: 'Aisha', passcode: '1234' },
    { name: 'Rohan', passcode: '1234' },
    { name: 'Priya', passcode: '1234' },
    { name: 'Meera', passcode: '1234', moveOutDate: new Date('2026-03-31T00:00:00Z') },
    { name: 'Sam', passcode: '1234', moveInDate: new Date('2026-04-15T00:00:00Z') },
    { name: 'Dev', passcode: '1234' },
    { name: 'Kabir', passcode: '1234' }
  ];

  for (const r of roommates) {
    await prisma.user.create({
      data: r
    });
  }

  console.log('Seed completed. Roommates loaded:');
  const dbUsers = await prisma.user.findMany();
  console.log(dbUsers.map(u => u.name).join(', '));
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
