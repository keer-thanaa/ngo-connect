import { supabase } from './supabaseClient.js';
import { requireAuth, signOut, cleanText } from './auth.js';

const els = {
  dashTitle: document.getElementById('dashTitle'),
  roleBadge: document.getElementById('roleBadge'),
  pendingNote: document.getElementById('pendingNote'),
  alertBox: document.getElementById('alertBox'),
  composeSection: document.getElementById('composeSection'),
  composeForm: document.getElementById('composeForm'),
  composeBtn: document.getElementById('composeBtn'),
  filterSection: document.getElementById('filterSection'),
  filterCategory: document.getElementById('filterCategory'),
  board: document.getElementById('board'),
  logoutBtn: document.getElementById('logoutBtn'),
};

const STAMP_LABEL = { pending: 'Pending', claimed: 'Claimed', done: 'Done' };

function showAlert(message, type = 'error') {
  els.alertBox.innerHTML = `<div class="alert alert-${type === 'error' ? 'error' : 'ok'}">${message}</div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

let currentProfile = null;

async function init() {
  const auth = await requireAuth('login.html');
  if (!auth) return;
  const { profile } = auth;

  if (!profile) {
    showAlert('We could not find your profile. Please contact support.');
    return;
  }
  currentProfile = profile;

  els.roleBadge.textContent = profile.role === 'institution' ? 'Institution' : 'NGO';
  els.dashTitle.textContent = profile.role === 'institution' ? 'Your requirements' : 'Community board';

  if (!profile.approved) {
    els.pendingNote.style.display = 'block';
    els.pendingNote.textContent = "Your account is pending manual approval. You'll be able to " +
      (profile.role === 'institution' ? 'post requirements' : 'claim requirements') +
      ' once it is reviewed. You can browse the board in the meantime.';
  }

  if (profile.role === 'institution') {
    if (profile.approved) els.composeSection.style.display = 'block';
    els.composeForm.addEventListener('submit', handlePost);
  } else {
    els.filterSection.style.display = 'block';
    els.filterCategory.addEventListener('change', loadBoard);
  }

  els.logoutBtn.addEventListener('click', signOut);

  await loadBoard();
}

async function handlePost(e) {
  e.preventDefault();
  const category = els.composeForm.category.value;
  const description = cleanText(els.composeForm.reqDescription.value, 400);

  if (!description) {
    showAlert('Please describe what is needed.');
    return;
  }

  els.composeBtn.disabled = true;
  els.composeBtn.textContent = 'Posting…';

  const { error } = await supabase.from('requirements').insert({
    institution_id: currentProfile.id,
    category,
    description
  });

  els.composeBtn.disabled = false;
  els.composeBtn.textContent = 'Post to board';

  if (error) {
    showAlert('Could not post: ' + error.message);
    return;
  }

  els.composeForm.reset();
  showAlert('Posted to the board.', 'ok');
  await loadBoard();
}

async function loadBoard() {
  els.board.innerHTML = '<p style="color: var(--paper-text-soft)">Loading…</p>';

  let query = supabase
    .from('requirements')
    .select('*, profiles:institution_id(name, location, institution_type)')
    .order('created_at', { ascending: false });

  if (currentProfile.role === 'institution') {
    query = query.eq('institution_id', currentProfile.id);
  } else {
    query = query.neq('status', 'done');
    const cat = els.filterCategory.value;
    if (cat) query = query.eq('category', cat);
  }

  const { data, error } = await query;

  if (error) {
    els.board.innerHTML = '';
    showAlert('Could not load the board: ' + error.message);
    return;
  }

  renderBoard(data || []);
}

function renderBoard(items) {
  if (items.length === 0) {
    els.board.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="glyph">📌</div>
        <p>${currentProfile.role === 'institution'
          ? "Nothing posted yet. Use the form above to post your first requirement."
          : "Nothing on the board right now. Check back soon."}</p>
      </div>`;
    return;
  }

  els.board.innerHTML = items.map(item => cardHtml(item)).join('');

  els.board.querySelectorAll('[data-claim-id]').forEach(btn => {
    btn.addEventListener('click', () => handleClaim(btn.dataset.claimId, btn));
  });
  els.board.querySelectorAll('[data-done-id]').forEach(btn => {
    btn.addEventListener('click', () => handleMarkDone(btn.dataset.doneId, btn));
  });
}

function cardHtml(item) {
  const inst = item.profiles || {};
  const stampClass = `stamp-${item.status}`;
  const stampLabel = STAMP_LABEL[item.status] || item.status;

  let actions = '';
  if (currentProfile.role === 'ngo' && item.status === 'pending') {
    actions = currentProfile.approved
      ? `<div class="actions"><button class="btn btn-primary btn-sm" data-claim-id="${item.id}">Claim this</button></div>`
      : `<div class="actions"><span style="font-size:13px;color:var(--ink-soft)">Approval pending — you'll be able to claim once approved</span></div>`;
  }
  if (currentProfile.role === 'institution' && item.status !== 'done') {
    actions = `<div class="actions"><button class="btn btn-ghost btn-sm" data-done-id="${item.id}">Mark done</button></div>`;
  }

  const subtitle = currentProfile.role === 'ngo'
    ? `${escapeHtml(inst.name || 'Institution')} · ${escapeHtml(inst.location || '')}`
    : `Posted ${new Date(item.created_at).toLocaleDateString()}`;

  return `
    <div class="card req-card">
      <span class="pin"></span>
      <div class="top-row">
        <div class="cat">${escapeHtml(item.category)}</div>
        <span class="stamp ${stampClass}">${stampLabel}</span>
      </div>
      <p style="color: var(--ink); font-size:15px; margin:0 0 4px;">${escapeHtml(item.description)}</p>
      <div class="inst-name">${subtitle}</div>
      ${actions}
    </div>`;
}

async function handleClaim(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Claiming…';

  const { error } = await supabase.rpc('claim_requirement', { requirement_id: id });

  if (error) {
    showAlert(error.message);
    btn.disabled = false;
    btn.textContent = 'Claim this';
    return;
  }

  showAlert('Claimed. The institution\'s contact details are on their profile.', 'ok');
  await loadBoard();
}

async function handleMarkDone(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Updating…';

  const { error } = await supabase
    .from('requirements')
    .update({ status: 'done' })
    .eq('id', id)
    .eq('institution_id', currentProfile.id);

  if (error) {
    showAlert('Could not update: ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Mark done';
    return;
  }

  await loadBoard();
}

init();
