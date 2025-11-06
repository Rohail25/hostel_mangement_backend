const BASE_URL = 'http://localhost:3000/api/admin';

async function api(endpoint, method = 'GET', body) {
	const res = await fetch(`${BASE_URL}${endpoint}`, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	const data = await res.json();
	return { status: res.status, data };
}

async function run() {
	console.log('\n=== Vendor API Quick Test ===');

	// Create
	const create = await api('/vendors', 'POST', {
		name: 'AC Repair Services',
		companyName: 'CoolTech Pvt Ltd',
		email: `vendor_${Date.now()}@example.com`,
		phone: '0300-0000000',
		category: 'maintenance',
		services: ['ac_repair', 'maintenance'],
		contactPerson: { name: 'Ali', phone: '0301-1111111' },
		address: { city: 'Karachi', country: 'PK' },
		paymentTerms: 'net30',
		creditLimit: 50000
	});
	console.log('Create:', create.status, create.data.message);
	const vendorId = create.data?.data?.id;

	// List
	const list = await api('/vendors?search=AC');
	console.log('List:', list.status, list.data.message, 'Count:', list.data?.data?.pagination?.total);

	// Get
	if (vendorId) {
		const get = await api(`/vendors/${vendorId}`);
		console.log('Get:', get.status, get.data?.data?.name);
	}

	// Update financials
	if (vendorId) {
		const fin = await api(`/vendors/${vendorId}/financials`, 'PATCH', {
			deltaPayable: 12000,
			deltaPaid: 2000
		});
		console.log('Financials:', fin.status, fin.data.message);
	}

	// Update
	if (vendorId) {
		const upd = await api(`/vendors/${vendorId}`, 'PUT', { notes: 'Preferred vendor for AC maintenance' });
		console.log('Update:', upd.status, upd.data.message);
	}

	console.log('=== Done ===');
}

run().catch(err => console.error(err));




