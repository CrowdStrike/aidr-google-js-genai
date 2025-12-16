# CrowdStrike AIDR + Google Gen AI SDK

A wrapper around the Google Gen AI SDK that wraps the Gemini API with
CrowdStrike AIDR. Supports Node.js v22 and greater.

## Installation

```bash
npm install @crowdstrike/aidr-google-genai
```

## Usage

```typescript
import { AidrGoogleGenAI } from "@crowdstrike/aidr-google-genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const CS_AIDR_TOKEN = process.env.CS_AIDR_TOKEN!;
const AIDR_BASE_URL_TEMPLATE = process.env.CS_AIDR_BASE_URL_TEMPLATE!;

const ai = new AidrGoogleGenAI({
  apiKey: GEMINI_API_KEY,
  aidrApiKey: CS_AIDR_TOKEN,
  aidrBaseURLTemplate: AIDR_BASE_URL_TEMPLATE,
});

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash-001",
  contents: "Why is the sky blue?",
});
console.log(response.text);
```

Note that AI Guard transformations on the LLM response are **not** applied
because the conversion from Gemini API output to CrowdStrike AIDR input is
lossy.
