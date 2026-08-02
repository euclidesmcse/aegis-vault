-- AegisVault schema v1 - idempotente para recriar em banco vazio.
-- All timestamps in UTC. IDs externos opacos (ULID). Constraints explicitas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  state         TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_terms_at   TIMESTAMPTZ,
  accepted_privacy_at TIMESTAMPTZ,
  locale        TEXT NOT NULL DEFAULT 'pt-BR'
);
CREATE INDEX IF NOT EXISTS idx_users_state ON users(state);

CREATE TABLE IF NOT EXISTS user_emails (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  verified_at   TIMESTAMPTZ,
  is_primary    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_emails_user ON user_emails(user_id);

CREATE TABLE IF NOT EXISTS auth_identities (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  password_hash TEXT,
  argon2_salt   TEXT,
  argon2_params JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  UNIQUE (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_auth_user ON auth_identities(user_id);

CREATE TABLE IF NOT EXISTS workspaces (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('personal','family','business')),
  name          TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('owner','admin','manager','member','auditor','guest')),
  state         TEXT NOT NULL DEFAULT 'invited',
  invited_by    TEXT REFERENCES users(id),
  joined_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  ip_subnet     TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint   TEXT NOT NULL,
  label         TEXT,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS mfa_methods (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('totp','webauthn')),
  label         TEXT,
  envelope      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash     TEXT NOT NULL UNIQUE,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folders (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES folders(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  envelope_for_member TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_items (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id     TEXT REFERENCES folders(id),
  collection_id TEXT REFERENCES collections(id),
  type          TEXT NOT NULL CHECK (type IN ('login','note','identity','card','custom')),
  envelope      TEXT NOT NULL,
  favorite      BOOLEAN NOT NULL DEFAULT false,
  trashed       BOOLEAN NOT NULL DEFAULT false,
  revision      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vault_items_workspace ON vault_items(workspace_id, trashed);

CREATE TABLE IF NOT EXISTS item_revisions (
  id            TEXT PRIMARY KEY,
  item_id       TEXT NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
  envelope      TEXT NOT NULL,
  revision      INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS secure_shares (
  id            TEXT PRIMARY KEY,
  token_digest  TEXT NOT NULL UNIQUE,
  envelope      TEXT NOT NULL,
  state         TEXT NOT NULL CHECK (state IN ('active','consumed','expired','revoked','deleted')),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at   TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_shares_state_active ON secure_shares(state, expires_at);

CREATE TABLE IF NOT EXISTS share_events (
  id            TEXT PRIMARY KEY,
  share_id      TEXT NOT NULL REFERENCES secure_shares(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_subnet     TEXT,
  user_agent    TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT,
  actor_user_id TEXT,
  action        TEXT NOT NULL,
  target        TEXT,
  result        TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_subnet     TEXT,
  metadata      JSONB
);
