// server.js
const express  = require('express');
const cors     = require('cors');
require('dotenv').config();

const authRoutes       = require('./routes/auth');
const studentRoutes    = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const classRoutes      = require('./routes/classes');
const settingsRoutes   = require('./routes/settings');
const protect          = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Public routes — no token needed
app.use('/api/auth', authRoutes);

// Protected routes — token required for everything below
app.use('/api/students',   protect, studentRoutes);
app.use('/api/attendance', protect, attendanceRoutes);
app.use('/api/classes',    classRoutes);   // protect is inside the file
app.use('/api/settings',   settingsRoutes); // protect is inside the file

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running ✅' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));