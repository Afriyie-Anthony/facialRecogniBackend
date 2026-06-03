// server.js
const express  = require('express');
const cors     = require('cors');
require('dotenv').config();

const studentRoutes    = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');

const app = express();

// MIDDLEWARE — these run on every request before it reaches a route
app.use(cors());                          // Allow React frontend to connect
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies (base64 images are large)

// ROUTES — connect URL prefixes to the route files
app.use('/api/students',   studentRoutes);
app.use('/api/attendance', attendanceRoutes);

// Test endpoint — visit http://localhost:5000/api/health to confirm server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});