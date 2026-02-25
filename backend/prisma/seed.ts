import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Starting seed...');

  // First, check if we have any users to use as instructors
  let instructor = await prisma.user.findFirst({
    where: { userType: 'INSTRUCTOR' },
  });

  // If no instructor exists, create a placeholder one
  if (!instructor) {
    instructor = await prisma.user.findFirst();
  }

  if (!instructor) {
    console.log('⚠️  No users found. Creating a placeholder user...');
    instructor = await prisma.user.create({
      data: {
        clerkUserId: 'seed_user_001',
        email: 'instructor@cognilab.com',
        fullName: 'Seed Instructor',
        userType: 'INSTRUCTOR',
        university: 'CogniLab University',
      },
    });
  }

  console.log(`📚 Using instructor: ${instructor.fullName} (${instructor.id})`);

  // Seed modules
  const modules = [
    {
      moduleName: 'Electronics Fundamentals',
      description:
        'Basic electronics concepts including resistors, capacitors, inductors, and basic circuit analysis.',
      moduleCode: 'EE101',
    },
    {
      moduleName: 'Digital Electronics',
      description:
        'Introduction to digital logic, gates, flip-flops, and combinational circuits.',
      moduleCode: 'EE201',
    },
    {
      moduleName: 'Power Systems',
      description:
        'Study of power generation, transmission, distribution, and power electronics.',
      moduleCode: 'EE301',
    },
    {
      moduleName: 'Control Systems',
      description:
        'Analysis and design of control systems, feedback mechanisms, and stability analysis.',
      moduleCode: 'EE302',
    },
    {
      moduleName: 'Measurements & Instrumentation',
      description:
        'Electronic measurement techniques, oscilloscopes, multimeters, and signal analyzers.',
      moduleCode: 'EE203',
    },
    {
      moduleName: 'Circuit Analysis Lab',
      description:
        'Practical laboratory experiments for circuit analysis and design.',
      moduleCode: 'EE102L',
    },
    {
      moduleName: 'Analog Electronics',
      description:
        'Operational amplifiers, filters, oscillators, and analog signal processing.',
      moduleCode: 'EE202',
    },
    {
      moduleName: 'Renewable Energy Systems',
      description:
        'Solar, wind, and other renewable energy technologies and their integration.',
      moduleCode: 'EE401',
    },
  ];

  for (const moduleData of modules) {
    const existing = await prisma.module.findFirst({
      where: { moduleCode: moduleData.moduleCode },
    });

    if (!existing) {
      await prisma.module.create({
        data: {
          ...moduleData,
          instructorId: instructor.id,
        },
      });
      console.log(`✅ Created module: ${moduleData.moduleName}`);
    } else {
      console.log(`⏭️  Module already exists: ${moduleData.moduleName}`);
    }
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
