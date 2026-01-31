const { prisma } = require('../../config/db');
const bcrypt = require('bcrypt');
const { successResponse, errorResponse } = require('../../Helper/helper');

const paged = (page = 1, limit = 12) => {
    const p = parseInt(page, 10) || 1;
    const l = Math.min(parseInt(limit, 10) || 12, 100);
    return { skip: (p - 1) * l, take: l, page: p, limit: l };
};

const clamp0to5 = (n) => {
    const x = Number(n);
    if (Number.isNaN(x)) return 0;
    return Math.max(0, Math.min(5, x));
};

const overallFrom = (...vals) => {
    const arr = vals.map(clamp0to5);
    const sum = arr.reduce((a, b) => a + b, 0);
    return +(sum / arr.length).toFixed(1);
};

const parseDocumentsList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const buildUploads = (profilePhoto, docs) => ({
    profilePhoto: profilePhoto || null,
    documents: parseDocumentsList(docs),
});

// =================== CREATE EMPLOYEE ===================
const createEmployee = async (req, res) => {
    try {
        const {
            // User data
            name,
            username,
            email,
            phone,
            password,
            userRoleId, // User role ID (foreign key to Role table)
            
            // Employee data
            role: employeeRole, // Employee role (staff, manager, supervisor, etc)
            department,
            designation,
            salary,
            salaryType,
            joinDate,
            workingHours,
            hostelId,
            bankDetails,
            address,
            emergencyContact,
            qualifications,
            notes,
            // New fields
            fatherName,
            whatsappNumber,
            // Professional fields
            professionType,
            academicName,
            academicAddress,
            academicLocation,
            studentCardNo,
            jobTitle,
            companyName,
            jobAddress,
            jobLocation,
            jobIdNo,
            businessName,
            businessAddress,
            businessLocation,
            professionDescription,
            // Emergency fields
            emergencyContactName,
            emergencyContactNumber,
            emergencyContactWhatsapp,
            emergencyContactRelation,
            emergencyContactRelationOther,
            anyDisease,
            bloodGroup,
            nearestRelativeContact,
            nearestRelativeWhatsapp,
            nearestRelativeRelation,
            nearestRelativeRelationOther
        } = req.body;

        // Handle uploaded files - when using uploadAny.any(), files come as an array
        // Group files by fieldname
        const filesByField = {};
        if (req.files && Array.isArray(req.files)) {
            req.files.forEach(file => {
                if (!filesByField[file.fieldname]) {
                    filesByField[file.fieldname] = [];
                }
                filesByField[file.fieldname].push(file);
            });
        } else if (req.files) {
            // Fallback for when files come as object (upload.fields format)
            Object.keys(req.files).forEach(fieldname => {
                filesByField[fieldname] = Array.isArray(req.files[fieldname]) 
                    ? req.files[fieldname] 
                    : [req.files[fieldname]];
            });
        }

        // Handle uploaded files
        const profilePhoto = filesByField.profilePhoto?.[0]
            ? `/uploads/employees/${filesByField.profilePhoto[0].filename}`
            : null;

        // Handle CNIC documents (max 2 images)
        const cnicFiles = filesByField.cnicDocuments || [];
        const cnicDocuments = cnicFiles.slice(0, 2).map(file => ({
            field: 'cnicDocuments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));

        // Handle Agreement document (1 image)
        const agreementFile = filesByField.agreementDocument?.[0];
        const agreementDocument = agreementFile ? [{
            field: 'agreementDocument',
            url: `/uploads/employees/${agreementFile.filename}`,
            filename: agreementFile.filename,
            originalName: agreementFile.originalname,
            mimetype: agreementFile.mimetype,
            size: agreementFile.size,
            uploadedAt: new Date().toISOString(),
        }] : null;

        // Handle Police Character Certificate (1 image)
        const policeFile = filesByField.policeCharacterCertificate?.[0];
        const policeCharacterCertificate = policeFile ? [{
            field: 'policeCharacterCertificate',
            url: `/uploads/employees/${policeFile.filename}`,
            filename: policeFile.filename,
            originalName: policeFile.originalname,
            mimetype: policeFile.mimetype,
            size: policeFile.size,
            uploadedAt: new Date().toISOString(),
        }] : null;

        // Handle Any Other documents (multiple files)
        const anyOtherFiles = filesByField.anyOtherDocuments || [];
        const anyOtherDocuments = anyOtherFiles.map(file => ({
            field: 'anyOtherDocuments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));

        // Handle academic attachments
        const academicFiles = filesByField.academicAttachments || [];
        const academicAttachments = academicFiles.map(file => ({
            field: 'academicAttachments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));

        // Handle job attachments
        const jobFiles = filesByField.jobAttachments || [];
        const jobAttachments = jobFiles.map(file => ({
            field: 'jobAttachments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));

        // Handle business attachments
        const businessFiles = filesByField.businessAttachments || [];
        const businessAttachments = businessFiles.map(file => ({
            field: 'businessAttachments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));

        // Handle document uploads (keep for backward compatibility)
        const uploadedDocs = filesByField.documents || [];
        const providedDocuments = req.body.documents 
            ? (Array.isArray(req.body.documents) ? req.body.documents : parseDocumentsList(req.body.documents))
            : [];
        const fileDocuments = uploadedDocs.map(file => ({
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));
        const allDocuments = providedDocuments.length || fileDocuments.length 
            ? [...providedDocuments, ...fileDocuments] 
            : null;

        // Build emergency contact JSON
        let emergencyContactData = emergencyContact ? (typeof emergencyContact === 'string' ? JSON.parse(emergencyContact) : emergencyContact) : {};
        if (emergencyContactName || emergencyContactNumber || emergencyContactRelation) {
            emergencyContactData.name = emergencyContactName || emergencyContactData.name || null;
            emergencyContactData.phone = emergencyContactNumber || emergencyContactData.phone || null;
            emergencyContactData.relationship = emergencyContactRelation || emergencyContactData.relationship || null;
            emergencyContactData.whatsappNumber = emergencyContactWhatsapp || emergencyContactData.whatsappNumber || null;
            emergencyContactData.relationOther = emergencyContactRelationOther || emergencyContactData.relationOther || null;
        }

        // Build nearest relative JSON
        let nearestRelativeData = null;
        if (nearestRelativeContact || nearestRelativeWhatsapp || nearestRelativeRelation) {
            nearestRelativeData = {
                contactNumber: nearestRelativeContact || null,
                whatsappNumber: nearestRelativeWhatsapp || null,
                relation: nearestRelativeRelation || null,
                relationOther: nearestRelativeRelationOther || null,
            };
        }

        // Validation
        const userName = username || name; // Support both name and username for backward compatibility
        if (!userName || !email || !phone || !password) {
            return errorResponse(res, 'Username (or name), email, phone, and password are required', 400);
        }

        if (!salary || !joinDate) {
            return errorResponse(res, 'Salary and join date are required', 400);
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return errorResponse(res, 'Email already exists', 400);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create User and Employee in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    username: userName,
                    email,
                    phone,
                    password: hashedPassword,
                    userRoleId: userRoleId ? parseInt(userRoleId) : null,
                    status: 'active'
                }
            });

            // Create employee profile
            const employee = await tx.employee.create({
                data: {
                    userId: user.id,
                    employeeCode: `EMP${String(user.id).padStart(5, '0')}`,
                    role: employeeRole || 'staff',
                    department,
                    designation,
                    fatherName: fatherName || null,
                    whatsappNumber: whatsappNumber || null,
                    salary: parseFloat(salary),
                    salaryType: salaryType || 'monthly',
                    joinDate: new Date(joinDate),
                    workingHours,
                    hostelId: hostelId ? parseInt(hostelId) : null,
                    bankDetails,
                    address,
                    emergencyContact: Object.keys(emergencyContactData).length > 0 ? emergencyContactData : (emergencyContact || null),
                    emergencyContactWhatsapp: emergencyContactWhatsapp || null,
                    emergencyContactRelationOther: emergencyContactRelationOther || null,
                    anyDisease: anyDisease || null,
                    bloodGroup: bloodGroup || null,
                    nearestRelative: nearestRelativeData,
                    qualifications,
                    profilePhoto: profilePhoto || null,
                    documents: allDocuments,
                    cnicDocuments: cnicDocuments.length > 0 ? cnicDocuments : null,
                    agreementDocument: agreementDocument,
                    policeCharacterCertificate: policeCharacterCertificate,
                    anyOtherDocuments: anyOtherDocuments.length > 0 ? anyOtherDocuments : null,
                    // Professional fields
                    professionType: professionType || null,
                    academicName: academicName || null,
                    academicAddress: academicAddress || null,
                    academicLocation: academicLocation || null,
                    studentCardNo: studentCardNo || null,
                    academicAttachments: academicAttachments.length > 0 ? academicAttachments : null,
                    jobTitle: jobTitle || null,
                    companyName: companyName || null,
                    jobAddress: jobAddress || null,
                    jobLocation: jobLocation || null,
                    jobIdNo: jobIdNo || null,
                    jobAttachments: jobAttachments.length > 0 ? jobAttachments : null,
                    businessName: businessName || null,
                    businessAddress: businessAddress || null,
                    businessLocation: businessLocation || null,
                    businessAttachments: businessAttachments.length > 0 ? businessAttachments : null,
                    professionDescription: professionDescription || null,
                    notes,
                    status: 'active'
                }
            });

            return { user, employee };
        });

        return successResponse(res, {
            user: {
                id: result.user.id,
                username: result.user.username,
                email: result.user.email,
                phone: result.user.phone,
                userRoleId: result.user.userRoleId
            },
            employee: result.employee
        }, 'Employee created successfully', 201);

    } catch (error) {
        console.error('Create employee error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== GET ALL EMPLOYEES ===================
const getAllEmployees = async (req, res) => {
    try {
        const {
            status,
            role,
            department,
            hostelId,
            search,
            page = 1,
            limit = 10
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build filters
        const filters = {};

        if (status) filters.status = status;
        if (role) filters.role = role;
        if (department) filters.department = department;
        if (hostelId) filters.hostelId = parseInt(hostelId);

        // Build search conditions
        const searchConditions = [];
        if (search) {
            searchConditions.push(
                { user: { username: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { user: { phone: { contains: search } } },
                { employeeCode: { contains: search, mode: 'insensitive' } },
                { designation: { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } }
            );
        }

        const where = {
            ...filters,
            ...(searchConditions.length > 0 ? { OR: searchConditions } : {})
        };

        // Get employees with user data and hostel info
        const [employees, total] = await Promise.all([
            prisma.employee.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            userRole: {
                                select: {
                                    id: true,
                                    roleName: true,
                                },
                            },
                            status: true
                        }
                    },
                    hostel: {
                        select: {
                            id: true,
                            name: true,
                            address: true
                        }
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.employee.count({ where })
        ]);

        return successResponse(res, {
            items: employees,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        }, 'Employees fetched successfully');

    } catch (error) {
        console.error('Get employees error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== GET EMPLOYEE BY ID ===================
const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;

        const employee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true,
                        userRole: {
                            select: {
                                id: true,
                                roleName: true,
                            },
                        },
                        status: true,
                        createdAt: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            }
        });

        if (!employee) {
            return errorResponse(res, 'Employee not found', 404);
        }

        return successResponse(res, employee, 'Employee fetched successfully');

    } catch (error) {
        console.error('Get employee error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== GET EMPLOYEE BY USER ID ===================
const getEmployeeByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        const employee = await prisma.employee.findUnique({
            where: { userId: parseInt(userId) },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true,
                        userRole: {
                            select: {
                                id: true,
                                roleName: true,
                            },
                        },
                        status: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            }
        });

        if (!employee) {
            return errorResponse(res, 'Employee not found for this user', 404);
        }

        return successResponse(res, employee, 'Employee fetched successfully');

    } catch (error) {
        console.error('Get employee by user ID error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== UPDATE EMPLOYEE ===================
const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            // User data
            name,
            username,
            email,
            phone,
            password,
            userRoleId,
            
            // Employee data
            employeeCode,
            role: employeeRole,
            department,
            designation,
            salary,
            salaryType,
            joinDate,
            terminationDate,
            status,
            workingHours,
            hostelId,
            bankDetails,
            address,
            emergencyContact,
            qualifications,
            notes,
            // New fields
            fatherName,
            whatsappNumber,
            // Professional fields
            professionType,
            academicName,
            academicAddress,
            academicLocation,
            studentCardNo,
            jobTitle,
            companyName,
            jobAddress,
            jobLocation,
            jobIdNo,
            businessName,
            businessAddress,
            businessLocation,
            professionDescription,
            // Emergency fields
            emergencyContactName,
            emergencyContactNumber,
            emergencyContactWhatsapp,
            emergencyContactRelation,
            emergencyContactRelationOther,
            anyDisease,
            bloodGroup,
            nearestRelativeContact,
            nearestRelativeWhatsapp,
            nearestRelativeRelation,
            nearestRelativeRelationOther
        } = req.body;

        // Check if employee exists
        const existingEmployee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!existingEmployee) {
            return errorResponse(res, 'Employee not found', 404);
        }

        // Handle uploaded files - when using uploadAny.any(), files come as an array
        // Group files by fieldname
        const filesByField = {};
        if (req.files && Array.isArray(req.files)) {
            req.files.forEach(file => {
                if (!filesByField[file.fieldname]) {
                    filesByField[file.fieldname] = [];
                }
                filesByField[file.fieldname].push(file);
            });
        } else if (req.files) {
            // Fallback for when files come as object (upload.fields format)
            Object.keys(req.files).forEach(fieldname => {
                filesByField[fieldname] = Array.isArray(req.files[fieldname]) 
                    ? req.files[fieldname] 
                    : [req.files[fieldname]];
            });
        }

        // Handle uploaded files
        const profilePhoto = filesByField.profilePhoto?.[0]
            ? `/uploads/employees/${filesByField.profilePhoto[0].filename}`
            : undefined;

        // Handle CNIC documents
        const cnicFiles = filesByField.cnicDocuments || [];
        const existingCnic = existingEmployee.cnicDocuments ? parseDocumentsList(existingEmployee.cnicDocuments) : [];
        const newCnicDocuments = cnicFiles.slice(0, 2).map(file => ({
            field: 'cnicDocuments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));
        const mergedCnicDocuments = newCnicDocuments.length > 0 
            ? [...existingCnic, ...newCnicDocuments].slice(0, 2) // Keep max 2
            : (existingCnic.length > 0 ? existingCnic : null);

        // Handle Agreement document
        const agreementFile = filesByField.agreementDocument?.[0];
        const existingAgreement = existingEmployee.agreementDocument ? parseDocumentsList(existingEmployee.agreementDocument) : [];
        const newAgreementDocument = agreementFile ? [{
            field: 'agreementDocument',
            url: `/uploads/employees/${agreementFile.filename}`,
            filename: agreementFile.filename,
            originalName: agreementFile.originalname,
            mimetype: agreementFile.mimetype,
            size: agreementFile.size,
            uploadedAt: new Date().toISOString(),
        }] : [];
        const mergedAgreementDocument = newAgreementDocument.length > 0
            ? [...existingAgreement, ...newAgreementDocument]
            : (existingAgreement.length > 0 ? existingAgreement : null);

        // Handle Police Character Certificate
        const policeFile = filesByField.policeCharacterCertificate?.[0];
        const existingPolice = existingEmployee.policeCharacterCertificate ? parseDocumentsList(existingEmployee.policeCharacterCertificate) : [];
        const newPoliceCertificate = policeFile ? [{
            field: 'policeCharacterCertificate',
            url: `/uploads/employees/${policeFile.filename}`,
            filename: policeFile.filename,
            originalName: policeFile.originalname,
            mimetype: policeFile.mimetype,
            size: policeFile.size,
            uploadedAt: new Date().toISOString(),
        }] : [];
        const mergedPoliceCertificate = newPoliceCertificate.length > 0
            ? [...existingPolice, ...newPoliceCertificate]
            : (existingPolice.length > 0 ? existingPolice : null);

        // Handle Any Other documents
        const anyOtherFiles = filesByField.anyOtherDocuments || [];
        const existingAnyOther = existingEmployee.anyOtherDocuments ? parseDocumentsList(existingEmployee.anyOtherDocuments) : [];
        const newAnyOtherDocuments = anyOtherFiles.map(file => ({
            field: 'anyOtherDocuments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));
        const mergedAnyOtherDocuments = newAnyOtherDocuments.length > 0
            ? [...existingAnyOther, ...newAnyOtherDocuments]
            : (existingAnyOther.length > 0 ? existingAnyOther : null);

        // Handle academic attachments
        const academicFiles = filesByField.academicAttachments || [];
        const existingAcademic = existingEmployee.academicAttachments ? parseDocumentsList(existingEmployee.academicAttachments) : [];
        const newAcademicAttachments = academicFiles.map(file => ({
            field: 'academicAttachments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));
        const mergedAcademicAttachments = newAcademicAttachments.length > 0
            ? [...existingAcademic, ...newAcademicAttachments]
            : (existingAcademic.length > 0 ? existingAcademic : null);

        // Handle job attachments
        const jobFiles = filesByField.jobAttachments || [];
        const existingJob = existingEmployee.jobAttachments ? parseDocumentsList(existingEmployee.jobAttachments) : [];
        const newJobAttachments = jobFiles.map(file => ({
            field: 'jobAttachments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));
        const mergedJobAttachments = newJobAttachments.length > 0
            ? [...existingJob, ...newJobAttachments]
            : (existingJob.length > 0 ? existingJob : null);

        // Handle business attachments
        const businessFiles = filesByField.businessAttachments || [];
        const existingBusiness = existingEmployee.businessAttachments ? parseDocumentsList(existingEmployee.businessAttachments) : [];
        const newBusinessAttachments = businessFiles.map(file => ({
            field: 'businessAttachments',
            url: `/uploads/employees/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
        }));
        const mergedBusinessAttachments = newBusinessAttachments.length > 0
            ? [...existingBusiness, ...newBusinessAttachments]
            : (existingBusiness.length > 0 ? existingBusiness : null);

        // Handle document uploads (keep for backward compatibility)
        const uploadedDocs = filesByField.documents || [];
        const existingDocuments = existingEmployee.documents ? parseDocumentsList(existingEmployee.documents) : [];
        
        let allDocuments = undefined;
        if (uploadedDocs.length > 0 || req.body.documents !== undefined) {
            const providedDocuments = req.body.documents 
                ? (Array.isArray(req.body.documents) ? req.body.documents : parseDocumentsList(req.body.documents))
                : existingDocuments;
            const fileDocuments = uploadedDocs.map(file => ({
                url: `/uploads/employees/${file.filename}`,
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                uploadedAt: new Date().toISOString(),
            }));
            allDocuments = [...providedDocuments, ...fileDocuments];
        }

        // Build emergency contact JSON
        let emergencyContactData = existingEmployee.emergencyContact ? (typeof existingEmployee.emergencyContact === 'string' ? JSON.parse(existingEmployee.emergencyContact) : existingEmployee.emergencyContact) : {};
        if (emergencyContactName !== undefined || emergencyContactNumber !== undefined || emergencyContactRelation !== undefined) {
            if (emergencyContactName !== undefined) emergencyContactData.name = emergencyContactName || null;
            if (emergencyContactNumber !== undefined) emergencyContactData.phone = emergencyContactNumber || null;
            if (emergencyContactRelation !== undefined) emergencyContactData.relationship = emergencyContactRelation || null;
            if (emergencyContactWhatsapp !== undefined) emergencyContactData.whatsappNumber = emergencyContactWhatsapp || null;
            if (emergencyContactRelationOther !== undefined) emergencyContactData.relationOther = emergencyContactRelationOther || null;
        } else if (emergencyContact !== undefined) {
            emergencyContactData = typeof emergencyContact === 'string' ? JSON.parse(emergencyContact) : emergencyContact;
        }

        // Build nearest relative JSON
        let nearestRelativeData = existingEmployee.nearestRelative ? (typeof existingEmployee.nearestRelative === 'string' ? JSON.parse(existingEmployee.nearestRelative) : existingEmployee.nearestRelative) : null;
        if (nearestRelativeContact !== undefined || nearestRelativeWhatsapp !== undefined || nearestRelativeRelation !== undefined) {
            nearestRelativeData = nearestRelativeData || {};
            if (nearestRelativeContact !== undefined) nearestRelativeData.contactNumber = nearestRelativeContact || null;
            if (nearestRelativeWhatsapp !== undefined) nearestRelativeData.whatsappNumber = nearestRelativeWhatsapp || null;
            if (nearestRelativeRelation !== undefined) nearestRelativeData.relation = nearestRelativeRelation || null;
            if (nearestRelativeRelationOther !== undefined) nearestRelativeData.relationOther = nearestRelativeRelationOther || null;
        }

        // Update password if provided
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Update in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update user if user data is provided
            const userUpdateData = {};
            const userName = username || name; // Support both name and username
            if (userName) userUpdateData.username = userName;
            if (email) userUpdateData.email = email;
            if (phone) userUpdateData.phone = phone;
            if (userRoleId !== undefined) userUpdateData.userRoleId = userRoleId ? parseInt(userRoleId) : null;
            if (hashedPassword) userUpdateData.password = hashedPassword;

            let updatedUser = existingEmployee.user;
            if (Object.keys(userUpdateData).length > 0) {
                updatedUser = await tx.user.update({
                    where: { id: existingEmployee.userId },
                    data: userUpdateData
                });
            }

            // Update employee
            const employeeUpdateData = {};
            if (employeeCode !== undefined) employeeUpdateData.employeeCode = employeeCode;
            if (employeeRole !== undefined) employeeUpdateData.role = employeeRole;
            if (department !== undefined) employeeUpdateData.department = department;
            if (designation !== undefined) employeeUpdateData.designation = designation;
            if (fatherName !== undefined) employeeUpdateData.fatherName = fatherName || null;
            if (whatsappNumber !== undefined) employeeUpdateData.whatsappNumber = whatsappNumber || null;
            if (salary !== undefined) employeeUpdateData.salary = parseFloat(salary);
            if (salaryType !== undefined) employeeUpdateData.salaryType = salaryType;
            if (joinDate !== undefined) employeeUpdateData.joinDate = new Date(joinDate);
            if (terminationDate !== undefined) employeeUpdateData.terminationDate = terminationDate ? new Date(terminationDate) : null;
            if (status !== undefined) employeeUpdateData.status = status;
            if (workingHours !== undefined) employeeUpdateData.workingHours = workingHours;
            if (hostelId !== undefined) employeeUpdateData.hostelId = hostelId ? parseInt(hostelId) : null;
            if (bankDetails !== undefined) employeeUpdateData.bankDetails = bankDetails;
            if (address !== undefined) employeeUpdateData.address = address;
            if (Object.keys(emergencyContactData).length > 0 || emergencyContact !== undefined) {
                employeeUpdateData.emergencyContact = Object.keys(emergencyContactData).length > 0 ? emergencyContactData : (emergencyContact || null);
            }
            if (emergencyContactWhatsapp !== undefined) employeeUpdateData.emergencyContactWhatsapp = emergencyContactWhatsapp || null;
            if (emergencyContactRelationOther !== undefined) employeeUpdateData.emergencyContactRelationOther = emergencyContactRelationOther || null;
            if (anyDisease !== undefined) employeeUpdateData.anyDisease = anyDisease || null;
            if (bloodGroup !== undefined) employeeUpdateData.bloodGroup = bloodGroup || null;
            if (nearestRelativeData !== null || nearestRelativeData !== undefined) employeeUpdateData.nearestRelative = nearestRelativeData;
            if (qualifications !== undefined) employeeUpdateData.qualifications = qualifications;
            if (profilePhoto !== undefined) employeeUpdateData.profilePhoto = profilePhoto || existingEmployee.profilePhoto;
            if (allDocuments !== undefined) employeeUpdateData.documents = allDocuments;
            if (mergedCnicDocuments !== undefined) employeeUpdateData.cnicDocuments = mergedCnicDocuments;
            if (mergedAgreementDocument !== undefined) employeeUpdateData.agreementDocument = mergedAgreementDocument;
            if (mergedPoliceCertificate !== undefined) employeeUpdateData.policeCharacterCertificate = mergedPoliceCertificate;
            if (mergedAnyOtherDocuments !== undefined) employeeUpdateData.anyOtherDocuments = mergedAnyOtherDocuments;
            // Professional fields
            if (professionType !== undefined) employeeUpdateData.professionType = professionType || null;
            if (academicName !== undefined) employeeUpdateData.academicName = academicName || null;
            if (academicAddress !== undefined) employeeUpdateData.academicAddress = academicAddress || null;
            if (academicLocation !== undefined) employeeUpdateData.academicLocation = academicLocation || null;
            if (studentCardNo !== undefined) employeeUpdateData.studentCardNo = studentCardNo || null;
            if (mergedAcademicAttachments !== undefined) employeeUpdateData.academicAttachments = mergedAcademicAttachments;
            if (jobTitle !== undefined) employeeUpdateData.jobTitle = jobTitle || null;
            if (companyName !== undefined) employeeUpdateData.companyName = companyName || null;
            if (jobAddress !== undefined) employeeUpdateData.jobAddress = jobAddress || null;
            if (jobLocation !== undefined) employeeUpdateData.jobLocation = jobLocation || null;
            if (jobIdNo !== undefined) employeeUpdateData.jobIdNo = jobIdNo || null;
            if (mergedJobAttachments !== undefined) employeeUpdateData.jobAttachments = mergedJobAttachments;
            if (businessName !== undefined) employeeUpdateData.businessName = businessName || null;
            if (businessAddress !== undefined) employeeUpdateData.businessAddress = businessAddress || null;
            if (businessLocation !== undefined) employeeUpdateData.businessLocation = businessLocation || null;
            if (mergedBusinessAttachments !== undefined) employeeUpdateData.businessAttachments = mergedBusinessAttachments;
            if (professionDescription !== undefined) employeeUpdateData.professionDescription = professionDescription || null;
            if (notes !== undefined) employeeUpdateData.notes = notes;

            const updatedEmployee = await tx.employee.update({
                where: { id: parseInt(id) },
                data: employeeUpdateData
            });

            return { user: updatedUser, employee: updatedEmployee };
        });

        return successResponse(res, {
            user: {
                id: result.user.id,
                username: result.user.username,
                email: result.user.email,
                phone: result.user.phone,
                userRoleId: result.user.userRoleId
            },
            employee: result.employee
        }, 'Employee updated successfully');

    } catch (error) {
        console.error('Update employee error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== UPDATE EMPLOYEE SALARY ===================
const updateEmployeeSalary = async (req, res) => {
    try {
        const { id } = req.params;
        const { salary, salaryType, effectiveDate, notes } = req.body;

        if (!salary) {
            return errorResponse(res, 'Salary is required', 400);
        }

        const employee = await prisma.employee.update({
            where: { id: parseInt(id) },
            data: {
                salary: parseFloat(salary),
                salaryType: salaryType || 'monthly',
                notes: notes || `Salary updated on ${new Date().toISOString()}`
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        return successResponse(res, employee, 'Employee salary updated successfully');

    } catch (error) {
        console.error('Update salary error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== UPDATE EMPLOYEE STATUS ===================
const updateEmployeeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, terminationDate, notes } = req.body;

        if (!status) {
            return errorResponse(res, 'Status is required', 400);
        }

        const updateData = { status };
        if (status === 'terminated' && terminationDate) {
            updateData.terminationDate = new Date(terminationDate);
        }
        if (notes) updateData.notes = notes;

        const employee = await prisma.employee.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        // Also update user status if employee is terminated
        if (status === 'terminated') {
            await prisma.user.update({
                where: { id: employee.userId },
                data: { status: 'inactive' }
            });
        }

        return successResponse(res, employee, 'Employee status updated successfully');

    } catch (error) {
        console.error('Update status error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== DELETE EMPLOYEE ===================
const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if employee exists
        const employee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!employee) {
            return errorResponse(res, 'Employee not found', 404);
        }

        // Delete employee and user in transaction
        await prisma.$transaction(async (tx) => {
            // Delete employee
            await tx.employee.delete({
                where: { id: parseInt(id) }
            });

            // Delete user
            await tx.user.delete({
                where: { id: employee.userId }
            });
        });

        return successResponse(res, null, 'Employee deleted successfully');

    } catch (error) {
        console.error('Delete employee error:', error);
        return errorResponse(res, error.message);
    }
};

// =================== GET EMPLOYEE STATISTICS ===================
const getEmployeeStatistics = async (req, res) => {
    try {
        const [
            totalEmployees,
            activeEmployees,
            inactiveEmployees,
            onLeaveEmployees,
            terminatedEmployees,
            employeesByRole,
            employeesByDepartment
        ] = await Promise.all([
            prisma.employee.count(),
            prisma.employee.count({ where: { status: 'active' } }),
            prisma.employee.count({ where: { status: 'inactive' } }),
            prisma.employee.count({ where: { status: 'on_leave' } }),
            prisma.employee.count({ where: { status: 'terminated' } }),
            prisma.employee.groupBy({
                by: ['role'],
                _count: true
            }),
            prisma.employee.groupBy({
                by: ['department'],
                _count: true,
                where: {
                    department: {
                        not: null
                    }
                }
            })
        ]);

        // Calculate total salary expense
        const salaryData = await prisma.employee.aggregate({
            where: { status: 'active' },
            _sum: { salary: true },
            _avg: { salary: true }
        });

        return successResponse(res, {
            totalEmployees,
            statusBreakdown: {
                active: activeEmployees,
                inactive: inactiveEmployees,
                on_leave: onLeaveEmployees,
                terminated: terminatedEmployees
            },
            employeesByRole,
            employeesByDepartment,
            salaryStatistics: {
                totalMonthlySalaryExpense: salaryData._sum.salary || 0,
                averageSalary: salaryData._avg.salary || 0
            }
        }, 'Employee statistics fetched successfully');

    } catch (error) {
        console.error('Get statistics error:', error);
        return errorResponse(res, error.message);
    }
};

const listEmployees = async (req, res) => {
    try {
        const { status, search, page, limit } = req.query;
        const { skip, take } = paged(page, limit);

        const where = {
            ...(status ? { status } : {}),
            ...(search
                ? {
                    OR: [
                        { user: { username: { contains: search, mode: 'insensitive' } } },
                        { user: { email: { contains: search, mode: 'insensitive' } } },
                        { user: { phone: { contains: search } } },
                        { employeeCode: { contains: search, mode: 'insensitive' } },
                        { designation: { contains: search, mode: 'insensitive' } },
                        { department: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };

        const [rows, total] = await Promise.all([
            prisma.employee.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            userRole: {
                                select: {
                                    id: true,
                                    roleName: true,
                                },
                            },
                            status: true,
                        },
                    },
                },
            }),
            prisma.employee.count({ where }),
        ]);

        const hostelIds = Array.from(
            new Set(
                rows
                    .map((emp) => emp.hostelId)
                    .filter((id) => typeof id === 'number' && !Number.isNaN(id)),
            ),
        );

        const hostels = hostelIds.length
            ? await prisma.hostel.findMany({
                where: { id: { in: hostelIds } },
                select: { id: true, name: true },
            })
            : [];
        const hostelMap = hostels.reduce((acc, hostel) => {
            acc[hostel.id] = hostel.name;
            return acc;
        }, {});

        const cards = rows.map((e) => {
            const hostelId = e.hostelId ?? null;
            const hostelName = hostelId ? hostelMap[hostelId] ?? null : null;

            return {
                id: e.id,
                userId: e.user?.id ?? null,
                username: e.user?.username ?? null,
                email: e.user?.email ?? null,
                phone: e.user?.phone ?? null,
                role: e.role,
                userRole: e.user?.userRole?.roleName ?? null,
                userRoleId: e.user?.userRoleId ?? null,
                status: e.status === 'active' ? 'Active' : e.status === 'inactive' ? 'Inactive' : e.status,
                avatar: e.profilePhoto ?? null,
                joinedAt: e.joinDate ? e.joinDate.toISOString().split('T')[0] : null,
                salary: typeof e.salary === 'number' ? e.salary : null,
                hostel: hostelId
                    ? {
                        id: hostelId,
                        name: hostelName,
                    }
                    : null,
            };
        });

        return successResponse(res, { items: cards, total });
    } catch (e) {
        console.error('List employees error:', e);
        return errorResponse(res, e.message);
    }
};

const employeeDetails = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const emp = await prisma.employee.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true,
                        userRole: {
                            select: {
                                id: true,
                                roleName: true,
                            },
                        },
                        status: true,
                    },
                },
                hostel: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            },
        });
        if (!emp) return errorResponse(res, 'Employee not found', 404);

        const hostel = emp.hostel;

        const employeeDocuments = parseDocumentsList(emp.documents);
        const cnicDocuments = parseDocumentsList(emp.cnicDocuments);
        const agreementDocument = parseDocumentsList(emp.agreementDocument);
        const policeCharacterCertificate = parseDocumentsList(emp.policeCharacterCertificate);
        const anyOtherDocuments = parseDocumentsList(emp.anyOtherDocuments);

        let currentScore = null;
        try {
            currentScore = await prisma.scoreCard.findFirst({
                where: {
                    entityType: 'employee',
                    entityId: id,
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    score: true,
                    criteria: true,
                    remarks: true,
                    createdAt: true,
                },
            });
        } catch (err) {
            console.log('ScoreCard query failed:', err.message);
        }
        const formattedStatus =
            emp.status === 'active' ? 'Active' : emp.status === 'inactive' ? 'Inactive' : emp.status;

        return successResponse(res, {
            id: emp.id,
            userId: emp.userId,
            username: emp.user?.username ?? null,
            email: emp.user?.email ?? null,
            phone: emp.user?.phone ?? null,
            role: emp.role,
            userRole: emp.user?.userRole?.roleName ?? null,
            userRoleId: emp.user?.userRoleId ?? null,
            status: formattedStatus,
            profilePhoto: emp.profilePhoto ?? null,
            avatar: emp.profilePhoto ?? null,
            fatherName: emp.fatherName ?? null,
            whatsappNumber: emp.whatsappNumber ?? null,
            joinDate: emp.joinDate ? emp.joinDate.toISOString().split('T')[0] : null,
            terminationDate: emp.terminationDate
                ? emp.terminationDate.toISOString().split('T')[0]
                : null,
            department: emp.department ?? null,
            designation: emp.designation ?? null,
            employeeCode: emp.employeeCode ?? null,
            salary: typeof emp.salary === 'number' ? emp.salary : null,
            salaryType: emp.salaryType ?? null,
            workingHours: emp.workingHours ?? null,
            hostel: hostel
                ? {
                    id: hostel.id,
                    name: hostel.name,
                    address: hostel.address ?? null,
                }
                : null,
            bankDetails: emp.bankDetails ?? null,
            address: emp.address ?? null,
            emergencyContact: emp.emergencyContact ?? null,
            emergencyContactWhatsapp: emp.emergencyContactWhatsapp ?? null,
            emergencyContactRelationOther: emp.emergencyContactRelationOther ?? null,
            anyDisease: emp.anyDisease ?? null,
            bloodGroup: emp.bloodGroup ?? null,
            nearestRelative: emp.nearestRelative ?? null,
            qualifications: emp.qualifications ?? null,
            notes: emp.notes ?? null,
            documents: employeeDocuments,
            cnicDocuments: cnicDocuments,
            agreementDocument: agreementDocument,
            policeCharacterCertificate: policeCharacterCertificate,
            anyOtherDocuments: anyOtherDocuments,
            // Professional fields
            professionType: emp.professionType ?? null,
            academicName: emp.academicName ?? null,
            academicAddress: emp.academicAddress ?? null,
            academicLocation: emp.academicLocation ?? null,
            studentCardNo: emp.studentCardNo ?? null,
            academicAttachments: emp.academicAttachments ?? null,
            jobTitle: emp.jobTitle ?? null,
            companyName: emp.companyName ?? null,
            jobAddress: emp.jobAddress ?? null,
            jobLocation: emp.jobLocation ?? null,
            jobIdNo: emp.jobIdNo ?? null,
            jobAttachments: emp.jobAttachments ?? null,
            businessName: emp.businessName ?? null,
            businessAddress: emp.businessAddress ?? null,
            businessLocation: emp.businessLocation ?? null,
            businessAttachments: emp.businessAttachments ?? null,
            professionDescription: emp.professionDescription ?? null,
            uploads: buildUploads(emp.profilePhoto, emp.documents),
            score: currentScore,
        });
    } catch (e) {
        console.error('Employee details error:', e);
        return errorResponse(res, e.message);
    }
};

const getEmployeeCurrentScore = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const score = await prisma.scoreCard.findFirst({
            where: {
                entityType: 'employee',
                entityId: id,
            },
            orderBy: { createdAt: 'desc' },
        });
        return successResponse(res, score || null);
    } catch (e) {
        console.error('Get employee score error:', e);
        return errorResponse(res, e.message);
    }
};

const getEmployeeScoreHistory = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const limitNum = Math.min(parseInt(req.query.limit, 10) || 10, 50);
        const rows = await prisma.scoreCard.findMany({
            where: {
                entityType: 'employee',
                entityId: id,
            },
            orderBy: { createdAt: 'desc' },
            take: limitNum,
        });
        return successResponse(res, rows);
    } catch (e) {
        console.error('Get employee score history error:', e);
        return errorResponse(res, e.message);
    }
};

const upsertEmployeeScore = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { behavior, punctuality, taskQuality, remarks } = req.body;

        const overall = overallFrom(behavior, punctuality, taskQuality);
        const payload = {
            entityType: 'employee',
            entityId: id,
            score: overall,
            criteria: JSON.stringify({ behavior, punctuality, taskQuality }),
            remarks: remarks || null,
            recordedBy: req.user?.id || null,
        };

        const row = await prisma.scoreCard.create({ data: payload });
        return successResponse(
            res,
            {
                ...row,
                behavior: clamp0to5(behavior),
                punctuality: clamp0to5(punctuality),
                taskQuality: clamp0to5(taskQuality),
                overall,
            },
            'Employee score saved',
        );
    } catch (e) {
        console.error('Upsert employee score error:', e);
        return errorResponse(res, e.message);
    }
};

// =================== GET EMPLOYEES BY HOSTEL ID ===================
const getEmployeesByHostelId = async (req, res) => {
    try {
        const { hostelId } = req.params;
        const {
            status,
            role,
            department,
            search,
            page = 1,
            limit = 10
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build filters
        const filters = {
            hostelId: parseInt(hostelId)
        };

        if (status) filters.status = status;
        if (role) filters.role = role;
        if (department) filters.department = department;

        // Build search conditions
        const searchConditions = [];
        if (search) {
            searchConditions.push(
                { user: { username: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { user: { phone: { contains: search } } },
                { employeeCode: { contains: search, mode: 'insensitive' } },
                { designation: { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } }
            );
        }

        const where = {
            ...filters,
            ...(searchConditions.length > 0 ? { OR: searchConditions } : {})
        };

        // Get employees with user data and hostel info
        const [employees, total] = await Promise.all([
            prisma.employee.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            userRole: {
                                select: {
                                    id: true,
                                    roleName: true,
                                },
                            },
                            status: true
                        }
                    },
                    hostel: {
                        select: {
                            id: true,
                            name: true,
                            address: true
                        }
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.employee.count({ where })
        ]);

        return successResponse(res, {
            items: employees,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            hostelId: parseInt(hostelId)
        }, 'Employees fetched successfully for hostel');

    } catch (error) {
        console.error('Get employees by hostel ID error:', error);
        return errorResponse(res, error.message);
    }
};

module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    getEmployeeByUserId,
    updateEmployee,
    updateEmployeeSalary,
    updateEmployeeStatus,
    deleteEmployee,
    getEmployeeStatistics,
    listEmployees,
    employeeDetails,
    getEmployeeCurrentScore,
    getEmployeeScoreHistory,
    upsertEmployeeScore,
    getEmployeesByHostelId,
};

