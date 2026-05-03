# Local Native Install (No Docker)

## Prerequisites

- Node.js 20+ (install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 20`)
- PostgreSQL 16
- Redis 7
- OpenClaw (optional but recommended)

## PostgreSQL

**Mac:**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb personal_agent_db
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-16
sudo systemctl start postgresql
sudo -u postgres createdb personal_agent_db
```

**Windows:** Download the PostgreSQL 16 installer from postgresql.org. Run it, set a password, and start the service.

Set in `.env`:
```
DATABASE_URL=postgresql://localhost/personal_agent_db
```

## Redis

**Mac:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

**Windows:** Use WSL2 or download from github.com/microsoftarchive/redis/releases.

Set in `.env`:
```
REDIS_URL=redis://localhost:6379
```

## Backend

```bash
cd backend
npm install
cp ../.env.example .env   # fill in your values
npm run migrate           # runs DB migrations
npm run dev               # development with auto-reload
# or: npm start           # production
```

Server starts at http://localhost:3000.

## Frontend

```bash
cd frontend
npm install
npm run dev               # Vite dev server at http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:3000`.

## OpenClaw (Native)

```bash
npm install -g openclaw
openclaw start            # gateway at http://localhost:18789
openclaw onboard          # follow wizard to pair channels
```

Copy the skill file:
```bash
mkdir -p ~/.openclaw/workspace/skills/personal-agent
cp openclaw-config/workspace/skills/personal-agent/SKILL.md \
   ~/.openclaw/workspace/skills/personal-agent/SKILL.md
openclaw restart
```

Set in `.env`:
```
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_HOOKS_TOKEN=<your token matching openclaw.json>
```
