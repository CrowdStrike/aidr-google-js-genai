import { AIGuard } from '@crowdstrike/aidr';
import { GoogleGenAI, type GoogleGenAIOptions } from '@google/genai';

import { AidrModels } from './models';

export class AidrGoogleGenAI extends GoogleGenAI {
  constructor(
    options: GoogleGenAIOptions & {
      aidrApiKey: string;
      aidrBaseURLTemplate: string;
    }
  ) {
    super(options);

    // @ts-expect-error - models is a read-only property
    this.models = new AidrModels(
      this.models,
      new AIGuard({
        token: options.aidrApiKey,
        baseURLTemplate: options.aidrBaseURLTemplate,
      })
    );
  }
}
