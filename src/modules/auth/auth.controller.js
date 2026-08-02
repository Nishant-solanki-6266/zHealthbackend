const bcrypt = require('bcryptjs')
const prisma = require('../../config/db')
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/token')

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Invalid email or password, or account inactive.' })
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' })
    }

    const payload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)

    // Save refresh token to DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    })
  } catch (error) {
    next(error)
  }
}

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required.' })
    }

    const savedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    })

    if (!savedToken || savedToken.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' })
    }

    const decoded = verifyRefreshToken(refreshToken)
    const payload = { userId: decoded.userId, email: decoded.email, role: decoded.role }

    const newAccessToken = generateAccessToken(payload)

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    })
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token.' })
  }
}

const me = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    })
  } catch (error) {
    next(error)
  }
}

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      })
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully.' })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  login,
  refresh,
  me,
  logout,
}
