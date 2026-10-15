import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArguments, verifyContentApi } from '../scripts/verify-content-api-destinations.mjs';

function mockFetch(change = (_destination: string, body: any): any => body, unscoped = 400) {
  const calls: URL[] = [];
  const fetchImpl = async (input: URL, init: RequestInit) => {
    calls.push(input);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal);
    const destination = input.searchParams.get('destination');
    if (!destination) return Response.json({ error: 'destination required' }, { status: unscoped });
    return Response.json(change(destination, {
      data: [{ id: 'public-id', release: { destination } }], pagination: { total: 1 },
    }));
  };
  return { calls, fetchImpl };
}

test('checks both destinations and rejects unscoped reads without fixed historical totals', async () => {
  const mock = mockFetch();
  const result = await verifyContentApi({ fetchImpl: mock.fetchImpl });
  assert.equal(result.ok, true);
  assert.deepEqual(result.totals, { challenge: 1, referee: 1 });
  assert.equal(mock.calls.length, 3);
});

test('an unscoped HTTP 200 is a failed isolation check', async () => {
  const mock = mockFetch(undefined, 200);
  const result = await verifyContentApi({ fetchImpl: mock.fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.checks[2].ok, false);
});

test('rejects wrong or absent destination release metadata', async () => {
  for (const release of [{ destination: 'challenge' }, undefined]) {
    const mock = mockFetch((destination, body) => destination === 'referee'
      ? { ...body, data: [{ id: 'public-id', release }] } : body);
    assert.equal((await verifyContentApi({ fetchImpl: mock.fetchImpl })).ok, false);
  }
});

test('rejects invalid totals and inconsistent or missing data', async () => {
  for (const body of [null, [], {}, { data: [], pagination: { total: 1 } },
    { data: [], pagination: { total: '0' } }, { data: [], pagination: { total: -1 } },
    { data: [], pagination: { total: 0.5 } }]) {
    const mock = mockFetch(() => body);
    assert.equal((await verifyContentApi({ fetchImpl: mock.fetchImpl })).ok, false);
  }
});

test('accepts empty catalogs and supports explicit snapshot counts', async () => {
  const mock = mockFetch(() => ({ data: [], pagination: { total: 0 } }));
  assert.equal((await verifyContentApi({ fetchImpl: mock.fetchImpl, expectedTotals: { referee: 0 } })).ok, true);
  assert.equal((await verifyContentApi({ fetchImpl: mock.fetchImpl, expectedTotals: { referee: 2 } })).ok, false);
});

test('collects all probe failures without exposing remote bodies or network errors', async () => {
  let calls = 0;
  const result = await verifyContentApi({ fetchImpl: async () => {
    calls += 1;
    if (calls === 1) throw new Error('private remote details');
    return new Response('private response', { status: 503 });
  } });
  assert.equal(calls, 3);
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /private/);
});

test('aborts slow requests and still attempts every probe', async () => {
  const result = await verifyContentApi({ timeoutMs: 1, fetchImpl: async (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
    }) });
  assert.equal(result.checks.length, 3);
  assert.equal(result.ok, false);
});

test('rejects unsafe origins before calling fetch', async () => {
  for (const baseUrl of ['http://content.example', 'https://u:p@content.example',
    'ftp://localhost', 'https://content.example/path', 'https://content.example/?secret=x']) {
    await assert.rejects(verifyContentApi({ baseUrl, fetchImpl: () => { throw new Error('must not fetch'); } }));
  }
});

test('validates expected counts and rejects duplicate or unknown arguments', async () => {
  assert.deepEqual(parseArguments(['http://localhost:3000', '--expected-referee=0']),
    { baseUrl: 'http://localhost:3000', expectedTotals: { referee: 0 } });
  for (const flags of [['--expected-referee=-1'], ['--expected-referee=2', '--expected-referee=3'], ['--unknown=1']]) {
    assert.throws(() => parseArguments(['https://content.example', ...flags]));
  }
  await assert.rejects(verifyContentApi({ expectedTotals: { referee: -1 } }));
});
