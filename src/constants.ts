// IMPORTANT: Replace with your actual Google Cloud Project ID and desired location.
export const VERTEX_AI_LOCATION = 'us-central1';
export const VERTEX_AI_PROJECT_ID = 'gen-lang-client-0513612665';

// Model IDs for Vertex AI
export const VIRTUAL_TRY_ON_MODEL_ID = 'virtual-try-on-preview-08-04';
export const VEO_MODEL_ID = 'veo-3.1-fast-generate-preview';


// Base endpoint for Vertex AI REST API calls
export const VERTEX_AI_API_BASE = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}`;
