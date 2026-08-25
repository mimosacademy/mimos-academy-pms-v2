import PocketBase from 'pocketbase';

const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL;

if (!POCKETBASE_API_URL) {
  throw new Error('VITE_POCKETBASE_URL is not configured. Add it to the Vercel environment variables.');
}

const pocketbaseClient = new PocketBase(POCKETBASE_API_URL.replace(/\/$/, ''));

export default pocketbaseClient;
export { pocketbaseClient };
