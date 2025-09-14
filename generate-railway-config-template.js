// Template for generating Railway config - will be completed when user provides domain

const generateRailwayConfig = (domain) => {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const VITE_STRIPE_PUBLIC_KEY = process.env.VITE_STRIPE_PUBLIC_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const config = `# 🚀 RAILWAY ENVIRONMENT VARIABLES - SECURE INTEGRATION
# Generated: ${new Date().toISOString()}
# Source: Replit Secrets (Secure)

# Copy each line below as a separate variable in Railway Variables tab:

NODE_ENV=production
PORT=5000
HOST=0.0.0.0
FORCE_HTTPS=true
SESSION_SECRET=a1e6d64dadc3e52cf7903e965bfc53cf2392cbcfae0c99d9d7bcaa83e4d9d3c8
CSRF_SECRET=74f23ad8eeb4579c3375b1ba097605b30c614d7c6a442aa69223a413fb0065a2
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
DOMAIN=${domain}
CORS_ORIGINS=https://${domain},https://www.${domain}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
VITE_STRIPE_PUBLIC_KEY=${VITE_STRIPE_PUBLIC_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}`;

  return config;
};

module.exports = { generateRailwayConfig };