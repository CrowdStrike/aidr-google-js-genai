import type { AIGuard } from '@crowdstrike/aidr';
import type {
  Content,
  GenerateContentParameters,
  GenerateContentResponse,
  Models,
  Part,
} from '@google/genai';

import { tContents, tPart } from './_transformers';
import { AidrAIGuardBlockedError } from './errors';

function hasRoleAndParts(
  x: Content
): x is Content & { role: string; parts: Part[] } {
  return x.role !== undefined && x.parts !== undefined && x.parts.length > 0;
}

function hasText(x: Part): x is Part & { text: string } {
  return x.text !== undefined;
}

export class AidrModels {
  private readonly googleModels: Models;

  private readonly aiGuardClient: AIGuard;

  constructor(googleModels: Models, aiGuardClient: AIGuard) {
    this.googleModels = googleModels;
    this.aiGuardClient = aiGuardClient;
  }

  /**
   * Makes an API request to generate content with a given model.
   *
   * For the `model` parameter, supported formats for Vertex AI API include:
   * - The Gemini model ID, for example: 'gemini-2.0-flash'
   * - The full resource name starts with 'projects/', for example:
   *  'projects/my-project-id/locations/us-central1/publishers/google/models/gemini-2.0-flash'
   * - The partial resource name with 'publishers/', for example:
   *  'publishers/google/models/gemini-2.0-flash' or
   *  'publishers/meta/models/llama-3.1-405b-instruct-maas'
   * - `/` separated publisher and model name, for example:
   * 'google/gemini-2.0-flash' or 'meta/llama-3.1-405b-instruct-maas'
   *
   * For the `model` parameter, supported formats for Gemini API include:
   * - The Gemini model ID, for example: 'gemini-2.0-flash'
   * - The model name starts with 'models/', for example:
   *  'models/gemini-2.0-flash'
   * - For tuned models, the model name starts with 'tunedModels/',
   * for example:
   * 'tunedModels/1234567890123456789'
   *
   * Some models support multimodal input and output.
   *
   * @param params - The parameters for generating content.
   * @return The response from generating content.
   *
   * @example
   * ```ts
   * const response = await ai.models.generateContent({
   *   model: 'gemini-2.0-flash',
   *   contents: 'why is the sky blue?',
   *   config: {
   *     candidateCount: 2,
   *   }
   * });
   * console.log(response);
   * ```
   */
  generateContent = async (
    params: GenerateContentParameters
  ): Promise<GenerateContentResponse> => {
    const normalizedContents = tContents(params.contents);
    const pangeaMessages: [
      { role: string; content: string },
      number,
      number,
    ][] = normalizedContents
      .filter(hasRoleAndParts)
      .flatMap((content, contentIdx) =>
        content.parts
          .filter(hasText)
          .map(
            (part, partIdx) =>
              [
                { role: content.role, content: part.text },
                contentIdx,
                partIdx,
              ] satisfies [{ role: string; content: string }, number, number]
          )
      );

    const guardInputResponse = await this.aiGuardClient.guardChatCompletions({
      guard_input: { messages: pangeaMessages.map(([message]) => message) },
      event_type: 'input',
    });

    if (
      guardInputResponse.status === 'Success' &&
      guardInputResponse.result?.blocked
    ) {
      throw new AidrAIGuardBlockedError();
    }

    if (
      guardInputResponse.status === 'Success' &&
      guardInputResponse.result?.transformed &&
      guardInputResponse.result.guard_output?.messages &&
      Array.isArray(guardInputResponse.result.guard_output.messages)
    ) {
      for (const [
        idx,
        [_message, contentIdx, partIdx],
      ] of pangeaMessages.entries()) {
        const transformed =
          guardInputResponse.result.guard_output.messages[idx];
        const parts = normalizedContents[contentIdx].parts;
        if (parts) {
          parts[partIdx] = tPart(transformed.content);
        }
      }
    }

    const genaiResponse = await this.googleModels.generateContent({
      ...params,
      contents: normalizedContents,
    });

    if (genaiResponse.text) {
      const guardOutputResponse = await this.aiGuardClient.guardChatCompletions(
        {
          // The LLM response must be contained within a single "assistant"
          // message to AI Guard. Splitting up the content parts into multiple
          // "assistant" messages will result in only the last message being
          // processed.
          guard_input: {
            messages: pangeaMessages
              .map(([message]) => message)
              .concat([{ role: 'assistant', content: genaiResponse.text }]),
          },
          event_type: 'output',
        }
      );

      if (
        guardOutputResponse.status === 'Success' &&
        guardOutputResponse.result?.blocked
      ) {
        throw new AidrAIGuardBlockedError();
      }
    }

    return genaiResponse;
  };
}
