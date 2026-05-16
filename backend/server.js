const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_TEAMS = 16;
const MAX_PLAYERS_PER_TEAM = 15;
const MIN_PLAYERS_PER_TEAM = 7;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.get('/api/teams', (req, res) => {
  const teams = db.prepare(`
    SELECT t.*, COUNT(p.id) as player_count
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at ASC
  `).all();
  res.json(teams);
});

app.get('/api/teams/:id', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const players = db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY jersey_number').all(team.id);
  res.json({ ...team, players });
});

app.post('/api/teams', (req, res) => {
  const { name, captain_name, captain_email, captain_phone } = req.body;
  if (!name?.trim() || !captain_name?.trim() || !captain_email?.trim() || !captain_phone?.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(captain_email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  const count = db.prepare('SELECT COUNT(*) as c FROM teams').get().c;
  if (count >= MAX_TEAMS) {
    return res.status(409).json({ error: `Tournament is full. Maximum ${MAX_TEAMS} teams allowed.` });
  }
  try {
    const result = db.prepare(`
      INSERT INTO teams (name, captain_name, captain_email, captain_phone)
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), captain_name.trim(), captain_email.trim(), captain_phone.trim());
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(team);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A team with that name already exists.' });
    }
    throw err;
  }
});

app.delete('/api/teams/:id', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ message: 'Team deleted' });
});

app.post('/api/teams/:id/players', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { name, position, jersey_number } = req.body;
  if (!name?.trim() || !position?.trim() || jersey_number == null) {
    return res.status(400).json({ error: 'All player fields are required.' });
  }
  const num = parseInt(jersey_number, 10);
  if (isNaN(num) || num < 1 || num > 99) {
    return res.status(400).json({ error: 'Jersey number must be between 1 and 99.' });
  }
  const playerCount = db.prepare('SELECT COUNT(*) as c FROM players WHERE team_id = ?').get(team.id).c;
  if (playerCount >= MAX_PLAYERS_PER_TEAM) {
    return res.status(409).json({ error: `Maximum ${MAX_PLAYERS_PER_TEAM} players per team.` });
  }
  try {
    const result = db.prepare(`
      INSERT INTO players (team_id, name, position, jersey_number)
      VALUES (?, ?, ?, ?)
    `).run(team.id, name.trim(), position.trim(), num);
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(player);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: `Jersey number ${num} is already taken in this team.` });
    }
    throw err;
  }
});

app.delete('/api/teams/:teamId/players/:playerId', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ? AND team_id = ?')
    .get(req.params.playerId, req.params.teamId);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  db.prepare('DELETE FROM players WHERE id = ?').run(req.params.playerId);
  res.json({ message: 'Player removed' });
});

app.get('/api/stats', (req, res) => {
  const totalTeams = db.prepare('SELECT COUNT(*) as c FROM teams').get().c;
  const totalPlayers = db.prepare('SELECT COUNT(*) as c FROM players').get().c;
  const readyTeams = db.prepare(`
    SELECT COUNT(*) as c FROM (
      SELECT team_id FROM players GROUP BY team_id HAVING COUNT(*) >= ?
    )
  `).get(MIN_PLAYERS_PER_TEAM).c;
  res.json({ totalTeams, totalPlayers, readyTeams, maxTeams: MAX_TEAMS, minPlayers: MIN_PLAYERS_PER_TEAM });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Football Tournament server running at http://localhost:${PORT}`);
});
