const express = require('express');
const router  = express.Router();
const { supabase, requireAuth } = require('../supabase');

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'ubagroup.com';

// POST /auth/magic-link
// Body: { email: "user@ubagroup.com" }
// Sends a magic link email via Supabase Auth
router.post('/magic-link', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const domain = email.split('@')[1];
  if (domain !== ALLOWED_DOMAIN) {
    return res.status(403).json({
      error: `Only @${ALLOWED_DOMAIN} email addresses are allowed`
    });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: process.env.FRONTEND_URL || 'https://uba-api-tracker-front-end.rodriguesjmunguambe.workers.dev'
    }
  });

  if (error) {
    console.error('Magic link error:', error);
    return res.status(500).json({ error: 'Failed to send magic link' });
  }

  res.json({ message: 'Magic link sent — check your email' });
});

// POST /auth/verify
// Body: { token_hash, type }
// Called after user clicks magic link — exchanges hash for session
router.post('/verify', async (req, res) => {
  const { token_hash, type } = req.body;

  if (!token_hash) {
    return res.status(400).json({ error: 'token_hash is required' });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type || 'email'
  });

  if (error || !data.session) {
    return res.status(401).json({ error: 'Invalid or expired magic link' });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  res.json({
    access_token: data.session.access_token,
    user: profile || {
      id: data.user.id,
      email: data.user.email,
      role: 'data_scientist'
    }
  });
});

// GET /auth/me
// Returns current user profile
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// POST /auth/update-profile
// Body: { name }
// Updates the user's display name
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

module.exports = router;
