const express = require('express')
const router = express.Router()
const controller = require('./practitioner.controller')
const authenticate = require('../../middlewares/auth.middleware')
const authorize = require('../../middlewares/role.middleware')

router.use(authenticate, authorize('SUPER_ADMIN', 'CLINIC_ADMIN', 'PRACTITIONER'))

router.get('/appointments', controller.getAppointments)
router.post('/appointments', controller.createAppointment)
router.put('/appointments/:id', controller.updateAppointment)
router.delete('/appointments/:id', controller.deleteAppointment)

router.get('/waitlist', controller.getWaitlist)
router.post('/waitlist', controller.addToWaitlist)
router.patch('/waitlist/:id/status', controller.updateWaitlistStatus)
router.delete('/waitlist/:id', controller.removeFromWaitlist)

router.get('/patients', controller.getPatients)
router.post('/patients', controller.createPatient)
router.put('/patients/:id', controller.updatePatient)

module.exports = router
