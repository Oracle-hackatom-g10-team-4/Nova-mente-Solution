import type { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';

type Options = Parameters<OpenAICompatibleChatLanguageModel['doGenerate']>[0];
type Model = {
  doGenerate(options: Options): PromiseLike<Awaited<ReturnType<OpenAICompatibleChatLanguageModel['doGenerate']>>>;
  doStream(options: Options): PromiseLike<Awaited<ReturnType<OpenAICompatibleChatLanguageModel['doStream']>>>;
};
export const MAX_OUTPUT_TOKENS = 4000;

const TOKEN_OPTIONS = new Set(['max_tokens', 'max_completion_tokens', 'max_output_tokens', 'maxOutputTokens']);

function tokenLimit(value: unknown, ceiling: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error('Limite de saída do modelo inválido.');
  return Math.min(value, ceiling);
}

function capped(options: Options, limit: number): Options {
  const requested = tokenLimit(options.maxOutputTokens ?? limit, limit);
  const providerOptions = options.providerOptions && Object.fromEntries(
    Object.entries(options.providerOptions).map(([name, values]) => [name, values && Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, TOKEN_OPTIONS.has(key) ? tokenLimit(value, requested) : value]),
    )]),
  );
  return { ...options, maxOutputTokens: requested, providerOptions };
}

/** Bound OpenAI-compatible requests, including vendor overrides; session quotas still apply. */
export function withOutputBudget<T extends Model>(model: T, limit = MAX_OUTPUT_TOKENS): T {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_OUTPUT_TOKENS)
    throw new Error('Orçamento de saída do modelo inválido.');
  return new Proxy(model, {
    get(target, property) {
      if (property === 'doGenerate')
        return (options: Options) => target.doGenerate(capped(options, limit));
      if (property === 'doStream')
        return (options: Options) => target.doStream(capped(options, limit));
      return Reflect.get(target, property, target);
    },
  });
}
