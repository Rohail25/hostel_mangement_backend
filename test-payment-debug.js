// ===============================
// Test Script: Debug Payment History
// Run: node test-payment-debug.js
// ===============================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPaymentHistory() {
    try {
        console.log('\n🔍 === DEBUGGING PAYMENT HISTORY ===\n');

        // 1. Check all tenants
        console.log('1️⃣ Checking all tenants...');
        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                name: true,
                phone: true,
                email: true
            }
        });
        console.log('📊 Total Tenants:', tenants.length);
        console.log('Tenants:', JSON.stringify(tenants, null, 2));

        // 2. Check all payments
        console.log('\n2️⃣ Checking all payments...');
        const payments = await prisma.payment.findMany({
            select: {
                id: true,
                tenantId: true,
                amount: true,
                paymentType: true,
                paymentDate: true
            }
        });
        console.log('💰 Total Payments:', payments.length);
        console.log('Payments:', JSON.stringify(payments, null, 2));

        // 3. Check payments grouped by tenant
        console.log('\n3️⃣ Payments grouped by tenant...');
        for (const tenant of tenants) {
            const tenantPayments = await prisma.payment.findMany({
                where: { tenantId: tenant.id },
                select: {
                    id: true,
                    amount: true,
                    paymentType: true
                }
            });
            
            const totalPaid = await prisma.payment.aggregate({
                where: { tenantId: tenant.id },
                _sum: { amount: true }
            });

            console.log(`\nTenant #${tenant.id} (${tenant.name}):`);
            console.log(`  - Payments: ${tenantPayments.length}`);
            console.log(`  - Total Paid: ₹${totalPaid._sum.amount || 0}`);
            if (tenantPayments.length > 0) {
                console.log(`  - Payment IDs: ${tenantPayments.map(p => p.id).join(', ')}`);
            }
        }

        // 4. Check for orphaned payments (payments with invalid tenantId)
        console.log('\n4️⃣ Checking for orphaned payments...');
        const allPaymentIds = payments.map(p => p.tenantId);
        const allTenantIds = tenants.map(t => t.id);
        const orphanedTenantIds = [...new Set(allPaymentIds)].filter(id => !allTenantIds.includes(id));
        
        if (orphanedTenantIds.length > 0) {
            console.log('⚠️  Found orphaned payments (tenantId doesn\'t exist):');
            for (const tenantId of orphanedTenantIds) {
                const orphanedPayments = payments.filter(p => p.tenantId === tenantId);
                console.log(`  - TenantID: ${tenantId} → ${orphanedPayments.length} payments`);
            }
        } else {
            console.log('✅ No orphaned payments found');
        }

        // 5. Recommendations
        console.log('\n\n📋 === RECOMMENDATIONS ===\n');
        
        if (tenants.length === 0) {
            console.log('❌ No tenants found!');
            console.log('   → Create a tenant first: POST /api/admin/tenant');
        } else {
            console.log('✅ Tenants exist');
        }

        if (payments.length === 0) {
            console.log('❌ No payments found!');
            console.log('   → Create a payment first: POST /api/admin/payment');
            console.log('   → Example payload:');
            console.log('     {');
            console.log(`       "tenantId": ${tenants[0]?.id || 1},`);
            console.log('       "hostelId": 1,');
            console.log('       "amount": 5000,');
            console.log('       "paymentType": "rent",');
            console.log('       "paymentMethod": "cash"');
            console.log('     }');
        } else {
            console.log('✅ Payments exist');
            console.log(`   → Total: ${payments.length} payments`);
        }

        console.log('\n\n🎯 === TESTING ENDPOINTS ===\n');
        console.log('Test these endpoints in Postman:\n');
        
        for (const tenant of tenants.slice(0, 3)) { // Show first 3 tenants
            const count = payments.filter(p => p.tenantId === tenant.id).length;
            console.log(`Tenant #${tenant.id} (${tenant.name}) - ${count} payment(s):`);
            console.log(`  GET http://localhost:5000/api/admin/tenant/${tenant.id}/payments`);
            console.log('');
        }

        console.log('\n✅ Debug complete!\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugPaymentHistory();




