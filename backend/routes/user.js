const express = require('express');
const { verifyToken } = require('./auth');
const pool = require('../db');

const router = express.Router();

router.get('/members', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query('SELECT * FROM users');
    connection.release();
    res.json(results);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/add-member', verifyToken, async (req, res) => {
  const { name, username, password, phone, referralExchange, referralCode, grade, memo } = req.body;
  try {
    const connection = await pool.getConnection();
    const [existingUsers] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);

    if (existingUsers.length > 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    await connection.query(
      'INSERT INTO users (name, username, password, phone, referralExchange, referralCode, grade, memo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, username, password, phone, referralExchange, referralCode, grade, memo]
    );

    connection.release();
    res.json({ success: true, message: 'Member added successfully' });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/edit-member', verifyToken, async (req, res) => {
  const { name, username, password, phone, referralExchange, referralCode, grade, memo } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE users SET name = ?, password = ?, phone = ?, referralExchange = ?, referralCode = ?, grade = ?, memo = ? WHERE username = ?',
      [name, password, phone, referralExchange, referralCode, grade, memo, username]
    );
    connection.release();
    res.json({ success: true, message: 'Member updated successfully' });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/delete-member/:username', verifyToken, async (req, res) => {
  const { username } = req.params;
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM users WHERE username = ?', [username]);
    connection.release();
    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
