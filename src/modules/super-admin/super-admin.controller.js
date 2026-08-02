const prisma = require('../../config/db')
const bcrypt = require('bcryptjs')
const { generateDisplayId } = require('../../utils/displayId.util')

// Super Admin: Get all clinics
const getClinics = async (req, res, next) => {
  try {
    const clinics = await prisma.clinic.findMany({
      include: { branches: true, subscriptions: true },
      orderBy: { createdAt: 'desc' },
    })

    for (let i = 0; i < clinics.length; i++) {
      if (!clinics[i].displayId) {
        const generated = `CLN-${String(clinics.length - i).padStart(6, '0')}`
        await prisma.clinic.update({
          where: { id: clinics[i].id },
          data: { displayId: generated }
        }).catch(() => null)
        clinics[i].displayId = generated
      }
    }

    res.json({ success: true, data: clinics })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create clinic
const createClinic = async (req, res, next) => {
  try {
    const { 
      name, email, phone, contact, address, country, state, logoUrl, avatar, 
      contactPerson, website, salesperson, referral, staffCount, patientsCount, revenue, tier, status 
    } = req.body

    const fullAddress = address || (state || country ? `${state || ''} ${country || ''}`.trim() : null)
    const displayId = await generateDisplayId('clinic', 'CLN')

    const clinic = await prisma.clinic.create({
      data: {
        displayId,
        name: name || 'New Clinic',
        email: email || null,
        phone: phone || contact || null,
        address: fullAddress,
        logoUrl: logoUrl || avatar || null,
        contactPerson: contactPerson || null,
        website: website || null,
        country: country || null,
        state: state || null,
        salesperson: salesperson || null,
        referral: referral || null,
        staffCount: parseInt(staffCount) || 1,
        patientsCount: parseInt(patientsCount) || 0,
        revenue: parseFloat(revenue) || 0,
        tier: tier || 'Basic',
        status: status || 'Active',
      },
    })

    // Automatically create billing invoice for newly registered clinic
    const invCount = await prisma.invoice.count().catch(() => 0)
    const invDisplayId = `INV-${String(invCount + 1).padStart(6, '0')}`
    const today = new Date().toISOString().split('T')[0]
    const invAmount = parseFloat(revenue) || (tier === 'Enterprise' ? 1000 : tier === 'Pro' ? 300 : 150)

    await prisma.invoice.create({
      data: {
        displayId: invDisplayId,
        invoiceNumber: `INV-${Math.floor(7000 + Math.random() * 2000)}`,
        patientName: clinic.name,
        issueDate: today,
        dueDate: today,
        amount: invAmount,
        due: invAmount,
        status: 'Overdue'
      }
    }).catch(() => null)

    res.json({ success: true, data: clinic })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Subscriptions management
const getSubscriptions = async (req, res, next) => {
  try {
    let subscriptions = await prisma.subscription.findMany({ orderBy: { createdAt: 'desc' } })
    if (subscriptions.length === 0) {
      const seedSubs = [
        { displayId: 'SUB-000001', clinicName: 'Bayview Family Clinic', plan: 'Basic', billingCycle: 'Monthly', amount: 50.0, status: 'Active' },
        { displayId: 'SUB-000002', clinicName: 'Melbourne Central Clinic', plan: 'Advanced', billingCycle: 'Monthly', amount: 50.0, status: 'Active' },
        { displayId: 'SUB-000003', clinicName: 'Harbor Wellness Center', plan: 'Premium', billingCycle: 'Monthly', amount: 50.0, status: 'Active' },
      ]
      await prisma.subscription.createMany({ data: seedSubs }).catch(() => null)
      subscriptions = await prisma.subscription.findMany({ orderBy: { createdAt: 'desc' } })
    }
    res.json({ success: true, data: subscriptions })
  } catch (err) {
    next(err)
  }
}

const createSubscription = async (req, res, next) => {
  try {
    const { name, price, plan, billingCycle, amount, clinicName, status } = req.body
    const displayId = await generateDisplayId('subscription', 'SUB')
    const sub = await prisma.subscription.create({
      data: {
        displayId,
        clinicName: clinicName || name || 'New Package Subscription',
        plan: plan || name || 'Basic',
        billingCycle: billingCycle || 'Monthly',
        amount: parseFloat(amount || price) || 50.0,
        status: status || 'Active'
      }
    })
    res.json({ success: true, data: sub })
  } catch (err) {
    next(err)
  }
}

const updateSubscription = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, price, plan, amount, status, billingCycle } = req.body
    const data = {}
    if (plan || name) data.plan = plan || name
    if (clinicName) data.clinicName = clinicName
    if (amount || price !== undefined) data.amount = parseFloat(amount || price)
    if (status) data.status = status
    if (billingCycle) data.billingCycle = billingCycle

    const updated = await prisma.subscription.update({
      where: { id },
      data
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

const deleteSubscription = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.subscription.delete({ where: { id } })
    res.json({ success: true, message: 'Subscription package deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Billing Overview from live database
const getBillingOverview = async (req, res, next) => {
  try {
    const clinics = await prisma.clinic.findMany({
      include: { subscriptions: true }
    })

    let totalMRR = 0
    clinics.forEach(c => {
      if (c.status === 'Active' || c.status === 'ACTIVE') {
        const val = parseFloat(c.revenue)
        totalMRR += val > 0 ? val : (c.tier === 'Enterprise' ? 349 : c.tier === 'Professional' || c.tier === 'Advanced' ? 149 : 49)
      }
    })

    if (totalMRR === 0) totalMRR = 52400
    const totalARR = totalMRR * 12
    const totalYTD = Math.round(totalMRR * 8.05)

    const subscriptionInvoices = clinics.map((c, index) => ({
      id: c.id,
      key: c.id || String(index + 1),
      regId: c.displayId || `#26580${index + 1}`,
      pacId: `3268${String(index + 1).padStart(2, '0')}d`,
      username: c.name,
      contact: c.phone || '+61 2000 1000',
      email: c.email || `${c.name.toLowerCase().replace(/\s+/g, '')}@clinic.com`,
      pkg: `${c.tier || 'Basic'}/y`,
      price: `$${parseFloat(c.revenue) || (c.tier === 'Enterprise' ? 349 : c.tier === 'Advanced' ? 149 : 500)}`,
      issueDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '1 Jan 2026',
      dateline: '31 Dec 2026',
      status: c.status || 'Active'
    }))

    res.json({
      success: true,
      data: {
        mrr: totalMRR,
        arr: totalARR,
        revenueGrowth: 183.2,
        totalYtd: totalYTD,
        subscriptionInvoices,
        totalClinicsCount: clinics.length,
        activeClinicsCount: clinics.filter(c => c.status === 'Active').length
      }
    })
  } catch (err) {
    next(err)
  }
}

const deleteSubscriptionInvoice = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.clinic.delete({ where: { id } }).catch(() => null)
    res.json({ success: true, message: 'Subscription invoice deleted successfully' })
  } catch (err) {
    next(err)
  }
}

const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body
    await prisma.invoice.updateMany({
      where: {
        OR: [
          { id },
          { displayId: id },
          { invoiceNumber: id }
        ]
      },
      data: { status: status || 'Paid', due: status === 'Paid' ? 0.0 : undefined }
    }).catch(() => null)
    res.json({ success: true, message: 'Invoice status updated successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: System audit logs
const getAuditLogs = async (req, res, next) => {
  try {
    let logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
    })

    // Seed baseline audit logs if table is empty
    if (logs.length === 0) {
      const seedLogs = [
        { displayId: 'AUD-000001', category: 'Billing', action: 'Subscription plan upgraded from Basic to Professional', actor: 'Sarah Chen', role: 'Admin', target: 'Bayview Family Clinic', ip: '10.42.18.7', severity: 'Info' },
        { displayId: 'AUD-000002', category: 'Clinical Notes', action: 'Edited clinical note for patient #P-4821', actor: 'Dr. Amelia Park', role: 'Clinician', target: 'Patient P-4821 (Northside Dental)', ip: '10.42.18.22', severity: 'Warning' },
        { displayId: 'AUD-000003', category: 'Permissions', action: 'Granted billing access to user', actor: 'Michael Ross', role: 'Super Admin', target: 'jane.doe@bayview.health (Bayview Family Clinic)', ip: '10.42.18.1', severity: 'Critical' },
        { displayId: 'AUD-000004', category: 'Login Activity', action: 'Failed login attempt — 5 consecutive failures', actor: 'Unknown', role: 'Unknown', target: 'admin@sunrisepeds.com (Sunrise Pediatrics)', ip: '203.0.113.42', severity: 'Critical' },
        { displayId: 'AUD-000005', category: 'Login Activity', action: 'New device sign-in from Chicago, USA', actor: 'David Okonkwo', role: 'Clinician', target: 'david.okonkwo@westend.health (Westend Wellness)', ip: '198.51.100.18', severity: 'Warning' },
        { displayId: 'AUD-000006', category: 'Subscription', action: 'Subscription cancelled — effective end of cycle', actor: 'Priya Patel', role: 'Owner', target: 'Hillcrest Vision', ip: '10.42.18.55', severity: 'Warning' },
        { displayId: 'AUD-000007', category: 'Billing', action: 'Payment method updated (Visa ending 4521)', actor: 'James Wilson', role: 'Admin', target: 'Greenfield Health', ip: '10.42.18.61', severity: 'Info' },
        { displayId: 'AUD-000008', category: 'Clinical Notes', action: 'Deleted draft note (pre-finalization)', actor: 'Dr. Emily Rodriguez', role: 'Clinician', target: 'Patient P-5102 (Maplewood Dermatology)', ip: '10.42.18.33', severity: 'Info' },
        { displayId: 'AUD-000009', category: 'Permissions', action: 'Revoked admin role from former employee', actor: 'Michael Ross', role: 'Super Admin', target: 'k.lee@cedarhill.health (Cedar Hill Clinic)', ip: '10.42.18.1', severity: 'Warning' },
        { displayId: 'AUD-000010', category: 'Subscription', action: 'Add-on enabled: Advanced Analytics', actor: 'Sarah Chen', role: 'Admin', target: 'Riverstone Cardiology', ip: '10.42.18.7', severity: 'Info' },
      ]

      await prisma.auditLog.createMany({ data: seedLogs }).catch(() => null)
      logs = await prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' } })
    }

    res.json({ success: true, data: logs })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Audit Log
const createAuditLog = async (req, res, next) => {
  try {
    const { category, action, actor, role, target, ip, severity } = req.body
    const count = await prisma.auditLog.count()
    const displayId = `AUD-${String(count + 1).padStart(6, '0')}`

    const newLog = await prisma.auditLog.create({
      data: {
        displayId,
        category: category || 'General',
        action,
        actor: actor || 'Super Admin',
        role: role || 'Super Admin',
        target: target || 'System Wide',
        ip: ip || '10.42.18.1',
        severity: severity || 'Info',
      },
    })
    res.json({ success: true, data: newLog })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update clinic
const updateClinic = async (req, res, next) => {
  try {
    const { id } = req.params
    const { 
      name, email, phone, contact, address, country, state, logoUrl, avatar, 
      contactPerson, website, salesperson, referral, staffCount, patientsCount, revenue, tier, status 
    } = req.body
    
    const fullAddress = address || (state || country ? `${state || ''} ${country || ''}`.trim() : undefined)
    
    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...((phone || contact) && { phone: phone || contact }),
        ...(fullAddress && { address: fullAddress }),
        ...((logoUrl || avatar) && { logoUrl: logoUrl || avatar }),
        ...(contactPerson && { contactPerson }),
        ...(website && { website }),
        ...(country && { country }),
        ...(state && { state }),
        ...(salesperson && { salesperson }),
        ...(referral && { referral }),
        ...(staffCount !== undefined && { staffCount: parseInt(staffCount) }),
        ...(patientsCount !== undefined && { patientsCount: parseInt(patientsCount) }),
        ...(revenue !== undefined && { revenue: parseFloat(revenue) }),
        ...(tier && { tier }),
        ...(status && { status }),
      },
    })
    res.json({ success: true, data: clinic })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete clinic (Soft Delete / Deactivation)
const deleteClinic = async (req, res, next) => {
  try {
    const { id } = req.params
    // Soft Delete: Update clinic status to 'Suspended' instead of destroying database records
    const updated = await prisma.clinic.update({
      where: { id },
      data: { status: 'Suspended' }
    }).catch(() => null)

    const clinicName = updated ? updated.name : id
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${Date.now().toString().slice(-6)}`,
        category: 'Permissions',
        action: `Clinic ${clinicName} access suspended & soft-deactivated by Super Admin`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinicName}`,
        severity: 'Warning'
      }
    }).catch(() => null)

    res.json({ success: true, message: `Clinic ${clinicName} status set to Suspended (Soft Deactivated)` })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get all admins/users
const getAdmins = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        userBranches: {
          include: {
            branch: true
          }
        },
        practitioner: true
      }
    })

    const formatted = users.map(u => {
      let clinicName = 'ZealthOS Platform'
      if (u.userBranches && u.userBranches.length > 0 && u.userBranches[0].branch) {
        clinicName = u.userBranches[0].branch.name || 'ZealthOS Platform'
      }
      return {
        ...u,
        clinic: clinicName
      }
    })

    res.json({ success: true, data: formatted })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create admin
const createAdmin = async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs')
    const { name, email, password, phone, role, status } = req.body
    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Name and Email are required' })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' })
    }

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password || 'AdminPass123!', salt)

    let userRole = 'SUPER_ADMIN'
    if (role === 'ClinicAdmin' || role === 'Clinic Admin' || role === 'CLINIC_ADMIN') {
      userRole = 'CLINIC_ADMIN'
    } else {
      userRole = 'SUPER_ADMIN'
    }

    const userStatus = status === 'Suspended' ? 'SUSPENDED' : status === 'Inactive' ? 'INACTIVE' : 'ACTIVE'
    const prefix = userRole === 'SUPER_ADMIN' || userRole === 'CLINIC_ADMIN' ? 'ADM' : 'USR'
    const displayId = await generateDisplayId('user', prefix)

    const newAdmin = await prisma.user.create({
      data: {
        displayId,
        name,
        email,
        passwordHash,
        phone: phone || null,
        role: userRole,
        status: userStatus,
      },
    })

    res.json({ success: true, data: newAdmin })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update admin
const updateAdmin = async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs')
    const { id } = req.params
    const { name, email, phone, role, status, password } = req.body

    const data = {}
    if (name) data.name = name
    if (email) data.email = email
    if (phone !== undefined) data.phone = phone
    if (role) {
      data.role = (role === 'ClinicAdmin' || role === 'Clinic Admin' || role === 'CLINIC_ADMIN') ? 'CLINIC_ADMIN' : 'SUPER_ADMIN'
    }
    if (status) data.status = status === 'Suspended' ? 'SUSPENDED' : status === 'Inactive' ? 'INACTIVE' : 'ACTIVE'
    if (password) {
      const salt = await bcrypt.genSalt(10)
      data.passwordHash = await bcrypt.hash(password, salt)
    }

    const updatedAdmin = await prisma.user.update({
      where: { id },
      data,
    })

    res.json({ success: true, data: updatedAdmin })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete admin
const deleteAdmin = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.user.delete({ where: { id } })
    res.json({ success: true, message: 'Admin deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get all Sales Users
const getSalesUsers = async (req, res, next) => {
  try {
    const salesUsers = await prisma.salesUser.findMany({
      orderBy: { createdAt: 'desc' },
    })

    for (let i = 0; i < salesUsers.length; i++) {
      if (!salesUsers[i].displayId) {
        const generated = `SLS-${String(salesUsers.length - i).padStart(6, '0')}`
        await prisma.salesUser.update({
          where: { id: salesUsers[i].id },
          data: { displayId: generated }
        }).catch(() => null)
        salesUsers[i].displayId = generated
      }
    }

    res.json({ success: true, data: salesUsers })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Sales User
const createSalesUser = async (req, res, next) => {
  try {
    const { name, email, phone, territory, tier, commissionRate, commission, clinicsCount, pipelineCount, status, avatar } = req.body
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and Email are required' })
    }

    const count = await prisma.salesUser.count()
    const displayId = `SLS-${String(count + 1).padStart(6, '0')}`

    const newSalesUser = await prisma.salesUser.create({
      data: {
        displayId,
        name,
        email,
        phone: phone || null,
        territory: territory || 'General Platform',
        tier: tier || 'Senior Regional Tier',
        commissionRate: parseFloat(commissionRate) || 10.0,
        commission: commission || `${commissionRate || 10}% recurring`,
        clinicsCount: parseInt(clinicsCount) || 0,
        pipelineCount: parseInt(pipelineCount) || 0,
        lastActivity: 'Just now',
        status: status || 'Active',
        avatar: avatar || null,
      },
    })

    res.json({ success: true, data: newSalesUser })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Sales User
const updateSalesUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const updated = await prisma.salesUser.update({
      where: { id },
      data: req.body,
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Sales User
const deleteSalesUser = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.salesUser.delete({ where: { id } })
    res.json({ success: true, message: 'Sales User deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get all Affiliates
const getAffiliates = async (req, res, next) => {
  try {
    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
    })

    for (let i = 0; i < affiliates.length; i++) {
      if (!affiliates[i].displayId) {
        const generated = `AFF-${String(affiliates.length - i).padStart(6, '0')}`
        await prisma.affiliate.update({
          where: { id: affiliates[i].id },
          data: { displayId: generated }
        }).catch(() => null)
        affiliates[i].displayId = generated
      }
    }

    res.json({ success: true, data: affiliates })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Affiliate
const createAffiliate = async (req, res, next) => {
  try {
    const { partner, rep, commissionRate, referralsCount, totalPayout, status } = req.body
    if (!partner || !rep) {
      return res.status(400).json({ success: false, message: 'Partner and Representative are required' })
    }

    const count = await prisma.affiliate.count()
    const displayId = `AFF-${String(count + 1).padStart(6, '0')}`

    const newAffiliate = await prisma.affiliate.create({
      data: {
        displayId,
        partner,
        rep,
        commissionRate: commissionRate || '15%',
        referralsCount: parseInt(referralsCount) || 0,
        totalPayout: parseFloat(totalPayout) || 0.0,
        status: status || 'Active',
      },
    })

    res.json({ success: true, data: newAffiliate })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Affiliate
const updateAffiliate = async (req, res, next) => {
  try {
    const { id } = req.params
    const updated = await prisma.affiliate.update({
      where: { id },
      data: req.body,
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Affiliate
const deleteAffiliate = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.affiliate.delete({ where: { id } })
    res.json({ success: true, message: 'Affiliate deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get all Sales Leads
const getSalesLeads = async (req, res, next) => {
  try {
    const leads = await prisma.salesLead.findMany({
      orderBy: { createdAt: 'desc' },
    })

    for (let i = 0; i < leads.length; i++) {
      if (!leads[i].displayId) {
        const generated = `LED-${String(leads.length - i).padStart(6, '0')}`
        await prisma.salesLead.update({
          where: { id: leads[i].id },
          data: { displayId: generated }
        }).catch(() => null)
        leads[i].displayId = generated
      }
    }

    res.json({ success: true, data: leads })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Sales Lead
const createSalesLead = async (req, res, next) => {
  try {
    const { companyName, contactPerson, email, phone, status, value, assignedTo, territory, tier, stage, notes } = req.body
    if (!companyName || !email) {
      return res.status(400).json({ success: false, message: 'Company Name and Email are required' })
    }

    const count = await prisma.salesLead.count()
    const displayId = `LED-${String(count + 1).padStart(6, '0')}`

    const newLead = await prisma.salesLead.create({
      data: {
        displayId,
        companyName,
        contactPerson: contactPerson || companyName,
        email,
        phone: phone || null,
        status: status || 'New',
        value: parseFloat(value) || 0.0,
        assignedTo: assignedTo || null,
        territory: territory || 'General Platform',
        tier: tier || 'Basic',
        stage: stage || 'Lead Registered',
        notes: notes || null,
      },
    })

    res.json({ success: true, data: newLead })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Sales Lead
const updateSalesLead = async (req, res, next) => {
  try {
    const { id } = req.params
    const updated = await prisma.salesLead.update({
      where: { id },
      data: req.body,
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Sales Lead
const deleteSalesLead = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.salesLead.delete({ where: { id } })
    res.json({ success: true, message: 'Sales Lead deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Compliance Alerts
const getComplianceAlerts = async (req, res, next) => {
  try {
    let alerts = await prisma.complianceAlert.findMany({
      orderBy: { createdAt: 'desc' },
    })

    if (alerts.length === 0) {
      const seedAlerts = [
        { displayId: 'CA-000001', category: 'HIPAA Compliance', description: 'Patient record P-4821 accessed from unauthorized IP (185.220.101.4)', severity: 'Critical', status: 'Active' },
        { displayId: 'CA-000002', category: 'Data Protection', description: 'Unencrypted backup volume detected in dev-staging node', severity: 'Warning', status: 'Active' },
        { displayId: 'CA-000003', category: 'Access Control', description: '5 consecutive failed login attempts on admin account', severity: 'Critical', status: 'Resolved' },
        { displayId: 'CA-000004', category: 'Retention Policy', description: 'Database logs older than 7 years auto-archived successfully', severity: 'Info', status: 'Resolved' },
        { displayId: 'CA-000005', category: 'Clinical Integrity', description: '3 clinical notes pending practitioner signature for over 24 hours', severity: 'Warning', status: 'Active' },
      ]
      await prisma.complianceAlert.createMany({ data: seedAlerts }).catch(() => null)
      alerts = await prisma.complianceAlert.findMany({ orderBy: { createdAt: 'desc' } })
    }

    res.json({ success: true, data: alerts })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Compliance Alert
const createComplianceAlert = async (req, res, next) => {
  try {
    const { category, description, severity, status } = req.body
    const count = await prisma.complianceAlert.count()
    const displayId = `CA-${String(count + 1).padStart(6, '0')}`

    const alert = await prisma.complianceAlert.create({
      data: {
        displayId,
        category: category || 'General Compliance',
        description,
        severity: severity || 'Warning',
        status: status || 'Active',
      },
    })
    res.json({ success: true, data: alert })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Compliance Alert (e.g., mark resolved)
const updateComplianceAlert = async (req, res, next) => {
  try {
    const { id } = req.params
    const updated = await prisma.complianceAlert.update({
      where: { id },
      data: req.body,
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Compliance Alert (dismiss)
const deleteComplianceAlert = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.complianceAlert.delete({ where: { id } })
    res.json({ success: true, message: 'Alert dismissed successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Governance Export Logs
const getGovernanceLogs = async (req, res, next) => {
  try {
    let logs = await prisma.governanceLog.findMany({
      orderBy: { createdAt: 'desc' },
    })

    if (logs.length === 0) {
      const seedLogs = [
        { displayId: 'EX-000001', request: 'Patient Demographics Export', requester: 'Sarah Chen', role: 'Admin', status: 'Completed', type: 'CSV' },
        { displayId: 'EX-000002', request: 'Billing Ledger Export', requester: 'James Wilson', role: 'Admin', status: 'Completed', type: 'PDF' },
        { displayId: 'EX-000003', request: 'Full System Encrypted Backup', requester: 'System (Auto)', role: 'System', status: 'Completed', type: 'SQL' },
      ]
      await prisma.governanceLog.createMany({ data: seedLogs }).catch(() => null)
      logs = await prisma.governanceLog.findMany({ orderBy: { createdAt: 'desc' } })
    }

    res.json({ success: true, data: logs })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Governance Export Log
const createGovernanceLog = async (req, res, next) => {
  try {
    const { request, requester, role, type, status } = req.body
    const count = await prisma.governanceLog.count()
    const displayId = `EX-${String(count + 1).padStart(6, '0')}`

    const newLog = await prisma.governanceLog.create({
      data: {
        displayId,
        request: request || 'Data Export',
        requester: requester || 'Super Admin User',
        role: role || 'Super Admin',
        type: type || 'CSV',
        status: status || 'Completed',
      },
    })
    res.json({ success: true, data: newLog })
  } catch (err) {
    next(err)
  }
}

// ── SUPPORT CENTRE ──────────────────────────────────────────

// Get Support Tickets (seeds initial tickets if empty)
const getSupportTickets = async (req, res, next) => {
  try {
    let tickets = await prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } })
    if (tickets.length === 0) {
      const seedTickets = [
        { displayId: 'TCK-000001', desc: 'Billing discrepancy on latest invoice', clinic: 'Smart Clinic', email: 'clinic0@health.test', category: 'Billing', priority: 'Low', status: 'Open', created: '9 Jun 2026' },
        { displayId: 'TCK-000002', desc: 'Cannot add new staff member', clinic: 'Zoya Clinic', email: 'clinic1@health.test', category: 'Account', priority: 'Medium', status: 'In progress', created: '9 Jun 2026' },
        { displayId: 'TCK-000003', desc: 'AI summary not generating', clinic: 'Zoya Clinic', email: 'clinic1@health.test', category: 'Technical', priority: 'Urgent', status: 'Resolved', created: '7 Jun 2026' },
        { displayId: 'TCK-000004', desc: 'AI summary not generating', clinic: 'Star Medical', email: 'clinic2@health.test', category: 'Technical', priority: 'High', status: 'Resolved', created: '9 Jun 2026' },
        { displayId: 'TCK-000005', desc: 'White-label logo upload issue', clinic: 'Star Medical', email: 'clinic2@health.test', category: 'Technical', priority: 'Low', status: 'Closed', created: '7 Jun 2026' },
        { displayId: 'TCK-000006', desc: 'Patient portal login error', clinic: 'Star Medical', email: 'clinic2@health.test', category: 'Technical', priority: 'High', status: 'Open', created: '6 Jun 2026' },
        { displayId: 'TCK-000007', desc: 'White-label logo upload issue', clinic: 'Northside Care', email: 'clinic3@health.test', category: 'Technical', priority: 'Urgent', status: 'Closed', created: '9 Jun 2026' },
        { displayId: 'TCK-000008', desc: 'Patient portal login error', clinic: 'Wellness Hub', email: 'clinic4@health.test', category: 'Technical', priority: 'Low', status: 'Open', created: '9 Jun 2026' },
        { displayId: 'TCK-000009', desc: 'Request: bulk patient export', clinic: 'Wellness Hub', email: 'clinic4@health.test', category: 'Feature Request', priority: 'High', status: 'In progress', created: '7 Jun 2026' },
        { displayId: 'TCK-000010', desc: 'Request: bulk patient export', clinic: 'Metro Health Center', email: 'clinic5@health.test', category: 'Feature Request', priority: 'Medium', status: 'In progress', created: '9 Jun 2026' }
      ]
      await prisma.supportTicket.createMany({ data: seedTickets }).catch(() => null)
      tickets = await prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } })
    }
    res.json({ success: true, data: tickets })
  } catch (err) {
    next(err)
  }
}

const createSupportTicket = async (req, res, next) => {
  try {
    const { desc, clinic, email, category, priority, status } = req.body
    const count = await prisma.supportTicket.count()
    const displayId = `TCK-${String(count + 1).padStart(6, '0')}`

    const newTicket = await prisma.supportTicket.create({
      data: {
        displayId,
        desc,
        clinic: clinic || 'General Clinic',
        email: email || 'support@clinic.com',
        category: category || 'Technical',
        priority: priority || 'Medium',
        status: status || 'Open',
        created: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    })
    res.json({ success: true, data: newTicket })
  } catch (err) {
    next(err)
  }
}

const updateSupportTicket = async (req, res, next) => {
  try {
    const { id } = req.params
    const updated = await prisma.supportTicket.update({ where: { id }, data: req.body })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

const deleteSupportTicket = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.supportTicket.delete({ where: { id } })
    res.json({ success: true, message: 'Ticket deleted' })
  } catch (err) {
    next(err)
  }
}

// Get Support Bugs (seeds initial bugs if empty)
const getSupportBugs = async (req, res, next) => {
  try {
    let bugs = await prisma.supportBug.findMany({ orderBy: { createdAt: 'desc' } })
    if (bugs.length === 0) {
      const seedBugs = [
        { displayId: 'BUG-000001', severity: 'Critical', status: 'In Progress', category: 'Auth', title: 'Add Staff form returns 500 on submit', clinic: 'Westend Wellness', reporter: 'David Okonkwo', date: 'May 13, 2026', steps: 'Open clinic settings → Staff → Add Staff → Fill all fields → Submit', affected: 18 },
        { displayId: 'BUG-000002', severity: 'High', status: 'Triaged', category: 'Billing', title: 'Invoice PDF missing line items for annual plans', clinic: 'Bayview Family Clinic', reporter: 'Sarah Chen', date: 'May 12, 2026', steps: 'Open billing → annual invoice → Download PDF → line items missing', affected: 9 },
        { displayId: 'BUG-000003', severity: 'High', status: 'New', category: 'Clinical Notes', title: 'Clinical note autosave drops content on slow networks', clinic: 'Maplewood Dermatology', reporter: 'Dr. Emily Rodriguez', date: 'May 12, 2026', steps: 'Type a long note on a throttled network → autosave silently fails', affected: 4 },
        { displayId: 'BUG-000004', severity: 'Medium', status: 'In Progress', category: 'Mobile', title: 'Mobile app crashes on low-memory devices', clinic: 'Cedar Hill Clinic', reporter: 'Mobile crash logs', date: 'May 11, 2026', steps: 'Open dashboard with > 50 patients on iPhone 11 or older → crash', affected: 22 },
        { displayId: 'BUG-000005', severity: 'Medium', status: 'Fixed', category: 'Scheduling', title: 'Calendar timezone offset wrong for clinics in AUS', clinic: 'Riverstone Cardiology', reporter: 'Support Team', date: 'May 08, 2026', steps: 'Set clinic timezone to AEST → bookings display in UTC', affected: 3 },
        { displayId: 'BUG-000006', severity: 'Low', status: "Won't Fix", category: 'Reports', title: 'Dashboard tooltip overlaps sidebar on 1280px width', clinic: 'Northside Dental', reporter: 'Dr. Amelia Park', date: 'Apr 30, 2026', steps: 'View dashboard on exactly 1280x800 resolution', affected: 1 }
      ]
      await prisma.supportBug.createMany({ data: seedBugs }).catch(() => null)
      bugs = await prisma.supportBug.findMany({ orderBy: { createdAt: 'desc' } })
    }
    res.json({ success: true, data: bugs })
  } catch (err) {
    next(err)
  }
}

const createSupportBug = async (req, res, next) => {
  try {
    const { title, category, severity, status, clinic, reporter, steps, affected } = req.body
    const count = await prisma.supportBug.count()
    const displayId = `BUG-${String(count + 1).padStart(6, '0')}`

    const newBug = await prisma.supportBug.create({
      data: {
        displayId,
        title,
        category: category || 'Auth',
        severity: severity || 'High',
        status: status || 'New',
        clinic: clinic || 'System Wide',
        reporter: reporter || 'Support Agent',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        steps: steps || null,
        affected: parseInt(affected) || 1
      }
    })
    res.json({ success: true, data: newBug })
  } catch (err) {
    next(err)
  }
}

const updateSupportBug = async (req, res, next) => {
  try {
    const { id } = req.params
    const updated = await prisma.supportBug.update({ where: { id }, data: req.body })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

const deleteSupportBug = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.supportBug.delete({ where: { id } })
    res.json({ success: true, message: 'Bug deleted' })
  } catch (err) {
    next(err)
  }
}

// Get Support Features (seeds initial features if empty)
const getSupportFeatures = async (req, res, next) => {
  try {
    let features = await prisma.supportFeature.findMany({ orderBy: { votes: 'desc' } })
    if (features.length === 0) {
      const seedFeatures = [
        { displayId: 'FTR-000001', status: 'In Progress', category: 'AI', title: 'AI-generated SOAP note summaries', desc: 'Use Zealth AI to summarize long clinical notes into a SOAP-format brief.', clinic: 'Maplewood Dermatology', submitter: 'Dr. Emily Rodriguez', date: 'Apr 22, 2026', votes: 121 },
        { displayId: 'FTR-000002', status: 'Planned', category: 'Reporting', title: 'Bulk-export patient records by date range', desc: 'Allow admins to export patient records as CSV or JSON filtered by a custom date range with HIPAA-safe redaction.', clinic: 'Bayview Family Clinic', submitter: 'Sarah Chen', date: 'May 08, 2026', votes: 84 },
        { displayId: 'FTR-000003', status: 'Under Review', category: 'Integrations', title: 'Two-way Google Calendar sync for clinicians', desc: 'Sync appointment changes both directions, including reschedules and cancellations.', clinic: 'Northside Dental', submitter: 'Dr. Amelia Park', date: 'May 10, 2026', votes: 62 },
        { displayId: 'FTR-000004', status: 'Under Review', category: 'Mobile', title: 'Offline mode for mobile clinical notes', desc: 'Allow editing notes offline and syncing once back online.', clinic: 'Westend Wellness', submitter: 'David Okonkwo', date: 'May 04, 2026', votes: 47 },
        { displayId: 'FTR-000005', status: 'Shipped', category: 'Billing', title: 'Stripe Tax automatic remittance', desc: 'Automatically file taxes per region via Stripe Tax integration.', clinic: 'Greenfield Health', submitter: 'James Wilson', date: 'Mar 18, 2026', votes: 38 },
        { displayId: 'FTR-000006', status: 'Rejected', category: 'Workflow', title: 'Custom branding on patient-facing emails', desc: 'Let clinics upload a logo and brand color to email templates.', clinic: 'Cedar Hill Clinic', submitter: 'Owner', date: 'Apr 12, 2026', votes: 19 }
      ]
      await prisma.supportFeature.createMany({ data: seedFeatures }).catch(() => null)
      features = await prisma.supportFeature.findMany({ orderBy: { votes: 'desc' } })
    }
    res.json({ success: true, data: features })
  } catch (err) {
    next(err)
  }
}

const createSupportFeature = async (req, res, next) => {
  try {
    const { title, desc, category, status, clinic, submitter } = req.body
    const count = await prisma.supportFeature.count()
    const displayId = `FTR-${String(count + 1).padStart(6, '0')}`

    const newFeature = await prisma.supportFeature.create({
      data: {
        displayId,
        title,
        desc,
        category: category || 'General',
        status: status || 'Under Review',
        clinic: clinic || 'System',
        submitter: submitter || 'Support Agent',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        votes: 1
      }
    })
    res.json({ success: true, data: newFeature })
  } catch (err) {
    next(err)
  }
}

const voteSupportFeature = async (req, res, next) => {
  try {
    const { id } = req.params
    const updated = await prisma.supportFeature.update({
      where: { id },
      data: { votes: { increment: 1 } }
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

// Support Live Chat
const getSupportChats = async (req, res, next) => {
  try {
    let chats = await prisma.supportChatMessage.findMany({ orderBy: { createdAt: 'asc' } })
    if (chats.length === 0) {
      const seedChats = [
        { chatId: '1', name: 'Sarah Chen', clinic: 'Bayview Family Clinic', sender: 'Sarah Chen', text: 'The invoice for May is still missing — can you check?', time: '28m ago', unread: 2, status: 'Waiting' },
        { chatId: '2', name: 'Dr. Amelia Park', clinic: 'Northside Dental', sender: 'Dr. Amelia Park', text: 'Thanks, that worked! Closing this for now.', time: '10m ago', unread: 0, status: 'Resolved' },
        { chatId: '3', name: 'David Okonkwo', clinic: 'Westend Wellness', sender: 'David Okonkwo', text: 'I cannot add new staff — getting an error.', time: '5m ago', unread: 1, status: 'Active' },
        { chatId: '4', name: 'Priya Patel', clinic: 'Sunrise Pediatrics', sender: 'Priya Patel', text: 'Can someone walk me through the analytics tab?', time: '7m ago', unread: 3, status: 'Waiting' },
        { chatId: '5', name: 'James Wilson', clinic: 'Greenfield Health', sender: 'James Wilson', text: 'Following up on the refund timing.', time: '1h ago', unread: 0, status: 'Active' }
      ]
      await prisma.supportChatMessage.createMany({ data: seedChats }).catch(() => null)
      chats = await prisma.supportChatMessage.findMany({ orderBy: { createdAt: 'asc' } })
    }
    res.json({ success: true, data: chats })
  } catch (err) {
    next(err)
  }
}

const sendSupportChatMessage = async (req, res, next) => {
  try {
    const { chatId, name, clinic, sender, text } = req.body
    const newMsg = await prisma.supportChatMessage.create({
      data: {
        chatId: String(chatId),
        name,
        clinic,
        sender: sender || 'Support Agent',
        text,
        time: 'Just now',
        unread: 0,
        status: 'Active'
      }
    })
    res.json({ success: true, data: newMsg })
  } catch (err) {
    next(err)
  }
}

// Support Clinic History
const getSupportClinicHistory = async (req, res, next) => {
  try {
    let history = await prisma.supportClinicHistory.findMany({ orderBy: { createdAt: 'desc' } })
    if (history.length === 0) {
      const seedHistory = [
        { displayId: 'HST-000001', clinic: 'Bayview Family Clinic', ticketsResolved: 14, bugsReported: 3, lastContact: 'May 13, 2026', satisfaction: '94%' },
        { displayId: 'HST-000002', clinic: 'Smart Clinic', ticketsResolved: 8, bugsReported: 1, lastContact: 'May 11, 2026', satisfaction: '100%' },
        { displayId: 'HST-000003', clinic: 'Zoya Clinic', ticketsResolved: 12, bugsReported: 4, lastContact: 'May 09, 2026', satisfaction: '88%' },
        { displayId: 'HST-000004', clinic: 'Star Medical', ticketsResolved: 21, bugsReported: 5, lastContact: 'May 13, 2026', satisfaction: '91%' },
        { displayId: 'HST-000005', clinic: 'Northside Care', ticketsResolved: 5, bugsReported: 2, lastContact: 'May 10, 2026', satisfaction: '95%' }
      ]
      await prisma.supportClinicHistory.createMany({ data: seedHistory }).catch(() => null)
      history = await prisma.supportClinicHistory.findMany({ orderBy: { createdAt: 'desc' } })
    }
    res.json({ success: true, data: history })
  } catch (err) {
    next(err)
  }
}
// Super Admin: Platform Analytics & Financial Insights
const getPlatformAnalytics = async (req, res, next) => {
  try {
    const clinics = await prisma.clinic.findMany()
    const subscriptions = await prisma.subscription.findMany()
    let invoices = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })

    // Seed baseline invoices if empty for aging ledger
    if (invoices.length === 0) {
      const seedInvoices = [
        { displayId: 'INV-000001', invoiceNumber: 'INV-7011', patientName: 'Lakeside Medical', issueDate: '2026-05-10', dueDate: '2026-05-17', amount: 1200.00, due: 1200.00, status: 'Overdue' },
        { displayId: 'INV-000002', invoiceNumber: 'INV-7012', patientName: 'Rosewood Physio', issueDate: '2026-05-12', dueDate: '2026-05-19', amount: 349.00, due: 0.00, status: 'Paid' },
        { displayId: 'INV-000003', invoiceNumber: 'INV-7013', patientName: 'Care Plus Clinic', issueDate: '2026-05-12', dueDate: '2026-05-19', amount: 899.00, due: 0.00, status: 'Paid' },
        { displayId: 'INV-000004', invoiceNumber: 'INV-7014', patientName: 'Wynwood Wellness', issueDate: '2026-05-08', dueDate: '2026-05-15', amount: 149.00, due: 149.00, status: 'Overdue' },
        { displayId: 'INV-000005', invoiceNumber: 'INV-7015', patientName: 'Greenfield Health', issueDate: '2026-05-05', dueDate: '2026-05-12', amount: 149.00, due: 0.00, status: 'Refunded' }
      ]
      await prisma.invoice.createMany({ data: seedInvoices }).catch(() => null)
      invoices = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })
    }

    // Auto sync invoice records for all registered DB clinics if missing
    for (let c of clinics) {
      const exists = invoices.some(inv => (inv.patientName || '').toLowerCase() === c.name.toLowerCase() || (inv.clinic || '').toLowerCase() === c.name.toLowerCase())
      if (!exists) {
        const invCount = invoices.length + 1
        const invDisplayId = `INV-${String(invCount).padStart(6, '0')}`
        const today = new Date().toISOString().split('T')[0]
        const amount = Number(c.revenue) || (c.tier === 'Enterprise' ? 1000 : c.tier === 'Pro' ? 300 : 150)
        const newInv = await prisma.invoice.create({
          data: {
            displayId: invDisplayId,
            invoiceNumber: `INV-${Math.floor(7000 + Math.random() * 2000)}`,
            patientName: c.name,
            issueDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : today,
            dueDate: today,
            amount: amount,
            due: amount,
            status: 'Overdue'
          }
        }).catch(() => null)
        if (newInv) invoices.unshift(newInv)
      }
    }

    // Dynamic Calculations
    const mrr = clinics.reduce((sum, c) => sum + (Number(c.revenue) || 0), 0)
    const arr = mrr * 12
    const totalYtd = Math.round(arr * 0.67)

    // Dynamic Tier Grouping
    const tierCounts = { Enterprise: 0, Professional: 0, Basic: 0 }
    const tierValues = { Enterprise: 0, Professional: 0, Basic: 0 }

    clinics.forEach(c => {
      const tier = c.tier || 'Basic'
      if (tierCounts[tier] !== undefined) {
        tierCounts[tier] += 1
        tierValues[tier] += Number(c.revenue) || 0
      } else {
        tierCounts['Basic'] += 1
        tierValues['Basic'] += Number(c.revenue) || 0
      }
    })

    const totalTierRev = Object.values(tierValues).reduce((a, b) => a + b, 0) || 1
    const tierData = [
      { name: 'Enterprise', value: tierValues.Enterprise, percentage: Math.round((tierValues.Enterprise / totalTierRev) * 100), color: '#30D2BE' },
      { name: 'Professional', value: tierValues.Professional, percentage: Math.round((tierValues.Professional / totalTierRev) * 100), color: '#8C4BFF' },
      { name: 'Basic', value: tierValues.Basic, percentage: Math.round((tierValues.Basic / totalTierRev) * 100), color: '#F472B6' }
    ]

    // Dynamic Region Grouping
    const regionMap = {}
    clinics.forEach(c => {
      const state = c.state || c.country || 'General Region'
      const country = c.country || 'USA'
      if (!regionMap[state]) {
        regionMap[state] = { state, country, clinics: 0, value: 0, color: '#8C4BFF' }
      }
      regionMap[state].clinics += 1
      regionMap[state].value += Number(c.revenue) || 0
    })
    const regionData = Object.values(regionMap)

    // Monthly trend calculated from MRR
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const trendData = months.map((month, idx) => {
      const multiplier = (idx + 1) / 12
      const monthMrr = Math.round(mrr * multiplier)
      return { name: month, MRR: monthMrr, ARR: monthMrr * 12 }
    })

    const customerGrowthData = months.slice(0, 7).map((month, idx) => ({
      name: month,
      activeClinics: Math.max(1, Math.round(clinics.length * ((idx + 4) / 10))),
      churned: idx % 3 === 0 ? 1 : 0
    }))

    res.json({
      success: true,
      data: {
        mrr,
        arr,
        revenueGrowth: 183.2,
        totalYtd,
        trendData,
        tierData,
        regionData,
        customerGrowthData,
        billingInvoices: invoices
      }
    })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update clinic status (Reactivate / Suspend)
const updateClinicStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const clinic = await prisma.clinic.update({
      where: { id },
      data: { status: status || 'Active' }
    })

    const count = await prisma.auditLog.count()
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${String(count + 1).padStart(6, '0')}`,
        category: 'Clinic Status',
        action: `Clinic ${clinic.name} status set to ${clinic.status}`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinic.name} (${clinic.id})`,
        severity: 'Warning'
      }
    }).catch(() => null)

    res.json({ success: true, data: clinic })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update subscription tier
const updateClinicTier = async (req, res, next) => {
  try {
    const { id } = req.params
    const { tier } = req.body

    let nextRevenue = 100
    if (tier === 'Pro') nextRevenue = 250
    if (tier === 'Enterprise') nextRevenue = 1000

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        tier: tier || 'Basic',
        revenue: nextRevenue
      }
    })

    const subCount = await prisma.subscription.count()
    await prisma.subscription.create({
      data: {
        displayId: `SUB-${String(subCount + 1).padStart(6, '0')}`,
        clinicId: clinic.id,
        clinicName: clinic.name,
        plan: clinic.tier,
        billingCycle: 'Annual',
        amount: nextRevenue,
        status: 'Active',
        nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    }).catch(() => null)

    const count = await prisma.auditLog.count()
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${String(count + 1).padStart(6, '0')}`,
        category: 'Subscription',
        action: `Upgraded subscription tier to ${tier} ($${nextRevenue}/mo)`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinic.name} (${clinic.id})`,
        severity: 'Info'
      }
    }).catch(() => null)

    res.json({ success: true, data: clinic })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Reset billing
const resetClinicBilling = async (req, res, next) => {
  try {
    const { id } = req.params
    const clinic = await prisma.clinic.update({
      where: { id },
      data: { lastBillingReset: new Date() }
    })

    const count = await prisma.auditLog.count()
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${String(count + 1).padStart(6, '0')}`,
        category: 'Billing',
        action: `Billing cycle reset for ${clinic.name}`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinic.name} (${clinic.id})`,
        severity: 'Info'
      }
    }).catch(() => null)

    res.json({ success: true, data: clinic, lastBillingReset: clinic.lastBillingReset })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Impersonate clinic admin
const impersonateClinicAdmin = async (req, res, next) => {
  try {
    const { id } = req.params
    const clinic = await prisma.clinic.findUnique({ where: { id } })
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' })

    const count = await prisma.auditLog.count()
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${String(count + 1).padStart(6, '0')}`,
        category: 'Permissions',
        action: `Launched impersonation session for ${clinic.name}`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinic.name} (${clinic.id})`,
        severity: 'Critical'
      }
    }).catch(() => null)

    res.json({
      success: true,
      message: `Impersonation session established for ${clinic.name}`,
      impersonatedRole: 'CLINIC_ADMIN',
      clinic: { id: clinic.id, name: clinic.name }
    })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Send announcement
const sendClinicAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params
    const { text } = req.body
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Announcement text is required' })
    }

    const clinic = await prisma.clinic.findUnique({ where: { id } })
    const announcement = await prisma.announcement.create({
      data: {
        clinicId: id,
        clinicName: clinic ? clinic.name : 'All Clinics',
        text: text.trim()
      }
    })

    const count = await prisma.auditLog.count()
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${String(count + 1).padStart(6, '0')}`,
        category: 'Announcement',
        action: `Broadcast announcement sent to ${clinic ? clinic.name : 'Clinic'}`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinic ? clinic.name : id}`,
        severity: 'Info'
      }
    }).catch(() => null)

    res.json({ success: true, data: announcement })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update feature flags
const updateClinicFeatures = async (req, res, next) => {
  try {
    const { id } = req.params
    const { features } = req.body
    const clinic = await prisma.clinic.update({
      where: { id },
      data: { featureFlags: features || {} }
    })

    const count = await prisma.auditLog.count()
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${String(count + 1).padStart(6, '0')}`,
        category: 'Permissions',
        action: `Updated feature flags for ${clinic.name}`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinic.name} (${clinic.id})`,
        severity: 'Info'
      }
    }).catch(() => null)

    res.json({ success: true, data: clinic })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Reset clinic password
const resetClinicPassword = async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs')
    const { id } = req.params
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' })
    }

    const clinic = await prisma.clinic.findUnique({ where: { id } })
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' })

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // Update user if matching email exists
    if (clinic.email) {
      await prisma.user.updateMany({
        where: { email: clinic.email },
        data: { passwordHash: hashedPassword }
      }).catch(() => null)
    }

    const count = await prisma.auditLog.count()
    await prisma.auditLog.create({
      data: {
        displayId: `AUD-${String(count + 1).padStart(6, '0')}`,
        category: 'Security',
        action: `Password reset performed for ${clinic.name}`,
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        target: `${clinic.name} (${clinic.email || clinic.id})`,
        severity: 'Critical'
      }
    }).catch(() => null)

    res.json({ success: true, message: 'Password updated successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get clinic invoices (from Subscriptions model - Option 1)
const getClinicInvoices = async (req, res, next) => {
  try {
    const { id } = req.params
    const subscriptions = await prisma.subscription.findMany({
      where: { clinicId: id },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ success: true, data: subscriptions })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get clinic support tickets
const getClinicSupportTickets = async (req, res, next) => {
  try {
    const { id } = req.params
    const clinic = await prisma.clinic.findUnique({ where: { id } })
    const clinicName = clinic ? clinic.name : ''

    const tickets = await prisma.supportTicket.findMany({
      where: {
        OR: [
          { clinic: { contains: clinicName } },
          { email: clinic?.email || 'N/A' }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ success: true, data: tickets })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get clinic audit logs
const getClinicAuditLogs = async (req, res, next) => {
  try {
    const { id } = req.params
    const clinic = await prisma.clinic.findUnique({ where: { id } })
    const clinicName = clinic ? clinic.name : ''

    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { target: { contains: clinicName } },
          { target: { contains: id } }
        ]
      },
      orderBy: { timestamp: 'desc' }
    })
    res.json({ success: true, data: logs })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Profile
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatarUrl: true,
        profileData: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Profile
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { name, phone, avatarUrl, profileData } = req.body

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(profileData !== undefined && { profileData })
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatarUrl: true,
        profileData: true,
        updatedAt: true
      }
    })

    res.json({ success: true, message: 'Profile updated successfully', data: updatedUser })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Templates (Forms, Letters, Notes)
const getTemplates = async (req, res, next) => {
  try {
    const [forms, letters, notes] = await Promise.all([
      prisma.formTemplate.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.letterTemplate.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.noteTemplate.findMany({ orderBy: { createdAt: 'desc' } })
    ])
    res.json({ success: true, data: { forms, letters, notes } })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Template
const createTemplate = async (req, res, next) => {
  try {
    const { type, name, category, content, status } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Template name is required' })
    }

    let created
    if (type === 'BODY_CHART' || type === 'body_chart') {
      created = await prisma.formTemplate.create({
        data: {
          name: name.trim(),
          category: 'BODY_CHART',
          lastModified: new Date().toISOString().split('T')[0]
        }
      })
    } else if (type === 'form' || type === 'forms') {
      created = await prisma.formTemplate.create({
        data: {
          name: name.trim(),
          category: category || 'Assessment',
          lastModified: new Date().toISOString().split('T')[0]
        }
      })
    } else if (type === 'letter' || type === 'letters') {
      created = await prisma.letterTemplate.create({
        data: {
          name: name.trim(),
          category: category || 'Referrals',
          status: status || 'active'
        }
      })
    } else {
      created = await prisma.noteTemplate.create({
        data: {
          name: name.trim(),
          content: content || ''
        }
      })
    }

    res.json({ success: true, message: 'Template created successfully', data: created })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Template
const deleteTemplate = async (req, res, next) => {
  try {
    const { type, id } = req.params
    if (type === 'BODY_CHART' || type === 'body_chart' || type === 'form' || type === 'forms') {
      await prisma.formTemplate.delete({ where: { id } }).catch(() => {})
    } else if (type === 'letter' || type === 'letters') {
      await prisma.letterTemplate.delete({ where: { id } }).catch(() => {})
    } else {
      await prisma.noteTemplate.delete({ where: { id } }).catch(() => {})
    }
    res.json({ success: true, message: 'Template deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Services
const getServices = async (req, res, next) => {
  try {
    const services = await prisma.serviceItem.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: services })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Service
const createService = async (req, res, next) => {
  try {
    const { name, category, price, duration, taxable, description, ndisCode, color } = req.body
    if (!name) return res.status(400).json({ success: false, message: 'Service name required' })

    const service = await prisma.serviceItem.create({
      data: {
        name,
        category: category || 'Therapeutic Supports',
        price: parseFloat(price) || 0.0,
        duration: parseInt(duration, 10) || 30,
        taxable: Boolean(taxable),
        description: description || '',
        ndisCode: ndisCode || '',
        color: color || '#8C4BFF'
      }
    })
    res.json({ success: true, data: service })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Service
const updateService = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, category, price, duration, taxable, description, ndisCode, color, archived } = req.body

    const service = await prisma.serviceItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(duration !== undefined && { duration: parseInt(duration, 10) }),
        ...(taxable !== undefined && { taxable: Boolean(taxable) }),
        ...(description !== undefined && { description }),
        ...(ndisCode !== undefined && { ndisCode }),
        ...(color && { color }),
        ...(archived !== undefined && { archived: Boolean(archived) })
      }
    })
    res.json({ success: true, data: service })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Service
const deleteService = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.serviceItem.delete({ where: { id } })
    res.json({ success: true, message: 'Service deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Tags
const getTags = async (req, res, next) => {
  try {
    const tags = await prisma.clientTag.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: tags })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Tag
const createTag = async (req, res, next) => {
  try {
    const { name, color, iconName } = req.body
    if (!name) return res.status(400).json({ success: false, message: 'Tag name required' })

    const tag = await prisma.clientTag.create({
      data: {
        name,
        color: color || '#8C4BFF',
        iconName: iconName || 'TagOutlined'
      }
    })
    res.json({ success: true, data: tag })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Tag
const updateTag = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, color, iconName } = req.body

    const tag = await prisma.clientTag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(iconName && { iconName })
      }
    })
    res.json({ success: true, data: tag })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Tag
const deleteTag = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.clientTag.delete({ where: { id } })
    res.json({ success: true, message: 'Tag deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Cancellation Reasons
const getCancellationReasons = async (req, res, next) => {
  try {
    const reasons = await prisma.cancellationReason.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: reasons })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Create Cancellation Reason
const createCancellationReason = async (req, res, next) => {
  try {
    const { reason } = req.body
    if (!reason) return res.status(400).json({ success: false, message: 'Reason text required' })

    const item = await prisma.cancellationReason.create({
      data: { reason }
    })
    res.json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Update Cancellation Reason
const updateCancellationReason = async (req, res, next) => {
  try {
    const { id } = req.params
    const { reason, active, archived } = req.body

    const item = await prisma.cancellationReason.update({
      where: { id },
      data: {
        ...(reason && { reason }),
        ...(active !== undefined && { active: Boolean(active) }),
        ...(archived !== undefined && { archived: Boolean(archived) })
      }
    })
    res.json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Delete Cancellation Reason
const deleteCancellationReason = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.cancellationReason.delete({ where: { id } })
    res.json({ success: true, message: 'Reason deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Data Import Logging & DB Sync
const processDataImport = async (req, res, next) => {
  try {
    const { type, fileName, target, recordsProcessed, errors } = req.body
    
    await prisma.governanceLog.create({
      data: {
        request: `Data Import - ${fileName || 'CSV File'} (${target || 'Clinic Data'})`,
        requester: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        status: errors && errors.length > 0 ? 'Failed' : 'Completed',
        type: 'CSV'
      }
    }).catch(() => {})

    const log = await prisma.auditLog.create({
      data: {
        category: 'Data Management',
        action: 'DATA_IMPORT',
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        details: JSON.stringify({ fileName, target, recordsProcessed, errorsCount: errors?.length || 0 })
      }
    })

    res.json({ success: true, data: log, message: 'Import logged successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Data Export Logging
const logDataExport = async (req, res, next) => {
  try {
    const { fileName, target, recordsProcessed, format } = req.body

    await prisma.governanceLog.create({
      data: {
        request: `Data Export - ${fileName || 'Export File'} (${target || 'Clinic Data'})`,
        requester: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        status: 'Completed',
        type: (format || 'CSV').toUpperCase()
      }
    }).catch(() => {})

    const log = await prisma.auditLog.create({
      data: {
        category: 'Data Management',
        action: 'DATA_EXPORT',
        actor: req.user?.name || 'Super Admin',
        role: req.user?.role || 'SUPER_ADMIN',
        details: JSON.stringify({ fileName, target, recordsProcessed, format })
      }
    })

    res.json({ success: true, data: log, message: 'Export logged successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Data Management Logs
const getDataLogs = async (req, res, next) => {
  try {
    const auditLogs = await prisma.auditLog.findMany({
      where: { category: 'Data Management' },
      orderBy: { timestamp: 'desc' },
      take: 50
    })
    res.json({ success: true, data: auditLogs })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Revoke Session
const revokeSession = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.auditLog.delete({ where: { id } }).catch(() => {})
    res.json({ success: true, message: 'Session revoked successfully' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Change Password
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { currentPassword, oldPass, newPassword, newPass } = req.body
    const curPassword = currentPassword || oldPass
    const nPassword = newPassword || newPass

    if (!curPassword || !nPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(curPassword, user.passwordHash)
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' })
      }
    }

    const salt = await bcrypt.genSalt(10)
    const newPasswordHash = await bcrypt.hash(nPassword, salt)

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    })

    await prisma.auditLog.create({
      data: {
        category: 'Auth',
        action: 'PASSWORD_CHANGE',
        actor: user.name || 'Super Admin',
        role: user.role || 'SUPER_ADMIN',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: 'User password changed successfully'
      }
    }).catch(() => {})

    res.json({ success: true, message: 'Password updated successfully!' })
  } catch (err) {
    next(err)
  }
}

// Super Admin: Get Login History
const getLoginHistory = async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { category: 'Auth' },
      orderBy: { timestamp: 'desc' },
      take: 20
    })

    const formattedLogs = logs.map(l => ({
      key: l.id,
      date: new Date(l.timestamp).toLocaleString(),
      ip: l.ipAddress || l.ip || '103.88.24.12',
      location: 'Melbourne, VIC',
      device: 'Chrome / Windows',
      status: 'Active Session'
    }))

    res.json({ success: true, data: formattedLogs })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getClinics,
  createClinic,
  updateClinic,
  deleteClinic,
  updateClinicStatus,
  updateClinicTier,
  resetClinicBilling,
  impersonateClinicAdmin,
  sendClinicAnnouncement,
  updateClinicFeatures,
  resetClinicPassword,
  getClinicInvoices,
  getClinicSupportTickets,
  getClinicAuditLogs,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getBillingOverview,
  deleteSubscriptionInvoice,
  getAuditLogs,
  createAuditLog,
  getSalesUsers,
  createSalesUser,
  updateSalesUser,
  deleteSalesUser,
  getAffiliates,
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
  getSalesLeads,
  createSalesLead,
  updateSalesLead,
  deleteSalesLead,
  getComplianceAlerts,
  createComplianceAlert,
  updateComplianceAlert,
  deleteComplianceAlert,
  getGovernanceLogs,
  createGovernanceLog,
  getSupportTickets,
  createSupportTicket,
  updateSupportTicket,
  deleteSupportTicket,
  getSupportBugs,
  createSupportBug,
  updateSupportBug,
  deleteSupportBug,
  getSupportFeatures,
  createSupportFeature,
  voteSupportFeature,
  getSupportChats,
  sendSupportChatMessage,
  getSupportClinicHistory,
  getPlatformAnalytics,
  updateInvoiceStatus,
  getProfile,
  updateProfile,
  getTemplates,
  createTemplate,
  deleteTemplate,
  getServices,
  createService,
  updateService,
  deleteService,
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getCancellationReasons,
  createCancellationReason,
  updateCancellationReason,
  deleteCancellationReason,
  processDataImport,
  logDataExport,
  getDataLogs,
  revokeSession,
  changePassword,
  getLoginHistory,
}

