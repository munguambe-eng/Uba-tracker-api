const express = require('express');
const router  = express.Router();
const { supabase, requireAuth } = require('../supabase');

// GET /members/:project_id
// Returns all members of a project
router.get('/:project_id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('project_members')
    .select('*, user:user_id(id, name, email, role)')
    .eq('project_id', req.params.project_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ members: data });
});

// GET /members/users/all
// Returns all registered users (for member picker)
router.get('/users/all', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ users: data });
});

// POST /members
// Adds a member to a project
router.post('/', requireAuth, async (req, res) => {
  const { project_id, user_id, role } = req.body;
  if (!project_id || !user_id) return res.status(400).json({ error: 'project_id and user_id are required' });

  const { data, error } = await supabase
    .from('project_members')
    .insert({ project_id, user_id, role: role || 'member' })
    .select('*, user:user_id(id, name, email, role)')
    .single();

  if (error) {
    if (error.message.includes('unique')) return res.status(409).json({ error: 'User is already a member of this project' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ member: data });
});

// DELETE /members/:project_id/:user_id
router.delete('/:project_id/:user_id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', req.params.project_id)
    .eq('user_id', req.params.user_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Member removed' });
});

module.exports = router;
