// routes/classes.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/auth');

// All class routes require a valid login token
router.use(protect);

// ── GET /api/classes ────────────────────────────────────────
// Get all classes with their student count
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        c.id,
        c.name,
        c.created_at,
        COUNT(s.id) AS student_count
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id
      GROUP BY c.id, c.name, c.created_at
      ORDER BY c.name
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// ── GET /api/classes/:id ────────────────────────────────────
// Get one class and all students in it
router.get('/:id', async (req, res) => {
  try {
    const [classes] = await db.execute(
      'SELECT * FROM classes WHERE id = ?', [req.params.id]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const [students] = await db.execute(
      'SELECT * FROM students WHERE class_id = ? ORDER BY name',
      [req.params.id]
    );

    res.json({ ...classes[0], students });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// ── POST /api/classes ───────────────────────────────────────
// Create a new class
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Class name is required' });
  }

  try {
    // Check for duplicate name
    const [existing] = await db.execute(
      'SELECT id FROM classes WHERE name = ?', [name.trim()]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A class with this name already exists' });
    }

    const [result] = await db.execute(
      'INSERT INTO classes (name) VALUES (?)', [name.trim()]
    );

    res.status(201).json({
      success: true,
      message: `Class "${name}" created`,
      classId: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// ── PUT /api/classes/:id ────────────────────────────────────
// Rename a class
router.put('/:id', async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Class name is required' });
  }

  try {
    // Make sure the class exists first
    const [existing] = await db.execute(
      'SELECT id FROM classes WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    await db.execute(
      'UPDATE classes SET name = ? WHERE id = ?',
      [name.trim(), req.params.id]
    );

    res.json({ success: true, message: 'Class updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// ── DELETE /api/classes/:id ─────────────────────────────────
// Delete a class (only if it has no students)
router.delete('/:id', async (req, res) => {
  try {
    // Safety check — don't delete a class that still has students
    const [students] = await db.execute(
      'SELECT id FROM students WHERE class_id = ?', [req.params.id]
    );

    if (students.length > 0) {
      return res.status(400).json({
        error: `Cannot delete — this class has ${students.length} student(s). Reassign them first.`,
      });
    }

    await db.execute('DELETE FROM classes WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

module.exports = router;