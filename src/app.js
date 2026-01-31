const express = require('express');
const path = require('path');
const cors = require('cors');

require('./config/db');

const authRoutes = require('./routes/auth.routes');
const checkinRoutes = require('./routes/checkin.routes');
const statsRoutes = require('./routes/stats.routes');
const screeningRoutes = require('./routes/screening.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/screening', screeningRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
