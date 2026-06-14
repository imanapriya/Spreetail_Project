const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database roommates (non-destructive)...');

  const roommates = [
    { name: 'Aisha', passcode: '1234' },
    { name: 'Rohan', passcode: '1234' },
    { name: 'Priya', passcode: '1234' },
    { name: 'Meera', passcode: '1234', moveOutDate: new Date('2026-03-31T00:00:00Z') },
    { name: 'Sam', passcode: '1234', moveInDate: new Date('2026-04-15T00:00:00Z') },
    { name: 'Dev', passcode: '1234' },
    { name: 'Kabir', passcode: '1234' }
  ];

  for (const roommate of roommates) {
    await prisma.user.upsert({
      where: { name: roommate.name },
      update: {},
      create: roommate
    });

    console.log(`Checked roommate: ${roommate.name}`);
  }

  const dbUsers = await prisma.user.findMany();

  console.log('Seed completed.');
  console.log(`Total users: ${dbUsers.length}`);
  console.log(
    'Active Roommates:',
    dbUsers.map((u) => u.name).join(', ')
  );
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


