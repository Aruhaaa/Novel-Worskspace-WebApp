// A stand-in for Supabase, for testing and for trying the app with its cloud features without a Supabase project.
//
//   node scripts/dev-supabase/server.mjs [--port 54321]
//
// It runs the app's real database schema (supabase/migrations/*.sql) and setup scripts (supabase/setup_scripts/*.sql)
// on PGlite, a real PostgreSQL engine that runs inside this process, and answers the parts of Supabase's HTTP and
// WebSocket interfaces the app uses: sign-up and sign-in, the REST interface with row level security applied as the
// signed-in person, remote procedure calls, and Realtime (table changes, broadcast and presence).
//
// It is NOT Supabase: no email, no storage, no OAuth, data lives in memory and is gone when it stops. Never use it
// for real work. It exists so the real supabase-js client and the real SQL can be exercised together.
import http from 'node:http';
import crypto from 'node:crypto';
import { ANON_KEY, sign, verify } from './keys.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { WebSocketServer } from 'ws';

const supabaseDir = fileURLToPath(new URL('../../supabase/', import.meta.url));

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const q = (name) => {
  if (!IDENT.test(name)) throw httpError(400, { code: 'PGRST100', message: `Invalid name "${name}"` });
  return `"${name}"`;
};

function httpError(status, body) {
  const e = new Error(body.message || 'error');
  e.status = status;
  e.body = body;
  return e;
}

/** A PostgreSQL error becomes the answer PostgREST would give. */
const mapPgError = (e, context = {}) => {
  if (e.status && e.body) return e;
  const code = e.code || '';
  const message = e.message || String(e);
  if (code === '42P01') return httpError(404, { code: 'PGRST205', message: `Could not find the table 'public.${context.table ?? ''}' in the schema cache`, details: null, hint: null });
  if (code === '42883') return httpError(404, { code: 'PGRST202', message: `Could not find the function public.${context.fn ?? ''} in the schema cache`, details: null, hint: null });
  if (code === '42501') return httpError(context.anon ? 401 : 403, { code, message, details: null, hint: null });
  if (code === '23505' || code === '23503') return httpError(409, { code, message, details: e.detail ?? null, hint: null });
  if (code === '22P02' || code === '23502' || code === '23514' || code === 'P0001' || code === '42703' || code === '22023' || code === '23001' || code === '22007') {
    return httpError(400, { code, message, details: e.detail ?? null, hint: null });
  }
  return httpError(500, { code: code || 'XX000', message, details: e.detail ?? null, hint: null });
};

// ---------------------------------------------------------------------------------------------------------------------
// PostgREST-style filters
// ---------------------------------------------------------------------------------------------------------------------
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };

/** Split "a.eq.1,and(b.eq.2,c.in.(3,4))" at the commas that are not inside brackets. */
const splitTop = (text) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
};

const condition = (col, opText, params) => {
  let negate = false;
  let op = opText;
  if (op.startsWith('not.')) {
    negate = true;
    op = op.slice(4);
  }
  const dot = op.indexOf('.');
  const name = dot === -1 ? op : op.slice(0, dot);
  const value = dot === -1 ? '' : op.slice(dot + 1);
  let sql;
  if (name === 'is') {
    const v = value.toLowerCase();
    sql = `${q(col)} is ${v === 'null' ? 'null' : v === 'true' ? 'true' : v === 'false' ? 'false' : 'null'}`;
  } else if (name === 'in') {
    const items = splitTop(value.replace(/^\(/, '').replace(/\)$/, '')).map((s) => s.replace(/^"(.*)"$/, '$1'));
    params.push(items);
    sql = `${q(col)}::text = any($${params.length}::text[])`;
  } else if (name === 'like' || name === 'ilike') {
    params.push(value.replace(/\*/g, '%'));
    sql = `${q(col)}::text ${OPS[name]} $${params.length}`;
  } else if (OPS[name]) {
    params.push(value);
    sql = `${q(col)} ${OPS[name]} $${params.length}`;
  } else {
    throw httpError(400, { code: 'PGRST100', message: `Unsupported operator "${name}"` });
  }
  return negate ? `not (${sql})` : sql;
};

const logicTree = (kind, inner, params) => {
  const parts = splitTop(inner).map((item) => {
    const m = /^(not\.)?(and|or)\((.*)\)$/.exec(item);
    if (m) {
      const sub = logicTree(m[2], m[3], params);
      return m[1] ? `not (${sub})` : sub;
    }
    const first = item.indexOf('.');
    return condition(item.slice(0, first), item.slice(first + 1), params);
  });
  return `(${parts.join(kind === 'or' ? ' or ' : ' and ')})`;
};

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const whereClause = (searchParams, params) => {
  const clauses = [];
  for (const [key, value] of searchParams) {
    if (RESERVED.has(key)) continue;
    if (key === 'or' || key === 'and') {
      clauses.push(logicTree(key, value.replace(/^\(/, '').replace(/\)$/, ''), params));
      continue;
    }
    clauses.push(condition(key, value, params));
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
};

const selectList = (searchParams) => {
  const s = searchParams.get('select');
  if (!s || s === '*' || s.includes('(')) return '*';
  return s
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c === '*' ? '*' : q(c.includes(':') ? c.split(':').pop() : c)))
    .join(', ');
};

const orderClause = (searchParams) => {
  const o = searchParams.get('order');
  if (!o) return '';
  return ` order by ${o
    .split(',')
    .map((item) => {
      const [col, ...mods] = item.split('.');
      return `${q(col)} ${mods.includes('desc') ? 'desc' : 'asc'}${mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''}`;
    })
    .join(', ')}`;
};

// ---------------------------------------------------------------------------------------------------------------------
/** `nextFeatures: false` leaves out supabase/setup_scripts/20261105_next_features.sql, to see the app before that setup step has been run. */
export async function startSupabaseLite({ port = 54321, extraSql = [], nextFeatures = true } = {}) {
  const db = new PGlite();

  // Platform pieces Supabase provides
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      encrypted_password text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create schema extensions;
    create function extensions.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
    grant usage on schema public, auth, extensions to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
    create publication supabase_realtime;
    create schema realtime;
    create table realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, event text);
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select, insert on realtime.messages to authenticated;
    grant usage on sequence realtime.messages_id_seq to authenticated;
    grant execute on function realtime.topic() to authenticated;
  `);
  await db.exec(readFileSync(`${supabaseDir}migrations/20261022125111_remote_schema.sql`, 'utf8'));
  if (nextFeatures) await db.exec(readFileSync(`${supabaseDir}setup_scripts/20261105_next_features.sql`, 'utf8'));
  for (const sql of extraSql) await db.exec(sql);

  // Row changes are announced so Realtime can pass them on
  await db.exec(`
    create function public._emit() returns trigger language plpgsql as $$
    begin
      perform pg_notify('row_changes', json_build_object(
        'table', tg_table_name, 'type', tg_op,
        'new', case when tg_op = 'DELETE' then null when length(to_jsonb(new)::text) > 6000 then to_jsonb(new) - 'content' else to_jsonb(new) end,
        'old', case when tg_op = 'INSERT' then null when length(to_jsonb(old)::text) > 6000 then to_jsonb(old) - 'content' else to_jsonb(old) end)::text);
      return null;
    end $$;
  `);
  for (const t of ['notifications', 'chat_messages', 'message_reads', 'comments', 'reviews', 'profiles', 'project_members', 'project_invites', 'share_comments']) {
    if ((await db.query('select to_regclass($1) is not null as ok', [`public.${t}`])).rows[0].ok) {
      await db.exec(`create trigger zz_emit after insert or update or delete on public.${t} for each row execute function public._emit()`);
    }
  }

  const now = () => Math.floor(Date.now() / 1000);
  const anonKey = ANON_KEY;
  const refreshTokens = new Map();

  const identityOf = (header) => {
    const token = String(header || '').replace(/^Bearer\s+/i, '');
    const claims = verify(token);
    if (!claims) return { role: 'anon', sub: '', claims: { role: 'anon' } };
    if (claims.role === 'authenticated') return { role: 'authenticated', sub: claims.sub, claims };
    return { role: 'anon', sub: '', claims };
  };

  /** Run something inside a transaction, as a person (or as nobody), exactly as Supabase does for each request. */
  const as = (identity, fn) =>
    db.transaction(async (tx) => {
      await tx.exec(`set local role ${identity.role}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true), set_config('request.jwt.claim.role', $3, true)", [
        identity.sub,
        JSON.stringify(identity.claims),
        identity.role,
      ]);
      return fn(tx);
    });

  const sessionFor = async (row, meta) => {
    const claims = { sub: row.id, email: row.email, role: 'authenticated', aud: 'authenticated', iat: now(), exp: now() + 3600, user_metadata: meta ?? row.raw_user_meta_data ?? {}, app_metadata: { provider: 'email' } };
    const refresh = crypto.randomUUID();
    refreshTokens.set(refresh, row.id);
    return {
      access_token: sign(claims),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: claims.exp,
      refresh_token: refresh,
      user: userJson(row),
    };
  };
  const userJson = (row) => ({
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: row.raw_user_meta_data ?? {},
    identities: [],
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: new Date().toISOString(),
  });
  const hash = (pw) => crypto.createHash('sha256').update(`lite:${pw}`).digest('hex');

  // -------------------------------------------------------------------------------------------------------------------
  // HTTP
  // -------------------------------------------------------------------------------------------------------------------
  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(text ? JSON.parse(text) : undefined);
        } catch {
          resolve(undefined);
        }
      });
    });

  const send = (res, status, body, headers = {}) => {
    const text = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Content-Range', ...headers });
    res.end(text);
  };

  const handleAuth = async (req, res, url, body) => {
    const path = url.pathname.replace('/auth/v1', '');
    const grant = url.searchParams.get('grant_type');
    if (path === '/signup' && req.method === 'POST') {
      const { email, password, data } = body ?? {};
      if (!email || !password) return send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Email and password are required' });
      if (String(password).length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
      const exists = await db.query('select 1 from auth.users where lower(email) = lower($1)', [email]);
      if (exists.rows.length) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const row = (await db.query('insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning *', [email, hash(password), JSON.stringify(data ?? {})])).rows[0];
      return send(res, 200, await sessionFor(row));
    }
    if (path === '/token' && grant === 'password' && req.method === 'POST') {
      const { email, password } = body ?? {};
      const found = (await db.query('select * from auth.users where lower(email) = lower($1)', [email])).rows[0];
      if (!found || found.encrypted_password !== hash(password)) return send(res, 400, { code: 400, error_code: 'invalid_credentials', error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      return send(res, 200, await sessionFor(found));
    }
    if (path === '/token' && grant === 'refresh_token' && req.method === 'POST') {
      const id = refreshTokens.get(body?.refresh_token);
      if (!id) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      const row = (await db.query('select * from auth.users where id = $1', [id])).rows[0];
      return send(res, 200, await sessionFor(row));
    }
    if (path === '/user') {
      const ident = identityOf(req.headers.authorization);
      if (ident.role !== 'authenticated') return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      let row = (await db.query('select * from auth.users where id = $1', [ident.sub])).rows[0];
      if (!row) return send(res, 401, { code: 401, error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' });
      if (req.method === 'PUT') {
        if (body?.data) await db.query("update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || $2::jsonb where id = $1", [ident.sub, JSON.stringify(body.data)]);
        if (body?.password) await db.query('update auth.users set encrypted_password = $2 where id = $1', [ident.sub, hash(body.password)]);
        row = (await db.query('select * from auth.users where id = $1', [ident.sub])).rows[0];
      }
      return send(res, 200, userJson(row));
    }
    if (path === '/authorize' && req.method === 'GET') {
      // The pretend Google or Apple: no page of its own. It signs a pretend person in at once (named by login_hint, or a fixed one)
      // and sends the browser back to the site with the session in the address, the way the real ones do.
      const provider = url.searchParams.get('provider') ?? 'google';
      const back = url.searchParams.get('redirect_to') || 'http://localhost:5173/';
      const email = (url.searchParams.get('login_hint') || `${provider}.person@example.com`).toLowerCase();
      let row = (await db.query('select * from auth.users where lower(email) = lower($1)', [email])).rows[0];
      if (!row) {
        row = (await db.query("insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, '', $2) returning *", [email, JSON.stringify({ full_name: 'Pretend Person', provider })])).rows[0];
      }
      const session = await sessionFor(row);
      const fragment = new URLSearchParams({
        access_token: session.access_token,
        expires_at: String(session.expires_at),
        expires_in: String(session.expires_in),
        refresh_token: session.refresh_token,
        token_type: 'bearer',
        provider_token: 'pretend',
      }).toString();
      res.writeHead(302, { Location: `${back}#${fragment}` });
      return res.end();
    }
    if (path === '/logout') return send(res, 204, undefined);
    if (path === '/recover') return send(res, 200, {});
    return send(res, 404, { code: 404, msg: `Unsupported auth call ${req.method} ${path}` });
  };

  const handleRest = async (req, res, url, body) => {
    const ident = identityOf(req.headers.authorization);
    const parts = url.pathname.replace('/rest/v1/', '').split('/');
    const prefer = String(req.headers.prefer || '');
    const wantRows = /return=representation/.test(prefer);
    const wantCount = /count=exact/.test(prefer);
    const single = /vnd\.pgrst\.object/.test(String(req.headers.accept || ''));
    const respondRows = (rows, status, total) => {
      if (single) {
        if (rows.length !== 1) {
          return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
        }
        return send(res, status, rows[0]);
      }
      const range = total !== undefined ? { 'Content-Range': `${rows.length ? `0-${rows.length - 1}` : '*'}/${total}` } : {};
      return send(res, status, rows, range);
    };

    // ---- remote procedure calls
    if (parts[0] === 'rpc') {
      const fn = parts[1];
      const args = req.method === 'GET' ? Object.fromEntries(url.searchParams) : (body ?? {});
      const meta = (await db.query("select p.proretset, p.prorettype::regtype::text as ret from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1", [fn])).rows[0];
      if (!meta) throw httpError(404, { code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache`, details: null, hint: null });
      const names = Object.keys(args);
      const params = names.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
      const call = `public.${q(fn)}(${names.map((n, i) => `${q(n)} => $${i + 1}`).join(', ')})`;
      const rows = await as(ident, async (tx) => {
        const r = await tx.query(`select coalesce(json_agg(_t), '[]'::json) as body from (select * from ${call}) _t`, params);
        return r.rows[0].body;
      }).catch((e) => {
        throw mapPgError(e, { fn, anon: ident.role === 'anon' });
      });
      if (meta.ret === 'void') return send(res, 204, undefined);
      if (meta.proretset) return send(res, 200, rows);
      const row = rows[0];
      // A function that returns one plain value is answered with just that value
      const keys = row ? Object.keys(row) : [];
      if (keys.length === 1 && keys[0] === fn) return send(res, 200, row[fn]);
      return send(res, 200, row ?? null);
    }

    const table = parts[0];
    const exists = (await db.query("select to_regclass('public.' || quote_ident($1)) is not null as ok", [table])).rows[0].ok;
    if (!exists) throw httpError(404, { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache`, details: null, hint: "Perhaps you meant the table 'public.chapters'" });

    const params = [];
    const run = (fn) => as(ident, fn).catch((e) => {
      throw mapPgError(e, { table, anon: ident.role === 'anon' });
    });

    if (req.method === 'GET' || req.method === 'HEAD') {
      const where = whereClause(url.searchParams, params);
      const order = orderClause(url.searchParams);
      const limit = url.searchParams.get('limit');
      const offset = url.searchParams.get('offset');
      const sqlBody = `from public.${q(table)}${where}`;
      const result = await run(async (tx) => {
        const total = wantCount ? Number((await tx.query(`select count(*)::int as n ${sqlBody}`, params)).rows[0].n) : undefined;
        if (req.method === 'HEAD') return { rows: [], total };
        const rows = (
          await tx.query(`select coalesce(json_agg(_t), '[]'::json) as body from (select ${selectList(url.searchParams)} ${sqlBody}${order}${limit ? ` limit ${Number(limit)}` : ''}${offset ? ` offset ${Number(offset)}` : ''}) _t`, params)
        ).rows[0].body;
        return { rows, total };
      });
      if (req.method === 'HEAD') return send(res, 200, undefined, { 'Content-Range': `*/${result.total ?? 0}` });
      return respondRows(result.rows, 200, result.total);
    }

    if (req.method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r ?? {})))];
      const conflictCols = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
      let conflict = '';
      if (/resolution=(merge|ignore)-duplicates/.test(prefer)) {
        let target = conflictCols;
        if (!target.length) {
          target = (await db.query("select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisprimary", [table])).rows.map((r) => r.attname);
        }
        const updates = cols.filter((c) => !target.includes(c));
        conflict = /merge/.test(prefer) && updates.length ? ` on conflict (${target.map(q).join(', ')}) do update set ${updates.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')}` : ` on conflict (${target.map(q).join(', ')}) do nothing`;
      }
      const result = await run(async (tx) => {
        const insert = cols.length
          ? `insert into public.${q(table)} (${cols.map(q).join(', ')}) select ${cols.map(q).join(', ')} from json_populate_recordset(null::public.${q(table)}, $1::json)${conflict} returning *`
          : `insert into public.${q(table)} default values returning *`;
        return (await tx.query(`with _r as (${insert}) select coalesce(json_agg(_r), '[]'::json) as body from _r`, cols.length ? [JSON.stringify(rows)] : [])).rows[0].body;
      });
      return wantRows ? respondRows(result, 201) : send(res, 201, undefined);
    }

    if (req.method === 'PATCH') {
      const cols = Object.keys(body ?? {});
      const where = whereClause(url.searchParams, params);
      const jsonParam = `$${params.length + 1}`;
      const result = await run(async (tx) => {
        const sets = cols.map((c) => `${q(c)} = (json_populate_record(null::public.${q(table)}, ${jsonParam}::json)).${q(c)}`).join(', ');
        return (await tx.query(`with _r as (update public.${q(table)} set ${sets}${where} returning *) select coalesce(json_agg(_r), '[]'::json) as body from _r`, [...params, JSON.stringify(body)])).rows[0].body;
      });
      return wantRows ? respondRows(result, 200) : send(res, 204, undefined);
    }

    if (req.method === 'DELETE') {
      const where = whereClause(url.searchParams, params);
      const result = await run(async (tx) => (await tx.query(`with _r as (delete from public.${q(table)}${where} returning *) select coalesce(json_agg(_r), '[]'::json) as body from _r`, params)).rows[0].body);
      return wantRows ? respondRows(result, 200) : send(res, 204, undefined);
    }
    return send(res, 405, { message: 'Method not allowed' });
  };

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, undefined);
    const url = new URL(req.url, `http://localhost:${port}`);
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE' ? undefined : await readBody(req);
      if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url, body);
      if (url.pathname.startsWith('/rest/v1/')) return await handleRest(req, res, url, body);
      if (url.pathname === '/__admin/sql' && req.method === 'POST') {
        const r = await db.query(body.sql, body.params ?? []);
        return send(res, 200, r.rows);
      }
      if (url.pathname === '/__admin/anon-key') return send(res, 200, { anonKey });
      return send(res, 404, { message: 'Not found' });
    } catch (e) {
      const err = e.status ? e : mapPgError(e);
      return send(res, err.status, err.body);
    }
  });

  // -------------------------------------------------------------------------------------------------------------------
  // Realtime
  // -------------------------------------------------------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/realtime/v1/websocket')) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  /** topic -> { sockets: Set, presence: Map(key -> metas[]) } */
  const channels = new Map();
  const sockets = new Set();
  let bindingId = 0;
  let presenceRef = 0;

  const push = (ws, joinRef, ref, topic, event, payload) => {
    if (ws.readyState === 1) ws.send(JSON.stringify([joinRef ?? null, ref ?? null, topic, event, payload]));
  };

  const channelAllows = async (identity, topic, write) => {
    // Channels named project:<id>:... are private: the database's realtime policies decide who may use them
    try {
      await db.transaction(async (tx) => {
        await tx.exec("select set_config('realtime.topic', '" + topic.replace(/'/g, "''") + "', true)");
        if (write) {
          await tx.exec(`set local role ${identity.role}`);
          await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [identity.sub, JSON.stringify(identity.claims)]);
          await tx.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast')", [topic]);
        } else {
          const id = (await tx.query("insert into realtime.messages (topic, extension) values ($1, 'broadcast') returning id", [topic])).rows[0].id;
          await tx.exec(`set local role ${identity.role}`);
          await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [identity.sub, JSON.stringify(identity.claims)]);
          const seen = (await tx.query('select 1 from realtime.messages where id = $1', [id])).rows.length;
          if (!seen) throw new Error('not allowed');
        }
        throw new Error('rollback');
      });
    } catch (e) {
      return e.message === 'rollback';
    }
    return false;
  };

  const matchFilter = (filter, record) => {
    if (!filter) return true;
    const m = /^([a-zA-Z0-9_]+)=eq\.(.*)$/.exec(filter);
    if (!m) return true;
    return String(record?.[m[1]]) === m[2];
  };

  const canSee = async (identity, table, record, type) => {
    if (type === 'DELETE') return true;
    try {
      const r = await as(identity, (tx) => tx.query(`select exists (select 1 from public.${q(table)} x where to_jsonb(x) @> $1::jsonb) as ok`, [JSON.stringify(record)]));
      return r.rows[0].ok;
    } catch {
      return false;
    }
  };

  await db.listen('row_changes', async (payload) => {
    let ev;
    try {
      ev = JSON.parse(payload);
    } catch {
      return;
    }
    const record = ev.new ?? ev.old;
    for (const ws of sockets) {
      for (const [topic, join] of ws.joins) {
        for (const b of join.bindings) {
          if (b.table !== ev.table || (b.event !== '*' && b.event !== ev.type) || !matchFilter(b.filter, record)) continue;
          if (!(await canSee(join.identity, ev.table, record, ev.type))) continue;
          push(ws, null, null, topic, 'postgres_changes', {
            ids: [b.id],
            data: { schema: 'public', table: ev.table, commit_timestamp: new Date().toISOString(), type: ev.type, record: ev.new ?? {}, old_record: ev.old ?? {}, columns: [], errors: null },
          });
        }
      }
    }
  });

  const decodeBinaryPush = (buf) => {
    // [kind=3][joinRefLen][refLen][topicLen][eventLen][metaLen][encoding] joinRef ref topic event meta payload
    const text = (o, n) => buf.subarray(o, o + n).toString('utf8');
    let o = 7;
    const [jl, rl, tl, el, ml, enc] = [buf[1], buf[2], buf[3], buf[4], buf[5], buf[6]];
    const joinRef = text(o, jl);
    o += jl;
    const ref = text(o, rl);
    o += rl;
    const topic = text(o, tl);
    o += tl;
    const event = text(o, el);
    o += el;
    o += ml;
    const raw = buf.subarray(o);
    return { joinRef, ref, topic, event, payload: enc === 1 ? JSON.parse(raw.toString('utf8')) : raw };
  };

  const leave = (ws, topic) => {
    const join = ws.joins.get(topic);
    ws.joins.delete(topic);
    const ch = channels.get(topic);
    if (!ch) return;
    ch.sockets.delete(ws);
    if (join?.presenceKey !== undefined && ch.presence.has(join.presenceKey)) {
      const metas = ch.presence.get(join.presenceKey);
      ch.presence.delete(join.presenceKey);
      for (const other of ch.sockets) push(other, null, null, topic, 'presence_diff', { joins: {}, leaves: { [join.presenceKey]: { metas } } });
    }
    if (ch.sockets.size === 0 && ch.presence.size === 0) channels.delete(topic);
  };

  wss.on('connection', (ws, req) => {
    ws.joins = new Map();
    sockets.add(ws);
    const apikey = new URL(req.url, 'http://x').searchParams.get('apikey');
    ws.defaultToken = apikey;

    ws.on('message', async (raw, isBinary) => {
      let msg;
      try {
        if (isBinary) {
          const buf = Buffer.from(raw);
          if (buf[0] !== 3) return;
          const b = decodeBinaryPush(buf);
          msg = { joinRef: b.joinRef, ref: b.ref, topic: b.topic, event: 'broadcast', payload: { type: 'broadcast', event: b.event, payload: b.payload } };
        } else {
          const [joinRef, ref, topic, event, payload] = JSON.parse(raw.toString());
          msg = { joinRef, ref, topic, event, payload };
        }
      } catch {
        return;
      }
      const { joinRef, ref, topic, event, payload } = msg;

      if (topic === 'phoenix' && event === 'heartbeat') return push(ws, null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} });

      if (event === 'phx_join') {
        const config = payload?.config ?? {};
        const identity = identityOf(`Bearer ${payload?.access_token || ws.defaultToken}`);
        const name = topic.replace(/^realtime:/, '');
        if (config.private && !(await channelAllows(identity, name, false))) {
          return push(ws, joinRef, ref, topic, 'phx_reply', { status: 'error', response: { reason: 'Unauthorized: You do not have permissions to read from this Channel topic: ' + name } });
        }
        for (const c of config.postgres_changes ?? []) {
          const there = (await db.query("select to_regclass('public.' || quote_ident($1)) is not null as ok", [c.table])).rows[0].ok;
          if (!there) return push(ws, joinRef, ref, topic, 'phx_reply', { status: 'error', response: { reason: `Unable to subscribe to changes with given parameters. Please check Realtime is enabled for the given connect parameters: [event: ${c.event}, schema: ${c.schema}, table: ${c.table}, filters: [${c.filter ?? ''}]]` } });
        }
        const bindings = (config.postgres_changes ?? []).map((c) => ({ id: ++bindingId, event: c.event, schema: c.schema, table: c.table, filter: c.filter }));
        const presenceKey = config.presence?.key ? String(config.presence.key) : undefined;
        ws.joins.set(topic, { identity, bindings, joinRef, presenceKey, private: !!config.private, self: !!config.broadcast?.self, name });
        let ch = channels.get(topic);
        if (!ch) channels.set(topic, (ch = { sockets: new Set(), presence: new Map() }));
        ch.sockets.add(ws);
        push(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: bindings.map((b) => ({ id: b.id, event: b.event, schema: b.schema, table: b.table, ...(b.filter ? { filter: b.filter } : {}) })) } });
        if (bindings.length) push(ws, null, null, topic, 'system', { message: 'Subscribed to PostgreSQL', status: 'ok', extension: 'postgres_changes', channel: name });
        const state = {};
        for (const [key, metas] of ch.presence) state[key] = { metas };
        push(ws, null, null, topic, 'presence_state', state);
        return;
      }

      const join = ws.joins.get(topic);
      if (event === 'phx_leave') {
        leave(ws, topic);
        return push(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      }
      if (event === 'access_token') {
        if (join) join.identity = identityOf(`Bearer ${payload?.access_token}`);
        return push(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      }
      if (!join) return;
      const ch = channels.get(topic);

      if (event === 'broadcast') {
        if (join.private && !(await channelAllows(join.identity, join.name, true))) return;
        for (const other of ch.sockets) {
          const theirs = other.joins.get(topic);
          if (other === ws && !join.self) continue;
          if (other !== ws && theirs?.private && !(await channelAllows(theirs.identity, theirs.name, false))) continue;
          push(other, null, null, topic, 'broadcast', { type: 'broadcast', event: payload.event, payload: payload.payload });
        }
        if (ref) push(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
        return;
      }
      if (event === 'presence') {
        if (join.private && !(await channelAllows(join.identity, join.name, true))) return;
        const key = join.presenceKey ?? crypto.randomUUID();
        join.presenceKey = key;
        if (payload.event === 'track') {
          const meta = { phx_ref: String(++presenceRef), ...payload.payload };
          const before = ch.presence.get(key) ?? [];
          ch.presence.set(key, [meta]);
          for (const other of ch.sockets) push(other, null, null, topic, 'presence_diff', { joins: { [key]: { metas: [meta] } }, leaves: before.length ? { [key]: { metas: before } } : {} });
        } else if (payload.event === 'untrack') {
          const before = ch.presence.get(key);
          if (before) {
            ch.presence.delete(key);
            for (const other of ch.sockets) push(other, null, null, topic, 'presence_diff', { joins: {}, leaves: { [key]: { metas: before } } });
          }
        }
        if (ref) push(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      }
    });

    ws.on('close', () => {
      for (const topic of [...ws.joins.keys()]) leave(ws, topic);
      sockets.delete(ws);
    });
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${port}`,
    anonKey,
    db,
    close: async () => {
      for (const ws of sockets) ws.terminate();
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}

// Started from the command line
if ((process.argv[1] || '').split('\\').join('/').endsWith('/dev-supabase/server.mjs')) {
  const i = process.argv.indexOf('--port');
  const port = i > -1 ? Number(process.argv[i + 1]) : 54321;
  const lite = await startSupabaseLite({ port, nextFeatures: !process.argv.includes('--no-next-features') });
  console.log(`Supabase stand-in running at ${lite.url}`);
  console.log(`VITE_SUPABASE_URL=${lite.url}`);
  console.log(`VITE_SUPABASE_ANON_KEY=${lite.anonKey}`);
}
