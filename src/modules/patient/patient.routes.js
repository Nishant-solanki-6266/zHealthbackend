const express = require('express')
const router = express.Router()
const controller = require('./patient.controller')
const authenticate = require('../../middlewares/auth.middleware')
const authorize = require('../../middlewares/role.middleware')

router.use(authenticate, authorize('PATIENT', 'SUPER_ADMIN'))

router.get('/profile', controller.getPatientProfile)
router.get('/appointments', controller.getPatientAppointments)
router.get('/invoices', controller.getPatientInvoices)

module.exports = router
