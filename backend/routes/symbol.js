// routes/symbol.js
const express = require('express');
const { verifyToken } = require('./auth');
const pool = require('../db');

const router = express.Router();

console.log('symbol.js');
router.get('/exchange-info-summary', async (req, res) => {
  try {
    //console.log('/exchange-info-summary');
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

router.get('/exchange-info', async (req, res) => {
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

module.exports = router;
