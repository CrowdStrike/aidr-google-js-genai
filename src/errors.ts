export class AidrError extends Error {}

export class AidrAIGuardBlockedError extends AidrError {
  constructor() {
    super('CrowdStrike AIDR returned a blocked response.');
  }
}
