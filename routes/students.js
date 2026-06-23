const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { enrollFace, deleteFace } = require('../services/faceApi');

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
    // The API returns a template_id we must store — it's our handle for updating/deleting this face later
    const faceResult = await enrollFace(imageBase64, { student_id: studentId, name });
    const templateId = faceResult?.template_id || faceResult?.id || null;

    // Step 2: Save the student in our own database, including the template_id
    // The ? placeholders prevent SQL injection attacks
    await db.execute(
      `INSERT INTO students (student_id, name, class_id, face_enrolled, face_template_id)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         class_id = VALUES(class_id),
         face_enrolled = 1,
         face_template_id = VALUES(face_template_id)`,
      [studentId, name, classId, templateId]
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

// GET /api/students/:id — fetch a single student by DB primary key
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT s.*, c.name AS class_name
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// PUT /api/students/:id — update a student
router.put('/:id', async (req, res) => {
  const { name, class_id, student_id } = req.body;
  if (!name || !class_id || !student_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await db.execute(
      'UPDATE students SET name = ?, class_id = ?, student_id = ? WHERE id = ?',
      [name, class_id, student_id, req.params.id]
    );
    res.json({ success: true, message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// DELETE /api/students/:id — delete a student AND remove their face from the model
router.delete('/:id', async (req, res) => {
  try {
    // Step 1: Fetch the student record — we need their name and face_template_id
    const [rows] = await db.execute(
      'SELECT student_id, name, face_enrolled, face_template_id FROM students WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = rows[0];

    // Step 2: Remove face template from the recognition model (best-effort)
    // face_template_id is the ID returned by the face API when the student was enrolled.
    // Without it we cannot call the delete endpoint, so we skip and just warn.
    if (student.face_enrolled && student.face_template_id) {
      try {
        await deleteFace(student.face_template_id);
      } catch (faceError) {
        console.error(`Warning: could not remove face template for "${student.name}":`, faceError.message);
        // Continue — don't block the DB deletion over a model error
      }
    } else if (student.face_enrolled && !student.face_template_id) {
      // Enrolled before we started storing template_id — we can't delete from model
      console.warn(`Student "${student.name}" is enrolled but has no template_id stored — face NOT removed from model.`);
    }

    // Step 3: Delete the student from our database
    await db.execute('DELETE FROM students WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: `${student.name} deleted successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

module.exports = router;