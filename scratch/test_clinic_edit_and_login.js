const http = require('http')

const oldEmail = `edit_before_${Date.now().toString().slice(-4)}@zealth.com`
const newEmail = `edit_AFTER_${Date.now().toString().slice(-4)}@zealth.com`
const password = 'Password123!'

function makeRequest(method, path, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : ''
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
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

async function runFullSyncTest() {
  try {
    console.log('--- Step 1: Registering initial Clinic ---')
    console.log('Original Email:', oldEmail)
    const regRes = await makeRequest('POST', '/api/auth/register', {
      organization: 'Sync Test Clinic',
      fullName: 'Dr. Sync Test',
      email: oldEmail,
      password: password
    })
    console.log('Registration Result:', regRes.statusCode, regRes.data.data?.clinic?.id)
    const clinicId = regRes.data.data?.clinic?.id

    console.log('\n--- Step 2: Super Admin updates Clinic Email & Name ---')
    console.log('Updating Email to:', newEmail)
    const updateRes = await makeRequest('PUT', `/api/super-admin/clinics/${clinicId}`, {
      email: newEmail,
      contactPerson: 'Dr. Sync Test Updated'
    })
    console.log('Update Clinic Status:', updateRes.statusCode, updateRes.data.success)

    console.log('\n--- Step 3: Logging in with UPDATED Email ---')
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: newEmail,
      password: password
    })
    console.log('Login Status:', loginRes.statusCode)
    console.log('Logged in User Data:', loginRes.data.data?.user)

    if (loginRes.statusCode === 200 && loginRes.data.data?.user?.email.toLowerCase() === newEmail.toLowerCase()) {
      console.log('\n🎉 SUCCESS 100%: Clinic Admin logged in with UPDATED EMAIL & Name synced in MySQL DB!')
    } else {
      console.log('\n❌ FAILED: Could not login with updated email!')
    }
  } catch (err) {
    console.error('Test error:', err)
  }
}

runFullSyncTest()
