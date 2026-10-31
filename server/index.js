import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const app = createApp();
const server = app.listen(port, () => console.log(`All Transport API listening on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
