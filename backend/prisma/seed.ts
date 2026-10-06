import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { DEFAULT_CIRCUIT_RULES } from '../src/circuit-validation/circuit-rules';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter } as any);

// ---- Test accounts -------------------------------------------------------
// Created in Clerk (development instances only) and mirrored in the users
// table with onboarding already complete. "+clerk_test" addresses are
// Clerk test emails: if Clerk asks for a verification code, use 424242.
// Override the shared password with SEED_TEST_PASSWORD.

const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD ?? 'CogniLab-Test-2026!';
const TEST_INSTITUTION = 'CogniLab University';

const TEST_ACCOUNTS = [
  {
    email: 'instructor+clerk_test@cognilab.dev',
    firstName: 'Test',
    lastName: 'Instructor',
    role: 'INSTRUCTOR',
  },
  {
    email: 'student1+clerk_test@cognilab.dev',
    firstName: 'Test',
    lastName: 'Student One',
    role: 'STUDENT',
  },
  {
    email: 'student2+clerk_test@cognilab.dev',
    firstName: 'Test',
    lastName: 'Student Two',
    role: 'STUDENT',
  },
] as const;

async function seedTestAccounts() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.log('⏭️  CLERK_SECRET_KEY not set: skipping test accounts.');
    return;
  }
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error(
      'Refusing to create test accounts: CLERK_SECRET_KEY is not a development (sk_test_) key.',
    );
  }

  const clerk = createClerkClient({ secretKey });

  for (const account of TEST_ACCOUNTS) {
    const publicMetadata = {
      onboardingComplete: true,
      role: account.role,
      institution: TEST_INSTITUTION,
    };
    const { data: existing } = await clerk.users.getUserList({
      emailAddress: [account.email],
    });
    const clerkUser = existing[0]
      ? await clerk.users.updateUser(existing[0].id, {
          password: TEST_PASSWORD,
          publicMetadata,
        })
      : await clerk.users.createUser({
          emailAddress: [account.email],
          password: TEST_PASSWORD,
          firstName: account.firstName,
          lastName: account.lastName,
          publicMetadata,
        });

    const fullName = `${account.firstName} ${account.lastName}`;
    await prisma.user.upsert({
      where: { email: account.email },
      create: {
        clerkUserId: clerkUser.id,
        email: account.email,
        fullName,
        userType: account.role,
        university: TEST_INSTITUTION,
      },
      update: {
        clerkUserId: clerkUser.id,
        fullName,
        userType: account.role,
        university: TEST_INSTITUTION,
      },
    });
    console.log(
      `👤 ${existing[0] ? 'Updated' : 'Created'} ${account.role.toLowerCase()}: ${account.email}`,
    );
  }
}

async function main() {
  console.log('🌱 Starting seed...');

  await seedTestAccounts();

  // Prefer the seeded instructor, then any instructor, then any user.
  let instructor =
    (await prisma.user.findUnique({
      where: { email: TEST_ACCOUNTS[0].email },
    })) ??
    (await prisma.user.findFirst({
      where: { userType: 'INSTRUCTOR' },
    }));

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

  await seedDemoLab(instructor.id);

  console.log('🎉 Seed completed!');
}

// ---- Demo lab --------------------------------------------------------------
// The worked example from docs/circuit-validation-graph.md: a 12 V supply
// drives R1, then R2 ∥ R3, then an LED, with a voltmeter across R1. The
// instructor's wires are saved, so student circuits are compared with it.

async function findOrCreateEquipment(
  creatorId: string,
  equipmentName: string,
  equipmentType: string,
  defaultConfigJson: Prisma.InputJsonObject | null,
) {
  const existing = await prisma.labEquipment.findFirst({
    where: { creatorId, equipmentName },
  });
  if (existing) return existing;
  return prisma.labEquipment.create({
    data: {
      creatorId,
      equipmentName,
      equipmentType,
      supportsConfiguration: defaultConfigJson !== null,
      defaultConfigJson: defaultConfigJson ?? undefined,
    },
  });
}

async function seedDemoLab(instructorId: string) {
  const labName = 'Demo: LED with series-parallel resistors';
  const module = await prisma.module.findFirst({
    where: { moduleCode: 'EE101' },
  });
  if (!module) return;

  const existing = await prisma.labInstance.findFirst({ where: { labName } });
  if (existing) {
    console.log(`⏭️  Lab already exists: ${labName}`);
    return;
  }

  const supply = await findOrCreateEquipment(
    instructorId,
    'DC Power Supply',
    'Power',
    { voltage: 12 },
  );
  const resistor = await findOrCreateEquipment(
    instructorId,
    'Resistor',
    'Component',
    { resistance: 100 },
  );
  const led = await findOrCreateEquipment(
    instructorId,
    'LED',
    'Component',
    null,
  );
  const voltmeter = await findOrCreateEquipment(
    instructorId,
    'Voltmeter',
    'Instrument',
    null,
  );

  const lab = await prisma.labInstance.create({
    data: {
      instructorId,
      moduleId: module.id,
      labName,
      description:
        'Build the circuit: a 12 V supply drives R1 (100 Ω), then R2 (300 Ω) and R3 (600 Ω) in parallel, then an LED. Connect the voltmeter across R1. Mind the polarity of the LED and the voltmeter.',
      circuitRulesJson: {
        ...DEFAULT_CIRCUIT_RULES,
        allowedTopologies: ['series-parallel'],
        requireStepsCompleted: false,
      },
    },
  });

  const parts: Array<{
    key: string;
    equipmentId: string;
    x: number;
    y: number;
    config: Record<string, number>;
  }> = [
    {
      key: 'V1',
      equipmentId: supply.id,
      x: 0,
      y: 200,
      config: { voltage: 12 },
    },
    {
      key: 'R1',
      equipmentId: resistor.id,
      x: 200,
      y: 60,
      config: { resistance: 100 },
    },
    {
      key: 'R2',
      equipmentId: resistor.id,
      x: 420,
      y: 0,
      config: { resistance: 300 },
    },
    {
      key: 'R3',
      equipmentId: resistor.id,
      x: 420,
      y: 160,
      config: { resistance: 600 },
    },
    { key: 'LED1', equipmentId: led.id, x: 640, y: 80, config: {} },
    { key: 'VM', equipmentId: voltmeter.id, x: 200, y: -120, config: {} },
  ];
  const ids: Record<string, string> = {};
  for (const part of parts) {
    const placement = await prisma.labInstanceEquipment.create({
      data: {
        labId: lab.id,
        equipmentId: part.equipmentId,
        positionX: part.x,
        positionY: part.y,
        positionZ: 0,
        configJson: { name: part.key, ...part.config },
      },
    });
    ids[part.key] = placement.id;
  }

  // [from part, terminal id, to part, terminal id]
  const wires: Array<[string, string, string, string]> = [
    ['V1', 'pos', 'R1', 't1'],
    ['R1', 't2', 'R2', 't1'],
    ['R1', 't2', 'R3', 't1'],
    ['R2', 't2', 'LED1', 'anode'],
    ['R3', 't2', 'LED1', 'anode'],
    ['LED1', 'cathode', 'V1', 'neg'],
    ['VM', 'pos', 'R1', 't1'],
    ['VM', 'com', 'R1', 't2'],
  ];
  await prisma.wireConnection.createMany({
    data: wires.map(([from, sourceHandle, to, targetHandle]) => ({
      labId: lab.id,
      sourceEquipmentId: ids[from],
      targetEquipmentId: ids[to],
      sourceHandle,
      targetHandle,
    })),
  });

  await prisma.experimentStep.createMany({
    data: [
      'Place the supply, resistors, LED and voltmeter',
      'Wire R1, then R2 ∥ R3, then the LED across the supply',
      'Connect the voltmeter across R1 (+ towards the supply +)',
    ].map((stepDescription, index) => ({
      labId: lab.id,
      stepNumber: index + 1,
      stepDescription,
    })),
  });

  console.log(`✅ Created lab: ${labName}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
