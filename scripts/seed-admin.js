/**
 * Seed Script: Create Admin Users
 * 
 * This script creates default admin users for the hotel management system.
 * Admin users have full access via the isAdmin flag (no role needed).
 * 
 * Run with: node scripts/seed-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

// Default admin users configuration
const DEFAULT_ADMINS = [
    {
        username: 'admin',
        email: 'admin@gmail.com',
        password: 'admin123',
        phone: '+1234567890',
        status: 'active',
        isAdmin: true
    }
];

/**
 * Create or update an admin user
 */
async function createAdminUser(adminConfig) {
    try {
        // Check if admin user already exists
        const existingAdmin = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: adminConfig.email },
                    { username: adminConfig.username }
                ]
            }
        });

        if (existingAdmin) {
            // Update existing user to be admin
            const hashedPassword = await bcrypt.hash(adminConfig.password, 10);
            
            const updatedAdmin = await prisma.user.update({
                where: { id: existingAdmin.id },
                data: {
                    username: adminConfig.username,
                    email: adminConfig.email,
                    password: hashedPassword,
                    phone: adminConfig.phone || existingAdmin.phone,
                    status: adminConfig.status || existingAdmin.status,
                    isAdmin: true,
                    userRoleId: null // Admin doesn't need a role
                }
            });

            console.log(`  ✓ Updated existing admin: ${adminConfig.email}`);
            return updatedAdmin;
        }

        // Create new admin user
        const hashedPassword = await bcrypt.hash(adminConfig.password, 10);
        
        const adminUser = await prisma.user.create({
            data: {
                username: adminConfig.username,
                email: adminConfig.email,
                password: hashedPassword,
                phone: adminConfig.phone,
                status: adminConfig.status || 'active',
                isAdmin: true,
                userRoleId: null // Admin doesn't need a role
            }
        });

        console.log(`  ✓ Created admin user: ${adminConfig.email}`);
        return adminUser;
    } catch (error) {
        console.error(`  ✗ Error creating/updating admin ${adminConfig.email}:`, error.message);
        throw error;
    }
}

/**
 * Main seeding function
 */
async function seedAdmins() {
    console.log('🌱 Seeding admin users...\n');

    const createdAdmins = [];

    for (const adminConfig of DEFAULT_ADMINS) {
        try {
            const admin = await createAdminUser(adminConfig);
            createdAdmins.push({
                email: admin.email,
                username: admin.username,
                password: adminConfig.password // Show plain password for initial setup
            });
        } catch (error) {
            console.error(`  ✗ Failed to create admin ${adminConfig.email}:`, error.message);
        }
    }

    console.log(`\n✅ Successfully processed ${createdAdmins.length} admin user(s)\n`);

    if (createdAdmins.length > 0) {
        console.log('📝 Admin Credentials:');
        console.log('─'.repeat(50));
        createdAdmins.forEach(admin => {
            console.log(`  Email: ${admin.email}`);
            console.log(`  Username: ${admin.username}`);
            console.log(`  Password: ${admin.password}`);
            console.log('─'.repeat(50));
        });
        console.log('\n⚠️  Please change these passwords after first login!\n');
    }

    return createdAdmins;
}

/**
 * Main execution
 */
async function main() {
    try {
        console.log('🚀 Starting admin user seeding...\n');

        await seedAdmins();

        console.log('✅ Admin seeding completed successfully!');
    } catch (error) {
        console.error('❌ Error during admin seeding:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed
if (require.main === module) {
    main()
        .then(() => {
            console.log('✨ Done!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Admin seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedAdmins, createAdminUser };

