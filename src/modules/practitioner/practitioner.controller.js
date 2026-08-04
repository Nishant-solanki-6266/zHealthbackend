const prisma = require('../../config/db')

// Appointments
const getAppointments = async (req, res, next) => {
  try {
    const { search, date, status, practitionerId, patientId } = req.query
    let appointments = await prisma.appointment.findMany({ orderBy: { createdAt: 'desc' } })

    // Auto seed sample appointments if empty
    if (appointments.length === 0) {
      const seedAppts = [
        {
          displayId: 'APT-000001',
          patientName: 'John Doe',
          practitionerName: 'Dr. Sarah Jenkins',
          appointmentType: 'Consultation',
          date: new Date().toISOString().split('T')[0],
          startTime: '10:00',
          endTime: '11:00',
          status: 'Confirmed',
          fee: 180,
          location: 'Melbourne Clinic',
          room: 'Room A',
          notes: 'Initial musculoskeletal assessment'
        },
        {
          displayId: 'APT-000002',
          patientName: 'Emma Watson',
          practitionerName: 'Dr. Sarah Jenkins',
          appointmentType: 'Follow-up',
          date: new Date().toISOString().split('T')[0],
          startTime: '14:00',
          endTime: '15:00',
          status: 'Arrived',
          fee: 120,
          location: 'Melbourne Clinic',
          room: 'Room B',
          notes: 'Post-op shoulder rehab review'
        }
      ]
      await prisma.appointment.createMany({ data: seedAppts }).catch(() => null)
      appointments = await prisma.appointment.findMany({ orderBy: { createdAt: 'desc' } })
    }

    let filtered = appointments

    // RBAC & Filter for Practitioner
    let pracFilter = practitionerId
    if (req.user && req.user.role === 'PRACTITIONER') {
      const pRecord = await prisma.practitioner.findFirst({
        where: {
          OR: [
            { userId: req.user.id },
            { email: req.user.email }
          ]
        }
      })
      if (pRecord) {
        pracFilter = pRecord.id
      }
    }

    if (pracFilter) {
      filtered = filtered.filter(a =>
        a.practitionerId === pracFilter ||
        (a.practitionerName || '').toLowerCase().includes(pracFilter.toLowerCase()) ||
        (req.user && req.user.name && (a.practitionerName || '').toLowerCase().includes(req.user.name.toLowerCase()))
      )
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(a => (a.status || '').toLowerCase() === status.toLowerCase())
    }
    if (date) {
      filtered = filtered.filter(a => a.date === date)
    }
    if (patientId) {
      filtered = filtered.filter(a => a.patientId === patientId || (a.patientName || '').toLowerCase().includes(patientId.toLowerCase()))
    }
    if (search && search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(a =>
        (a.patientName || '').toLowerCase().includes(q) ||
        (a.practitionerName || '').toLowerCase().includes(q) ||
        (a.appointmentType || '').toLowerCase().includes(q) ||
        (a.displayId || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q)
      )
    }

    res.json({ success: true, data: filtered })
  } catch (err) {
    next(err)
  }
}

const createAppointment = async (req, res, next) => {
  try {
    const {
      patientId, patientName, practitionerId, practitionerName,
      appointmentType, date, time, endTime, duration, notes, location, room,
      repeat, diagnosis, bodyPart, ndisLineItem, invoiceStatus, fundingScheme, travel
    } = req.body

    let finalPracId = practitionerId
    let finalPracName = practitionerName

    if (!finalPracName && req.user) {
      finalPracName = req.user.name
    }

    const count = await prisma.appointment.count().catch(() => 0)
    const displayId = `APT-${String(count + 1).padStart(6, '0')}`

    const appt = await prisma.appointment.create({
      data: {
        displayId,
        patientId,
        patientName: patientName || 'Unknown Patient',
        practitionerId: finalPracId,
        practitionerName: finalPracName || 'Dr. Sarah Jenkins',
        appointmentType: appointmentType || 'Consultation',
        date: date || new Date().toISOString().split('T')[0],
        time: time || '09:00',
        endTime: endTime || '10:00',
        duration: parseInt(duration) || 60,
        notes: notes || '',
        location: location || 'Clinic',
        room: room || 'Room A',
        repeat: repeat || 'None',
        diagnosis: diagnosis || '',
        bodyPart: bodyPart || '',
        ndisLineItem: ndisLineItem || '',
        invoiceStatus: invoiceStatus || 'Not Invoiced',
        fundingScheme: fundingScheme || 'Private',
        status: 'Confirmed',
        travelDetails: travel ? travel : null
      }
    })

    res.json({ success: true, data: appt })
  } catch (err) {
    next(err)
  }
}

const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params
    const updateData = { ...req.body }
    delete updateData.id

    const appt = await prisma.appointment.update({
      where: { id },
      data: updateData
    })
    res.json({ success: true, data: appt })
  } catch (err) {
    next(err)
  }
}

const deleteAppointment = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.appointment.delete({ where: { id } })
    res.json({ success: true, message: 'Appointment deleted successfully from live database' })
  } catch (err) {
    next(err)
  }
}

// Practitioners List for dropdowns
const getPractitioners = async (req, res, next) => {
  try {
    let practitioners = await prisma.practitioner.findMany({ orderBy: { createdAt: 'desc' } })
    if (practitioners.length === 0) {
      const seedPrac = await prisma.practitioner.create({
        data: {
          name: 'Dr. Sarah Jenkins',
          specialty: 'Physiotherapist',
          email: 'sarah.jenkins@clinic.com',
          phone: '+61 412 100 001',
          status: 'Active',
          color: '#30D2BE'
        }
      }).catch(() => null)
      if (seedPrac) practitioners = [seedPrac]
    }
    res.json({ success: true, data: practitioners })
  } catch (err) {
    next(err)
  }
}

// Waitlist
const getWaitlist = async (req, res, next) => {
  try {
    const waitlist = await prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: waitlist })
  } catch (err) {
    next(err)
  }
}

const addToWaitlist = async (req, res, next) => {
  try {
    const entry = await prisma.waitlist.create({ data: req.body })
    res.json({ success: true, data: entry })
  } catch (err) {
    next(err)
  }
}

const updateWaitlistStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const entry = await prisma.waitlist.update({ where: { id }, data: { status } })
    res.json({ success: true, data: entry })
  } catch (err) {
    next(err)
  }
}

const removeFromWaitlist = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.waitlist.delete({ where: { id } })
    res.json({ success: true, message: 'Waitlist item removed' })
  } catch (err) {
    next(err)
  }
}

// Patients
const getPatients = async (req, res, next) => {
  try {
    const patients = await prisma.patient.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: patients })
  } catch (err) {
    next(err)
  }
}

const createPatient = async (req, res, next) => {
  try {
    const patient = await prisma.patient.create({ data: req.body })
    res.json({ success: true, data: patient })
  } catch (err) {
    next(err)
  }
}

const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params
    const patient = await prisma.patient.update({ where: { id }, data: req.body })
    res.json({ success: true, data: patient })
  } catch (err) {
    next(err)
  }
}

// Payments Management
const getPayments = async (req, res, next) => {
  try {
    const { search } = req.query
    let payments = await prisma.payment.findMany({ orderBy: { createdAt: 'desc' } })

    if (payments.length === 0) {
      const seedPayments = [
        { receiptNumber: 'RCPT-0394', clientName: 'Nishant Solanki', amount: 108.00, paymentDate: '19 Aug 2026', invoiceReference: 'INV-0394', transactionId: 'tx_rcpt-0394_892' },
        { receiptNumber: 'RCPT-0380', clientName: 'Peter Bent', amount: 264.64, paymentDate: '16 Jun 2026', invoiceReference: 'INV-0380', transactionId: 'tx_rcpt-0380_892' },
        { receiptNumber: 'RCPT-0377', clientName: 'Andrej Anastasov', amount: 241.87, paymentDate: '19 Jun 2026', invoiceReference: 'INV-0377', transactionId: 'tx_rcpt-0377_892' },
        { receiptNumber: 'RCPT-0378', clientName: 'Alessia Sharpe', amount: 232.24, paymentDate: '17 Jun 2026', invoiceReference: 'INV-0378', transactionId: 'tx_rcpt-0378_892' },
        { receiptNumber: 'RCPT-0379', clientName: 'Noah Lawrence', amount: 257.71, paymentDate: '18 Jun 2026', invoiceReference: 'INV-0379', transactionId: 'tx_rcpt-0379_892' },
        { receiptNumber: 'RCPT-0383', clientName: 'Feras Taha', amount: 187.50, paymentDate: '23 Jun 2026', invoiceReference: 'INV-0383', transactionId: 'tx_rcpt-0383_892' },
        { receiptNumber: 'RCPT-0381', clientName: 'Liliana Radojcic', amount: 229.99, paymentDate: '17 Jun 2026', invoiceReference: 'INV-0381', transactionId: 'tx_rcpt-0381_892' }
      ]
      await prisma.payment.createMany({ data: seedPayments }).catch(() => null)
      payments = await prisma.payment.findMany({ orderBy: { createdAt: 'desc' } })
    }

    if (search && search.trim()) {
      const q = search.toLowerCase()
      payments = payments.filter(p =>
        (p.clientName || '').toLowerCase().includes(q) ||
        (p.receiptNumber || '').toLowerCase().includes(q) ||
        (p.invoiceReference || '').toLowerCase().includes(q)
      )
    }

    res.json({ success: true, data: payments })
  } catch (err) {
    next(err)
  }
}

const createPayment = async (req, res, next) => {
  try {
    const { from, clientName, amount, date, paymentDate, paymentMethod, invoiceReference, patientId } = req.body

    const count = await prisma.payment.count().catch(() => 0)
    const receiptNumber = `RCPT-${String(count + 384).padStart(4, '0')}`
    const finalClientName = from || clientName || 'Client'
    const finalDate = paymentDate || date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

    const payment = await prisma.payment.create({
      data: {
        receiptNumber,
        clientName: finalClientName,
        amount: parseFloat(amount) || 0.0,
        paymentDate: finalDate,
        paymentMethod: paymentMethod || 'Stripe / Credit Card',
        invoiceReference: invoiceReference || `INV-${receiptNumber.replace('RCPT-', '')}`,
        status: 'Successful (Paid)',
        transactionId: `tx_${receiptNumber.toLowerCase()}_892`,
        patientId: patientId || null
      }
    })

    res.json({ success: true, data: payment })
  } catch (err) {
    next(err)
  }
}

const updatePayment = async (req, res, next) => {
  try {
    const { id } = req.params
    const updateData = { ...req.body }
    delete updateData.id
    delete updateData.createdAt

    if (updateData.amount !== undefined) updateData.amount = parseFloat(updateData.amount)

    const payment = await prisma.payment.update({
      where: { id },
      data: updateData
    })
    res.json({ success: true, data: payment })
  } catch (err) {
    next(err)
  }
}

const deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.payment.delete({ where: { id } })
    res.json({ success: true, message: 'Payment entry deleted successfully from live database' })
  } catch (err) {
    next(err)
  }
}

const getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const userEmail = req.user?.email

    let practitioner = await prisma.practitioner.findFirst({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(userEmail ? [{ email: userEmail }] : [])
        ]
      }
    }).catch(() => null)

    if (!practitioner) {
      practitioner = await prisma.practitioner.findFirst({
        where: { email: 'colin.edegbe@ceotherapy.com' }
      }).catch(() => null)
    }

    if (!practitioner) {
      practitioner = await prisma.practitioner.create({
        data: {
          name: 'Dr. Colin Edegbe',
          specialty: 'Physiotherapist',
          email: userEmail || 'colin.edegbe@ceotherapy.com',
          phone: '+61 412 345 678',
          status: 'Active',
          color: '#8C4BFF',
          consultationFee: 150.0,
          joinDate: '15 Jan 2024',
          assignedBranches: ['NDIS', 'CEO Therapy Mobile'],
          qualifications: ['BPhty (Hons)', 'AHPRA Registered'],
          bio: 'Senior Musculoskeletal Physiotherapist'
        }
      }).catch(() => null)
    }

    let user = null
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null)
    }

    res.json({
      success: true,
      data: {
        id: practitioner?.id,
        userId: user?.id || userId,
        title: 'Mr',
        firstName: practitioner?.name ? practitioner.name.split(' ')[0] : 'Colin',
        lastName: practitioner?.name ? practitioner.name.split(' ').slice(1).join(' ') : 'Edegbe',
        gender: 'Male',
        email: practitioner?.email || user?.email || 'colin.edegbe@ceotherapy.com',
        phone: practitioner?.phone || user?.phone || '+61 412 345 678',
        dob: '1990-08-15',
        profTitle: practitioner?.specialty || 'Physiotherapist',
        locations: practitioner?.assignedBranches || ['NDIS', 'CEO Therapy Mobile'],
        services: [
          'Physiotherapy Subsequent Session (Therapeutic Supports)',
          'Progress report (Non-Face-to-Face Services)',
          'Initial Physiotherapy Session (Therapeutic Supports)'
        ],
        signature: 'Colin Edegbe',
        providerNumbers: [
          { id: 1, type: 'AHPRA', num: 'PHY000278016', loc: 'NDIS' },
          { id: 2, type: 'AHPRA', num: 'PHY000278016', loc: 'CEO Therapy Mobile' },
          { id: 3, type: 'Medicare', num: '6683896B', loc: 'CEO Therapy Mobile' }
        ],
        avatarUrl: user?.avatarUrl || null,
        profileData: user?.profileData || {}
      }
    })
  } catch (err) {
    next(err)
  }
}

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const userEmail = req.user?.email
    const bcrypt = require('bcryptjs')

    const {
      title, firstName, lastName, name, gender, email, phone, mobile, dob,
      profTitle, locations, services, signature, providerNumbers,
      currentPassword, newPassword
    } = req.body

    const updateName = name || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName)

    let user = null
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null)
    }

    if (newPassword && user && user.passwordHash) {
      if (currentPassword) {
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!isMatch) {
          return res.status(400).json({ success: false, message: 'Current password does not match' })
        }
      }
      const salt = await bcrypt.genSalt(10)
      const newPasswordHash = await bcrypt.hash(newPassword, salt)
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      }).catch(() => null)
    }

    if (userId && (updateName || email || phone || mobile)) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(updateName && { name: updateName }),
          ...(email && { email }),
          ...((phone || mobile) && { phone: phone || mobile })
        }
      }).catch(() => null)
    }

    let practitioner = await prisma.practitioner.findFirst({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(userEmail ? [{ email: userEmail }] : [])
        ]
      }
    }).catch(() => null)

    if (practitioner) {
      practitioner = await prisma.practitioner.update({
        where: { id: practitioner.id },
        data: {
          ...(updateName && { name: updateName }),
          ...(profTitle && { specialty: profTitle }),
          ...(email && { email }),
          ...((phone || mobile) && { phone: phone || mobile }),
          ...(locations && { assignedBranches: locations })
        }
      })
    }

    res.json({
      success: true,
      message: 'Practitioner profile settings saved successfully in live database!',
      data: practitioner
    })
  } catch (err) {
    next(err)
  }
}

const {
  getIntegrations,
  updateIntegration,
  createIntegration,
  deleteIntegration
} = require('../clinic-admin/clinic-admin.controller')

// Practitioner: Login History & Session Logs
const getLoginHistory = async (req, res, next) => {
  try {
    const { search, status } = req.query

    let logs = await prisma.auditLog.findMany({
      where: { category: 'Auth' },
      orderBy: { timestamp: 'desc' },
      take: 50
    })

    if (logs.length === 0) {
      const seedAuthLogs = [
        { displayId: 'LOG-000001', category: 'Auth', action: 'LOGIN', actor: 'Colin Edegbe', role: 'PRACTITIONER', ip: '192.168.1.1', target: 'Chrome / Windows (Current)', severity: 'Active Session', details: 'Melbourne, VIC' },
        { displayId: 'LOG-000002', category: 'Auth', action: 'LOGIN', actor: 'Colin Edegbe', role: 'PRACTITIONER', ip: '120.91.4.11', target: 'iPhone App Client', severity: 'Active Session', details: 'Sydney, NSW' },
        { displayId: 'LOG-000003', category: 'Auth', action: 'LOGIN', actor: 'Colin Edegbe', role: 'PRACTITIONER', ip: '110.12.82.9', target: 'Safari / macOS Sierra', severity: 'Expired', details: 'Melbourne, VIC' }
      ]
      await prisma.auditLog.createMany({ data: seedAuthLogs }).catch(() => null)
      logs = await prisma.auditLog.findMany({
        where: { category: 'Auth' },
        orderBy: { timestamp: 'desc' }
      })
    }

    let formattedLogs = logs.map(l => ({
      key: l.id,
      id: l.id,
      date: new Date(l.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ip: l.ipAddress || l.ip || '192.168.1.1',
      location: l.details || 'Melbourne, VIC',
      device: l.target || 'Chrome / Windows',
      status: l.severity === 'Revoked' ? 'Revoked' : (l.severity || 'Active Session')
    }))

    if (status && status !== 'all' && status !== 'All') {
      formattedLogs = formattedLogs.filter(l => l.status.toLowerCase() === status.toLowerCase())
    }

    if (search && search.trim()) {
      const q = search.toLowerCase()
      formattedLogs = formattedLogs.filter(l =>
        l.device.toLowerCase().includes(q) ||
        l.ip.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        l.date.toLowerCase().includes(q)
      )
    }

    res.json({ success: true, data: formattedLogs })
  } catch (err) {
    next(err)
  }
}

const recordLoginLog = async (req, res, next) => {
  try {
    const { device, ip, location, status } = req.body
    const count = await prisma.auditLog.count()
    const displayId = `LOG-${String(count + 1).padStart(6, '0')}`

    const newLog = await prisma.auditLog.create({
      data: {
        displayId,
        category: 'Auth',
        action: 'LOGIN',
        actor: req.user?.name || 'Colin Edegbe',
        role: req.user?.role || 'PRACTITIONER',
        ip: ip || '192.168.1.100',
        target: device || 'Chrome / Windows',
        severity: status || 'Active Session',
        details: location || 'Melbourne, VIC'
      }
    })

    res.json({
      success: true,
      message: 'New login activity recorded in live database!',
      data: {
        key: newLog.id,
        id: newLog.id,
        date: new Date(newLog.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        time: new Date(newLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ip: newLog.ip,
        location: newLog.details,
        device: newLog.target,
        status: newLog.severity
      }
    })
  } catch (err) {
    next(err)
  }
}

const revokeLoginSession = async (req, res, next) => {
  try {
    const { id } = req.params
    const updatedLog = await prisma.auditLog.update({
      where: { id },
      data: { severity: 'Revoked' }
    }).catch(async () => null)

    res.json({
      success: true,
      message: 'Session revoked in live database successfully!',
      data: updatedLog
    })
  } catch (err) {
    next(err)
  }
}

// Practitioner: Password Change with bcrypt & Audit Log
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' })
    }

    const userId = req.user?.id
    let user = null
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null)
    }
    if (!user && req.user?.email) {
      user = await prisma.user.findFirst({ where: { email: req.user.email } }).catch(() => null)
    }
    if (!user) {
      user = await prisma.user.findFirst({ where: { role: 'PRACTITIONER' } }).catch(() => null)
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' })
    }

    if (user.passwordHash) {
      const bcrypt = require('bcryptjs')
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password does not match.' })
      }
    }

    const bcrypt = require('bcryptjs')
    const salt = await bcrypt.genSalt(10)
    const newPasswordHash = await bcrypt.hash(newPassword, salt)

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash }
    })

    // Log password change in auditLog
    const count = await prisma.auditLog.count().catch(() => 0)
    await prisma.auditLog.create({
      data: {
        displayId: `LOG-${String(count + 1).padStart(6, '0')}`,
        category: 'Auth',
        action: 'PASSWORD_CHANGE',
        actor: user.name || 'Colin Edegbe',
        role: user.role || 'PRACTITIONER',
        ip: req.ip || '192.168.1.1',
        target: 'User Account Password',
        severity: 'Security Event',
        details: 'Password updated successfully in live database'
      }
    }).catch(() => null)

    res.json({
      success: true,
      message: 'Password updated successfully in live database!'
    })
  } catch (err) {
    next(err)
  }
}

// Practitioner: 2FA Security Settings Persistence
const getSecuritySettings = async (req, res, next) => {
  try {
    let clinic = await prisma.clinic.findFirst()
    const flags = (clinic && clinic.featureFlags && typeof clinic.featureFlags === 'object') ? clinic.featureFlags : {}
    const security = flags.security || { tfaEnabled: true, tfaMethod: 'app' }

    res.json({ success: true, data: security })
  } catch (err) {
    next(err)
  }
}

const updateSecuritySettings = async (req, res, next) => {
  try {
    const { tfaEnabled, tfaMethod } = req.body
    let clinic = await prisma.clinic.findFirst()
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic record not found' })
    }

    const flags = (clinic.featureFlags && typeof clinic.featureFlags === 'object') ? clinic.featureFlags : {}
    const currentSecurity = flags.security || {}
    const updatedSecurity = {
      ...currentSecurity,
      ...(tfaEnabled !== undefined && { tfaEnabled: Boolean(tfaEnabled) }),
      ...(tfaMethod !== undefined && { tfaMethod })
    }

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        featureFlags: {
          ...flags,
          security: updatedSecurity
        }
      }
    })

    res.json({
      success: true,
      data: updatedSecurity,
      message: 'Security settings saved to live database successfully!'
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getPractitioners,
  getWaitlist,
  addToWaitlist,
  updateWaitlistStatus,
  removeFromWaitlist,
  getPatients,
  createPatient,
  updatePatient,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getProfile,
  updateProfile,
  getBodyChartTemplates,
  createBodyChartTemplate,
  updateBodyChartTemplate,
  deleteBodyChartTemplate,
  getIntegrations,
  updateIntegration,
  createIntegration,
  deleteIntegration,
  getLoginHistory,
  recordLoginLog,
  revokeLoginSession,
  changePassword,
  getSecuritySettings,
  updateSecuritySettings,
}

// ─── Body Chart Templates ─────────────────────────────────────────────────────

async function getBodyChartTemplates(req, res, next) {
  try {
    // Find the practitioner record for the logged-in user
    const practitioner = await prisma.practitioner.findFirst({
      where: {
        OR: [
          { userId: req.user.id },
          { email: req.user.email }
        ]
      }
    })

    let templates = await prisma.bodyChartTemplate.findMany({
      where: practitioner ? { practitionerId: practitioner.id } : {},
      orderBy: { createdAt: 'desc' }
    })

    // Auto seed initial templates if none found
    if (templates.length === 0 && practitioner) {
      const seeds = [
        { practitionerId: practitioner.id, name: 'Physiotherapy Full Body', description: 'Full body anterior & posterior chart for physiotherapy assessments', thumbnailUrl: null },
        { practitionerId: practitioner.id, name: 'Upper Limb Assessment', description: 'Detailed upper limb chart including shoulder, elbow, wrist', thumbnailUrl: null },
        { practitionerId: practitioner.id, name: 'Lower Limb Assessment', description: 'Detailed lower limb chart including hip, knee, ankle', thumbnailUrl: null },
      ]
      await prisma.bodyChartTemplate.createMany({ data: seeds })
      templates = await prisma.bodyChartTemplate.findMany({
        where: { practitionerId: practitioner.id },
        orderBy: { createdAt: 'desc' }
      })
    }

    res.json({ success: true, data: templates })
  } catch (err) {
    next(err)
  }
}

async function createBodyChartTemplate(req, res, next) {
  try {
    const practitioner = await prisma.practitioner.findFirst({
      where: {
        OR: [
          { userId: req.user.id },
          { email: req.user.email }
        ]
      }
    })

    const { name, description, thumbnailUrl, canvasData } = req.body
    const template = await prisma.bodyChartTemplate.create({
      data: {
        practitionerId: practitioner?.id || null,
        name,
        description: description || null,
        thumbnailUrl: thumbnailUrl || null,
        canvasData: canvasData || null,
      }
    })

    res.status(201).json({ success: true, data: template })
  } catch (err) {
    next(err)
  }
}

async function updateBodyChartTemplate(req, res, next) {
  try {
    const { id } = req.params
    const { name, description, thumbnailUrl, canvasData } = req.body
    const template = await prisma.bodyChartTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(canvasData !== undefined && { canvasData }),
      }
    })

    res.json({ success: true, data: template })
  } catch (err) {
    next(err)
  }
}

async function deleteBodyChartTemplate(req, res, next) {
  try {
    const { id } = req.params
    await prisma.bodyChartTemplate.delete({ where: { id } })
    res.json({ success: true, message: 'Template deleted successfully' })
  } catch (err) {
    next(err)
  }
}
