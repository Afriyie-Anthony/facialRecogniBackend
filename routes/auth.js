// routes/auth.js
const express     = require('express');
const router      = express.Router();
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const rateLimit   = require('express-rate-limit');
const db          = require('../config/db');
const protect     = require('../middleware/auth');

// ── Rate limiter for login ────────────────────────────────────────────────────
// Max 5 failed attempts per IP per 15 minutes to block brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts toward the limit
});

// ── POST /api/auth/register ─────────────────────────────────
// Creates the FIRST admin account only.
// Once one admin exists this route is permanently locked — use the app to manage accounts.
router.post('/register', async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email and password are required' });
  }

  try {
    // Safety lock — only allow registration when zero admins exist
    const [[{ count }]] = await db.execute('SELECT COUNT(*) AS count FROM admins');
    if (count > 0) {
      return res.status(403).json({
        error: 'Registration is closed. An admin account already exists.',
      });
    }

    // Check if email already exists
    const [existing] = await db.execute(
      'SELECT id FROM admins WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash the password — "10" is the salt rounds (how complex the hash is)
    // Never store plain text passwords
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      `INSERT INTO admins (full_name, email, phone, password) VALUES (?, ?, ?, ?)`,
      [fullName, email, phone || null, hashedPassword]
    );

    res.status(201).json({ success: true, message: 'Admin account created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find admin by email
    const [rows] = await db.execute(
      'SELECT * FROM admins WHERE email = ?', [email]
    );

    if (rows.length === 0) {
      // Use a vague message — don't tell attackers whether the email exists
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const admin = rows[0];

    // Compare the submitted password against the stored hash
    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create a JWT token — expires in 8 hours (a school day)
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id:       admin.id,
        fullName: admin.full_name,
        email:    admin.email,
        phone:    admin.phone,
        role:     admin.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/auth/profile
// Protected — requires a valid token
router.get('/profile', protect, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, full_name, email, phone, role, created_at FROM admins WHERE id = ?',
      [req.admin.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── PUT /api/auth/profile
// Update the admin's own profile (what your Profile page sends)
router.put('/profile', protect, async (req, res) => {
  const { fullName, email, phone } = req.body;

  try {
    await db.execute(
      `UPDATE admins SET full_name = ?, email = ?, phone = ? WHERE id = ?`,
      [fullName, email, phone, req.admin.id]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── PUT /api/auth/change-password 
router.put('/change-password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const [rows] = await db.execute(
      'SELECT password FROM admins WHERE id = ?', [req.admin.id]
    );

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.execute(
      'UPDATE admins SET password = ? WHERE id = ?', [hashed, req.admin.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;