// Max output tokens per response segment.
// DeepSeek V4 Flash supports up to 64K output tokens;
// Anthropic Claude supports 8K with beta header.
// Using 16384 as a good balance — large enough for complex code generation,
// but not so large that it causes long waits or rate limiting on free models.
export const MAX_TOKENS = 16384;

// Limits the number of model responses that can be returned in a single request
// (when the model hits maxTokens, it continues with a CONTINUE_PROMPT)
export const MAX_RESPONSE_SEGMENTS = 2;
