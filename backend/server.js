const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { router: authRoutes, verifyToken } = require('./routes/auth');
const userRoutes = require('./routes/user');
const botRoutes = require('./routes/bot');
const calendarRoutes = require('./routes/calendar');
const symbolRoutes = require('./routes/symbol');

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

app.use('/api/auth', authRoutes); // auth 라우터는 인증 없이 접근 가능

// 모든 요청에 대해 verifyToken을 사용해 사용자 정보 설정
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  verifyToken(req, res, next);
});

app.use('/api/user', userRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/symbol', symbolRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
