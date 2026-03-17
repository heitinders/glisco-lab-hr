import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, Region, EmploymentType, LeaveType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Glisco Lab database...');

  // ─── Company ────────────────────────────────────────────────────────────────
  const company = await db.company.create({
    data: {
      name: 'Glisco Lab',
      legalName: 'Glisco Lab LLC',
      ein: '12-3456789',
      address: {
        street: '123 Broadway',
        city: 'New York',
        state: 'NY',
        zip: '10006',
        country: 'US',
      },
      region: Region.US,
      timezone: 'America/New_York',
      primaryColor: '#4B9EFF',
      fiscalYearStart: 4,
      settings: {
        regions: ['US', 'INDIA'],
        workWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        graceMinutes: 15,
      },
    },
  });
  console.log(`  Created company: ${company.name}`);

  // ─── Departments ────────────────────────────────────────────────────────────
  const departments = await Promise.all([
    db.department.create({
      data: { companyId: company.id, name: 'Engineering', code: 'ENG', budget: 500000 },
    }),
    db.department.create({
      data: { companyId: company.id, name: 'Operations', code: 'OPS', budget: 200000 },
    }),
    db.department.create({
      data: { companyId: company.id, name: 'Marketing', code: 'MKT', budget: 300000 },
    }),
    db.department.create({
      data: { companyId: company.id, name: 'Finance', code: 'FIN', budget: 150000 },
    }),
  ]);
  console.log(`  Created ${departments.length} departments`);

  // ─── Designations & Salary Bands ──────────────────────────────────────────
  const designationData = [
    { title: 'Software Engineer', level: 3, band: 'IC3', us: [90000, 110000, 130000], india: [800000, 1200000, 1600000] },
    { title: 'Senior Software Engineer', level: 4, band: 'IC4', us: [130000, 155000, 180000], india: [1500000, 2200000, 3000000] },
    { title: 'Engineering Manager', level: 5, band: 'M5', us: [160000, 190000, 220000], india: [2500000, 3500000, 4500000] },
    { title: 'Marketing Specialist', level: 3, band: 'IC3', us: [65000, 80000, 95000], india: [500000, 800000, 1100000] },
    { title: 'Operations Coordinator', level: 2, band: 'IC2', us: [50000, 62000, 75000], india: [400000, 600000, 800000] },
  ];

  const designations = [];
  for (const d of designationData) {
    const designation = await db.designation.create({
      data: { companyId: company.id, title: d.title, level: d.level, band: d.band },
    });
    designations.push(designation);

    await db.salaryBand.createMany({
      data: [
        { designationId: designation.id, region: Region.US, currency: 'USD', minSalary: d.us[0], midSalary: d.us[1], maxSalary: d.us[2], effectiveFrom: new Date('2024-01-01') },
        { designationId: designation.id, region: Region.INDIA, currency: 'INR', minSalary: d.india[0], midSalary: d.india[1], maxSalary: d.india[2], effectiveFrom: new Date('2024-01-01') },
      ],
    });
  }
  console.log(`  Created ${designations.length} designations with salary bands`);

  // ─── Admin User (SUPER_ADMIN) ─────────────────────────────────────────────
  const superAdminHash = await bcrypt.hash('Admin@123', 12);
  const superAdmin = await db.user.create({
    data: {
      email: 'admin@gliscolab.com',
      name: 'System Admin',
      role: UserRole.SUPER_ADMIN,
      passwordHash: superAdminHash,
    },
  });

  const superAdminEmployee = await db.employee.create({
    data: {
      companyId: company.id,
      userId: superAdmin.id,
      employeeId: 'GL-000',
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@gliscolab.com',
      departmentId: departments[1].id,
      joinedAt: new Date('2024-01-01'),
      region: Region.US,
      employmentType: EmploymentType.FULL_TIME,
      onboardingComplete: true,
    },
  });
  console.log(`  Created super admin: ${superAdmin.email}`);

  // ─── HR Admin User ────────────────────────────────────────────────────────
  const hrAdminHash = await bcrypt.hash('GliscoAdmin2025!', 12);
  const hrAdmin = await db.user.create({
    data: {
      email: 'meenakshi@gliscolab.com',
      name: 'Meenakshi Sharma',
      role: UserRole.HR_ADMIN,
      passwordHash: hrAdminHash,
    },
  });

  const hrAdminEmployee = await db.employee.create({
    data: {
      companyId: company.id,
      userId: hrAdmin.id,
      employeeId: 'GL-001',
      firstName: 'Meenakshi',
      lastName: 'Sharma',
      email: 'meenakshi@gliscolab.com',
      departmentId: departments[1].id,
      joinedAt: new Date('2024-01-01'),
      region: Region.US,
      employmentType: EmploymentType.FULL_TIME,
      onboardingComplete: true,
    },
  });
  console.log(`  Created HR admin: ${hrAdmin.email}`);

  // ─── Leave Type Configs ─────────────────────────────────────────────────────
  const leaveTypes = [
    // US Leave Types
    { leaveType: LeaveType.ANNUAL, name: 'Annual Leave', daysAllowed: 15, carryForward: true, maxCarryForward: 5, region: Region.US },
    { leaveType: LeaveType.SICK, name: 'Sick Leave', daysAllowed: 10, carryForward: false, region: Region.US },
    { leaveType: LeaveType.MATERNITY, name: 'Maternity Leave', daysAllowed: 60, carryForward: false, region: Region.US },
    { leaveType: LeaveType.PATERNITY, name: 'Paternity Leave', daysAllowed: 10, carryForward: false, region: Region.US },
    { leaveType: LeaveType.BEREAVEMENT, name: 'Bereavement Leave', daysAllowed: 5, carryForward: false, region: Region.US },
    { leaveType: LeaveType.FMLA, name: 'FMLA Leave', daysAllowed: 60, carryForward: false, region: Region.US, isPaid: false },
    { leaveType: LeaveType.UNPAID, name: 'Unpaid Leave', daysAllowed: 30, carryForward: false, region: Region.US, isPaid: false },
    // India Leave Types
    { leaveType: LeaveType.EL, name: 'Earned Leave', daysAllowed: 18, carryForward: true, maxCarryForward: 10, region: Region.INDIA },
    { leaveType: LeaveType.CASUAL, name: 'Casual Leave', daysAllowed: 12, carryForward: false, region: Region.INDIA },
    { leaveType: LeaveType.SICK, name: 'Sick Leave (India)', daysAllowed: 12, carryForward: false, region: Region.INDIA },
    { leaveType: LeaveType.MATERNITY, name: 'Maternity Leave (India)', daysAllowed: 182, carryForward: false, region: Region.INDIA },
    { leaveType: LeaveType.PATERNITY, name: 'Paternity Leave (India)', daysAllowed: 15, carryForward: false, region: Region.INDIA },
    { leaveType: LeaveType.COMPENSATORY, name: 'Compensatory Off', daysAllowed: 5, carryForward: false, region: Region.INDIA },
    { leaveType: LeaveType.UNPAID, name: 'Leave Without Pay', daysAllowed: 30, carryForward: false, region: Region.INDIA, isPaid: false },
  ];

  for (const lt of leaveTypes) {
    await db.leaveTypeConfig.create({
      data: {
        companyId: company.id,
        leaveType: lt.leaveType,
        name: lt.name,
        daysAllowed: lt.daysAllowed,
        carryForward: lt.carryForward,
        maxCarryForward: lt.maxCarryForward ?? null,
        region: lt.region,
        isPaid: lt.isPaid ?? true,
      },
    });
  }
  console.log(`  Created ${leaveTypes.length} leave type configs`);

  // ─── Leave Balances for Admin Users (US, 2026) ────────────────────────────
  const usLeaveTypes = await db.leaveTypeConfig.findMany({
    where: { companyId: company.id, region: Region.US },
  });

  for (const emp of [superAdminEmployee, hrAdminEmployee]) {
    for (const lt of usLeaveTypes) {
      await db.leaveBalance.create({
        data: {
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year: 2026,
          entitled: lt.daysAllowed,
        },
      });
    }
  }
  console.log('  Created leave balances for admin users');

  // ─── Holidays 2026 ────────────────────────────────────────────────────────
  const holidays = [
    // US Federal Holidays
    { name: "New Year's Day", date: '2026-01-01', region: Region.US },
    { name: 'Martin Luther King Jr. Day', date: '2026-01-19', region: Region.US },
    { name: "Presidents' Day", date: '2026-02-16', region: Region.US },
    { name: 'Memorial Day', date: '2026-05-25', region: Region.US },
    { name: 'Juneteenth', date: '2026-06-19', region: Region.US },
    { name: 'Independence Day', date: '2026-07-03', region: Region.US },
    { name: 'Labor Day', date: '2026-09-07', region: Region.US },
    { name: 'Columbus Day', date: '2026-10-12', region: Region.US },
    { name: 'Veterans Day', date: '2026-11-11', region: Region.US },
    { name: 'Thanksgiving', date: '2026-11-26', region: Region.US },
    { name: 'Day After Thanksgiving', date: '2026-11-27', region: Region.US },
    { name: 'Christmas Eve', date: '2026-12-24', region: Region.US },
    { name: 'Christmas Day', date: '2026-12-25', region: Region.US },
    // India National Holidays
    { name: 'Republic Day', date: '2026-01-26', region: Region.INDIA },
    { name: 'Holi', date: '2026-03-17', region: Region.INDIA },
    { name: 'Good Friday', date: '2026-04-03', region: Region.INDIA },
    { name: 'Dr. Ambedkar Jayanti', date: '2026-04-14', region: Region.INDIA },
    { name: 'May Day', date: '2026-05-01', region: Region.INDIA },
    { name: 'Independence Day', date: '2026-08-15', region: Region.INDIA },
    { name: 'Janmashtami', date: '2026-08-25', region: Region.INDIA },
    { name: 'Mahatma Gandhi Jayanti', date: '2026-10-02', region: Region.INDIA },
    { name: 'Dussehra', date: '2026-10-20', region: Region.INDIA },
    { name: 'Diwali', date: '2026-11-08', region: Region.INDIA },
    { name: 'Guru Nanak Jayanti', date: '2026-11-25', region: Region.INDIA },
    { name: 'Christmas Day', date: '2026-12-25', region: Region.INDIA },
  ];

  await db.holiday.createMany({
    data: holidays.map((h) => ({
      companyId: company.id,
      name: h.name,
      date: new Date(h.date),
      region: h.region,
    })),
  });
  console.log(`  Created ${holidays.length} holidays`);

  // ─── Onboarding Checklists ────────────────────────────────────────────────
  const usChecklist = await db.onboardingChecklist.create({
    data: { companyId: company.id, name: 'US Full-Time Onboarding', region: Region.US, employmentType: EmploymentType.FULL_TIME },
  });

  await db.onboardingTaskTemplate.createMany({
    data: [
      { checklistId: usChecklist.id, title: 'Complete I-9 Form', description: 'Employment eligibility verification', dueOffsetDays: 3, assigneeTo: 'employee', order: 1 },
      { checklistId: usChecklist.id, title: 'Submit W-4 Form', description: 'Federal tax withholding', dueOffsetDays: 3, assigneeTo: 'employee', order: 2 },
      { checklistId: usChecklist.id, title: 'Enroll in Benefits', description: 'Health, dental, vision, 401k', dueOffsetDays: 30, assigneeTo: 'employee', order: 3 },
      { checklistId: usChecklist.id, title: 'Set Up Direct Deposit', description: 'Bank account for payroll', dueOffsetDays: 5, assigneeTo: 'employee', order: 4 },
      { checklistId: usChecklist.id, title: 'Sign Offer Letter', description: 'Review and sign', dueOffsetDays: 0, assigneeTo: 'employee', order: 5 },
      { checklistId: usChecklist.id, title: 'Sign NDA', description: 'Non-disclosure agreement', dueOffsetDays: 0, assigneeTo: 'employee', order: 6 },
      { checklistId: usChecklist.id, title: 'IT Equipment Setup', description: 'Laptop, email, Slack, tool access', dueOffsetDays: 0, assigneeTo: 'hr', order: 7 },
      { checklistId: usChecklist.id, title: 'Welcome Meeting with Manager', description: 'Intro meeting', dueOffsetDays: 1, assigneeTo: 'manager', order: 8 },
      { checklistId: usChecklist.id, title: 'Company Handbook Review', description: 'Read and acknowledge', dueOffsetDays: 7, assigneeTo: 'employee', order: 9 },
      { checklistId: usChecklist.id, title: 'Background Check', description: 'Initiate background verification', dueOffsetDays: 0, assigneeTo: 'hr', order: 10, isRequired: true },
    ],
  });

  const indiaChecklist = await db.onboardingChecklist.create({
    data: { companyId: company.id, name: 'India Full-Time Onboarding', region: Region.INDIA, employmentType: EmploymentType.FULL_TIME },
  });

  await db.onboardingTaskTemplate.createMany({
    data: [
      { checklistId: indiaChecklist.id, title: 'Submit PAN Card Copy', description: 'For TDS compliance', dueOffsetDays: 3, assigneeTo: 'employee', order: 1 },
      { checklistId: indiaChecklist.id, title: 'Submit Aadhaar Card Copy', description: 'For PF registration', dueOffsetDays: 3, assigneeTo: 'employee', order: 2 },
      { checklistId: indiaChecklist.id, title: 'PF Registration', description: 'EPF UAN generation', dueOffsetDays: 7, assigneeTo: 'hr', order: 3 },
      { checklistId: indiaChecklist.id, title: 'Bank Account Details', description: 'For salary credit', dueOffsetDays: 5, assigneeTo: 'employee', order: 4 },
      { checklistId: indiaChecklist.id, title: 'Sign Offer Letter', description: 'Review and sign', dueOffsetDays: 0, assigneeTo: 'employee', order: 5 },
      { checklistId: indiaChecklist.id, title: 'Sign NDA', description: 'Non-disclosure agreement', dueOffsetDays: 0, assigneeTo: 'employee', order: 6 },
      { checklistId: indiaChecklist.id, title: 'IT Equipment Setup', description: 'Laptop, email, Slack', dueOffsetDays: 0, assigneeTo: 'hr', order: 7 },
      { checklistId: indiaChecklist.id, title: 'Welcome Meeting', description: 'Intro with reporting manager', dueOffsetDays: 1, assigneeTo: 'manager', order: 8 },
      { checklistId: indiaChecklist.id, title: 'Investment Declaration', description: 'Tax-saving under 80C', dueOffsetDays: 30, assigneeTo: 'employee', order: 9 },
      { checklistId: indiaChecklist.id, title: 'Emergency Contact Form', description: 'Provide emergency contacts', dueOffsetDays: 3, assigneeTo: 'employee', order: 10 },
    ],
  });
  console.log('  Created onboarding checklists');

  console.log('\nSeed complete!');
  console.log('Login: admin@gliscolab.com / Admin@123');
  console.log('Login: meenakshi@gliscolab.com / GliscoAdmin2025!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
