import { createApp } from "./app.js";
import { env } from "./config.js";

const app = createApp();
app.listen(env.PORT, () => {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log(`tumaia-backend ${baseUrl}/demo/site/index.html`);
});
