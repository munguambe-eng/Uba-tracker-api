require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRouter     = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const updatesRouter  = require('./routes/updates');
const reportsRouter  = require('./routes/reports');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.options('*', cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'UBA Tracker API', version: '1.0.0' });
});

app.use('/auth',     authRouter);
app.use('/projects', projectsRouter);
app.use('/updates',  updatesRouter);
app.use('/reports',  reportsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`UBA Tracker API running on port ${PORT}`);
});
