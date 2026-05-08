const express = require('express');
const router  = express.Router();
const { supabase, requireAuth } = require('../supabase');

// POST /upload
// Uploads a file to Supabase Storage and returns the public URL
// Expects multipart/form-data with field "file" and query param "project_id"
router.post('/', requireAuth, async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  const chunks = [];
  let filename = 'upload';
  let mimetype = 'application/octet-stream';

  // Parse multipart manually using raw body
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const buffer = Buffer.concat(chunks);
      const boundary = req.headers['content-type'].split('boundary=')[1];
      if (!boundary) return res.status(400).json({ error: 'Invalid multipart request' });

      const parts = buffer.toString('binary').split('--' + boundary);
      let fileBuffer = null;

      for (const part of parts) {
        if (part.includes('filename=')) {
          const fnMatch = part.match(/filename="([^"]+)"/);
          const ctMatch = part.match(/Content-Type: ([^\r\n]+)/);
          if (fnMatch) filename = fnMatch[1];
          if (ctMatch) mimetype = ctMatch[1].trim();
          const bodyStart = part.indexOf('\r\n\r\n') + 4;
          const bodyEnd = part.lastIndexOf('\r\n');
          if (bodyStart > 3 && bodyEnd > bodyStart) {
            fileBuffer = Buffer.from(part.slice(bodyStart, bodyEnd), 'binary');
          }
        }
      }

      if (!fileBuffer) return res.status(400).json({ error: 'No file found in request' });

      const path = `${project_id}/${Date.now()}-${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(path, fileBuffer, { contentType: mimetype, upsert: false });

      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path);

      // Save file reference to project
      const { data: project } = await supabase
        .from('projects')
        .select('files')
        .eq('id', project_id)
        .single();

      const files = project?.files || [];
      files.push({ name: filename, url: urlData.publicUrl, type: mimetype, uploaded_at: new Date().toISOString() });

      await supabase.from('projects').update({ files }).eq('id', project_id);

      res.json({ url: urlData.publicUrl, name: filename, type: mimetype });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// DELETE /upload
// Removes a file from a project
router.delete('/', requireAuth, async (req, res) => {
  const { project_id, url } = req.body;
  if (!project_id || !url) return res.status(400).json({ error: 'project_id and url are required' });

  const { data: project } = await supabase
    .from('projects')
    .select('files')
    .eq('id', project_id)
    .single();

  const files = (project?.files || []).filter(f => f.url !== url);
  await supabase.from('projects').update({ files }).eq('id', project_id);

  // Extract storage path from URL and delete
  const path = url.split('/project-files/')[1];
  if (path) await supabase.storage.from('project-files').remove([path]);

  res.json({ message: 'File removed' });
});

module.exports = router;
