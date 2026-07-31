# DreamScape Frontend

The frontend is built with Vue 3, Vite, TypeScript, Pinia, Vue Router, Vue I18n and Socket.IO. It provides responsive English and Vietnamese views for account access, dreams, community interaction, Oracle, messaging, academic reading and administration.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

The local environment must provide `VITE_API_BASE_URL`, `VITE_SOCKET_URL`, `VITE_PUBLIC_APP_URL` and the Firebase web configuration.

## Verify

```bash
npm run build
npm run test:unit
```

Deployment-specific values belong to the hosting platform rather than a committed `.env.production` file.
