const http = require('http')

const origEmail = `rev_before_${Date.now().toString().slice(-4)}@zealthos.com`
const updatedEmail = `rev_AFTER_${Date.now().toString().slice(-4)}@zealthos.com`
const password = 'Password123!'

function makeRequest(method, path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : ''
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: headers
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body })
        }
      })
    })
    req.on('error', err => reject(err))
    if (data) req.write(data)
    req.end()
  })
}

async function testReverseSync() {
  try {
    console.log('--- Step 1: Registering Clinic ---')
    const regRes = await makeRequest('POST', '/api/auth/register', {
      organization: 'Reverse Sync Clinic',
      fullName: 'Dr. Original Name',
      email: origEmail,
      password: password
    })
    console.log('Reg Result:', regRes.statusCode, regRes.data.data?.clinic?.id)
    const clinicId = regRes.data.data?.clinic?.id
    const token = regRes.data.data?.accessToken

    console.log('\n--- Step 2: Clinic Admin Updates Profile ---')
    console.log('New Email:', updatedEmail)
    const profileRes = await makeRequest('PUT', '/api/clinic-admin/profile', {
      name: 'Dr. Updated Reverse Name',
      email: updatedEmail,
      phone: '+61 400 999 888'
    }, token)
    console.log('Profile Update Status:', profileRes.statusCode, profileRes.data.success)

    console.log('\n--- Step 3: Login as Super Admin to fetch Clinics List ---')
    const saLogin = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@zhealth.com',
      password: 'Password123!'
    })
    const saToken = saLogin.data?.data?.accessToken

    const superAdminRes = await makeRequest('GET', '/api/super-admin/clinics', null, saToken)
    const clinicsList = superAdminRes.data?.data || []
    const foundClinic = clinicsList.find(c => c.id === clinicId)
    console.log('Fetched Clinic in Super Admin List:', foundClinic ? {
      id: foundClinic.id,
      name: foundClinic.name,
      email: foundClinic.email,
      contactPerson: foundClinic.contactPerson,
      phone: foundClinic.phone
    } : 'Not found')

    if (foundClinic && foundClinic.email.toLowerCase() === updatedEmail.toLowerCase() && foundClinic.contactPerson === 'Dr. Updated Reverse Name') {
      console.log('\n🎉 REVERSE SYNC SUCCESS 100%! Clinic Admin Profile update is Live Synced to Super Admin Clinics List!')
    } else {
      console.log('\n❌ REVERSE SYNC FAILED!')
    }
  } catch (err) {
    console.error('Test Error:', err)
  }
}

testReverseSync()
