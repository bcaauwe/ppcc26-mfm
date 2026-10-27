import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAll } from './pagination.ts'

test('all pages are read with the decoded continuation token', async () => {
  const tokens: (string | undefined)[] = []
  const rows = await readAll('Assets', async options => {
    tokens.push(options.$skiptoken)
    return options.$skiptoken ? { success: true, data: { value: [2] } } :
      { success: true, data: { value: [1], '@odata.nextLink': 'https://example.test/rows?$skiptoken=a%2Bb' } }
  })
  assert.deepEqual(rows, [1, 2])
  assert.deepEqual(tokens, [undefined, 'a+b'])
})
test('failed requests and missing payloads are surfaced, never empty successes', async () => {
  await assert.rejects(readAll('Assets', async () => ({ success: false, error: 'Denied' })), /Assets could not be loaded: Denied/)
  await assert.rejects(readAll('Assets', async () => ({ success: true })), /No rows payload/)
})
test('broken and repeated continuation links cannot silently truncate the fleet', async () => {
  await assert.rejects(readAll('Assets', async () => ({ success: true,
    data: { value: [], '@odata.nextLink': 'https://example.test/rows' } })), /pagination token/)
  await assert.rejects(readAll('Assets', async () => ({ success: true,
    data: { value: [], '@odata.nextLink': 'https://example.test/rows?$skiptoken=repeat' } })), /repeated pagination token/)
})
