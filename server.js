require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRouter     = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const updatesRouter  = require('./routes/updates');
const reportsRouter  = require('./routes/reports');
const tasksRouter    = require('./routes/tasks');
const membersRouter  = require('./routes/members');
const uploadRouter   = require('./routes/upload');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.options('*', cors());

// Raw body for file uploads
app.use('/upload', (req, res, next) => {
  if (req.method === 'POST') return next();
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/upload' && req.method === 'POST') return next();
  express.json()(req, res, next);
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'UBA Tracker API', version: '2.0.0' });
});

app.use('/auth',     authRouter);
app.use('/projects', projectsRouter);
app.use('/updates',  updatesRouter);
app.use('/reports',  reportsRouter);
app.use('/tasks',    tasksRouter);
app.use('/members',  membersRouter);
app.use('/upload',   uploadRouter);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`UBA Tracker API v2.0 running on port ${PORT}`);
});
