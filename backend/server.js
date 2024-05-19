const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const calendarRoutes = require('./routes/calendar');
const path = require('path');

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 정적 파일 제공 설정 추가
app.use('/static', express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'forgurm',
  password: 'asdfqwer1!',
  database: 'TPSL',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    connection.release();

    if (results.length > 0) {
      const token = jwt.sign({ username }, process.env.SECRET_KEY, { expiresIn: '1h' });
      res.json({ success: true, message: 'Login successful', token });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(403).json({ message: 'No token provided.' });
  }

  jwt.verify(token.split(' ')[1], process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      console.log('verifyToken - Failed to authenticate token:', err);
      return res.status(500).json({ message: 'Failed to authenticate token.' });
    }
    req.username = decoded.username;
    next();
  });
};

// 사용자 목록 조회
app.get('/api/members', verifyToken, async (req, res) => {
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

// 사용자 추가
app.post('/api/add-member', verifyToken, async (req, res) => {
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

// 사용자 수정
app.put('/api/edit-member', verifyToken, async (req, res) => {
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

// 사용자 삭제
app.delete('/api/delete-member/:username', verifyToken, async (req, res) => {
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

app.get('/api/exchange-info-summary', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query(`
      SELECT exchange_code, exchange_name, 
             COUNT(*) as symbol_count,
             SUM(CASE WHEN symbol_name IS NULL OR TRIM(symbol_name) = '' THEN 1 ELSE 0 END) as empty_count
      FROM exchange_info
      GROUP BY exchange_code, exchange_name
      ORDER BY exchange_name
    `);
    connection.release();
    res.json(results);
  } catch (error) {
    console.error('Error querying MySQL:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 거래소 정보
app.get('/api/exchange-info', verifyToken, async (req, res) => {
  const { exchange_code } = req.query;
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query(`
      SELECT exchange_name, symbol_code, symbol_name,
             (SELECT COUNT(*) FROM exchange_info ei WHERE ei.exchange_name = e.exchange_name) as symbol_count
      FROM exchange_info e
      WHERE exchange_code = ?
      ORDER BY exchange_name
    `, [exchange_code]);
    connection.release();
    res.json(results);
  } catch (error) {
    console.error('Error querying MySQL:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 심볼명 업데이트
app.post('/api/update-symbols', verifyToken, async (req, res) => {
  const symbols = req.body;
  try {
    const connection = await pool.getConnection();
    const queries = symbols.map(symbol => {
      return connection.query('UPDATE exchange_info SET symbol_name = ? WHERE symbol_code = ?', [symbol.symbol_name, symbol.symbol_code]);
    });

    await Promise.all(queries);
    connection.release();
    res.json({ success: true, message: 'Symbols updated successfully' });
  } catch (error) {
    console.error('Error updating symbols:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bot 관련 API 추가

// 봇 정보 가져오기
app.get('/api/bots', verifyToken, async (req, res) => {
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

// 에러 로그 가져오기
app.get('/api/bot-error-logs', verifyToken, async (req, res) => {
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

// 봇 재시동
app.post('/api/bots/:id/restart', verifyToken, async (req, res) => {
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

// 봇 중지
app.post('/api/bots/:id/stop', verifyToken, async (req, res) => {
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

// 특정 봇의 설정 가져오기
app.get('/api/bot-settings/:botId', verifyToken, async (req, res) => {
  const { botId } = req.params;
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query('SELECT setting_key, setting_name, setting_value FROM bot_settings WHERE bot_id = ?', [botId]);
    connection.release();
    const settings = {};
    results.forEach(row => {
      settings[row.setting_key] = { name: row.setting_name, value: row.setting_value };
    });
    res.json(settings);
  } catch (error) {
    console.error('Error fetching bot settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 특정 봇의 설정 저장하기
app.post('/api/bot-settings/:botId', verifyToken, async (req, res) => {
  const { botId } = req.params;
  const settings = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM bot_settings WHERE bot_id = ?', [botId]);

    const insertValues = Object.entries(settings).map(([key, setting]) => [botId, key, setting.value, setting.name]);
    const insertSql = 'INSERT INTO bot_settings (bot_id, setting_key, setting_value, setting_name) VALUES ?';

    await connection.query(insertSql, [insertValues]);
    connection.release();
    res.json({ success: true, message: `Settings for bot ${botId} saved successfully` });
  } catch (error) {
    console.error('Error saving bot settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
