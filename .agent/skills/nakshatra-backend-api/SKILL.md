---
name: nakshatra-backend-api
description: Enterprise-grade AI backend architecture, context engineering, token optimization, multi-step reasoning, bilingual language adaptation, and Cloudflare Workers proxy rules for Nakshatra AI. Use whenever building or optimizing backend APIs, system prompts, memory pipelines, STT/TTS routing, or search tools.
---

# Nakshatra AI — Enterprise AI Systems & Backend Architecture Skill

You are a Principal AI Systems Architect (modeling the engineering standards of Google DeepMind, Anthropic, and OpenAI). Build the **Nakshatra AI** backend on **Cloudflare Workers** so that it behaves intelligently, minimizes token latency and cost, adapts seamlessly to human languages, and maintains rock-solid production reliability.

---

## 1. Enterprise Context Engineering & Token Optimization
Large-scale AI systems stay fast and affordable by managing context windows surgically rather than dumping raw text into prompts:

- **Sliding-Window + Rolling Summary Memory:**
  - Never send the entire raw chat history on every turn.
  - Keep only the **last 4 to 6 exact message turns** (`user` + `assistant`) in active context for immediate conversational continuity.
  - Compress older conversation turns into a compact, structured `session_summary` (under 150 tokens) stored in metadata/Firestore and injected into the system prompt only when relevant.
- **Prompt Caching Architecture (Prefix Stability):**
  - Structure every LLM payload so static instructions (**System Prompt + Tool Definitions**) sit at the very top of the `messages` array, and dynamic data (**Date/Time, Search Snippets, User Query**) sit at the bottom.
  - This maximizes provider-level KV/Prefix caching, cutting Time-To-First-Token (TTFT) and input token costs by 50–80%.
- **Search & RAG Context Compression:**
  - When querying **Serper Web Search API**, strip HTML tags, boilerplate navigation text, and duplicate URLs.
  - Pass only the **top 3–4 high-signal snippets** (capped at ~120 words total) with source titles/URLs, formatted in compact XML tags (`<search_context>...</search_context>`).
- **XML-Delimited Prompt Sections:**
  - Follow Anthropic/Claude prompt structuring standards: separate system rules, retrieved search data, user memory, and user input using explicit XML tags (`<instructions>`, `<context>`, `<user_query>`) so the model never confuses retrieved data with system commands (preventing prompt injection).

---

## 2. Smart AI Behavior & Intent Routing (Tiered Intelligence)
Instead of treating every query the same, implement a lightweight **Intent & Complexity Router** before calling heavy models:

- **Fast-Path vs. Deep-Reasoning Routing:**
  - **Simple/Conversational Queries** (greetings, quick facts, casual chat): Route directly to fast, low-latency inference without unnecessary tool calls.
  - **Real-Time / Freshness Queries** (news, live scores, current prices, weather, 2026 events): Automatically trigger **Serper Web Search** first, inject grounded results, and instruct the model to cite facts cleanly without hallucinating.
  - **Complex Logic / Coding / Problem Solving:** Instruct the model to silently decompose the problem step-by-step before outputting a crisp, well-structured Markdown answer (no rambling filler).
- **Self-Correction & Graceful Fallback:**
  - If a primary model or upstream API times out (`AbortController` > 12s) or returns HTTP `429`/`5xx`, automatically fail over to a secondary backup model/provider without exposing raw stack traces to the user.

---

## 3. Natural Language & Bilingual Adaptation (Telugu + English)
Make **Nakshatra AI** sound like an intelligent, modern companion—never a stiff 1990s textbook translator:

- **Dynamic Mirroring (Language & Tone Matching):**
  - Automatically detect the user's input script and style:
    - **English input** → Crisp, modern, natural English.
    - **Telugu script (`తెలుగు`)** → Natural, conversational spoken Telugu (avoid archaic/bookish Grandhika vocabulary).
    - **Tenglish (Telugu written in English script, e.g., *"ela unnav"*, *"code fix cheyi"*)** → Respond in smooth, natural Tenglish or mixed Telugu-English matching the user's exact vibe and energy.
- **Zero-Stutter TTS Normalization (Voice Pipeline Optimization):**
  - When generating text intended for **Sarvam AI** (`bulbul:v3` / `bulbul:v4-flash`, speakers like `Kavya`, `Ishita`, `Neha`) or **ElevenLabs TTS**, run a lightweight text-normalizer on the backend:
    - Strip raw Markdown symbols (`**`, `###`, `` ` ``, bullet asterisks) and URLs from the TTS payload so the voice engine does not read punctuation aloud or stutter.
    - Expand common symbols (`%`, `&`, `₹`, numbers) into natural spoken words.

---

## 4. Production Cloudflare Workers & API Security Architecture
- **Edge Proxy & Secret Isolation:**
  - All external APIs (**Groq**, **Sarvam AI**, **ElevenLabs**, **Serper**, **Firebase**) must be proxied exclusively through **Cloudflare Workers** using `env.<SECRET_NAME>`. Never expose keys in client code or logs.
- **True End-to-End Streaming (SSE):**
  - Use `TransformStream` / `ReadableStream` to pipe LLM tokens directly from Groq/upstream providers to the client in real time (`Content-Type: text/event-stream`), ensuring instant word-by-word rendering on the pitch-black chat UI.
- **Audio / STT Binary Integrity:**
  - Handle multipart `FormData` audio uploads (`audio/webm;codecs=opus`, `audio/wav`, `audio/mp4`) cleanly by preserving exact binary `Blob` headers and filenames when forwarding to **Groq Whisper (`whisper-large-v3`)** or **Sarvam STT**, preventing `HTTP 400` codec rejection errors.
- **Multi-Layer Rate Limiting & Validation:**
  - Enforce per-IP/per-user sliding-window rate limits using Cloudflare KV or in-memory edge counters before invoking paid APIs.
  - Validate payload schemas (max prompt length, valid audio MIME types, strict origin CORS whitelist) and return standardized JSON error envelopes (`{ "success": false, "error": { "code": "...", "message": "..." } }`).
- **Non-Blocking Telemetry & History (`ctx.waitUntil`):**
  - Offload chat history persistence (Firebase Firestore) and token usage logging to `ctx.waitUntil()` so database writes execute asynchronously after the response stream begins—adding **0ms** to user-perceived latency.

---

## 5. Strict Engineering Prohibitions
- **Never** dump unbounded chat histories or raw HTML search pages into the LLM prompt.
- **Never** allow robotic, repetitive filler openings (*"Certainly! Here is the information you requested..."*) in system prompts—start directly with high-value answers.
- **Never** send uncleaned Markdown syntax (`**`, `#`, code blocks) directly into Text-to-Speech APIs.
- **Never** block the response stream waiting for database writes or analytics.
