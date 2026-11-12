import { defineDynamic } from "eve";
import { createGateway } from "@ai-sdk/gateway";
import { chatgpt } from "eve/models/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { connection } from "./vault.js";
import { withOutputBudget } from "./output-budget.js";

/** Keys are resolved in the trusted runtime, never in a prompt or durable state. */
export const atlasModel = defineDynamic({
  events: {
    "step.started": () => {
      const profile = connection("generation");
      if (!profile.model)
        throw new Error(
          "Configure um modelo de geração no painel ou no servidor.",
        );
      if (profile.provider === "gateway") {
        if (!profile.key)
          throw new Error("Chave do AI Gateway ausente no servidor.");
        return {
          model: createGateway({ apiKey: profile.key })(profile.model),
          modelContextWindowTokens: profile.context_window,
        };
      }
      if (profile.provider === "chatgpt_local") {
        if (
          process.env.ATLAS_ALLOW_LOCAL_CHATGPT !== "1" ||
          process.env.NODE_ENV === "production"
        )
          throw new Error(
            "ChatGPT por assinatura é exclusivo do Eve local habilitado pelo operador.",
          );
        return {
          model: chatgpt(profile.model),
          modelContextWindowTokens: profile.context_window,
        };
      }
      if (!profile.key)
        throw new Error("Chave de geração ausente no servidor.");
      const model =
        profile.provider === "anthropic"
          ? createAnthropic({ apiKey: profile.key })(profile.model)
          : withOutputBudget(createOpenAICompatible({
              name: profile.provider,
              baseURL: profile.base_url,
              apiKey: profile.key,
              includeUsage: true,
            })(profile.model));
      return { model, modelContextWindowTokens: profile.context_window };
    },
  },
});
