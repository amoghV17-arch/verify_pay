#!/usr/bin/env node
import { execSync } from 'node:child_process';

console.log('[db:up] Checking for Docker availability...');

let dockerAvailable = false;
try {
  execSync('docker --version', { stdio: 'pipe' });
  dockerAvailable = true;
} catch {
  dockerAvailable = false;
}

if (dockerAvailable) {
  console.log('[db:up] Docker found. Starting PostgreSQL container via docker compose...');
  try {
    execSync('docker compose up -d postgres', { stdio: 'inherit' });
    console.log('[db:up] PostgreSQL is running on port 5432.');
  } catch (err) {
    console.error('[db:up] Failed to start Docker container:', err.message);
    process.exit(1);
  }
} else {
  console.log('[db:up] Notice: Docker is not installed or not in PATH.');
  console.log('[db:up] As specified in project instructions, fallback mode is active:');
  console.log('[db:up] Using hosted Postgres via DATABASE_URL instead.');
  if (process.env.DATABASE_URL) {
    console.log('[db:up] Current DATABASE_URL is set.');
  } else {
    console.log('[db:up] DATABASE_URL not set in current shell. Will use .env when starting apps.');
  }
}

