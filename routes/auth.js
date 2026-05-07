const express = require('express');
const router  = express.Router();
const { supabase, requireAuth } = require('../supabase');

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'ubagroup.com';

// POST /auth/register
// Body: { email, password, name }
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password and name are required' });
  }

  const domain = email.split('@')[1];
  if (domain !== ALLOWED_DOMAIN) {
    return res.status(403).json({ error: `Only @${ALLOWED_DOMAIN} email addresses are allowed` });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });

 if (error) {
    console.error('Supabase register error:', JSON.stringify(error));
    if (error.message.includes('already registered')) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    return res.status(500).json({ error: error.message });
  }

  await supabase.from('users').upsert({
    id:   data.user.id,
    email,
    name,
    role: email.includes('head') ? 'head_of_data' : 'data_scientist'
  });

  res.status(201).json({ message: 'Account created. You can now sign in.' });
});

// POST /auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  res.json({
    access_token: data.session.access_token,
    user: profile || {
      id:    data.user.id,
      email: data.user.email,
      name:  data.user.user_metadata?.name || email.split('@')[0],
      role:  'data_scientist'
    }
  });
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// POST /auth/update-profile
router.post('/update-profile', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const { data, error } = await supabase
    .from('users')
    .update({ name })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ user: data });
});

// POST /auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { error } = await supabase.auth.admin.updateUserById(req.user.id, {
    password: new_password
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Password updated successfully' });
});
module.exports = router;