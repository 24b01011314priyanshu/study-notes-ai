# study-notes-ai
# Study Notes + AI (Quiz Generator)

This repository contains a static frontend (public/) and a serverless function (api/generate.js) to generate quizzes and resources using an LLM provider (Groq or OpenAI).

## Local dev
- For UI-only testing use `mock: true` in frontend fetch.
- To use Groq, set `GROQ_API_KEY` in Vercel env.

## Deploy
- Deploy to Vercel (recommended). Add `GROQ_API_KEY` (or `OPENAI_KEY`) in Environment Variables.
