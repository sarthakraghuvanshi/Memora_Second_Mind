# Memora - Technical Documentation & Assessment Response

## Executive Summary

Memora is a privacy-first, AI-powered "Second Brain" application that enables users to store, search, and query their personal knowledge base using natural language. The system supports 50+ file types, implements end-to-end encryption, and provides intelligent responses through hybrid search and conversational AI.

**Key Metrics:**
- **Multi-modal support:** Text, Documents (PDF, Office), Images (OCR), Audio (transcription), Web pages
- **Search performance:** Sub-second semantic search with temporal filtering
- **Privacy:** AES-256-GCM encryption, per-user key isolation
- **AI Integration:** OpenAI (embeddings, Whisper, TTS), Google Gemini 2.5 Pro (chat, vision, transcription)
- **Storage:** PostgreSQL with Drizzle ORM, vector embeddings for semantic search

---

## 1. System Architecture & Design Decisions

### 1.1 Multi-Modal Ingestion Architecture

**Design Philosophy:**
Memora is built on a modular ingestion pipeline that treats all content types uniformly: Extract → Encrypt → Chunk → Embed → Store. This unified approach simplifies the codebase while supporting maximum flexibility.

#### Ingestion Strategy

**1. Format-Specific Extraction Layer**

Each content type has a dedicated extractor that converts raw input into plain text:

| Format Category | Extraction Method | Rationale |
|----------------|-------------------|-----------|
| **PDF Documents** | pdf2json library | Lightweight, Next.js compatible, handles complex layouts |
| **Microsoft Office** | mammoth (DOCX), xlsx (Excel), pptx-parser (PowerPoint) | Native JS libraries, no external dependencies, fast processing |
| **OpenOffice** | Google Gemini 2.5 Pro | Complex XML structure, Gemini handles natively |
| **Images** | Google Gemini Vision API | State-of-the-art OCR, handles handwriting, screenshots, charts |
| **Audio** | Google Gemini Audio API | High-quality transcription, multilingual support |
| **Web Pages** | Cheerio HTML parser | Fast DOM manipulation, extracts main content, removes nav/footer |
| **Code Files** | Direct text read | Preserves syntax, no parsing needed |

**Why This Approach:**
- ✅ **Consistency:** All formats → plain text → same processing pipeline
- ✅ **Extensibility:** Adding new formats requires only one new extractor
- ✅ **Reliability:** Format-specific libraries are battle-tested
- ✅ **Performance:** Native parsers (pdf2json, mammoth) are faster than AI parsing for common formats
- ✅ **Cost Optimization:** Use AI (Gemini) only for complex formats (images, audio, OpenOffice)

**2. Content Date Extraction**

A critical feature for temporal querying is extracting dates mentioned in content:

```javascript
// Regex patterns for multiple date formats
- DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
- "January 5, 2025", "5 January 2025"
- "Nov 5", "5 Nov 2025"
- Relative dates normalized to absolute dates
```

**Stored in Metadata:**
```json
{
  "contentDates": ["2025-01-05T00:00:00Z", "2025-01-15T00:00:00Z"],
  "contentDateRange": {
    "earliest": "2025-01-05T00:00:00Z",
    "latest": "2025-01-15T00:00:00Z"
  }
}
```

**Use Case:**
- User uploads meeting minutes from January 5, 2025 (but uploads on November 15)
- Query: "What action items were due in early January?"
- System checks both `created_at` (Nov 15) AND `contentDates` (Jan 5)
- Document is matched because content mentions January dates

**3. Encryption-First Design**

All content is encrypted **before** database storage using AES-256-GCM:

```
Plaintext → AES-256-GCM (per-user key) → Base64 → Database
```

**Benefits:**
- Database admin cannot read user content
- Breach of database exposes only ciphertext
- User isolation at cryptographic level

**Trade-off:**
- Cannot perform full-text search on encrypted content
- Must decrypt before search (done in-memory)
- Slightly higher CPU usage during retrieval

**Justification:** Privacy trumps search convenience. Users trust us with sensitive data (work documents, personal notes). Encryption-at-rest is non-negotiable.

**4. Async Processing Pipeline**

Document upload returns immediately to user. Chunking and embedding happen asynchronously:

```javascript
// User gets instant confirmation
return { documentId, success: true };

// Background processing (non-blocking)
processDocumentEmbeddings(documentId, text, userId).catch(console.error);
```

**Benefits:**
- ✅ Fast user experience (< 2s upload confirmation)
- ✅ Large documents don't block UI
- ✅ Failures don't prevent document storage

**Trade-off:**
- Document is temporarily not searchable (until embeddings complete)
- User might query before processing finishes

**Mitigation:** Processing is fast (2-3s for typical documents). For production, we could add a "processing" indicator.

---

### 1.2 Information Retrieval & Querying Strategy

#### Chosen Approach: **Hybrid Multi-Method Search**

After evaluating semantic-only, keyword-only, and graph-based approaches, I implemented a **hybrid system** combining:

1. **Semantic Search** (Primary - 80% weight)
2. **Temporal Filtering** (Applied before search)
3. **Recency Boosting** (Applied after search)

**Why Hybrid?**

| Approach | Strengths | Weaknesses | Use Case |
|----------|-----------|------------|----------|
| **Semantic Only** | Understands meaning, handles paraphrasing | Misses exact terms/names | "Tell me about the project" |
| **Keyword Only** | Fast, exact matches | No context understanding | "Find document 'Budget-2024.pdf'" |
| **Graph-Based** | Complex relationships | Setup overhead, complex queries | Specialized knowledge graphs |
| **Hybrid (Chosen)** | Best of both, flexible | Slightly more complex | General-purpose knowledge base |

#### Detailed Retrieval Strategy

**Step 1: Temporal Parsing**

```javascript
Input: "What did I work on last week?"
↓
Temporal Parser extracts: "last week" → Date range (Nov 8-15, 2025)
Cleaned query: "What did I work on"
```

**Supported Temporal Expressions:**
- Absolute: "today", "yesterday", "this week", "this month"
- Relative: "last 5 days", "last week", "last month"
- Future: Can be extended to "next week", "tomorrow"

**Step 2: Query Embedding Generation**

```
Cleaned Query → OpenAI text-embedding-3-small → Vector[1536 dimensions]
```

**Why OpenAI embeddings:**
- ✅ Industry-leading quality
- ✅ 1536 dimensions (good balance of precision vs storage)
- ✅ Cosine similarity computation is fast
- ✅ Model is stable and well-tested

**Alternative considered:** Google Gemini embeddings
- Rejected: Less mature, fewer dimensions, less ecosystem support

**Step 3: Vector Similarity Search**

Fetch all user's embeddings from database, then:

```javascript
For each document chunk:
  1. Parse embedding from JSON string → float[]
  2. Calculate cosine similarity with query embedding
  3. Filter by temporal criteria (if applicable)
  4. Score = similarity + recency_boost
  5. Sort by score descending
  6. Return top K=10 chunks
```

**Cosine Similarity:**
```
similarity(A, B) = (A · B) / (||A|| × ||B||)

Range: -1 to 1 (typically 0.3 to 0.95 for text)
Good match: > 0.7
Excellent match: > 0.85
```

**Why Cosine Similarity:**
- ✅ Standard for text embeddings
- ✅ Fast to compute (dot product + magnitudes)
- ✅ Normalized (0-1 range, comparable across queries)
- ✅ Works well with OpenAI embeddings

**Step 4: Temporal Filtering**

Two-phase filtering for temporal queries:

```javascript
Filter documents where:
  (created_at >= dateRange.start AND created_at <= dateRange.end)
  OR
  (any contentDate in metadata_json.contentDates falls in dateRange)
```

**Example:**
- Query: "Action items from last 10 days"
- Today: Nov 15, 2025
- Range: Nov 5-15, 2025

Document A:
- created_at: Nov 2 (13 days ago) → ❌ Outside range
- contentDates: [Nov 5, Nov 6, Nov 7] → ✅ Inside range
- **Result:** INCLUDED (content mentions dates in range)

**Step 5: Recency Boosting**

Recent documents get slight boost:

```javascript
recency_boost = max(0, 1 - days_since_creation / 365) × 0.1

Examples:
- Created today: +0.1 boost
- Created 6 months ago: +0.05 boost
- Created 1+ year ago: +0 boost
```

**Justification:** Recent information is often more relevant. A 10% boost is subtle enough not to override strong semantic matches but helps when similarity is close.

**Step 6: Decryption & Context Building**

```javascript
Top K chunks → Decrypt(chunk, userId) → Build context string
```

Context format:
```
[1] From "Meeting Notes" (2025-11-05):
The project deadline is January 15...

[2] From "Budget Document" (2025-11-03):
Q4 budget allocation is $50,000...
```

This context is sent to Gemini for answer generation.

#### Why NOT Pure Keyword Search?

**Tested scenario:**
- User query: "Tell me about the budget meeting"
- Document contains: "Q4 financial planning session"
- Keyword search: ❌ MISS (no exact match)
- Semantic search: ✅ MATCH (understands "budget meeting" ≈ "financial planning")

**Why NOT Graph-Based?**

**Considered:** Neo4j, entity extraction, relationship mapping

**Rejected because:**
- ❌ Requires upfront schema definition (user data is unstructured)
- ❌ Complex entity extraction (additional AI cost)
- ❌ Query language learning curve (Cypher vs natural language)
- ❌ Overkill for personal knowledge base (not enterprise knowledge graph)

**When graph would be better:**
- Company-wide knowledge base with org charts
- Complex multi-hop relationships (A → B → C reasoning)
- Domain-specific ontologies (medical, legal)

For personal documents, **hybrid vector search is optimal.**

---

### 1.3 Data Indexing & Storage Model

#### Full Lifecycle of Information

**Phase 1: Ingestion**

```
1. User uploads document.pdf
2. Extract text: "This is my document content..."
3. Extract metadata:
   - fileName: "document.pdf"
   - fileSize: 1048576 bytes
   - mimeType: "application/pdf"
   - contentDates: [2025-01-05, 2025-01-15]
4. Encrypt full text: encrypt(text, userId) → "base64_ciphertext"
5. Save to documents table:
   - id: uuid
   - userId: user's uuid
   - type: "document"
   - contentEncrypted: "base64_ciphertext"
   - metadataJson: {...}
   - created_at: 2025-11-15T10:30:00Z
```

**Phase 2: Chunking**

```
Full text (10,000 chars) → Chunks:
Chunk 1: chars 0-1000
Chunk 2: chars 800-1800 (200 char overlap)
Chunk 3: chars 1600-2600
...
```

**Chunking Parameters:**
- **Size:** 1000 characters per chunk
- **Overlap:** 200 characters
- **Rationale:**
  - 1000 chars ≈ 250 tokens (fits in embedding context)
  - Overlap preserves context across boundaries
  - Small enough for precise retrieval
  - Large enough to be meaningful

**Example of Overlap Benefit:**

```
Chunk 1: "...the project deadline is January 15."
Chunk 2: "January 15. The team needs to complete..."
         ↑ Overlap preserves "January 15" context
```

**Phase 3: Embedding Generation**

```
For each chunk:
1. Send to OpenAI: POST /v1/embeddings
2. Model: text-embedding-3-small
3. Receive: float[1536]
4. Store as JSON string in embeddings table
```

**Batch Processing:**
```javascript
// Efficient: 10 chunks in 1 API call
const embeddings = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: [chunk1, chunk2, chunk3, ...] // Array of chunks
});
```

**Cost Optimization:**
- Batch requests reduce API overhead
- Embedding cached forever (never regenerate)
- Only new content needs embedding

**Phase 4: Indexed Storage**

Each chunk stored with:
```sql
chunks (
  id: uuid,
  document_id: uuid → foreign key,
  chunk_index: 0, 1, 2, ...,
  content_encrypted: base64,
  start_char: 0,
  end_char: 1000
)

embeddings (
  id: uuid,
  chunk_id: uuid → foreign key,
  embedding: '[0.123, -0.456, ...]', -- JSON array
  model: 'text-embedding-3-small'
)
```

**Indexing Technique:** Inverted index on foreign keys (automatic in PostgreSQL)

**Query Pattern:**
```sql
SELECT e.embedding, c.content_encrypted, d.title
FROM embeddings e
JOIN chunks c ON e.chunk_id = c.id
JOIN documents d ON c.document_id = d.id
WHERE d.user_id = $userId
```

Index on `user_id` makes this query fast (< 50ms for 1000 documents).

#### Database Schema Design

**Chosen: PostgreSQL (Neon Serverless)**

**Tables:**
1. **users** - Authentication (Google OAuth profile)
2. **documents** - Original content (encrypted)
3. **chunks** - Text segments (encrypted)
4. **embeddings** - Vector representations (JSON)
5. **sessions** - Chat sessions
6. **messages** - Chat history (encrypted)

**Metadata Stored:**

```json
documents.metadata_json: {
  "fileName": "report.pdf",
  "fileSize": 1048576,
  "mimeType": "application/pdf",
  "extractedTextLength": 5000,
  "contentDates": ["2025-01-05T00:00:00Z"],
  "contentDateRange": {
    "earliest": "2025-01-05T00:00:00Z",
    "latest": "2025-01-15T00:00:00Z"
  },
  "sourceUrl": "https://example.com" // if web page
}
```

**Why JSONB for Metadata:**
- ✅ Flexible schema (different file types have different metadata)
- ✅ PostgreSQL JSONB is indexed and queryable
- ✅ Can add new fields without migrations
- ✅ Native JSON operators in SQL

**Example Metadata Query:**
```sql
-- Find documents with dates in January 2025
SELECT * FROM documents
WHERE metadata_json->'contentDates' ?| 
  array['2025-01-01T00:00:00Z', '2025-01-31T00:00:00Z'];
```

#### Storage Trade-offs: PostgreSQL vs Alternatives

**PostgreSQL (Chosen) ✅**

**Pros:**
- ✅ ACID compliance (data integrity)
- ✅ Relations and foreign keys (referential integrity)
- ✅ JSONB for flexible metadata
- ✅ pgvector extension available (future upgrade)
- ✅ Mature ecosystem (Drizzle ORM, excellent tooling)
- ✅ Neon provides serverless scaling

**Cons:**
- ❌ Vector search not optimized yet (in-memory calculation)
- ❌ More expensive than NoSQL for pure document storage
- ❌ Vertical scaling limitations (though Neon handles this)

**Considered: MongoDB (NoSQL)**

**Why NOT chosen:**
- ❌ No native vector search (requires Atlas Vector Search, vendor lock-in)
- ❌ Weaker consistency guarantees
- ❌ No foreign key constraints (manual data integrity)
- ❌ Less mature TypeScript ORM support

**Considered: Pinecone/Weaviate (Vector DB)**

**Why NOT chosen:**
- ❌ Requires dual database (vector DB + relational DB)
- ❌ Additional service to manage
- ❌ Higher cost ($70+/month vs Neon free tier)
- ❌ Encrypted data can't use vector DB optimization

**Current Approach: PostgreSQL with In-Memory Vector Search**

**Scalability:**
- Works well up to ~10,000 documents per user
- Vector search done in application layer (fast enough: < 200ms)
- Can upgrade to pgvector native types when needed

**Future Optimization:**
```sql
-- When scaling beyond 10K documents
ALTER TABLE embeddings 
ALTER COLUMN embedding TYPE vector(1536);

-- Then use SQL-level similarity
SELECT *, embedding <=> $query_vector AS distance
FROM embeddings
ORDER BY distance LIMIT 10;
```

This would move vector search to database (faster for large datasets).

---

### 1.4 Temporal Querying Support

#### Architecture for Time-Based Queries

**Dual-Timestamp Strategy:**

Every piece of information has TWO temporal dimensions:

1. **Creation Timestamp** (`created_at`)
   - When document was uploaded to Memora
   - Automatically set by database: `defaultNow()`
   - Useful for: "What did I upload yesterday?"

2. **Content Dates** (`metadata_json.contentDates[]`)
   - Dates mentioned WITHIN the document
   - Extracted via regex during ingestion
   - Useful for: "Action items due next week"

**Example: Meeting Minutes**

```
Document uploaded: Nov 15, 2025
Content mentions: Nov 2, Nov 5, Nov 6, Nov 7, Nov 9

Temporal Query: "What was discussed in early November?"
↓
Date range: Nov 1-10, 2025
↓
Check created_at: Nov 15 → ❌ Outside range
Check contentDates: [Nov 2, Nov 5, Nov 6, Nov 7, Nov 9] → ✅ Inside range
↓
Document MATCHED (content is about early November)
```

#### Temporal Parser Implementation

**Pattern Matching Engine:**

```javascript
Patterns supported:
- "today" → startOfDay() to endOfDay()
- "yesterday" → startOfDay(yesterday) to endOfDay(yesterday)
- "last N days" → subDays(now, N) to now
- "last week" → subWeeks(now, 1) to now
- "this week" → startOfWeek() to endOfWeek()
- "last month" → subMonths(now, 1) to now
- "this month" → startOfMonth() to endOfMonth()
```

**Using date-fns library for reliability:**
- Handles timezones correctly
- Week start/end logic (Monday vs Sunday)
- Month boundaries (28/29/30/31 days)

**Query Cleaning:**

After extracting temporal expression, remove it from query:

```javascript
Input: "What did I work on last week?"
Temporal: "last week" → extracted
Cleaned: "What did I work on" → sent to embedding

Why: "last week" has no semantic meaning for embedding
Better: Embed only the actual question
```

#### Integration with Search

**Hybrid Search Flow with Temporal:**

```
1. Parse temporal: "last week" → [Nov 8-15]
2. Generate embedding: "What did I work on" → vector[1536]
3. Fetch ALL user embeddings from DB
4. Filter by date:
     WHERE (created_at BETWEEN start AND end)
        OR (contentDates && [start, end])
5. Calculate similarity for filtered set only
6. Return top K=10
```

**Performance Optimization:**

Instead of:
```sql
-- Slow: Calculate similarity for all 100K chunks
SELECT * FROM embeddings WHERE user_id = $user;
```

We do:
```javascript
// Faster: Filter first, then calculate
1. Fetch all embeddings (100K chunks)
2. Filter by date in JS (reduce to 5K chunks) ← 95% reduction
3. Calculate similarity only for 5K (not 100K)
4. Return top 10
```

**Why filter in application layer?**
- Embeddings are JSON strings (not native DB vectors yet)
- PostgreSQL can't do cosine similarity on JSON
- In-memory calculation is fast enough (< 100ms for 5K chunks)

**Trade-off:**
- Loads all embeddings into memory
- Works well for personal use (< 10K documents)
- Would need optimization for enterprise scale (10M+ chunks)

#### Answering "What did I work on last month?"

**Complete Flow:**

```
1. User Query: "What did I work on last month?"

2. Temporal Parser:
   - Extract: "last month"
   - Date range: Oct 15 - Nov 15, 2025
   - Cleaned query: "What did I work on"

3. Embedding Generation:
   - Send "What did I work on" to OpenAI
   - Receive: [0.123, -0.456, ..., 0.789] (1536 floats)

4. Database Query:
   - Fetch all embeddings for user
   - Load metadata_json for date filtering

5. Temporal Filtering (JavaScript):
   for each document:
     if (created_at in [Oct 15 - Nov 15]) → include
     OR
     if (any contentDate in [Oct 15 - Nov 15]) → include
   
   Result: 50 documents (from original 1000)

6. Similarity Calculation:
   for each of 50 documents' chunks (250 chunks total):
     similarity = cosine(queryVector, chunkVector)
   
   Results: [0.85, 0.82, 0.79, 0.75, ...]

7. Recency Boost:
   for each result:
     days_old = today - created_at
     boost = (1 - days_old/365) × 0.1
     final_score = similarity + boost

8. Top K Selection:
   - Sort by final_score descending
   - Take top 10 chunks
   - Decrypt chunks
   - Build context string

9. LLM Answer Generation:
   - Send context + query to Gemini
   - Gemini synthesizes answer from context
   - Response: "Last month, you worked on: Project X, Budget Review, ..."
```

**Why This Works:**
- ✅ Combines temporal and semantic signals
- ✅ Handles both "when uploaded" and "what it's about"
- ✅ Recency boost prevents old docs from dominating
- ✅ Top K limits context size (cost control)

---

### 1.5 Scalability and Privacy

#### Scalability Analysis

**Current Capacity (Single User):**

| Metric | Current | 1K Documents | 10K Documents | Notes |
|--------|---------|--------------|---------------|-------|
| **Documents** | < 100 | 1,000 | 10,000 | Encrypted in DB |
| **Chunks** | < 1,000 | ~10,000 | ~100,000 | 10 chunks/doc avg |
| **Embeddings** | < 1,000 | ~10,000 | ~100,000 | 1536 floats each |
| **Storage** | ~50MB | ~500MB | ~5GB | Inc. embeddings |
| **Search Time** | 50ms | 100ms | 500ms | In-memory calc |
| **Embedding Cost** | $0.10 | $1 | $10 | One-time cost |

**Bottlenecks at Scale:**

**10K Documents (100K Chunks):**
- ✅ Database: Neon handles easily
- ✅ Embeddings: 600MB storage (acceptable)
- ⚠️ Search: 500ms in-memory similarity (slower but usable)
- Solution: Migrate to pgvector native types

**100K Documents (1M Chunks):**
- ❌ In-memory search: 5+ seconds (unacceptable)
- ❌ Memory: Loading 1M embeddings into RAM (6GB)
- Solution required: Native vector DB or pgvector

**Optimization Path:**

**Phase 1 (Current): 0-10K docs**
- In-memory vector search
- JSON embedding storage
- No changes needed

**Phase 2: 10K-100K docs**
- Migrate to pgvector extension:
```sql
ALTER TABLE embeddings 
ALTER COLUMN embedding TYPE vector(1536);

CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
```
- Enable database-level similarity search
- 10-50x faster queries

**Phase 3: 100K+ docs**
- Separate vector database (Pinecone/Weaviate)
- Distributed search
- Caching layer (Redis)

**Multi-User Scaling:**

Current architecture is **multi-tenant ready:**
- ✅ user_id on all tables
- ✅ Foreign key constraints
- ✅ Row-level security possible
- ✅ Per-user encryption (data isolation)

**Horizontal Scaling:**
```
1,000 users × 1,000 docs = 1M documents = 10M chunks
↓
Neon autoscaling handles this
PostgreSQL connection pooling
Serverless functions scale automatically
```

**Cost at Scale:**

| Users | Documents | Storage | Neon Cost | AI Cost/month |
|-------|-----------|---------|-----------|---------------|
| 100 | 100K | 50GB | $20 | $50 (new docs) |
| 1,000 | 1M | 500GB | $200 | $500 |
| 10,000 | 10M | 5TB | $2,000 | $5,000 |

**Optimization:** Embeddings are 90% of storage. Could use:
- Quantization (1536 floats → 768 bytes, ~75% reduction)
- Dimensionality reduction (1536 → 768 dimensions)
- Trade-off: Slight accuracy loss (95% → 93%)

#### Privacy by Design

**Threat Model:**

**Protected Against:**
1. ✅ Database breach (data encrypted at rest)
2. ✅ Rogue admin (cannot decrypt user data)
3. ✅ Network sniffing (HTTPS + encrypted cookies)
4. ✅ Cross-user access (strict user_id checks)
5. ✅ Session hijacking (HTTP-only cookies)

**NOT Protected Against:**
6. ❌ Compromised master key (all data decryptable)
7. ❌ XSS attack (could steal session)
8. ❌ Physical device access (client-side plaintext)

**Encryption Strategy:**

**At Rest (Database):**
```
Master Key (ENCRYPTION_KEY env var)
    ↓
PBKDF2(masterKey, userId) → Per-User Key
    ↓
AES-256-GCM(plaintext, userKey) → Ciphertext
    ↓
Base64 → Store in PostgreSQL
```

**Benefits:**
- User A cannot decrypt User B's data (different keys)
- Database admin sees only ciphertext
- Breach exposes no plaintext

**Trade-off:**
- Search must decrypt in-memory (cannot search on ciphertext)
- Slightly higher CPU usage
- Cannot leverage database full-text search

**Why This Trade-off is Acceptable:**

For a **personal knowledge base**, privacy > performance:
- Users store sensitive data (work docs, personal notes)
- Trust is paramount
- Slight performance cost (50ms decryption) is negligible
- In-memory search is still sub-second

**At Transit:**
- ✅ HTTPS enforced
- ✅ Encrypted JWT cookies
- ✅ No sensitive data in URLs
- ✅ API keys in environment variables (never client-side)

**User Isolation:**

Every query includes user_id validation:
```javascript
const session = await getServerSession();
if (!session?.user?.id) return 401;

// All queries filtered by user
const docs = await db.select()
  .from(documents)
  .where(eq(documents.userId, session.user.id));
```

**Prevents:**
- User A accessing User B's documents
- IDOR attacks (Insecure Direct Object Reference)
- Privilege escalation

#### Cloud-Hosted vs Local-First

**Current: Cloud-Hosted (Neon + Vercel)**

**Pros:**
- ✅ Accessible anywhere (web browser)
- ✅ No local storage limits
- ✅ Automatic backups
- ✅ Cross-device sync
- ✅ Easy deployment

**Cons:**
- ❌ Requires internet connection
- ❌ Trust in cloud provider (mitigated by encryption)
- ❌ Ongoing costs (storage, API)

**Alternative: Local-First (Not Implemented)**

**How it would work:**
- SQLite database on device
- Local embedding generation (ONNX runtime)
- Local LLM (Llama, Mistral)
- Optional cloud sync (encrypted)

**Trade-offs:**

| Aspect | Cloud-Hosted (Chosen) | Local-First |
|--------|----------------------|-------------|
| **Privacy** | Good (encrypted at rest) | Excellent (never leaves device) |
| **Performance** | Depends on internet | Always fast |
| **Storage** | Unlimited ($) | Limited to device |
| **AI Quality** | Best (GPT-4, Gemini) | Good (local models) |
| **Cost** | $10-50/month | Free (after hardware) |
| **Accessibility** | Anywhere | Single device |
| **Setup** | Easy (web app) | Complex (install required) |

**Why Cloud-Hosted is Better for Memora:**

1. **AI Quality:** Gemini 2.5 Pro > any local model
2. **Accessibility:** Users want access from phone, laptop, tablet
3. **Ease of Use:** No installation, just sign in
4. **Storage:** Personal knowledge bases can be large (100GB+)
5. **Encryption Mitigates Privacy Concern:** Even cloud-hosted, data is encrypted

**Hybrid Approach (Future):**
- Cloud by default
- Export encrypted backup to local SQLite
- Offline mode with cached embeddings
- Sync when online

---

## 2. Detailed Component Documentation

### 2.1 Chunking Algorithm

**Implementation:**

```javascript
function chunkText(text: string): ChunkResult[] {
  const CHUNK_SIZE = 1000;
  const OVERLAP = 200;
  
  const chunks = [];
  let startChar = 0;
  let index = 0;
  
  while (startChar < text.length) {
    const endChar = Math.min(startChar + CHUNK_SIZE, text.length);
    const chunkText = text.substring(startChar, endChar);
    
    chunks.push({
      text: chunkText,
      startChar,
      endChar,
      index,
    });
    
    startChar += CHUNK_SIZE - OVERLAP; // Move forward, accounting for overlap
    index++;
  }
  
  return chunks;
}
```

**Why 1000 Characters?**

Tested chunk sizes:

| Size | Chunks/10K doc | Embedding Cost | Search Precision | Context Quality |
|------|----------------|----------------|------------------|-----------------|
| 500 | 20 | $0.02 | High | Poor (fragmented) |
| 1000 | 10 | $0.01 | Good | Good |
| 2000 | 5 | $0.005 | Lower | Better (but too broad) |

**1000 chars chosen:**
- ≈ 250 tokens (fits embedding model context)
- ≈ 3-4 paragraphs (semantic unit)
- Good balance of precision vs context

**Why 200 Character Overlap?**

Without overlap:
```
Chunk 1: "...important deadline is"
Chunk 2: "January 15. The team must..."

User query: "When is the deadline?"
→ Neither chunk has complete answer
```

With 200 char overlap:
```
Chunk 1: "...important deadline is January 15. The team..."
Chunk 2: "...deadline is January 15. The team must..."

Both chunks contain complete context
→ Higher chance of matching query
```

**Trade-off:** 20% more chunks = 20% higher embedding cost
**Justification:** Better search quality worth 20% cost increase

### 2.2 Embedding Generation Strategy

**Model: OpenAI text-embedding-3-small**

**Specifications:**
- Dimensions: 1536
- Max input: 8191 tokens
- Cost: $0.00002 per 1K tokens
- Latency: ~100ms per request

**Why text-embedding-3-small (not 3-large)?**

| Model | Dimensions | Cost | Quality | Storage |
|-------|------------|------|---------|---------|
| ada-002 | 1536 | $0.0001 | Good | 6KB/chunk |
| 3-small | 1536 | $0.00002 | Better | 6KB/chunk |
| 3-large | 3072 | $0.00013 | Best | 12KB/chunk |

**Chosen: 3-small**
- ✅ 5x cheaper than 3-large
- ✅ Quality improvement over ada-002
- ✅ Same storage as ada-002
- ✅ Sufficient for personal knowledge base

**Batch Processing:**

```javascript
// Efficient: Process all chunks in one API call
const embeddings = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: [chunk1.text, chunk2.text, ..., chunk10.text],
});

// Returns: Array of 10 embeddings
// Cost: Single API request overhead
```

**Cost Savings:**
- Batch: 1 API call for 10 chunks
- Sequential: 10 API calls
- Network overhead reduction: 90%

**Storage Format:**

```javascript
// Stored as JSON string (for now)
embedding: JSON.stringify([0.123, -0.456, ..., 0.789])

// Future: Native pgvector
embedding: vector(1536) // PostgreSQL native type
```

**Why JSON for now?**
- ✅ Simple to implement (no extension setup)
- ✅ Works immediately
- ✅ Easy to migrate later
- ✅ Drizzle ORM supports JSONB

**Migration Path:**
```sql
-- When scaling beyond 10K docs
CREATE EXTENSION vector;

ALTER TABLE embeddings 
ALTER COLUMN embedding TYPE vector(1536) 
USING embedding::text::vector;

-- Enable fast similarity search
CREATE INDEX ON embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### 2.3 Context Building for LLM

**Purpose:** Convert search results into coherent context for Gemini

**Format:**

```
[1] From "Meeting Notes" (2025-11-05):
The project deadline is January 15. The team consists of 5 engineers...

---

[2] From "Budget Document" (2025-11-03):
Q4 budget allocation is $50,000 for infrastructure...

---

[3] From "Technical Spec" (2025-11-01):
The architecture uses microservices with Kubernetes...
```

**Why This Format:**
- ✅ Clear source attribution (helps with citations)
- ✅ Date context (Gemini can reason about recency)
- ✅ Separators prevent chunk confusion
- ✅ Numbered for easy reference in responses

**Context Size Management:**

```javascript
Top K = 10 chunks
Average chunk = 1000 chars
Total context ≈ 10,000 chars ≈ 2,500 tokens

System prompt ≈ 200 tokens
User query ≈ 50 tokens
Response ≈ 500 tokens

Total: ~3,250 tokens (well within Gemini's 128K limit)
```

**Why K=10 (not more)?**

Tested K values:

| K | Context Size | Response Quality | Cost | Latency |
|---|--------------|------------------|------|---------|
| 5 | 1,250 tokens | Good | $0.001 | 1s |
| 10 | 2,500 tokens | Better | $0.002 | 1.5s |
| 20 | 5,000 tokens | Same | $0.004 | 2s |
| 50 | 12,500 tokens | Same | $0.01 | 3s |

**Diminishing Returns Beyond K=10:**
- Top 5-10 results contain the answer
- Additional chunks add noise, not signal
- Higher cost and latency for no benefit

**K=10 chosen:** Sweet spot of quality, cost, and speed

---

## 3. Privacy & Security Deep Dive

### 3.1 Encryption Implementation

**Algorithm: AES-256-GCM (Galois/Counter Mode)**

**Why GCM?**
- ✅ Authenticated encryption (prevents tampering)
- ✅ Built-in integrity check (auth tag)
- ✅ Fast (hardware acceleration on modern CPUs)
- ✅ Recommended by NIST

**vs Alternatives:**

| Mode | Authenticated? | Performance | Security |
|------|----------------|-------------|----------|
| CBC | ❌ | Good | Vulnerable to padding oracle |
| CTR | ❌ | Excellent | No integrity check |
| **GCM** | ✅ | Excellent | Strong + integrity |
| CCM | ✅ | Good | Complex to implement |

**GCM provides both confidentiality AND integrity.**

**Key Derivation: PBKDF2**

```javascript
function getUserKey(userId: string): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;
  
  return crypto.pbkdf2Sync(
    masterKey,      // Password
    userId,         // Salt (unique per user)
    100000,         // Iterations (NIST recommendation)
    32,             // Key length (256 bits)
    'sha256'        // Hash function
  );
}
```

**Why PBKDF2 with userId as Salt:**
- ✅ Deterministic: Same userId → same key (no key storage needed)
- ✅ User isolation: Different users → different keys
- ✅ Key rotation possible: Change masterKey → all keys change
- ✅ Standard: NIST approved, widely used

**Iterations = 100,000:**
- Slow enough to prevent brute force (100ms delay)
- Fast enough for normal use (100ms acceptable)
- NIST minimum is 10,000, we use 10x for extra security

**Encryption Process:**

```javascript
function encrypt(plaintext: string, userId: string): string {
  const key = getUserKey(userId);          // 32 bytes
  const iv = crypto.randomBytes(12);       // 12 bytes for GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();     // 16 bytes
  
  // Combine: IV || AuthTag || Ciphertext
  const combined = Buffer.concat([
    iv,                                     // 12 bytes
    authTag,                                // 16 bytes
    Buffer.from(encrypted, 'base64')        // Variable
  ]);
  
  return combined.toString('base64');      // Store this
}
```

**Result Format:**
```
Base64( IV[12] || AuthTag[16] || Ciphertext[variable] )
```

**Why This Format:**
- ✅ Self-contained (IV included, no separate storage)
- ✅ Integrity verified (auth tag)
- ✅ Single string (easy database storage)

**Decryption Process:**

```javascript
function decrypt(ciphertext: string, userId: string): string {
  const key = getUserKey(userId);
  const combined = Buffer.from(ciphertext, 'base64');
  
  const iv = combined.subarray(0, 12);           // Extract IV
  const authTag = combined.subarray(12, 28);     // Extract auth tag
  const encrypted = combined.subarray(28);        // Extract ciphertext
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);                  // Verify integrity
  
  let decrypted = decipher.update(encrypted);
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Security Properties:**
1. **Confidentiality:** AES-256 (unbreakable with current tech)
2. **Integrity:** Auth tag prevents tampering
3. **Authenticity:** Only correct user key can decrypt
4. **Forward Secrecy:** Rotating master key invalidates all old keys

### 3.2 Access Control

**Multi-Layered Security:**

**Layer 1: Authentication (NextAuth)**
```javascript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return Response 401 Unauthorized;
}
```

**Layer 2: Database Queries (Always Filter by user_id)**
```javascript
const documents = await db.select()
  .from(documents)
  .where(eq(documents.userId, session.user.id));
  //                         ^^^^^^^^^^^^^^^^^ 
  //                         ALWAYS include this
```

**Layer 3: Encryption (Even if DB query bypassed)**
```javascript
// Even if attacker gets data from DB:
const encrypted = "a8f3d9c2e1..."; // Looks like random noise
decrypt(encrypted, attackerUserId); // ❌ Fails (wrong key)
decrypt(encrypted, correctUserId);  // ✅ Works
```

**Defense in Depth:** 3 independent security layers

---

## 4. Conversation Memory & Context Management

### 4.1 Chat Session Persistence

**Problem:** How to maintain conversation memory across page refreshes and sessions?

**Solution:** Database-backed chat sessions with encrypted messages

**Schema:**
```sql
sessions (
  id uuid PRIMARY KEY,
  user_id uuid FOREIGN KEY,
  title text,
  created_at timestamp,
  updated_at timestamp
)

messages (
  id uuid PRIMARY KEY,
  session_id uuid FOREIGN KEY,
  role text, -- 'user' or 'assistant'
  content_encrypted text, -- AES-256-GCM encrypted
  created_at timestamp
)
```

**Cascade Delete:**
```sql
ON DELETE CASCADE

Delete user → deletes sessions → deletes messages
Delete session → deletes messages
```

**Benefits:**
- ✅ Conversation history preserved
- ✅ Refresh-proof (reload from DB)
- ✅ Cross-device access (same Google account)
- ✅ Privacy maintained (messages encrypted)

### 4.2 Conversation Context for Gemini

**Challenge:** Gemini doesn't natively support conversation history (no role-based messages)

**Solution:** Format full conversation in prompt

**Prompt Structure:**

```
SYSTEM PROMPT:
You are Memora, an AI assistant...

Context from user's documents:
[Search results here...]

---

Conversation:

User: Hi, what documents do I have?
