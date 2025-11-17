# Memora - System Design Diagrams

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Authentication Flow](#authentication-flow)
4. [Document Ingestion Pipeline](#document-ingestion-pipeline)
5. [Search & Retrieval System](#search--retrieval-system)
6. [Chat System](#chat-system)
7. [Voice Conversation System](#voice-conversation-system)
8. [Security & Encryption](#security--encryption)
9. [API Routes](#api-routes)
10. [Data Flow](#data-flow)

---

## Architecture Overview

### High-Level System Architecture

This diagram shows a high-level view of how your Second Brain / Memora system works end-to-end: the user uploads data through the frontend, which sends it to the backend ingestion API. The ingestion service places each upload into a queue, where different modality-specific workers (audio, documents, images, web pages, text) process the content into clean extracted text. That text then goes through a chunking + embedding pipeline, creating both searchable metadata and vector embeddings. Everything is stored in PostgreSQL + pgvector, allowing hybrid search using metadata filters, full-text search, and vector similarity. When the user asks a question, the query is analyzed for time-ranges or filters, embeddings are generated, and the system retrieves the most relevant chunks. Finally, an LLM synthesizes the retrieved context into a grounded answer that’s returned to the user.

<p align="center"> <img src="Diagrams/High-Level System Architecture.svg" width="650px" /> </p>

## Database Schema

### Entity Relationship Diagram

The diagram represents the complete query-processing flow of the Memora system, showing how a user’s question is transformed into an accurate, grounded answer. When the user submits a query through the frontend, it is sent to the backend Query API, which first runs a Query Analyzer to detect time ranges, source filters, and other contextual signals. The system then embeds the query into a vector and performs hybrid retrieval by combining three methods: metadata/time-based filtering from PostgreSQL, vector similarity search via pgvector, and full-text keyword search. These retrieved results are merged, ranked, and passed to the LLM along with the query so the model can synthesize a precise, context-aware answer grounded strictly in the user’s stored data. The final response is returned to the frontend, giving the user reliable information sourced directly from their personal knowledge base.

<p align="center"> <img src="Diagrams/ER Diagram.svg" width="650px" /> </p>

### Database Design Decisions

**Encryption Strategy:**
- All user content encrypted at rest (documents, chunks, messages)
- Per-user encryption keys derived from master key + user ID
- Even database admin cannot decrypt user data

**Cascading Deletes:**
- Delete user → cascades to documents, sessions
- Delete document → cascades to chunks
- Delete chunk → cascades to embeddings
- Delete session → cascades to messages

**Indexing:**
- Primary keys: UUID v4 (random)
- Foreign keys indexed automatically
- user_id indexed for fast user queries
- created_at useful for temporal queries



## Authentication Flow

### Google OAuth with JWT Sessions
This diagram shows the complete flow of how a user securely logs into the system. The process begins when the user enters their credentials on the frontend, which sends a login request to the backend authentication service. The backend verifies the email and password against the database, and if valid, generates a signed JWT access token along with a refresh token. These tokens are returned to the frontend, where the access token is stored securely (typically in memory) and used for authenticated API calls. When the access token expires, the frontend automatically sends the refresh token to the backend to request a new access token without requiring the user to log in again. The backend validates the refresh token, issues a new access/refresh pair, and returns them to the frontend, ensuring continuous secure access. If any token is invalid or expired, the user is logged out and must authenticate again.

<p align="center"> <img src="Diagrams/Authentication Sequence Diagram.svg" width="650px" /> </p>


### Session Management

**Strategy:** JWT (JSON Web Tokens)
- **Storage:** HTTP-only cookie
- **Expiration:** 30 days (configurable)
- **Contents:** User ID, email, name, image
- **Security:** Signed with NEXTAUTH_SECRET

**Benefits:**
- Stateless (no DB queries per request)
- Fast session validation
- Auto user creation on sign-in



## Document Ingestion Pipeline

### Multi-Modal Ingestion Flow
The image ingestion pipeline begins when a user uploads an image through the frontend, which sends the file to the backend ingestion API. The backend stores the raw image securely and creates an ingestion job that is pushed into a background processing queue. A specialized Image Processing Worker picks up this job and uses a Vision AI model to extract text (OCR), identify objects, read labels, and generate contextual metadata about the image. This ensures that even non-textual content becomes searchable and semantically meaningful.

After extraction, the system processes the text into chunks and generates vector embeddings so the content can participate in hybrid search. The original image, extracted text, metadata, and embeddings are all stored in the database, allowing the system to update the ingestion status and make the processed content available for retrieval. When the user later searches for related information, their query can match the semantic meaning of image contents, enabling rich, natural-language search across visual data.
<p align="center"> <img src="Diagrams/Multi Modal Ingestion Flow Diagram.svg" width="650px" /> </p>

### Supported File Formats (50+)

| Category | Formats | Extraction Method |
|----------|---------|-------------------|
| **Documents** | PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, CSV, RTF, TXT, MD | pdf2json, mammoth, xlsx, pptx-parser |
| **OpenOffice** | ODT, ODS, ODP | Gemini 2.5 Pro |
| **Images** | JPG, PNG, WEBP, GIF, BMP, TIFF, SVG, HEIC | Gemini 2.5 Pro Vision |
| **Audio** | MP3, M4A, WAV, AAC, FLAC, OGG, WMA | Gemini 2.5 Pro Audio |
| **Code/Data** | JS, TS, PY, JSON, XML, HTML, YAML, SQL, and 20+ more | Direct text read |
| **Web** | Any HTTP/HTTPS URL | Cheerio HTML parser |

---

## Search & Retrieval System

### Hybrid Search Architecture
The document ingestion pipeline starts when the user uploads a file such as a PDF, DOCX, MD, or TXT through the frontend. The backend ingestion API receives the file, stores the raw version, and creates an ingestion job in the processing queue. A Document Processing Worker picks up this job and extracts text, metadata (title, author, page count), and structural elements using format-specific parsers. This ensures that all document types are converted into clean, machine-readable text while preserving meaningful context like headings and sections.

After extraction, the system splits the text into semantic chunks and generates vector embeddings so the content becomes searchable through hybrid retrieval. The original document, extracted text, metadata, and embeddings are stored in the database, and the job status is updated. Once complete, the user’s documents become fully searchable via natural-language queries—allowing the system to retrieve relevant document sections using metadata filters, keyword search, and vector similarity.

<p align="center"> <img src="Diagrams/Hybrid Search Architecture.svg" width="650px" /> </p>

### Vector Similarity Calculation

**Cosine Similarity Formula:**
```
similarity(A, B) = (A · B) / (||A|| × ||B||)

Where:
- A = Query embedding vector [1536 dimensions]
- B = Document chunk embedding vector [1536 dimensions]
- A · B = Dot product
- ||A|| = Magnitude of A
- ||B|| = Magnitude of B
```

**Scoring:**
- Similarity range: 0.0 to 1.0
- Typical good match: > 0.7
- Recency boost: Up to +0.1 for recent documents
- Final score = base_similarity + recency_boost

### Temporal Query Patterns

| Pattern | Example | Date Range |
|---------|---------|------------|
| today | "documents from today" | Start of day → now |
| yesterday | "what I did yesterday" | Yesterday start → yesterday end |
| last N days | "last 5 days" | N days ago → now |
| last week | "files from last week" | 7 days ago → now |
| this week | "this week's work" | Start of week → end of week |
| last month | "last month's reports" | 30 days ago → now |
| this month | "this month" | Start of month → end of month |

**Content Date Matching:**
- Extracts dates from document content using regex patterns
- Supports: DD/MM/YYYY, YYYY-MM-DD, "January 5, 2025", etc.
- Stores in `metadata_json.contentDates[]`
- Matches if EITHER creation date OR content dates fall in range

---

## Chat System

### Chat Session Architecture
The Chat Session Architecture describes how a user interacts with the system through a continuous conversational flow. When the user sends a message—text, image, URL, audio, or document—the frontend forwards it to the backend Chat API, which first stores the message and its metadata in the database as part of an ongoing chat session. The system then enriches the message by generating embeddings, detecting intent, and identifying whether retrieval is needed. If required, the Query/Retrieval engine fetches relevant documents, chunks, or previous context from the user’s knowledge base, combining vector search, metadata filters, and full-text search. This context is packaged with the user’s message and passed to the LLM, which generates a grounded, personalized response. The response is then saved to the chat history and returned to the frontend, allowing the conversation to remain stateful, context-aware, and seamlessly tied to the user’s stored data.

<p align="center"> <img src="Diagrams/Chat Session Architecture.svg" width="300px"/> </p>


### Message Flow with Encryption
The Message Sequence Diagram illustrates how communication flows between the user, the frontend, the backend API, and the database during a chat interaction. When the user sends a message, the frontend immediately displays it and forwards the content to the backend, which stores the message, generates any necessary embeddings, and links it to the correct chat session. The backend then determines whether retrieval is needed and, if so, fetches relevant context from the database before passing everything to the LLM to generate a coherent, grounded response. Once the response is produced, the backend saves it, sends it back to the frontend, and the updated conversation state is displayed to the user. This sequence ensures the chat remains consistent, searchable, and context-aware across the entire session.

<p align="center"> <img src="Diagrams/Message Sequence Diagram.svg" width="650px"/> </p>

---

## Voice Conversation System

### Voice Mode Flow
The Voice Mode Flow Diagram shows how the system handles real-time voice interactions from start to finish. When the user speaks, the frontend captures audio and streams it to the backend, which processes the audio through a speech-to-text model to generate a transcript. The transcript is then analyzed for intent and, if needed, passed through the retrieval engine to fetch relevant context from the user’s stored data. This combined information is sent to the LLM to generate a response, which is then converted back into audio through text-to-speech. The backend streams this synthesized audio back to the frontend, which plays it to the user instantly, creating a smooth, natural, conversational voice experience.

<p align="center"> <img src="Diagrams/Voice Mode Flow Diagram.svg" width= "650"/> </p>

### Voice Conversation Sequence
The Voice Conversation Sequence Diagram shows how a full voice-based interaction flows through the system. When the user begins speaking, the frontend continuously streams the audio to the backend, where it is transcribed into text using speech-to-text processing. The backend stores the transcript, analyzes the message for intent, and performs retrieval if the query requires additional context from the user’s knowledge base. The combined context and transcript are then sent to the LLM, which generates a grounded response. This response is converted back into audio using text-to-speech and streamed to the frontend, where it is played for the user. Throughout the process, both the user’s voice input and the system’s responses are saved to maintain a complete, searchable conversation history.

<p align="center"> <img src="Diagrams/Voice Conversation Sequence Diagram.svg" width="650px"/> </p>

---

## Security & Encryption

### Encryption Architecture
The Encryption Architecture diagram explains how the system keeps all user data fully secure at every stage of ingestion, storage, and retrieval. When a user uploads any content—documents, audio, text, images, or URLs—the data first passes through an encryption layer where it is encrypted using a user-specific encryption key derived from their credentials. The raw files, text extracts, and embeddings are all encrypted before being saved to the database, ensuring that even the storage layer never sees plain text. During retrieval or querying, encrypted data is securely decrypted in-memory only for the authenticated user who owns it, and never written back in plain form. The system also encrypts chat messages, metadata, and session information, while access to keys is tightly controlled through a secure key-management service. This end-to-end encryption workflow guarantees that only the user—and the application acting on their behalf—can read their data, providing strong privacy and zero-knowledge security across the entire system.

<p align="center"> <img src="Diagrams/Encryption Architecture.svg" width="650px"/> </p>

### Security Features

**Data at Rest:**
- ✅ All documents encrypted (AES-256-GCM)
- ✅ All chunks encrypted
- ✅ All chat messages encrypted
- ✅ Per-user encryption keys
- ✅ Database admin cannot decrypt

**Data in Transit:**
- ✅ HTTPS only
- ✅ Encrypted JWT cookies
- ✅ No sensitive data in URLs

**User Isolation:**
- ✅ Foreign key constraints
- ✅ User ID validation on all queries
- ✅ Session validation
- ✅ Cannot access other users' data

**Authentication:**
- ✅ Google OAuth 2.0
- ✅ JWT with HTTP-only cookies
- ✅ CSRF protection (NextAuth)
- ✅ No password storage needed

---


### API Endpoints Detail

#### Authentication APIs
- **GET/POST `/api/auth/[...nextauth]`** - NextAuth handlers
- **GET `/api/auth/session`** - Get current session
- **GET `/api/auth/csrf`** - CSRF token

#### Ingestion APIs
- **POST `/api/ingest/text`**
  - Body: `{content: string, title?: string}`
  - Returns: `{documentId, success}`
  
- **POST `/api/ingest/document`**
  - Body: `FormData {file: File, title?: string}`
  - Returns: `{documentId, metadata}`
  
- **POST `/api/ingest/web`**
  - Body: `{url: string}`
  - Returns: `{documentId, metadata}`

#### Search & Chat APIs
- **POST `/api/search`**
  - Body: `{query: string, limit?: number}`
  - Returns: `{results[], context, totalResults}`
  
- **POST `/api/chat`**
  - Body: `{query: string, history?: Array<{role, content}>}`
  - Returns: Server-Sent Events stream
  - Format: `data: {content}\n\n`

#### Session APIs
- **GET `/api/sessions`** - Load all user sessions with messages
- **POST `/api/sessions`** - Create new session
- **DELETE `/api/sessions/[id]`** - Delete session (cascades to messages)
- **PATCH `/api/sessions/[id]/title`** - Update session title
- **POST `/api/sessions/[id]/messages`** - Save message
- **POST `/api/sessions/generate-title`** - AI-generate title from first message

#### Voice APIs
- **POST `/api/voice/transcribe`**
  - Body: `FormData {audio: Blob}`
  - Returns: `{text: string}`
  
- **POST `/api/voice/speak`**
  - Body: `{text: string}`
  - Returns: `audio/mpeg` (MP3 file)

---

## Data Flow

### Complete Data Flow Diagram

The Data Flow Diagram shows how information moves through your entire Second Brain system from ingestion to retrieval. When the user provides input—whether it's a document, text, image, audio, or a web link—the frontend sends it to the backend ingestion service, which extracts text, metadata, and content. This processed data is then chunked, embedded into vectors, and stored in the database along with the encrypted raw file. When the user later asks a question, the query goes through the retrieval service, which performs hybrid search by combining metadata filtering, full-text search, and vector similarity to find the most relevant chunks. These retrieved pieces of information are then passed to the LLM, which generates a contextual, grounded answer and returns it to the frontend. Throughout this pipeline, the data remains encrypted, organized, and easily searchable, ensuring fast and secure access to the user’s stored knowledge.



<p align="center"> <img src="Diagrams/Data Flow Diagram.svg" width="650px"/> </p>



---

## Performance Considerations

### Optimization Strategies

**Chunking:**
- Chunk size: 1000 characters
- Overlap: 200 characters
- Preserves context across boundaries

**Embedding Generation:**
- Batch processing (all chunks at once)
- Reduces API calls
- ~50 chunks in one request

**Search:**
- In-memory cosine similarity (fast)
- Filters applied before calculation
- Top K limits result set

**Caching:**
- JWT sessions (no DB queries)
- OpenAI embeddings stored permanently
- No re-embedding needed

**Async Processing:**
- Embeddings generated async (non-blocking)
- User gets immediate upload confirmation
- Background job processes embeddings

---

### Environment Variables Required

```bash
# Database
DATABASE_URL="postgresql://..."

# Authentication
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# Encryption
ENCRYPTION_KEY="af070d044ca02373ec6e5627cd00906afc1e6f9adcbae9de6451e59af3c1b091"

# AI Services
OPENAI_API_KEY="sk-..."
GOOGLE_GEMINI_API_KEY="..."
```

---

## Scalability & Limitations

### Current Limitations

**File Size:**
- No limit (user configurable)
- Large files may timeout on Vercel (10s limit)
- Consider background jobs for >100MB files

**Embedding Storage:**
- Currently JSON strings (not optimal)
- Future: Migrate to pgvector native type
- Would enable database-level vector search

**Voice Mode:**
- 10 second max recording per turn
- Browser autoplay policies may vary
- Requires HTTPS in production

### Future Enhancements

**Vector Database:**
- Use pgvector native types
- Enable SQL-level similarity search
- Faster queries with indexes

**Background Jobs:**
- Queue system for large files
- Parallel chunk processing
- Progress tracking

**Advanced Features:**
- Projects/folders for organization
- Collaborative sharing
- Mobile app (React Native)
- Browser extension


## Conclusion

Memora is a comprehensive Second Brain application with:
- ✅ **50+ file type support**
- ✅ **End-to-end encryption**
- ✅ **Hybrid semantic search**
- ✅ **Temporal querying**
- ✅ **AI-powered chat**
- ✅ **Voice conversation mode**
- ✅ **Full session management**
- ✅ **Production-ready architecture**

**Built with:** Next.js 16, PostgreSQL, OpenAI, Google Gemini, Drizzle ORM, NextAuth


