import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { readJson } from "./http";

/** The AI's verdict on a meaning answer in context. */
export interface ContextVerdict {
    result: 'correct' | 'minor_error' | 'wrong';
    reason?: string;
}

/** The subset of a Gemini generateContent response this service reads. */
interface GeminiResponse {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/** The model is asked for JSON, but it is still untrusted text: check the shape before using it. */
function isContextVerdict(value: unknown): value is ContextVerdict {
    if (typeof value !== 'object' || value === null) return false;
    const { result, reason } = value as Record<string, unknown>;
    return (result === 'correct' || result === 'minor_error' || result === 'wrong')
        && (reason === undefined || typeof reason === 'string');
}

export class LLMService {
    /**
     * Validates if a user's answer is a valid translation for a Japanese vocabulary word
     * given the specific context of a sentence.
     * 
     * @param apiKey The user's Gemini API key
     * @param vocab The target vocabulary being tested
     * @param sentence The sentence providing context
     * @param userAnswer The user's submitted English meaning
     * @returns The verdict, with a short reason
     */
    static async validateMeaningContext(
        apiKey: string,
        vocab: Vocabulary,
        sentence: Sentence,
        userAnswer: string
    ): Promise<ContextVerdict> {
        if (!apiKey) {
            throw new Error("No API key provided for Gemini validation");
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Get English translation of the sentence (use the first one available)
        const sentenceTranslation = sentence.en?.[0]?.text || "No translation provided.";

        // Flatten glosses for prompt
        const dictionaryMeanings = vocab.senses.flatMap(s => s.glosses).join(', ');

        const prompt = `You are a strict Japanese grading assistant for a Spaced Repetition System.
Your job is to determine if a user's English answer is a valid contextual translation for a specific Japanese vocabulary word.

Context:
- Japanese Vocabulary: ${vocab.writtenForm.kanji} (Reading: ${vocab.reading.primary})
- Dictionary Meanings: ${dictionaryMeanings}
- Example Sentence (Japanese): ${sentence.original}
- Example Sentence (English Translation): ${sentenceTranslation}

The user has submitted this meaning for the vocabulary word: "${userAnswer}"

Evaluate the user's English answer to see if they understand the meaning of the Japanese vocabulary word *in the context of the given sentence*.
Be lenient and focus on comprehension rather than exact wording.

- Return "correct" if the user's answer captures the core idea of the word as it is used in the context. Even if they don't use the exact words from the English translation, if their answer shows they understand what the word means in this situation, mark it correct.
- Return "minor_error" if the user's answer is a valid dictionary translation of the word but doesn't quite fit this specific context, OR if they understand the general concept but the phrasing is imprecise or misses a nuance (e.g., wrong part of speech like "decide" vs "decision").
- Return "wrong" if the answer means something fundamentally different, is completely unrelated, or shows they don't understand the word.

Respond ONLY with valid JSON in the following schema:
{
  "result": "correct" | "minor_error" | "wrong",
  "reason": "A brief 1-2 sentence explanation of why it was graded this way"
}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "object",
                            properties: {
                                result: {
                                    type: "string",
                                    enum: ["correct", "minor_error", "wrong"]
                                },
                                reason: { type: "string" }
                            },
                            required: ["result", "reason"]
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
            }

            const data = await readJson<GeminiResponse>(response);
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResult) throw new Error("Empty response from AI.");

            let parsed: unknown;
            try {
                parsed = JSON.parse(textResult);
            } catch (parseError) {
                console.error("[LLMService] Failed to parse Gemini response", parseError);
                throw new Error("Failed to parse AI response format.");
            }
            if (!isContextVerdict(parsed)) throw new Error("Unexpected AI response format.");
            return { result: parsed.result, reason: parsed.reason };

        } catch (error) {
            console.error("[LLMService] API Call Failed:", error);
            // On catastrophic failure, throw error to let the caller fallback to strict mode
            throw error;
        }
    }
}
