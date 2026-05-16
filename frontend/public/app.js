const API = '';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

let toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError(elId) {
  const el = document.getElementById(elId);
  el.textContent = '';
  el.classList.add('hidden');
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    if (tab === 'teams') loadTeams();
  });
});

async function loadStats() {
  try {
    const s = await api('GET', '/api/stats');
    document.getElementById('statTeams').textContent = s.totalTeams;
    document.getElementById('statSlots').textContent = s.maxTeams - s.totalTeams;
    document.getElementById('statPlayers').textContent = s.totalPlayers;
    document.getElementById('statReady').textContent = s.readyTeams;
  } catch (_) {}
}

document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearError('registerError');
  const name = document.getElementById('teamName').value.trim();
  const captain_name = document.getElementById('captainName').value.trim();
  const captain_email = document.getElementById('captainEmail').value.trim();
  const captain_phone = document.getElementById('captainPhone').value.trim();
  if (!name || !captain_name || !captain_email || !captain_phone) {
    showError('registerError', 'Please fill in all fields.');
    return;
  }
  const btn = document.getElementById('registerBtn');
  btn.disabled = true;
  btn.textContent = 'Registering…';
  try {
    await api('POST', '/api/teams', { name, captain_name, captain_email, captain_phone });
    toast(`Team "${name}" registered! Now add your players.`);
    e.target.reset();
    loadStats();
    document.querySelector('[data-tab="teams"]').click();
  } catch (err) {
    showError('registerError', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Register Team';
  }
});

async function loadTeams() {
  const grid = document.getElementById('teamsGrid');
  grid.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    const teams = await api('GET', '/api/teams');
    if (!teams.length) {
      grid.innerHTML = '<p class="empty-state">No teams yet. Be the first to register!</p>';
      return;
    }
    grid.innerHTML = '';
    teams.forEach(t => {
      const isReady = t.player_count >= 7;
      const isFull = t.player_count >= 15;
      const badgeClass = isFull ? 'badge-full' : isReady ? 'badge-ready' : 'badge-pending';
      const badgeText = isFull ? 'Full' : isReady ? 'Ready' : 'Needs players';
      const card = document.createElement('div');
      card.className = 'team-card';
      card.innerHTML = `
        <h3>${escHtml(t.name)}</h3>
        <div class="captain">Captain: ${escHtml(t.captain_name)}</div>
        <span class="badge ${badgeClass}">${badgeText}</span>
        <div class="player-count">${t.player_count} / 15 players</div>
      `;
      card.addEventListener('click', () => openTeamModal(t.id));
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p class="empty-state" style="color:var(--red)">${err.message}</p>`;
  }
}

async function openTeamModal(teamId) {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modalContent');
  modal.classList.remove('hidden');
  content.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
  try {
    const team = await api('GET', `/api/teams/${teamId}`);
    renderModalContent(team);
  } catch (err) {
    content.innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
  }
}

function renderModalContent(team) {
  const content = document.getElementById('modalContent');
  const isReady = team.players.length >= 7;
  const isFull = team.players.length >= 15;
  content.innerHTML = `
    <div class="modal-team-name">${escHtml(team.name)}</div>
    <div class="modal-captain">
      Captain: <strong>${escHtml(team.captain_name)}</strong> &nbsp;·&nbsp;
      ${escHtml(team.captain_email)} &nbsp;·&nbsp; ${escHtml(team.captain_phone)}
    </div>
    <span class="badge ${isFull ? 'badge-full' : isReady ? 'badge-ready' : 'badge-pending'}">
      ${isFull ? 'Squad Full' : isReady ? 'Ready to play' : `Need at least 7 players (${7 - team.players.length} more)`}
    </span>
    <div class="modal-section">
      <h3>Players (${team.players.length} / 15)</h3>
      ${team.players.length === 0
        ? '<p class="hint">No players yet.</p>'
        : team.players.map(p => `
          <div class="player-row">
            <div class="jersey">#${p.jersey_number}</div>
            <div class="player-name">${escHtml(p.name)}</div>
            <div class="player-pos">${escHtml(p.position)}</div>
            <button class="btn btn-danger btn-sm" onclick="removePlayer(${team.id},${p.id},'${escHtml(p.name).replace(/'/g,"\\'")}')" >Remove</button>
          </div>`).join('')
      }
    </div>
    ${!isFull ? `
    <div class="modal-section">
      <h3>Add Player</h3>
      <div class="add-player-form">
        <div id="addPlayerError" class="error-msg hidden"></div>
        <div class="form-row">
          <div class="form-group">
            <label>Full Name <span class="req">*</span></label>
            <input id="pName" type="text" placeholder="Player name" maxlength="60" />
          </div>
          <div class="form-group">
            <label>Position <span class="req">*</span></label>
            <select id="pPosition">
              <option value="">Select…</option>
              <option>Goalkeeper</option>
              <option>Defender</option>
              <option>Midfielder</option>
              <option>Forward</option>
            </select>
          </div>
          <div class="form-group">
            <label>Jersey # <span class="req">*</span></label>
            <input id="pJersey" type="number" min="1" max="99" placeholder="1–99" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="addPlayerBtn" onclick="addPlayer(${team.id})">Add Player</button>
      </div>
    </div>` : ''}
    <div style="margin-top:1.5rem;text-align:right;">
      <button class="btn btn-danger btn-sm" onclick="deleteTeam(${team.id},'${escHtml(team.name).replace(/'/g,"\\'")}')" >Delete Team</button>
    </div>
  `;
}

window.addPlayer = async function(teamId) {
  clearError('addPlayerError');
  const name = document.getElementById('pName')?.value.trim();
  const position = document.getElementById('pPosition')?.value;
  const jersey_number = document.getElementById('pJersey')?.value;
  if (!name || !position || !jersey_number) {
    showError('addPlayerError', 'All player fields are required.');
    return;
  }
  const btn = document.getElementById('addPlayerBtn');
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await api('POST', `/api/teams/${teamId}/players`, { name, position, jersey_number });
    const team = await api('GET', `/api/teams/${teamId}`);
    renderModalContent(team);
    loadStats();
    loadTeams();
    toast('Player added!');
  } catch (err) {
    showError('addPlayerError', err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Add Player'; }
  }
};

window.removePlayer = async function(teamId, playerId, playerName) {
  if (!confirm(`Remove ${playerName} from the team?`)) return;
  try {
    await api('DELETE', `/api/teams/${teamId}/players/${playerId}`);
    const team = await api('GET', `/api/teams/${teamId}`);
    renderModalContent(team);
    loadStats();
    loadTeams();
    toast(`${playerName} removed.`);
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteTeam = async function(teamId, teamName) {
  if (!confirm(`Delete team "${teamName}"? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/teams/${teamId}`);
    closeModal();
    loadStats();
    loadTeams();
    toast(`Team "${teamName}" deleted.`);
  } catch (err) {
    toast(err.message, 'error');
  }
};

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

loadStats();
