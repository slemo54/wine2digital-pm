import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // Hash passwords
  const adminPassword = await bcrypt.hash('johndoe123', 10);
  const testPassword = await bcrypt.hash('Test123!', 10);

  // Create users
  console.log('👥 Creating users...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'john@doe.com',
      password: adminPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: 'admin',
    },
  });

  const user1 = await prisma.user.create({
    data: {
      email: 'mario.rossi@wine2digital.com',
      password: testPassword,
      firstName: 'Mario',
      lastName: 'Rossi',
      role: 'manager',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'giulia.bianchi@wine2digital.com',
      password: testPassword,
      firstName: 'Giulia',
      lastName: 'Bianchi',
      role: 'member',
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: 'luca.verdi@wine2digital.com',
      password: testPassword,
      firstName: 'Luca',
      lastName: 'Verdi',
      role: 'member',
    },
  });

  const user4 = await prisma.user.create({
    data: {
      email: 'sara.ferrari@wine2digital.com',
      password: testPassword,
      firstName: 'Sara',
      lastName: 'Ferrari',
      role: 'member',
    },
  });

  console.log('✅ Created 5 users');

  // Create projects
  console.log('📁 Creating projects...');
  const project1 = await prisma.project.create({
    data: {
      name: 'Wine2Digital Website Redesign',
      description: 'Redesign of the corporate website with modern UX/UI and improved performance',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      status: 'active',
      creatorId: adminUser.id,
      members: {
        create: [
          { userId: adminUser.id, role: 'owner' },
          { userId: user1.id, role: 'member' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'E-commerce Platform Development',
      description: 'Build a scalable e-commerce platform for wine sales with payment integration',
      startDate: new Date('2025-02-01'),
      endDate: new Date('2025-06-30'),
      status: 'active',
      creatorId: user1.id,
      members: {
        create: [
          { userId: user1.id, role: 'owner' },
          { userId: user3.id, role: 'member' },
          { userId: user4.id, role: 'member' },
        ],
      },
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: 'Marketing Campaign Q1 2025',
      description: 'Digital marketing campaign for new product launch',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-04-15'),
      status: 'active',
      creatorId: adminUser.id,
      members: {
        create: [
          { userId: adminUser.id, role: 'owner' },
          { userId: user2.id, role: 'member' },
          { userId: user4.id, role: 'member' },
        ],
      },
    },
  });

  console.log('✅ Created 3 projects');

  // Create tasks for Project 1 (Website Redesign)
  console.log('📝 Creating tasks...');
  
  // TODO tasks
  const task1 = await prisma.task.create({
    data: {
      title: 'Design new homepage mockup',
      description: 'Create high-fidelity mockup for the new homepage design',
      status: 'todo',
      priority: 'high',
      dueDate: new Date('2025-01-20'),
      position: 0,
      projectId: project1.id,
      assignees: {
        create: [{ userId: user2.id }],
      },
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Setup development environment',
      description: 'Configure NextJS project with Tailwind and required dependencies',
      status: 'todo',
      priority: 'high',
      dueDate: new Date('2025-01-18'),
      position: 1,
      projectId: project1.id,
      assignees: {
        create: [{ userId: user1.id }],
      },
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: 'Content strategy document',
      description: 'Define content strategy and sitemap for the new website',
      status: 'todo',
      priority: 'medium',
      dueDate: new Date('2025-01-25'),
      position: 2,
      projectId: project1.id,
    },
  });

  // IN_PROGRESS tasks
  const task4 = await prisma.task.create({
    data: {
      title: 'Implement responsive navigation',
      description: 'Build responsive navigation menu with mobile hamburger',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date('2025-01-22'),
      position: 0,
      projectId: project1.id,
      assignees: {
        create: [{ userId: user1.id }],
      },
    },
  });

  const task5 = await prisma.task.create({
    data: {
      title: 'Optimize images for web',
      description: 'Compress and optimize all images for better performance',
      status: 'in_progress',
      priority: 'medium',
      position: 1,
      projectId: project1.id,
      assignees: {
        create: [{ userId: user2.id }],
      },
    },
  });

  // DONE tasks
  const task6 = await prisma.task.create({
    data: {
      title: 'Research competitor websites',
      description: 'Analyze top 10 competitor websites for design inspiration',
      status: 'done',
      priority: 'medium',
      position: 0,
      projectId: project1.id,
      assignees: {
        create: [{ userId: adminUser.id }],
      },
    },
  });

  const task7 = await prisma.task.create({
    data: {
      title: 'Stakeholder approval meeting',
      description: 'Present initial concepts to stakeholders and gather feedback',
      status: 'done',
      priority: 'high',
      position: 1,
      projectId: project1.id,
      assignees: {
        create: [{ userId: adminUser.id }, { userId: user1.id }],
      },
    },
  });

  // Tasks for Project 2 (E-commerce)
  await prisma.task.create({
    data: {
      title: 'Design product catalog UI',
      description: 'Create design system for product listings and detail pages',
      status: 'todo',
      priority: 'high',
      dueDate: new Date('2025-02-15'),
      position: 0,
      projectId: project2.id,
      assignees: {
        create: [{ userId: user3.id }],
      },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Integrate payment gateway',
      description: 'Implement Stripe payment integration for checkout',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date('2025-02-28'),
      position: 0,
      projectId: project2.id,
      assignees: {
        create: [{ userId: user4.id }],
      },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Database schema design',
      description: 'Design database schema for products, orders, and customers',
      status: 'done',
      priority: 'high',
      position: 0,
      projectId: project2.id,
      assignees: {
        create: [{ userId: user1.id }],
      },
    },
  });

  // Tasks for Project 3 (Marketing Campaign)
  await prisma.task.create({
    data: {
      title: 'Social media content calendar',
      description: 'Create content calendar for Q1 social media posts',
      status: 'todo',
      priority: 'medium',
      dueDate: new Date('2025-01-30'),
      position: 0,
      projectId: project3.id,
      assignees: {
        create: [{ userId: user2.id }],
      },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Design email templates',
      description: 'Create responsive email templates for campaign',
      status: 'in_progress',
      priority: 'medium',
      dueDate: new Date('2025-02-05'),
      position: 0,
      projectId: project3.id,
      assignees: {
        create: [{ userId: user4.id }],
      },
    },
  });

  console.log('✅ Created 12 tasks across all projects');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log('   - 5 users created');
  console.log('   - 3 projects created');
  console.log('   - 12 tasks created');
  console.log('\n🔑 Login credentials:');
  console.log('   Admin: john@doe.com / johndoe123');
  console.log('   User: mario.rossi@wine2digital.com / Test123!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
