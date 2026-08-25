import PocketBase from 'pocketbase';

const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL;

// Do not fail the Vite production build when deployment secrets are intentionally
// supplied by the hosting environment. Fail only when the browser actually loads
// the application without the required runtime configuration.
if (!POCKETBASE_API_URL && typeof window !== 'undefined') {
  throw new Error('VITE_POCKETBASE_URL is not configured. Add it to the Vercel environment variables.');
}

const pocketbaseClient = new PocketBase((POCKETBASE_API_URL || '').replace(/\/$/, ''));

export default pocketbaseClient;
export { pocketbaseClient };
