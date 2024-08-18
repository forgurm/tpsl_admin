const express = require('express');
const { verifyToken } = require('./auth');
const pool = require('../db');

const router = express.Router();

router.get('/bots', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query('SELECT * FROM bot_info');
    connection.release();
    res.json(results);
  } catch (error) {
    console.error('Error fetching bots:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/bot-error-logs', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query('SELECT * FROM bot_error_logs ORDER BY error_time DESC LIMIT 100');
    connection.release();
    res.json(results);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bots/:id/restart', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE bot_info SET status = 1 WHERE id = ?', [id]);
    const [rows] = await connection.query('SELECT * FROM bot_state WHERE bot_id = ?', [id]);
    if (rows.length === 0) {
      await connection.query('INSERT INTO bot_state (bot_id, bot_state, restart, stop) VALUES (?, 1, 1, 0)', [id]);
    } else {
      await connection.query('UPDATE bot_state SET bot_state = 1, restart = 1, stop = 0 WHERE bot_id = ?', [id]);
    }
    connection.release();
    res.json({ success: true, message: `Bot ${id} 재시동 성공` });
  } catch (error) {
    console.error(`Error restarting bot ${id}:`, error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bots/:id/stop', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE bot_info SET status = 0 WHERE id = ?', [id]);
    const [rows] = await connection.query('SELECT * FROM bot_state WHERE bot_id = ?', [id]);
    if (rows.length === 0) {
      await connection.query('INSERT INTO bot_state (bot_id, bot_state, restart, stop) VALUES (?, 0, 0, 1)', [id]);
    } else {
      await connection.query('UPDATE bot_state SET bot_state = 0, restart = 0, stop = 1 WHERE bot_id = ?', [id]);
    }
    connection.release();
    res.json({ success: true, message: `Bot ${id} 중지 성공` });
  } catch (error) {
    console.error(`Error stopping bot ${id}:`, error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/bot-settings/:botId/load-setting', verifyToken, async (req, res) => {
  const { botId } = req.params;
  console.log('Fetching bot settings for botId:', botId); // 추가 로그
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query('SELECT setting_key, setting_name, setting_value FROM bot_settings WHERE bot_id = ?', [botId]);
    connection.release();
    if (!results || results.length === 0) {
      console.error(`No settings found for bot ${botId}`);
      return res.status(404).json({ message: 'Settings not found' });
    }
    const settings = {};
    results.forEach(row => {
      settings[row.setting_key] = { name: row.setting_name, value: row.setting_value };
    });
    res.json(settings);
  } catch (error) {
    console.error(`Error fetching bot settings for bot ${botId}:`, error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bot-settings/:botId', verifyToken, async (req, res) => {
  const { botId } = req.params;
  const settings = req.body;
  console.log('Saving settings for botId:', botId); // 추가 로그
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM bot_settings WHERE bot_id = ?', [botId]);

    const insertValues = Object.entries(settings).map(([key, setting]) => [botId, key, setting.value, setting.name]);
    const insertSql = 'INSERT INTO bot_settings (bot_id, setting_key, setting_value, setting_name) VALUES ?';

    await connection.query(insertSql, [insertValues]);
    connection.release();
    res.json({ success: true, message: `Settings for bot ${botId} saved successfully` });
  } catch (error) {
    console.error(`Error saving bot settings for bot ${botId}:`, error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
