const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../../Helper/helper');
const prisma = new PrismaClient();

// =================== CREATE VENDOR ===================
exports.createVendor = async (req, res) => {
	try {
		const {
			name,
			companyName,
			email,
			phone,
			alternatePhone,
			taxId,
			category,
			services,
			contactPerson,
			address,
			paymentTerms,
			creditLimit,
			hostelId,
			documents,
			notes,
			status
		} = req.body;

		if (!name) {
			return errorResponse(res, 'Vendor name is required', 400);
		}

		// Normalize and validate enums/ids
		const allowedStatuses = ['active', 'inactive', 'blacklisted'];
		const allowedTerms = ['prepaid', 'cod', 'net15', 'net30', 'net45', 'net60'];

		// Normalize paymentTerms like "Net 30" -> "net30"
		let normalizedTerms = paymentTerms;
		if (typeof normalizedTerms === 'string') {
			const compact = normalizedTerms.toLowerCase().replace(/\s+/g, '');
			// map common variants
			if (compact === 'net30') normalizedTerms = 'net30';
			else if (compact === 'net15') normalizedTerms = 'net15';
			else if (compact === 'net45') normalizedTerms = 'net45';
			else if (compact === 'net60') normalizedTerms = 'net60';
			else if (compact === 'prepaid') normalizedTerms = 'prepaid';
			else if (compact === 'cod') normalizedTerms = 'cod';
		}

		if (normalizedTerms && !allowedTerms.includes(normalizedTerms)) {
			return errorResponse(res, 'Invalid paymentTerms. Allowed: prepaid, cod, net15, net30, net45, net60', 400);
		}

		let normalizedStatus = status;
		if (typeof normalizedStatus === 'string') {
			normalizedStatus = normalizedStatus.toLowerCase();
			if (!allowedStatuses.includes(normalizedStatus)) {
				return errorResponse(res, 'Invalid status. Allowed: active, inactive, blacklisted', 400);
			}
		}

		let hostelIdInt = null;
		if (hostelId !== undefined && hostelId !== null && hostelId !== '') {
			const parsed = parseInt(hostelId);
			if (Number.isNaN(parsed)) {
				return errorResponse(res, 'hostelId must be a numeric id', 400);
			}
			hostelIdInt = parsed;
		}

		const vendor = await prisma.vendor.create({
			data: {
				hostelId: hostelIdInt,
				name,
				companyName: companyName || null,
				email: email || null,
				phone: phone || null,
				alternatePhone: alternatePhone || null,
				taxId: taxId || null,
				category: category || null,
				services: services || null,
				contactPerson: contactPerson || null,
				address: address || null,
				paymentTerms: normalizedTerms || 'net30',
				creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
				documents: documents || null,
				notes: notes || null,
				status: normalizedStatus || 'active'
			}
		});

		return successResponse(res, vendor, 'Vendor created successfully', 201);
	} catch (error) {
		console.error('Create Vendor Error:', error);
		return errorResponse(res, 'Failed to create vendor', 500);
	}
};

// =================== GET ALL VENDORS ===================
exports.getVendors = async (req, res) => {
	try {
		const {
			search,
			status,
			category,
			paymentTerms,
			hostelId,
			page = 1,
			limit = 20,
			sortBy = 'createdAt',
			sortOrder = 'desc'
		} = req.query;

		const where = {};
		if (status) where.status = status;
		if (category) where.category = category;
		if (paymentTerms) where.paymentTerms = paymentTerms;
		if (hostelId) where.hostelId = parseInt(hostelId);

		if (search) {
			where.OR = [
				{ name: { contains: search } },
				{ companyName: { contains: search } },
				{ email: { contains: search } },
				{ phone: { contains: search } },
				{ category: { contains: search } }
			];
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);
		const take = parseInt(limit);

		const [vendors, total] = await Promise.all([
			prisma.vendor.findMany({
				where,
				orderBy: { [sortBy]: sortOrder },
				skip,
				take
			}),
			prisma.vendor.count({ where })
		]);

		return successResponse(res, {
			vendors,
			pagination: {
				total,
				page: parseInt(page),
				limit: parseInt(limit),
				totalPages: Math.ceil(total / parseInt(limit))
			}
		}, 'Vendors fetched successfully', 200);
	} catch (error) {
		console.error('Get Vendors Error:', error);
		return errorResponse(res, 'Failed to fetch vendors', 500);
	}
};

// =================== GET VENDOR BY ID ===================
exports.getVendorById = async (req, res) => {
	try {
		const { id } = req.params;

		const vendor = await prisma.vendor.findUnique({ where: { id: parseInt(id) } });

		if (!vendor) {
			return errorResponse(res, 'Vendor not found', 404);
		}

		return successResponse(res, vendor, 'Vendor fetched successfully', 200);
	} catch (error) {
		console.error('Get Vendor Error:', error);
		return errorResponse(res, 'Failed to fetch vendor', 500);
	}
};

// =================== UPDATE VENDOR ===================
exports.updateVendor = async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body;

		// Ensure vendor exists
		const existing = await prisma.vendor.findUnique({ where: { id: parseInt(id) } });
		if (!existing) {
			return errorResponse(res, 'Vendor not found', 404);
		}

		const data = {};
		if (updates.name !== undefined) data.name = updates.name;
		if (updates.companyName !== undefined) data.companyName = updates.companyName;
		if (updates.email !== undefined) data.email = updates.email;
		if (updates.phone !== undefined) data.phone = updates.phone;
		if (updates.alternatePhone !== undefined) data.alternatePhone = updates.alternatePhone;
		if (updates.taxId !== undefined) data.taxId = updates.taxId;
		if (updates.category !== undefined) data.category = updates.category;
		if (updates.services !== undefined) data.services = updates.services;
		if (updates.contactPerson !== undefined) data.contactPerson = updates.contactPerson;
		if (updates.address !== undefined) data.address = updates.address;
		if (updates.paymentTerms !== undefined) data.paymentTerms = updates.paymentTerms;
		if (updates.creditLimit !== undefined) data.creditLimit = parseFloat(updates.creditLimit);
		if (updates.hostelId !== undefined) data.hostelId = updates.hostelId ? parseInt(updates.hostelId) : null;
		if (updates.documents !== undefined) data.documents = updates.documents;
		if (updates.notes !== undefined) data.notes = updates.notes;
		if (updates.status !== undefined) data.status = updates.status;
		if (updates.totalPayable !== undefined) data.totalPayable = parseFloat(updates.totalPayable);
		if (updates.totalPaid !== undefined) data.totalPaid = parseFloat(updates.totalPaid);
		if (updates.balance !== undefined) data.balance = parseFloat(updates.balance);

		const vendor = await prisma.vendor.update({
			where: { id: parseInt(id) },
			data
		});

		return successResponse(res, vendor, 'Vendor updated successfully', 200);
	} catch (error) {
		console.error('Update Vendor Error:', error);
		return errorResponse(res, 'Failed to update vendor', 500);
	}
};

// =================== DELETE VENDOR ===================
exports.deleteVendor = async (req, res) => {
	try {
		const { id } = req.params;

		const existing = await prisma.vendor.findUnique({ where: { id: parseInt(id) } });
		if (!existing) {
			return errorResponse(res, 'Vendor not found', 404);
		}

		await prisma.vendor.delete({ where: { id: parseInt(id) } });
		return successResponse(res, null, 'Vendor deleted successfully', 200);
	} catch (error) {
		console.error('Delete Vendor Error:', error);
		return errorResponse(res, 'Failed to delete vendor', 500);
	}
};

// =================== UPDATE VENDOR BALANCE (PAYABLE FLOW) ===================
// Use this to adjust financials when you record vendor payments or bills
exports.updateVendorFinancials = async (req, res) => {
	try {
		const { id } = req.params;
		const { deltaPayable = 0, deltaPaid = 0 } = req.body;

		const vendor = await prisma.vendor.update({
			where: { id: parseInt(id) },
			data: {
				totalPayable: { increment: parseFloat(deltaPayable) },
				totalPaid: { increment: parseFloat(deltaPaid) },
				balance: { increment: parseFloat(deltaPayable) - parseFloat(deltaPaid) }
			}
		});

		return successResponse(res, vendor, 'Vendor financials updated', 200);
	} catch (error) {
		console.error('Update Vendor Financials Error:', error);
		return errorResponse(res, 'Failed to update vendor financials', 500);
	}
};
