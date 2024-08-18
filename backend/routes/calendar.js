const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/events', async (req, res) => {
  const sql = 'SELECT * FROM events';
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query(sql);
    connection.release();
    res.json(results);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/events', async (req, res) => {
  const event = { ...req.body, createdBy: req.user.username };
  const sql = 'INSERT INTO events SET ?';
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(sql, event);
    connection.release();
    res.json({ id: result.insertId });
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/events/:id', async (req, res) => {
  const { id } = req.params;
  const event = req.body;
  const sql = 'UPDATE events SET ? WHERE id = ?';
  try {
    const connection = await pool.getConnection();
    await connection.query(sql, [event, id]);
    connection.release();
    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/events/:id', async (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM events WHERE id = ?';
  try {
    const connection = await pool.getConnection();
    await connection.query(sql, [id]);
    connection.release();
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
