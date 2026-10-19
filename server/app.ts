import { Hono } from "hono";
import { describeDatabaseUrl, pingDb } from "./db";
import { fail, TypeError } from "./lib/api-response";
import { rateLimit } from "./lib/rate-limit";
import authRoutes from "./routes/auth";
import ggmapRoutes from "./routes/ggmap";
import moodRoutes from "./routes/moods";
import nearwakeRoutes from "./routes/nearwake";
import placesRoutes from "./routes/places";
import planRoutes from "./routes/plans";
import toiletRoutes from "./routes/toilets";
import userRoutes from "./routes/users";

const app = new Hono().basePath("/api");

// Apply CORS after the handler. The built-in cors() helper touches `c.res`
// before `next()`, which drops Set-Cookie on Vercel/Next (login never sticks).
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    const origin = c.req.header("origin") ?? "";
    const headers = new Headers();
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Vary", "Origin");
    }
    headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    headers.set(
      "Access-Control-Allow-Headers",
      c.req.header("Access-Control-Request-Headers") ||
        "Content-Type,Authorization",
    );
    return new Response(null, { status: 204, headers });
  }
  await next();
  const origin = c.req.header("origin") ?? "";
  if (origin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin", { append: true });
  }
});
app.use("*", rateLimit);

app.get("/v1/health", async (c) => {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  const ping = hasUrl ? await pingDb() : { ok: false, error: "DATABASE_URL is not set" };
  const meta = describeDatabaseUrl();
  return c.json({
    isSuccess: true,
    message: "ok",
    data: {
      db: ping.ok,
      hasDatabaseUrl: hasUrl,
      dbHost: meta.host,
      dbPort: meta.port,
      connectPort: meta.connectPort,
      sslmode: meta.sslmode,
      dbError: ping.error ?? null,
    },
    errorType: 0,
  });
});

app.route("/v1/auth", authRoutes);
app.route("/v1/users", userRoutes);
app.route("/v1/plans", planRoutes);
app.route("/v1/moods", moodRoutes);
app.route("/v1/ggmap", ggmapRoutes);
app.route("/v1/nearwake", nearwakeRoutes);
app.route("/v1/places", placesRoutes);
app.route("/v1/toilet", toiletRoutes);

app.notFound((c) =>
  c.json(fail("Not found", TypeError.NotFound), 404),
);

app.onError((err, c) => {
  console.error(err);
  return c.json(fail(err.message || "Internal error", TypeError.InternalError), 500);
});

export default app;
