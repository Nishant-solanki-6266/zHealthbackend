const http = require('http')

const emailA = `mb_clinic_A_${Date.now().toString().slice(-4)}@zealthos.com`
const emailB = `mb_clinic_B_${Date.now().toString().slice(-4)}@zealthos.com`
const password = 'Password123!'

function makeRequest(method, path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : ''
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
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

async function testMessageBoardTenantIsolation() {
  try {
    console.log('--- Step 1: Registering Clinic A ---')
    const regA = await makeRequest('POST', '/api/auth/register', {
      organization: 'MB Clinic Alpha', fullName: 'Dr. Alpha MB', email: emailA, password
    })
    const tokenA = regA.data?.data?.accessToken

    console.log('\n--- Step 2: Registering Clinic B ---')
    const regB = await makeRequest('POST', '/api/auth/register', {
      organization: 'MB Clinic Beta', fullName: 'Dr. Beta MB', email: emailB, password
    })
    const tokenB = regB.data?.data?.accessToken

    console.log('\n--- Step 3: Clinic A posts Message Board item ---')
    const postA = await makeRequest('POST', '/api/message-board', {
      message: 'Secret Task Communication for Clinic A', taskRef: 'TASK-ALPHA-01'
    }, tokenA)
    console.log('Clinic A Post Status:', postA.statusCode, postA.data?.data?.id)

    console.log('\n--- Step 4: Clinic B posts Message Board item ---')
    const postB = await makeRequest('POST', '/api/message-board', {
      message: 'Secret Task Communication for Clinic B', taskRef: 'TASK-BETA-01'
    }, tokenB)
    console.log('Clinic B Post Status:', postB.statusCode, postB.data?.data?.id)

    console.log('\n--- Step 5: Clinic A fetches Message Board ---')
    const listA = await makeRequest('GET', '/api/message-board', null, tokenA)
    const messagesA = (listA.data?.data || []).map(m => m.message)
    console.log('Clinic A Messages:', messagesA)

    console.log('\n--- Step 6: Clinic B fetches Message Board ---')
    const listB = await makeRequest('GET', '/api/message-board', null, tokenB)
    const messagesB = (listB.data?.data || []).map(m => m.message)
    console.log('Clinic B Messages:', messagesB)

    const aHasSecretA = messagesA.includes('Secret Task Communication for Clinic A')
    const aHasSecretB = messagesA.includes('Secret Task Communication for Clinic B')
    const bHasSecretB = messagesB.includes('Secret Task Communication for Clinic B')
    const bHasSecretA = messagesB.includes('Secret Task Communication for Clinic A')

    console.log('\n--- MESSAGE BOARD TENANT ISOLATION AUDIT ---')
    console.log('Clinic A sees Task A:', aHasSecretA)
    console.log('Clinic A sees Task B (MUST BE FALSE):', aHasSecretB)
    console.log('Clinic B sees Task B:', bHasSecretB)
    console.log('Clinic B sees Task A (MUST BE FALSE):', bHasSecretA)

    if (aHasSecretA && !aHasSecretB && bHasSecretB && !bHasSecretA) {
      console.log('\n🎉 100% MESSAGE BOARD & TASK COMMUNICATION TENANT ISOLATION VERIFIED SUCCESS!')
    } else {
      console.log('\n❌ MESSAGE BOARD TENANT ISOLATION FAILED!')
    }
  } catch (err) {
    console.error('Test error:', err)
  }
}

testMessageBoardTenantIsolation()
