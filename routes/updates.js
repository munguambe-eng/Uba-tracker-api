const express = require('express');
const router  = express.Router();
const { supabase, requireAuth } = require('../supabase');

// POST /updates
// Posts a weekly update to a project
// Body: { project_id, status, progress, comment, bottlenecks }
router.post('/', requireAuth, async (req, res) => {
  const { project_id, status, progress, comment, bottlenecks } = req.body;

  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (!status)     return res.status(400).json({ error: 'status is required' });
  if (progress === undefined) return res.status(400).json({ error: 'progress is required' });

  // Verify user has access to this project
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', project_id)
    .single();

  if (!project) return res.status(404).json({ error: 'Project not found' });

  const canUpdate =
    project.user_id === req.user.id ||
    ['head_of_data', 'admin'].includes(req.user.role);

  if (!canUpdate) return res.status(403).json({ error: 'Access denied' });

  // Insert the update record
  const { data: update, error: updateError } = await supabase
    .from('updates')
    .insert({
      project_id,
      posted_by: req.user.id,
      status,
      progress,
      comment: comment || null,
      bottlenecks: bottlenecks || []
    })
    .select()
    .single();

  if (updateError) return res.status(500).json({ error: updateError.message });

  // Also sync the latest values back to the project
  const { data: updatedProject, error: projectError } = await supabase
    .from('projects')
    .update({ status, progress, comment, bottlenecks: bottlenecks || [] })
    .eq('id', project_id)
    .select()
    .single();

  if (projectError) return res.status(500).json({ error: projectError.message });

  res.status(201).json({ update, project: updatedProject });
});

// GET /updates/:project_id
// Returns full update history for a project, newest first
router.get('/:project_id', requireAuth, async (req, res) => {
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', req.params.project_id)
    .single();

  if (!project) return res.status(404).json({ error: 'Project not found' });

  const canView =
    project.user_id === req.user.id ||
    ['head_of_data', 'admin'].includes(req.user.role);

  if (!canView) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('updates')
    .select('*, users(name, email)')
    .eq('project_id', req.params.project_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ updates: data });
});

module.exports = router;
