// routes/attendance.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { recognizeFace } = require('../services/faceApi');

// POST /api/attendance/take — the main attendance endpoint
router.post('/take', async (req, res) => {
  const { imageBase64, classId } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Image is required' });
  }

  try {
    // Step 1: Send the image to FaceAPI to find who this person is
    const faceResult = await recognizeFace(imageBase64);
    const identifier = faceResult.identifier;

    if (!identifier || !identifier.student_id) {
      return res.status(404).json({ error: 'Face not recognized. Is this student enrolled?' });
    }

    const { student_id, name } = identifier;

    // Step 2: Check if this student was already marked today
    // Use attendance_date (a plain DATE column) for the duplicate check
    const today = new Date().toISOString().split('T')[0]; // "2026-06-02"

    const [existing] = await db.execute(
      `SELECT id FROM attendance WHERE student_id = ? AND attendance_date = ?`,
      [student_id, today]
    );

    if (existing.length > 0) {
      return res.json({
        success: false,
        alreadyMarked: true,
        message: `${name} is already marked present today`,
        student: identifier,
      });
    }

    // Step 3: Insert the attendance record (attendance_date defaults to CURDATE())
    await db.execute(
      `INSERT INTO attendance (student_id, class_id, status, attendance_date) VALUES (?, ?, 'present', ?)`,
      [student_id, classId || null, today]
    );

    res.json({
      success: true,
      message: `Attendance marked for ${name}`,
      student: identifier,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/attendance — get records, optionally filtered
router.get('/', async (req, res) => {
  const { date, classId } = req.query; // e.g. /api/attendance?date=2026-06-02

  try {
    let query = `
      SELECT a.*, s.name AS student_name, c.name AS class_name
      FROM attendance a
      JOIN students s ON a.student_id = s.student_id
      LEFT JOIN classes c ON a.class_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Dynamically add filters only if they were provided
    if (date)    { query += ' AND a.attendance_date = ?'; params.push(date); }
    if (classId) { query += ' AND a.class_id = ?';         params.push(classId); }

    query += ' ORDER BY a.created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// GET /api/attendance/stats — numbers for the dashboard
router.get('/stats', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const [[{ totalStudents }]] = await db.execute('SELECT COUNT(*) AS totalStudents FROM students');
    const [[{ totalClasses }]]  = await db.execute('SELECT COUNT(*) AS totalClasses FROM classes');
    const [[{ presentToday }]]  = await db.execute(
      `SELECT COUNT(*) AS presentToday FROM attendance WHERE attendance_date = ?`, [today]
    );

    res.json({
      totalStudents,
      totalClasses,
      presentToday,
      absentToday: totalStudents - presentToday,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;