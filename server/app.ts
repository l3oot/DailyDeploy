import { Hono } from "hono";
import { cors } from "hono/cors";
import { pingDb } from "./db";
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

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  }),
);
app.use("*", rateLimit);

app.get("/v1/health", async (c) => {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  const db = hasUrl ? await pingDb() : false;
  return c.json({
    isSuccess: true,
    message: "ok",
    data: { db, hasDatabaseUrl: hasUrl },
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
