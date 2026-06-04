#!/usr/bin/env node

import fs from 'fs';

const DEFAULT_TABLE = 'app_state';

function parseEnvFile(path = '.env.local') {
  try {
    const text = fs.readFileSync(path, 'utf8');
    return Object.fromEntries(
      text
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const index = line.indexOf('=');
          return index === -1 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)];
        })
    );
  } catch {
    return {};
  }
}

function normalizeUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function parseTargets(env) {
  if (env.SUPABASE_KEEPALIVE_TARGETS) {
    return env.SUPABASE_KEEPALIVE_TARGETS
      .split(',')
      .map(target => target.trim())
      .filter(Boolean)
      .map(target => {
        const [name, url, anonKey, table] = target.split('|').map(part => part?.trim());
        return { name, url, anonKey, table: table || DEFAULT_TABLE };
      });
  }

  return [
    {
      name: 'main',
      url: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
      table: env.SUPABASE_KEEPALIVE_TABLE || DEFAULT_TABLE,
    },
    {
      name: 'archive',
      url: env.SUPABASE_ARCHIVE_URL,
      anonKey: env.SUPABASE_ARCHIVE_ANON_KEY,
      table: env.SUPABASE_ARCHIVE_KEEPALIVE_TABLE || DEFAULT_TABLE,
    },
  ].filter(target => target.url && target.anonKey);
}

async function pingTarget(target) {
  const url = normalizeUrl(target.url);
  const headers = {
    apikey: target.anonKey,
    Authorization: `Bearer ${target.anonKey}`,
  };

  const tableUrl = `${url}/rest/v1/${encodeURIComponent(target.table)}?select=*&limit=1`;
  const tableResponse = await fetch(tableUrl, { headers });
  if (tableResponse.ok) {
    return { ok: true, mode: `table:${target.table}`, status: tableResponse.status };
  }

  const rootResponse = await fetch(`${url}/rest/v1/`, { headers });
  if (rootResponse.ok || rootResponse.status === 404) {
    return {
      ok: true,
      mode: 'rest-root',
      status: rootResponse.status,
      tableStatus: tableResponse.status,
    };
  }

  const message = await rootResponse.text().catch(() => '');
  return {
    ok: false,
    mode: 'failed',
    status: rootResponse.status,
    tableStatus: tableResponse.status,
    message: message.slice(0, 200),
  };
}

async function main() {
  const env = { ...parseEnvFile(), ...process.env };
  const targets = parseTargets(env);

  if (targets.length === 0) {
    throw new Error('No Supabase keep-alive targets configured.');
  }

  const results = [];
  for (const target of targets) {
    const result = await pingTarget(target);
    results.push({ name: target.name, ...result });
    const status = result.ok ? 'ok' : 'fail';
    console.log(`[${status}] ${target.name}: ${result.mode} (${result.status})`);
  }

  const failed = results.filter(result => !result.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
