const express = require('express');
const router  = express.Router();
const { supabase, requireAuth, requireRole } = require('../supabase');

// GET /reports/generate
// Generates a live executive report snapshot
// Query params: ?status_filter=all&period=Week+of+...
router.get('/generate', requireAuth, async (req, res) => {
  const { status_filter = 'all', period } = req.query;

  let query = supabase
    .from('projects')
    .select('*')
    .order('status')
    .order('name');

  if (!['head_of_data', 'admin'].includes(req.user.role)) {
    query = query.eq('user_id', req.user.id);
  }

  if (status_filter !== 'all') {
    query = query.eq('status', status_filter);
  }

  const { data: projects, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const allProjects = await supabase
    .from('projects')
    .select('status, progress')
    .then(r => r.data || []);

  const summary = {
    total:     allProjects.length,
    on_track:  allProjects.filter(p => p.status === 'on-track').length,
    at_risk:   allProjects.filter(p => p.status === 'at-risk' || p.status === 'blocked').length,
    completed: allProjects.filter(p => p.status === 'completed').length,
    avg_progress: allProjects.length
      ? Math.round(allProjects.reduce((a, p) => a + p.progress, 0) / allProjects.length)
      : 0
  };

  res.json({
    period: period || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    generated_at: new Date().toISOString(),
    generated_by: req.user.name || req.user.email,
    summary,
    projects,
    blockers: projects.filter(p => p.bottlenecks && p.bottlenecks.length > 0)
  });
});

// POST /reports
// Saves a report snapshot to the database
// Body: { title, period, status_filter, snapshot }
router.post('/', requireAuth, async (req, res) => {
  const { title, period, status_filter, snapshot } = req.body;
  if (!title) return res.status(400).json({ error: 'Report title is required' });

  const { data, error } = await supabase
    .from('reports')
    .insert({
      created_by: req.user.id,
      title,
      period: period || null,
      status_filter: status_filter || 'all',
      snapshot: snapshot || null
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ report: data });
});

// GET /reports
// Lists saved reports for the current user (head sees all)
router.get('/', requireAuth, async (req, res) => {
  let query = supabase
    .from('reports')
    .select('id, title, period, status_filter, created_at, users(name, email)')
    .order('created_at', { ascending: false });

  if (!['head_of_data', 'admin'].includes(req.user.role)) {
    query = query.eq('created_by', req.user.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reports: data });
});

// GET /reports/:id
// Returns a specific saved report with full snapshot
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('reports')
    .select('*, users(name, email)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Report not found' });

  const canView =
    data.created_by === req.user.id ||
    ['head_of_data', 'admin'].includes(req.user.role);

  if (!canView) return res.status(403).json({ error: 'Access denied' });
  res.json({ report: data });
});

// DELETE /reports/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: existing } = await supabase
    .from('reports')
    .select('created_by')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Report not found' });

  const canDelete =
    existing.created_by === req.user.id ||
    ['head_of_data', 'admin'].includes(req.user.role);

  if (!canDelete) return res.status(403).json({ error: 'Access denied' });

  const { error } = await supabase.from('reports').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Report deleted' });
});

module.exports = router;
