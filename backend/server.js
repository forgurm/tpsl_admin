const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const calendarRoutes = require('./routes/calendar');
const path = require('path'); // path 모듈을 불러옵니다.

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
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
      return res.status(500).json({ message: 'Failed to authenticate token.' });
    }
    req.username = decoded.username;
    next();
  });
};

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
app.use('/api', calendarRoutes);

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
    res.status(500).json({ message: 'Internal server error' });
  }
});

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



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
