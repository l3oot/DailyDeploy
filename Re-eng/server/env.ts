function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function serverEnv() {
  return {
    databaseUrl: read("DATABASE_URL"),
    jwtSecret: read("JWT_SECRET"),
    jwtIssuer: read("JWT_ISSUER") || "dailyapp",
    jwtAudience: read("JWT_AUDIENCE") || "dailyapp-web",
    googleClientId: read("GOOGLE_CLIENT_ID"),
    googleApiKey: read("GOOGLE_API_KEY") || read("GOOGLE_API_KEY_MAP"),
    longdoApiKey: read("LONGDO_API_KEY"),
    auth0Domain: read("AUTH0_DOMAIN").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    auth0ClientId: read("AUTH0_CLIENT_ID"),
    auth0ClientSecret: read("AUTH0_CLIENT_SECRET"),
    authDevOtp: read("AUTH_DEV_OTP") === "true",
    nodeEnv: read("NODE_ENV") || "development",
    isProd: (read("NODE_ENV") || "development") === "production",
  };
}

export function requireJwtSecret(): string {
  const secret = serverEnv().jwtSecret;
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return secret;
}
