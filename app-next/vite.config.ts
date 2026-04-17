import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Dev proxy targets: mirror the RPC paths served by `litd` so the in-browser
 * Connect-ES client can talk to a local regtest node without CORS wrangling.
 * TLS verification is disabled for dev self-signed certs — the same tradeoff
 * the legacy `app/src/setupProxy.js` makes.
 */
const LITD_BACKEND = 'https://localhost:8443';

const RPC_PATHS = [
  '/lnrpc.Lightning',
  '/looprpc.SwapClient',
  '/poolrpc.Trader',
  '/poolrpc.ChannelAuctioneer',
  '/frdrpc.FaradayServer',
  '/litrpc.Sessions',
  '/litrpc.Accounts',
  '/litrpc.Status',
  '/litrpc.Firewall',
  '/litrpc.Autopilot',
  '/litrpc.Proxy',
] as const;

const proxy = Object.fromEntries(
  RPC_PATHS.map((p) => [
    p,
    {
      target: LITD_BACKEND,
      changeOrigin: true,
      secure: false,
      ws: true,
    },
  ]),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy,
  },
});
