// routes/attendance.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { recognizeFace } = require('../services/faceApi');

// POST /api/attendance/take — the main attendance endpoint
router.post('/take', async (req, res) => {
  const { imageBase64 } = req.body;

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

    // Step 1b: Look up the student's class from the database
    const [studentRows] = await db.execute(
      `SELECT s.class_id, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.student_id = ?`,
      [student_id]
    );
    const studentClass = studentRows.length > 0 ? studentRows[0] : { class_id: null, class_name: 'Unknown' };

    // Step 2: Check if this student was already marked today
    const today = new Date().toISOString().split('T')[0];

    const [existing] = await db.execute(
      `SELECT id FROM attendance WHERE student_id = ? AND attendance_date = ?`,
      [student_id, today]
    );

    if (existing.length > 0) {
      return res.json({
        success: false,
        alreadyMarked: true,
        message: `${name} is already marked present today`,
        student: { ...identifier, class_name: studentClass.class_name },
      });
    }

    // Step 3: Insert the attendance record
    await db.execute(
      `INSERT INTO attendance (student_id, class_id, status, attendance_date) VALUES (?, ?, 'present', ?)`,
      [student_id, studentClass.class_id, today]
    );

    res.json({
      success: true,
      message: `Attendance marked for ${name}`,
      student: { ...identifier, class_name: studentClass.class_name },
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
      SELECT a.*, s.name AS student_name, s.student_id,
             COALESCE(c.name, sc.name) AS class_name
      FROM attendance a
      JOIN students s ON a.student_id = s.student_id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN classes sc ON s.class_id = sc.id
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

// GET /api/attendance/dashboard-stats — comprehensive dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const [[{ totalStudents }]] = await db.execute('SELECT COUNT(*) AS totalStudents FROM students');
    const [[{ totalClasses }]]  = await db.execute('SELECT COUNT(*) AS totalClasses FROM classes');
    const [[{ presentToday }]]  = await db.execute(
      `SELECT COUNT(*) AS presentToday FROM attendance WHERE attendance_date = ? AND status = 'present'`, [today]
    );
    const [[{ attendanceRecords }]] = await db.execute('SELECT COUNT(*) AS attendanceRecords FROM attendance');

    // studentsByClass
    const [studentsByClassRaw] = await db.execute(`
      SELECT c.name as name, COUNT(s.id) as students
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id
      GROUP BY c.id, c.name
    `);

    // attendanceTrend (last 7 days)
    const [trendRaw] = await db.execute(`
      SELECT attendance_date as date,
             SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
             SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance
      GROUP BY attendance_date
      ORDER BY attendance_date DESC
      LIMIT 7
    `);
    const attendanceTrend = trendRaw.reverse(); // chronological order

    // attendanceStatus (overall)
    const [statusRaw] = await db.execute(`
      SELECT status, COUNT(*) as count
      FROM attendance
      GROUP BY status
    `);
    
    // recentAttendance (last 5)
    const [recentAttendance] = await db.execute(`
      SELECT a.id, a.attendance_date as date, a.status, s.name as studentName, s.student_id as indexNumber, 
             COALESCE(c.name, sc.name) AS className
      FROM attendance a
      JOIN students s ON a.student_id = s.student_id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN classes sc ON s.class_id = sc.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    let presentOverall = 0;
    let absentOverall = 0;
    statusRaw.forEach(row => {
      if (row.status === 'present') presentOverall = row.count;
      if (row.status === 'absent') absentOverall = row.count;
    });

    const attendanceStatus = [
      { name: 'Present', value: Number(presentOverall), fill: '#10b981' },
      { name: 'Absent', value: Number(absentOverall), fill: '#ef4444' }
    ];

    res.json({
      stats: {
        totalStudents: Number(totalStudents),
        totalClasses: Number(totalClasses),
        presentToday: Number(presentToday),
        absentToday: Math.max(0, Number(totalStudents) - Number(presentToday)),
        attendanceRecords: Number(attendanceRecords)
      },
      studentsByClass: studentsByClassRaw.map(r => ({ name: r.name, students: Number(r.students) })),
      attendanceTrend: attendanceTrend.map(r => ({ date: r.date.toISOString().split('T')[0], present: Number(r.present), absent: Number(r.absent) })),
      attendanceStatus,
      recentAttendance
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// DELETE /api/attendance/:id — remove an attendance record
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM attendance WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Attendance record deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete attendance record' });
  }
});

module.exports = router;