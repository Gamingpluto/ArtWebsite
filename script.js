/* ═══════════════════════════════════════
   Rashi Art Classes — script.js
   Uses backend API + Cloudinary (no localStorage)
   ═══════════════════════════════════════ */

// ─── ADMIN PASSWORD ───
const ADMIN_PASSWORD = 'rashi2025';

// ─── STATE ───
let isAdmin        = false;
let activeCategory = null;   // e.g. 'classes:drawing'
let lbIndex        = 0;
let lbImages       = [];     // current lightbox image list

// ─── API BASE ───
// In production this is the same origin; adjust only if deploying frontend separately
const API_BASE = '';

// ─── API HELPERS ───
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, options);
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
    setTimeout(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
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

  if (activeCategory === fullKey) {
    closeImageGallery(true);
    return;
  }

  activeCategory = fullKey;

  document.querySelectorAll('.sub-card').forEach(c => c.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const catLabel  = getCatLabel(mainType, catKey);
  const mainLabel = mainType === 'classes' ? 'Classes' : 'Courses';
  document.getElementById('ig-breadcrumb').textContent = mainLabel + ' →';
  document.getElementById('ig-title').textContent      = catLabel;

  renderImageGallery(fullKey);

  const section = document.getElementById('image-gallery-section');
  section.classList.add('open');

  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

function getCatLabel(mainType, catKey) {
  const labels = {
    'classes:drawing'     : 'Drawing',
    'classes:painting'    : 'Painting',
    'classes:coloring'    : 'Coloring',
    'classes:sketching'   : 'Sketching',
    'classes:watercolor'  : 'Watercolor',
    'classes:canvas'      : 'Canvas Art',
    'courses:calligraphy' : 'Calligraphy',
    'courses:rangoli'     : 'Rangoli',
    'courses:handwriting' : 'Handwriting',
    'courses:mandala'     : 'Mandala Art',
    'courses:craft'       : 'Craft Art',
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

// ─── RENDER IMAGE GALLERY (fetches from API) ───
async function renderImageGallery(fullKey) {
  const grid     = document.getElementById('ig-grid');
  const emptyMsg = document.getElementById('ig-empty');
  const progress = document.getElementById('ig-progress');

  grid.innerHTML = '';
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

  if (imgs.length === 0) {
    emptyMsg.style.display = 'flex';
    return;
  }

  imgs.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'ig-card';

    const coverBadge = idx === 0 ? `<span class="ig-cover-badge">Cover</span>` : '';
    const coverBtn   = idx > 0   ? `<button class="ig-cover-btn" onclick="setIgCover(event,'${img.public_id}')" title="Set as cover">⭐</button>` : '';

    card.innerHTML = `
      <div class="ig-img-wrap" onclick="openLightbox(${idx}, ${JSON.stringify(imgs).replace(/"/g, '&quot;')})">
        <img src="${img.url}" alt="${img.label || ''}" loading="lazy">
        <div class="ig-img-overlay"><span class="ig-zoom-icon">⤢</span></div>
        ${coverBadge}
      </div>
      <div class="ig-card-footer">
        <span class="ig-card-label">${img.label || 'Untitled'}</span>
        <input class="ig-label-input" value="${img.label || ''}"
               placeholder="Add a title…"
               onchange="updateIgLabel('${img.public_id}', this.value)">
        <button class="ig-delete-btn" onclick="deleteIgImage(event,'${img.public_id}')" title="Delete">✕</button>
        ${coverBtn}
      </div>`;
    grid.appendChild(card);
  });
}

// Fix: store images for lightbox in a module-level variable to avoid HTML attribute encoding issues
let _currentGalleryImages = [];

async function renderImageGallery(fullKey) {
  const grid     = document.getElementById('ig-grid');
  const emptyMsg = document.getElementById('ig-empty');
  const progress = document.getElementById('ig-progress');

  grid.innerHTML = '';
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

  if (imgs.length === 0) {
    emptyMsg.style.display = 'flex';
    return;
  }

  imgs.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'ig-card';

    const coverBadge = idx === 0 ? `<span class="ig-cover-badge">Cover</span>` : '';
    const coverBtn   = idx > 0   ? `<button class="ig-cover-btn" onclick="setIgCover(event,'${CSS.escape(img.public_id)}')" title="Set as cover">⭐</button>` : '';

    card.innerHTML = `
      <div class="ig-img-wrap">
        <img src="${img.url}" alt="${img.label || ''}" loading="lazy">
        <div class="ig-img-overlay"><span class="ig-zoom-icon">⤢</span></div>
        ${coverBadge}
      </div>
      <div class="ig-card-footer">
        <span class="ig-card-label">${img.label || 'Untitled'}</span>
        <input class="ig-label-input" value="${(img.label || '').replace(/"/g, '&quot;')}"
               placeholder="Add a title…">
        <button class="ig-delete-btn" title="Delete">✕</button>
        ${coverBtn}
      </div>`;

    // Attach events via JS (safe, no inline attribute encoding issues)
    card.querySelector('.ig-img-wrap').addEventListener('click', () => openLightbox(idx));
    card.querySelector('.ig-label-input').addEventListener('change', e => updateIgLabel(img.public_id, e.target.value));
    card.querySelector('.ig-delete-btn').addEventListener('click', e => deleteIgImage(e, img.public_id));
    if (idx > 0) {
      card.querySelector('.ig-cover-btn').addEventListener('click', e => setIgCover(e, img.public_id));
    }

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
  } catch (err) {
    alert('Could not set cover: ' + err.message);
  }
}

// ─── UPDATE LABEL ───
async function updateIgLabel(publicId, val) {
  try {
    await apiFetch('/api/images/' + encodeURIComponent(activeCategory) + '/label', {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ public_id: publicId, label: val }),
    });
  } catch (err) {
    console.error('Label update failed:', err);
  }
}

// ─── DELETE IMAGE ───
async function deleteIgImage(e, publicId) {
  e.stopPropagation();
  if (!confirm('Remove this artwork?')) return;
  try {
    await apiFetch('/api/images/' + encodeURIComponent(publicId), { method: 'DELETE' });
    renderImageGallery(activeCategory);
  } catch (err) {
    alert('Could not delete image: ' + err.message);
  }
}

// ─── UPLOAD ───
function triggerImgUpload() {
  if (!isAdmin) return;
  document.getElementById('ig-file-input').click();
}

async function handleImgFiles(files) {
  if (!isAdmin || !activeCategory) return;
  const arr = Array.from(files);
  if (!arr.length) return;

  const progress = document.getElementById('ig-progress');
  progress.style.display = 'flex';

  try {
    const formData = new FormData();
    const labels   = [];

    arr.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      formData.append('images', file);
      labels.push(file.name.replace(/\.[^.]+$/, ''));
    });
    formData.append('labels', JSON.stringify(labels));

    await apiFetch('/api/images/' + encodeURIComponent(activeCategory), {
      method: 'POST',
      body  : formData,
      // Don't set Content-Type — browser sets it with boundary for FormData
    });

    await renderImageGallery(activeCategory);
  } catch (err) {
    alert('Upload failed: ' + err.message);
    console.error('Upload error:', err);
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
  const imgs = lbImages;
  lbIndex = (lbIndex + dir + imgs.length) % imgs.length;
  document.getElementById('lb-img').src             = imgs[lbIndex].url;
  document.getElementById('lb-label').textContent   = imgs[lbIndex].label || '';
  document.getElementById('lb-counter').textContent = `${lbIndex + 1} / ${imgs.length}`;
}

// ─── ADMIN ───
function checkAdminSession() {
  isAdmin = sessionStorage.getItem('admin') === 'yes';
  if (isAdmin) document.body.classList.add('admin-mode');
}

function tryLogin() {
  const input = document.getElementById('admin-pwd-input');
  const error = document.getElementById('admin-error');
  if (input.value === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem('admin', 'yes');
    document.body.classList.add('admin-mode');
    closeAdminPanel();
    input.value = '';
    error.style.display = 'none';
  } else {
    error.style.display = 'block';
    error.textContent   = 'Incorrect password.';
    input.value         = '';
    input.focus();
  }
}

function logout() {
  isAdmin = false;
  sessionStorage.removeItem('admin');
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
