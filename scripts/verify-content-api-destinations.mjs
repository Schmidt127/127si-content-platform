#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const DESTINATIONS = ['challenge', 'referee'];

/** Read-only deployment checks. Inject fetch for offline acceptance tests. */
export async function verifyContentApi({
  baseUrl = 'https://content.fairfieldbasketballclub.com',
  fetchImpl = fetch,
  expectedTotals = {},
  timeoutMs = 10_000,
} = {}) {
  const origin = new URL(baseUrl);
  if (origin.username || origin.password || origin.search || origin.hash ||
      origin.pathname !== '/' ||
      (origin.protocol !== 'https:' &&
       !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
    throw new Error('Use an HTTPS origin, or HTTP localhost for local verification');
  }
  for (const [destination, total] of Object.entries(expectedTotals)) {
    if (!DESTINATIONS.includes(destination) || !Number.isSafeInteger(total) || total < 0) {
      throw new Error('Expected totals must be non-negative integers for challenge or referee');
    }
  }
  const checks = [];
  const totals = {};
  async function request(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(new URL(path, origin), {
        method: 'GET', headers: { accept: 'application/json' },
        redirect: 'manual', signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      return { status: response.status, body };
    } catch {
      // Never log remote bodies or exception text: they can contain private data.
      return { status: null, body: null };
    } finally {
      clearTimeout(timer);
    }
  }
  for (const destination of DESTINATIONS) {
    const result = await request(`/api/v1/content?destination=${destination}&page_size=1`);
    const { data, pagination } = result.body ?? {};
    const total = pagination?.total;
    const shapeOk = Array.isArray(data) && data.length <= 1 &&
      Number.isSafeInteger(total) && total >= 0 &&
      data.length === Math.min(total, 1) &&
      data.every(item => item && typeof item.id === 'string' && item.id.length > 0 &&
        item.release?.destination === destination);
    const ok = result.status === 200 && shapeOk &&
      (expectedTotals[destination] === undefined || total === expectedTotals[destination]);
    checks.push({ label: destination, ok, status: result.status,
      ...(Number.isSafeInteger(total) && total >= 0 ? { total } : {}) });
    if (ok) totals[destination] = total;
  }
  const unscoped = await request('/api/v1/content?page_size=1');
  checks.push({ label: 'unscoped list rejected', ok: unscoped.status === 400,
    status: unscoped.status });
  return { ok: checks.every(check => check.ok), checks, totals };
}

export function parseArguments(args) {
  const [baseUrl = 'https://content.fairfieldbasketballclub.com', ...flags] = args;
  const expectedTotals = {};
  for (const flag of flags) {
    const match = /^--expected-(challenge|referee)=(0|[1-9]\d*)$/.exec(flag);
    if (!match || expectedTotals[match[1]] !== undefined || !Number.isSafeInteger(Number(match[2]))) {
      throw new Error('Use [origin] [--expected-challenge=N] [--expected-referee=N]');
    }
    expectedTotals[match[1]] = Number(match[2]);
  }
  return { baseUrl, expectedTotals };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyContentApi(parseArguments(process.argv.slice(2)));
    for (const check of result.checks) {
      console.log(`${check.ok ? 'OK' : 'FAIL'} ${check.label}: HTTP ${check.status ?? 'unavailable'}${check.total === undefined ? '' : `, total=${check.total}`}`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error('FAIL invalid verification arguments; use an HTTPS origin and optional --expected-challenge=N / --expected-referee=N');
    process.exitCode = 1;
  }
}
