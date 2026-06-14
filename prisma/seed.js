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

  for (const r of roommates) {
    const existing = await prisma.user.findUnique({
      where: { name: r.name }
    });

    if (!existing) {
      await prisma.user.create({
        data: r
      });
      console.log(`Created roommate: ${r.name}`);
    } else {
      console.log(`Roommate already exists: ${r.name}`);
    }
  }

  console.log('Seed check complete.');
  const dbUsers = await prisma.user.findMany();
  console.log('Active Roommates:', dbUsers.map(u => u.name).join(', '));
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

