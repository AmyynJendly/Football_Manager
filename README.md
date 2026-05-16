# Football Tournament Registration App

A web application for managing team registration in a football tournament.

## Features

- Register a team with captain contact details
- Add/remove players per team (7–15 players per team)
- Browse all registered teams and their squads
- Real-time stats: total teams, spots remaining, total players, ready teams
- Supports up to 16 teams
- Data persisted in SQLite

## Quick Start

```bash
cd backend
npm install
node server.js
```

Then open http://localhost:3000 in your browser.

## Stack

- **Backend**: Node.js + Express + better-sqlite3
- **Frontend**: Vanilla HTML / CSS / JavaScript (no build step)
- **DB**: SQLite (file: `backend/tournament.db`)

## Rules

| Rule | Value |
|------|-------|
| Max teams | 16 |
| Min players per team | 7 |
| Max players per team | 15 |
| Jersey numbers | 1 – 99 (unique per team) |
