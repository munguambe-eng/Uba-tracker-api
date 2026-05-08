const express = require('express');
const router  = express.Router();
const { supabase, requireAuth } = require('../supabase');

// GET /tasks/:project_id
// Returns all tasks for a project with dependencies
router.get('/:project_id', requireAuth, async (req, res) => {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*, assignee:assignee_id(id, name, email), task_dependencies!task_dependencies_task_id_fkey(depends_on_id)')
    .eq('project_id', req.params.project_id)
    .order('position');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ tasks });
});

// POST /tasks
// Creates a new task
router.post('/', requireAuth, async (req, res) => {
  const { project_id, name, description, status, due_date, assignee_id, position } = req.body;
  if (!project_id || !name) return res.status(400).json({ error: 'project_id and name are required' });

  const { data, error } = await supabase
    .from('tasks')
    .insert({ project_id, name, description, status: status || 'pending', due_date, assignee_id, position: position || 0 })
    .select('*, assignee:assignee_id(id, name, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ task: data });
});

// PUT /tasks/:id
// Updates a task
router.put('/:id', requireAuth, async (req, res) => {
  const allowed = ['name', 'description', 'status', 'due_date', 'assignee_id', 'position'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', req.params.id)
    .select('*, assignee:assignee_id(id, name, email)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ task: data });
});

// DELETE /tasks/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Task deleted' });
});

// POST /tasks/dependency
// Adds a dependency between two tasks
router.post('/dependency', requireAuth, async (req, res) => {
  const { task_id, depends_on_id } = req.body;
  if (!task_id || !depends_on_id) return res.status(400).json({ error: 'task_id and depends_on_id are required' });
  if (task_id === depends_on_id) return res.status(400).json({ error: 'A task cannot depend on itself' });

  const { data, error } = await supabase
    .from('task_dependencies')
    .insert({ task_id, depends_on_id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ dependency: data });
});

// DELETE /tasks/dependency/:task_id/:depends_on_id
router.delete('/dependency/:task_id/:depends_on_id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('task_id', req.params.task_id)
    .eq('depends_on_id', req.params.depends_on_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Dependency removed' });
});

module.exports = router;
