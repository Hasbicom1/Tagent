# Current App Analysis

## Railway Services Currently Running:
- [ ] Main web app: onedollaragent-main (expected)
- [ ] Ollama container: ollama-ai (if exists)
- [ ] Database: PostgreSQL (Railway-managed)

## AI Services We're Paying For:
- [ ] OpenAI - Cost: $0/month (keys optional; fallback only)
- [ ] DeepSeek - Cost: $0/month (keys optional; fallback only)
- [ ] Other: Groq (free tier; optional)

## Files Using AI Services:
- LocalAI adapter: `services/FreeAIService.js`
- Message handler (uses LocalAI): `server/production.js` POST `/api/session/:sessionId/message`
- Legacy/fallback references: Ollama client init in `server/production.js`

## API Endpoints That Need Updating:
- POST `/api/session/:sessionId/message` (updated to LocalAI)
- Others: none required for base chat

## Current Monthly Cost: ~$20-30 (if Ollama service is running)
## After Migration Cost: $0 (AI) + Railway hosting only (LocalAI container + app)
