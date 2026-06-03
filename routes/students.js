const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { enrollFace } = require('../services/faceApi');

// GET /api/students — fetch all students
// "async" because we're waiting on a database query
router.get('/', async (req, res) => {
  try {
    // db.execute() runs a SQL query
    // The [rows] syntax is "destructuring" — execute() returns [rows, fields],
    // we only care about rows
    const [rows] = await db.execute(`
      SELECT s.*, c.name AS class_name
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      ORDER BY s.name
    `);

    res.json(rows); // send the array of students back to the frontend
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// POST /api/students/enroll — register a new student + their face
router.post('/enroll', async (req, res) => {
  // req.body contains what the React frontend sent
  const { name, studentId, classId, imageBase64 } = req.body;

  // Basic validation — never trust that frontend sends everything correctly
  if (!name || !studentId || !classId || !imageBase64) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Step 1: Send the face to FaceAPI for encoding
    await enrollFace(imageBase64, { student_id: studentId, name });

    // Step 2: Save the student in our own database
    // The ? placeholders prevent SQL injection attacks
    await db.execute(
      `INSERT INTO students (student_id, name, class_id, face_enrolled)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), class_id = VALUES(class_id)`,
      [studentId, name, classId]
    );

    res.json({ success: true, message: `${name} enrolled successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/students/classes — fetch all classes for the dropdown
router.get('/classes', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM classes ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

module.exports = router;