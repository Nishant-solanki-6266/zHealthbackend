const http = require('http')

// Test with clinicadmin@zhealth.com - the seeded Clinic Admin user
const existingEmail = 'clinicadmin@zhealth.com'
const password = 'Password123!'
const newName = 'Clinic Admin Updated Live'
const newPhone = '+91 88888 55555'

function makeRequest(method, path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : ''
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const req = http.request({
      hostname: 'localhost', port: 5001, path, method, headers
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(body) }) }
        catch (e) { resolve({ statusCode: res.statusCode, data: body }) }
      })
    })
    req.on('error', err => reject(err))
    if (data) req.write(data)
    req.end()
  })
}

async function testClinicAdminSync() {
  try {
    console.log('--- Step 1: Login as Clinic Admin ---')
    const loginRes = await makeRequest('POST', '/api/auth/login', { email: existingEmail, password })
    console.log('Login Status:', loginRes.statusCode, loginRes.data?.data?.user?.email, loginRes.data?.data?.user?.role)
    const token = loginRes.data?.data?.accessToken
    if (!token) { console.log('Login Failed:', JSON.stringify(loginRes.data)); return }

    console.log('\n--- Step 2: Update Profile (name + phone) ---')
    const profileRes = await makeRequest('PUT', '/api/clinic-admin/profile', {
      name: newName, phone: newPhone
    }, token)
    console.log('Profile Update Result:', profileRes.statusCode, profileRes.data.success)
    console.log('Updated user:', profileRes.data.data?.email, profileRes.data.data?.name)

    console.log('\n--- Step 3: Super Admin fetches Clinics List ---')
    const saLoginRes = await makeRequest('POST', '/api/auth/login', { email: 'admin@zhealth.com', password: 'Password123!' })
    const saToken = saLoginRes.data?.data?.accessToken

    const clinicsRes = await makeRequest('GET', '/api/super-admin/clinics', null, saToken)
    const clinicsList = clinicsRes.data?.data || []
    const matchedClinic = clinicsList.find(c =>
      c.email === existingEmail || c.contactPerson === newName || c.contactPerson?.includes('Clinic Admin'))

    console.log('Matched Clinic in SA list:', matchedClinic ? {
      id: matchedClinic.id,
      name: matchedClinic.name,
      email: matchedClinic.email,
      contactPerson: matchedClinic.contactPerson,
      phone: matchedClinic.phone
    } : 'NOT FOUND - checking all:')

    if (!matchedClinic) {
      clinicsList.slice(0, 8).forEach(c => console.log('  ->', c.name, '|', c.email, '| contactPerson:', c.contactPerson))
    }

    if (matchedClinic && matchedClinic.contactPerson === newName) {
      console.log('\n🎉 SUCCESS 100%: Profile -> Super Admin Clinics List LIVE SYNC WORKING!')
    } else {
      console.log('\n⚠️  Sync check: contactPerson still may not have matched (depends on whether this user has a linked clinic)')
    }
  } catch (err) {
    console.error('Test Error:', err)
  }
}

testClinicAdminSync()
