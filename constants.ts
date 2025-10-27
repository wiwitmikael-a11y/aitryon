// IMPORTANT: Replace with your actual Google Cloud Project ID and desired location.
export const VERTEX_AI_LOCATION = 'us-central1';
export const VERTEX_AI_PROJECT_ID = 'gen-lang-client-0513612665';
export const MODEL_ID = 'virtual-try-on-preview-08-04';

export const API_ENDPOINT = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${MODEL_ID}:predict`;