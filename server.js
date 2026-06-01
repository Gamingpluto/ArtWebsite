/* ═══════════════════════════════════════
   Rashi Art Classes — server.js
   Express + Cloudinary backend for Render
   ═══════════════════════════════════════ */

const express    = require('express');
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const cors       = require('cors');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CLOUDINARY CONFIG (set these as env vars on Render) ───
cloudinary.config({
  cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
  api_key    : process.env.CLOUDINARY_API_KEY,
  api_secret : process.env.CLOUDINARY_API_SECRET,
});

// ─── MIDDLEWARE ───
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer: accept images up to 10MB, store in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// ─── HELPERS ───
// Cloudinary folder name derived from gallery key (e.g. "classes:drawing" → "rashi/classes/drawing")
function folderFromKey(key) {
  return 'rashi/' + key.replace(':', '/');
}

// ─── ROUTES ───

// GET /api/images/:key  — list all images in a gallery
app.get('/api/images/:key(*)', async (req, res) => {
  try {
    const folder = folderFromKey(req.params.key);
    const result = await cloudinary.api.resources({
      type        : 'upload',
      prefix      : folder + '/',
      max_results : 200,
      context     : true,     // fetch caption / alt metadata
    });

    // Sort by created_at ascending so oldest = first (cover is index 0)
    const sorted = result.resources.sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    // Honour manual ordering stored in context.cover
    // The cover image has context key "cover" = "1"
    const cover  = sorted.find(r => r.context?.custom?.cover === '1');
    const rest   = sorted.filter(r => r.context?.custom?.cover !== '1');
    const images = cover ? [cover, ...rest] : sorted;

    res.json(images.map(r => ({
      public_id: r.public_id,
      url      : r.secure_url,
      label    : r.context?.custom?.caption || r.context?.custom?.label || '',
      isCover  : r.context?.custom?.cover   === '1',
    })));
  } catch (err) {
    // If folder doesn't exist yet Cloudinary returns a 404 — return empty array
    if (err.http_code === 404) return res.json([]);
    console.error('list error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/images/:key  — upload one or more images
app.post('/api/images/:key(*)', upload.array('images'), async (req, res) => {
  try {
    const folder  = folderFromKey(req.params.key);
    const labels  = JSON.parse(req.body.labels || '[]');   // array of label strings
    const results = [];

    for (let i = 0; i < req.files.length; i++) {
      const file  = req.files[i];
      const label = labels[i] || file.originalname.replace(/\.[^.]+$/, '');

      // Upload buffer directly to Cloudinary
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            context  : `caption=${label}|label=${label}`,
            resource_type: 'image',
          },
          (err, result) => err ? reject(err) : resolve(result)
        );
        stream.end(file.buffer);
      });

      results.push({
        public_id: uploaded.public_id,
        url      : uploaded.secure_url,
        label,
        isCover  : false,
      });
    }

    res.json(results);
  } catch (err) {
    console.error('upload error', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/images/:key/label  — update a label
app.patch('/api/images/:key(*)/label', async (req, res) => {
  try {
    const { public_id, label } = req.body;
    await cloudinary.uploader.update_metadata(`caption=${label}|label=${label}`, [public_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('label error', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/images/:key/cover  — set cover image
app.patch('/api/images/:key(*)/cover', async (req, res) => {
  try {
    const { public_id, folder_key } = req.body;
    const folder = folderFromKey(folder_key);

    // Get all resources in folder
    const result = await cloudinary.api.resources({
      type       : 'upload',
      prefix     : folder + '/',
      max_results: 200,
      context    : true,
    });

    // Clear cover on everyone, then set on chosen
    const updates = result.resources.map(r =>
      cloudinary.uploader.update_metadata(
        r.public_id === public_id ? 'cover=1' : 'cover=0',
        [r.public_id]
      )
    );
    await Promise.all(updates);
    res.json({ ok: true });
  } catch (err) {
    console.error('cover error', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/images/:public_id(*)  — delete one image
app.delete('/api/images/:public_id(*)', async (req, res) => {
  try {
    await cloudinary.uploader.destroy(req.params.public_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── SERVE FRONTEND ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START ───
app.listen(PORT, () =>
  console.log(`Rashi Art Classes server running on port ${PORT}`)
);
