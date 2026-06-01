/* ═══════════════════════════════════════
   Rashi Art Classes — script.js
   Password verified on server — never stored in frontend
   ═══════════════════════════════════════ */

// ─── STATE ───
let isAdmin               = false;
let adminToken            = null;   // JWT-like token from server
let activeCategory        = null;
let lbIndex               = 0;
let lbImages              = [];
let _currentGalleryImages = [];

// ─── API HELPERS ───
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (adminToken) headers['x-admin-token'] = adminToken;
  // Don't set Content-Type for FormData — browser does it with boundary
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ─── TOGGLE MAIN CARD (Classes / Courses) ───
function toggleMain(type) {
  const panel      = document.getElementById('panel-' + type);
  const card       = document.getElementById('card-' + type);
  const otherType  = type === 'classes' ? 'courses' : 'classes';
  const otherPanel = document.getElementById('panel-' + otherType);
  const otherCard  = document.getElementById('card-' + otherType);

  const isOpening = !panel.classList.contains('open');

  otherPanel.classList.remove('open');
  otherCard.classList.remove('active');

  if (isOpening) {
    panel.classList.add('open');
    card.classList.add('active');
    closeImageGallery(false);
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
  } else {
    panel.classList.remove('open');
    card.classList.remove('active');
    closeImageGallery(false);
  }

  document.querySelectorAll('.sub-card').forEach(c => c.classList.remove('active'));
  activeCategory = null;
}

// ─── OPEN IMAGE GALLERY ───
function openImageGallery(mainType, catKey) {
  const fullKey = mainType + ':' + catKey;

  if (activeCategory === fullKey) { closeImageGallery(true); return; }

  activeCategory = fullKey;

  document.querySelectorAll('.sub-card').forEach(c => c.classList.remove('active'));
  event.currentTarget.classList.add('active');

  document.getElementById('ig-breadcrumb').textContent = (mainType === 'classes' ? 'Classes' : 'Courses') + ' →';
  document.getElementById('ig-title').textContent      = getCatLabel(mainType, catKey);

  renderImageGallery(fullKey);

  const section = document.getElementById('image-gallery-section');
  section.classList.add('open');
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
}

function getCatLabel(mainType, catKey) {
  const labels = {
    'classes:drawing'      : 'Drawing',
    'classes:painting'     : 'Painting',
    'classes:coloring'     : 'Coloring',
    'classes:sketching'    : 'Sketching',
    'classes:watercolor'   : 'Watercolor',
    'classes:canvas'       : 'Canvas Art',
    'courses:calligraphy'  : 'Calligraphy',
    'courses:rangoli'      : 'Rangoli',
    'courses:handwriting'  : 'Handwriting',
    'courses:mandala'      : 'Mandala Art',
    'courses:craft'        : 'Craft Art',
    'courses:pencilshading': 'Pencil Shading',
  };
  return labels[mainType + ':' + catKey] || catKey;
}

function closeImageGallery(clearActive = true) {
  document.getElementById('image-gallery-section').classList.remove('open');
  if (clearActive) {
    activeCategory = null;
    document.querySelectorAll('.sub-card').forEach(c => c.classList.remove('active'));
  }
}

// ─── RENDER IMAGE GALLERY ───
async function renderImageGallery(fullKey) {
  const grid     = document.getElementById('ig-grid');
  const emptyMsg = document.getElementById('ig-empty');
  const progress = document.getElementById('ig-progress');

  grid.innerHTML          = '';
  emptyMsg.style.display  = 'none';
  progress.style.display  = 'flex';

  let imgs = [];
  try {
    imgs = await apiFetch('/api/images/' + encodeURIComponent(fullKey));
  } catch (err) {
    console.error('Failed to load images:', err);
    emptyMsg.style.display = 'flex';
    progress.style.display = 'none';
    return;
  }

  progress.style.display = 'none';
  _currentGalleryImages  = imgs;

  if (imgs.length === 0) { emptyMsg.style.display = 'flex'; return; }

  imgs.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'ig-card';

    const coverBadge = idx === 0 ? `<span class="ig-cover-badge">Cover</span>` : '';
    const coverBtn   = idx > 0   ? `<button class="ig-cover-btn" title="Set as cover">⭐</button>` : '';

    card.innerHTML = `
      <div class="ig-img-wrap">
        <img src="${img.url}" alt="${img.label || ''}" loading="lazy">
        <div class="ig-img-overlay"><span class="ig-zoom-icon">⤢</span></div>
        ${coverBadge}
      </div>
      <div class="ig-card-footer">
        <span class="ig-card-label">${img.label || 'Untitled'}</span>
        <input class="ig-label-input" value="${(img.label || '').replace(/"/g, '&quot;')}" placeholder="Add a title…">
        <button class="ig-delete-btn" title="Delete">✕</button>
        ${coverBtn}
      </div>`;

    card.querySelector('.ig-img-wrap').addEventListener('click', () => openLightbox(idx));
    card.querySelector('.ig-label-input').addEventListener('change', e => updateIgLabel(img.public_id, e.target.value));
    card.querySelector('.ig-delete-btn').addEventListener('click', e => deleteIgImage(e, img.public_id));
    if (idx > 0) card.querySelector('.ig-cover-btn').addEventListener('click', e => setIgCover(e, img.public_id));

    grid.appendChild(card);
  });
}

// ─── SET COVER ───
async function setIgCover(e, publicId) {
  e.stopPropagation();
  try {
    await apiFetch('/api/images/' + encodeURIComponent(activeCategory) + '/cover', {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ public_id: publicId, folder_key: activeCategory }),
    });
    renderImageGallery(activeCategory);
  } catch (err) { alert('Could not set cover: ' + err.message); }
}

// ─── UPDATE LABEL ───
async function updateIgLabel(publicId, val) {
  try {
    await apiFetch('/api/images/' + encodeURIComponent(activeCategory) + '/label', {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ public_id: publicId, label: val }),
    });
  } catch (err) { console.error('Label update failed:', err); }
}

// ─── DELETE IMAGE ───
async function deleteIgImage(e, publicId) {
  e.stopPropagation();
  if (!confirm('Remove this artwork?')) return;
  try {
    await apiFetch('/api/images/' + encodeURIComponent(publicId), { method: 'DELETE' });
    renderImageGallery(activeCategory);
  } catch (err) { alert('Could not delete image: ' + err.message); }
}

// ─── UPLOAD ───
function triggerImgUpload() {
  if (!isAdmin) return;
  document.getElementById('ig-file-input').click();
}

async function handleImgFiles(files) {
  if (!isAdmin || !activeCategory) return;
  const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!arr.length) return;

  const progress = document.getElementById('ig-progress');
  progress.style.display = 'flex';
  try {
    const formData = new FormData();
    const labels   = [];
    arr.forEach(file => {
      formData.append('images', file);
      labels.push(file.name.replace(/\.[^.]+$/, ''));
    });
    formData.append('labels', JSON.stringify(labels));

    await apiFetch('/api/images/' + encodeURIComponent(activeCategory), {
      method: 'POST',
      body  : formData,
    });
    await renderImageGallery(activeCategory);
  } catch (err) {
    alert('Upload failed: ' + err.message);
  } finally {
    progress.style.display = 'none';
    document.getElementById('ig-file-input').value = '';
  }
}

// ─── LIGHTBOX ───
function openLightbox(idx) {
  const imgs = _currentGalleryImages;
  if (!imgs.length) return;
  lbImages = imgs;
  lbIndex  = idx;
  const lb = document.getElementById('lightbox');
  lb.querySelector('#lb-img').src             = imgs[idx].url;
  lb.querySelector('#lb-label').textContent   = imgs[idx].label || '';
  lb.querySelector('#lb-counter').textContent = `${idx + 1} / ${imgs.length}`;
  lb.classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

function lbNav(dir) {
  lbIndex = (lbIndex + dir + lbImages.length) % lbImages.length;
  document.getElementById('lb-img').src             = lbImages[lbIndex].url;
  document.getElementById('lb-label').textContent   = lbImages[lbIndex].label || '';
  document.getElementById('lb-counter').textContent = `${lbIndex + 1} / ${lbImages.length}`;
}

// ─── ADMIN — password checked on SERVER, never in frontend ───
async function checkAdminSession() {
  const token = sessionStorage.getItem('adminToken');
  if (!token) return;
  try {
    const { valid } = await apiFetch('/api/admin/verify', {
      headers: { 'x-admin-token': token },
    });
    if (valid) {
      adminToken = token;
      isAdmin    = true;
      document.body.classList.add('admin-mode');
    } else {
      sessionStorage.removeItem('adminToken');
    }
  } catch { sessionStorage.removeItem('adminToken'); }
}

async function tryLogin() {
  const input = document.getElementById('admin-pwd-input');
  const error = document.getElementById('admin-error');
  const pwd   = input.value;
  input.value = '';

  try {
    const { token } = await apiFetch('/api/admin/login', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ password: pwd }),
    });
    adminToken = token;
    isAdmin    = true;
    sessionStorage.setItem('adminToken', token);
    document.body.classList.add('admin-mode');
    closeAdminPanel();
    error.style.display = 'none';
  } catch {
    error.style.display = 'block';
    error.textContent   = 'Incorrect password.';
    input.focus();
  }
}

async function logout() {
  try {
    await apiFetch('/api/admin/logout', { method: 'POST' });
  } catch { /* ignore */ }
  adminToken = null;
  isAdmin    = false;
  sessionStorage.removeItem('adminToken');
  document.body.classList.remove('admin-mode');
}

let footerClickCount = 0, footerClickTimer = null;
function footerSecretClick() {
  footerClickCount++;
  clearTimeout(footerClickTimer);
  footerClickTimer = setTimeout(() => { footerClickCount = 0; }, 600);
  if (footerClickCount >= 3) {
    footerClickCount = 0;
    isAdmin ? logout() : openAdminPanel();
  }
}

function openAdminPanel() {
  document.getElementById('admin-panel').classList.add('open');
  setTimeout(() => document.getElementById('admin-pwd-input').focus(), 100);
}
function closeAdminPanel() {
  document.getElementById('admin-panel').classList.remove('open');
  document.getElementById('admin-error').style.display = 'none';
}

// ─── CONTACT FORM → WHATSAPP ───
function setupContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name     = document.getElementById('cf-name').value.trim();
    const email    = document.getElementById('cf-email').value.trim();
    const interest = document.getElementById('cf-interest').value;
    const msg      = document.getElementById('cf-msg').value.trim();
    if (!name) { alert('Please enter your name.'); return; }
    const text = `Hi Rashi Art Classes! 🎨\n\nNew inquiry from the website:\n\n*Name:* ${name}\n*Email:* ${email || 'Not provided'}\n*Interested in:* ${interest || 'Not specified'}\n*Message:* ${msg || 'No message'}`;
    window.open(`https://wa.me/919022781500?text=${encodeURIComponent(text)}`, '_blank');
  });
}

// ─── KEYBOARD ───
document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (lb && lb.classList.contains('open')) {
    if (e.key === 'Escape')     { closeLightbox(); return; }
    if (e.key === 'ArrowRight') { lbNav(1);        return; }
    if (e.key === 'ArrowLeft')  { lbNav(-1);       return; }
  }
  if (e.key === 'Escape') closeAdminPanel();
  if (e.key === 'Enter' && document.getElementById('admin-panel').classList.contains('open')) tryLogin();
});

// ─── HERO CTA ───
function setupHeroCta() {
  const cta = document.querySelector('.hero-cta');
  if (!cta) return;
  cta.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('medium').scrollIntoView({ behavior: 'smooth' });
  });
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  checkAdminSession();
  setupContactForm();
  setupHeroCta();
});
