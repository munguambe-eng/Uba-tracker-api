const express = require('express');
const router  = express.Router();
const { supabase, requireAuth } = require('../supabase');

// GET /projects
// Returns all projects visible to the current user
// Head of data sees all; data scientists see only their own
router.get('/', requireAuth, async (req, res) => {
  let query = supabase
    .from('projects')
    .select('*, updates(*)')
    .order('created_at', { ascending: false });

  if (!['head_of_data', 'admin'].includes(req.user.role)) {
    query = query.eq('user_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ projects: data });
});

// GET /projects/:id
// Returns a single project with its full update history
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*, updates(*)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Project not found' });

  const canView =
    data.user_id === req.user.id ||
    ['head_of_data', 'admin'].includes(req.user.role);

  if (!canView) return res.status(403).json({ error: 'Access denied' });

  res.json({ project: data });
});

// POST /projects
// Creates a new project
// Body: { name, owner_name, status, progress, timeline, documentation, bottlenecks, comment }
router.post('/', requireAuth, async (req, res) => {
  const { name, owner_name, status, progress, timeline, documentation, bottlenecks, comment } = req.body;

  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: req.user.id,
      name,
      owner_name: owner_name || req.user.name,
      status: status || 'on-track',
      progress: progress || 0,
      timeline: timeline || null,
      documentation: documentation || null,
      bottlenecks: bottlenecks || [],
      comment: comment || null
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Auto-create first update entry
  await supabase.from('updates').insert({
    project_id: project.id,
    posted_by: req.user.id,
    status: project.status,
    progress: project.progress,
    comment: comment || 'Project created.',
    bottlenecks: project.bottlenecks
  });

  res.status(201).json({ project });
});

// PUT /projects/:id
// Updates a project's fields
router.put('/:id', requireAuth, async (req, res) => {
  const { data: existing } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const canEdit =
    existing.user_id === req.user.id ||
    ['head_of_data', 'admin'].includes(req.user.role);

  if (!canEdit) return res.status(403).json({ error: 'Access denied' });

  const allowed = ['name','owner_name','status','progress','timeline','documentation','bottlenecks','comment'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ project: data });
});

// DELETE /projects/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: existing } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const canDelete =
    existing.user_id === req.user.id ||
    ['head_of_data', 'admin'].includes(req.user.role);

  if (!canDelete) return res.status(403).json({ error: 'Access denied' });

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Project deleted' });
});

module.exports = router;
