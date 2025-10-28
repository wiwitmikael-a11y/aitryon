import { GoogleGenAI } from "@google/genai";

// Ensure the API key is available. This is a hard requirement.
if (!process.env.API_KEY) {
    // This error will be caught by the Vercel runtime and logged.
    // The client will receive a 500 Internal Server Error.
    throw new Error("API_KEY environment variable is not set.");
}

/**
 * A singleton instance of the GoogleGenAI client.
 * Initialized with the API key from environment variables.
 */
// FIX: Initialize GoogleGenAI with a named apiKey parameter as required by the new SDK versions.
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
