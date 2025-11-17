# Memora — Second Brain AI Companion

Memora is a privacy-first, multimodal personal AI companion that ingests audio, documents, web content, images, and text; stores encrypted content; indexes semantic embeddings; and provides hybrid retrieval and temporal reasoning via an LLM-powered Q&A interface.

This README summarizes architecture, ingestion, retrieval, storage schema, temporal querying, scalability, privacy decisions, and developer setup. It is based on the project's implementation plan in `plan.md`.

## Quickstart (development)

Install and run the development server:

```powershell
npm install
npm run dev
```

## 🔗 Live Demo

**Production Deployment:**  
👉https://memora-second-mind.onrender.com/ 


## High-level Architecture

- Frontend: Next.js (App Router) UI + React components
- API: Next.js API routes for ingestion, status, query, chat
- Storage: Neon/Postgres (via Supabase or direct) for metadata and encrypted blobs
- Vector DB: `pgvector` (pg extension) or a managed service (Pinecone/Qdrant)
- AI: OpenAI (embeddings + chat) and Google Gemini (optional for transcription/vision)
- Background processing: queue-based workers (BullMQ/Redis) for chunking, embedding and indexing

Core flow: Upload → Encrypt → Store → Extract Text → Chunk → Embed → Index → Query

### Then entire System Design is Explaint in System Design Document([text](SystemDesign.md)) and Also Diagram([text](System_Desgin_Diagram.md))

## Scalability

- Use async workers to offload heavy processing (transcription, chunking, embedding).
- Use Neon or managed Postgres for scalable DB; pgvector for vector search or switch to Qdrant/Pinecone if necessary.
- Batch embedding requests to reduce API calls.

## API Endpoints (overview)

- `POST /api/ingest` — upload file or submit URL. Params: `file`, `user_id`, `title`, `tags`.
- `GET /api/ingest/status/:id` — check processing status.
- `POST /api/query` — semantic query. Body: `user_id`, `query`, `filters`.
- `POST /api/chat` — chat endpoint that runs hybrid retrieval + LLM.

## Environment Variables

Example `.env` entries:

```
DATABASE_URL=postgres://...
VECTOR_DB_URL=pgvector://... (if needed)
OPENAI_API_KEY=sk-...
GOOGLE_GEMINI_API_KEY=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
ENCRYPTION_KEY=...(master key, keep secret)
```

## Project Structure (high-level)

- `app/` — Next.js routes and UI
- `app/api/ingest` — ingestion API routes
- `app/api/chat` — chat/query endpoints
- `lib/ingestion` — processors and handlers
- `lib/chunking` — chunking logic
- `lib/embeddings` — OpenAI embedding client
- `lib/retrieval` — search, temporal parsing, reranking
- `lib/db` — Drizzle schema and migrations
- `lib/encryption` — crypto utilities

## Diagrams

All system diagrams are explain [Here](System_Desgin_Diagram.md)



