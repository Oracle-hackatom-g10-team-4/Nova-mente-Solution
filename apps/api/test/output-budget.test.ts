import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { withOutputBudget, MAX_OUTPUT_TOKENS } from '../src/connections/output-budget.js';

test('provider requests are bounded for generated and streamed completions', async () => {
  const bodies: Record<string, unknown>[] = [];
  const signals: (AbortSignal | null | undefined)[] = [];
  const provider = createOpenAICompatible({
    name: 'synthetic', baseURL: 'https://fixture.invalid/v1', apiKey: 'synthetic-only-key',
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body); signals.push(init?.signal);
      const message = { id: 'fixture', model: 'fixture', choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] };
      return body.stream
        ? new Response('data: {"id":"fixture","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
        : new Response(JSON.stringify(message), { headers: { 'content-type': 'application/json' } });
    },
  });
  const original = provider('fixture');
  const model = withOutputBudget(original);
  assert.equal(model.provider, original.provider);
  assert.equal(model.modelId, original.modelId);
  assert.equal(model.constructor, original.constructor);
  assert.equal(model.specificationVersion, original.specificationVersion);
  assert.deepEqual(model.supportedUrls, original.supportedUrls);
  const controller = new AbortController();
  for (const requested of [undefined, 65536, 512]) {
    const options = { prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'fixture' }] }], maxOutputTokens: requested, abortSignal: controller.signal };
    await model.doGenerate(options);
    const result = await model.doStream(options);
    await result.stream.cancel();
    const expected = requested === 512 ? 512 : MAX_OUTPUT_TOKENS;
    assert.equal(bodies.at(-1)?.max_tokens, expected);
    assert.equal(bodies.at(-2)?.max_tokens, expected);
    assert.equal(options.maxOutputTokens, requested, 'caller options must remain unchanged');
  }
  assert.equal(bodies.length, 6);
  assert.ok(signals.every(signal => signal === controller.signal));
});

test('invalid budgets fail before any provider request', () => {
  let called = false;
  const original = createOpenAICompatible({ name: 'synthetic', apiKey: 'synthetic-only-key', fetch: async () => { called = true; throw new Error('must not call'); } })('fixture');
  for (const invalid of [0, -1, 1.5, NaN, 65536]) assert.throws(() => withOutputBudget(original, invalid));
  const model = withOutputBudget(original);
  for (const invalid of [0, -1, NaN, Infinity])
    assert.throws(() => model.doGenerate({ prompt: [], maxOutputTokens: invalid }));
  assert.equal(called, false);
});


test('vendor-specific token options cannot override the compatible-provider ceiling', async () => {
  const requests: Record<string, unknown>[] = [];
  const original = createOpenAICompatible({
    name: 'synthetic', baseURL: 'https://fixture.invalid/v1', apiKey: 'synthetic-only-key',
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] }), { headers: { 'content-type': 'application/json' } });
    },
  })('fixture');
  const model = withOutputBudget(original);
  const overrides = { max_tokens: 65536, max_completion_tokens: 65536, max_output_tokens: 65536, maxOutputTokens: 65536, user: 'synthetic-id' };
  await model.doGenerate({ prompt: [], maxOutputTokens: 512, providerOptions: { synthetic: overrides } });
  for (const key of ['max_tokens', 'max_completion_tokens', 'max_output_tokens', 'maxOutputTokens']) assert.equal(requests[0][key], 512);
  assert.equal(requests[0].user, 'synthetic-id');
  assert.equal(overrides.max_tokens, 65536, 'provider options must remain unchanged');
  assert.throws(() => model.doGenerate({ prompt: [], providerOptions: { synthetic: { max_tokens: -1 } } }));
});
