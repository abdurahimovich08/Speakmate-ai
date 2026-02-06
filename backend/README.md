# SpeakMate AI - Backend

Production-grade IELTS Speaking Coach API powered by AI.

## Features

### Core Functionality
- **Real-time Voice Conversation**: WebSocket-based audio streaming with STT/TTS
- **IELTS Scoring**: Evidence-based band scoring using official descriptors
- **Error Detection**: Hybrid analyzer (rule-based + LLM) for grammar, vocabulary, fluency
- **Pronunciation Assessment**: Two-layer analysis (intelligibility + prosody)
- **Training System**: Personalized drills with spaced repetition
- **PDF Reports**: Professional session reports

### Production Features
- **Two-Phase Analysis**: Fast summary (~15s) + Deep analysis (background)
- **Session Reconnection**: Resume interrupted sessions
- **Rate Limiting**: IP + user-based throttling
- **Audit Logging**: Full action tracking
- **Prompt Versioning**: Tracked and validated LLM prompts
- **Background Jobs**: Redis queue for heavy processing

## Architecture

```
backend/
├── app/
│   ├── api/
│   │   ├── routes/          # REST endpoints
│   │   │   ├── users.py
│   │   │   ├── sessions.py
│   │   │   ├── feedback.py
│   │   │   ├── training.py
│   │   │   └── analysis.py
│   │   └── websocket/       # Real-time audio
│   │       ├── protocol.py
│   │       ├── handlers.py
│   │       └── session_manager.py
│   ├── services/
│   │   ├── hybrid_analyzer.py      # Error detection
│   │   ├── pronunciation_engine.py # Pronunciation scoring
│   │   ├── ielts_scorer_production.py
│   │   ├── training_engine.py      # Spaced repetition
│   │   ├── prompt_manager.py       # Prompt versioning
│   │   └── analysis_coordinator.py # Two-phase analysis
│   ├── workers/
│   │   ├── queue_config.py
│   │   ├── analysis_worker.py
│   │   ├── pdf_worker.py
│   │   └── training_worker.py
│   └── middleware/
│       ├── security.py    # Rate limiting, PII
│       └── monitoring.py  # Metrics, tracing
├── prompts/               # Versioned prompt templates
├── supabase/
│   └── schema_production.sql
└── requirements.txt
```

## Quick Start

### 1. Prerequisites
- Python 3.11+
- Supabase project
- Google Cloud project (Speech-to-Text, Text-to-Speech, Gemini)
- Redis (optional, for background jobs)

### 2. Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 3. Configuration

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Database Setup

Run the schema in your Supabase SQL Editor:
```sql
-- File: supabase/schema_production.sql
```

### 5. Run Server

```bash
# Development
python run.py --mode dev

# Production
python run.py --mode prod --workers 4

# Background worker
python run.py --mode worker
```

## API Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/users/me` | GET | Current user profile |
| `/api/v1/sessions` | GET/POST | List/create sessions |
| `/api/v1/sessions/{id}` | GET | Session details |
| `/api/v1/analysis/sessions/{id}` | GET | Analysis results |
| `/api/v1/analysis/sessions/{id}/pdf` | POST | Generate PDF |
| `/api/v1/training/tasks` | GET | Due training tasks |
| `/api/v1/training/tasks/{id}/complete` | POST | Complete task |

### WebSocket

Connect to `/ws/{session_id}` with auth token.

**Client → Server:**
- `session.start` - Start conversation
- `session.resume` - Resume after disconnect
- `audio.config` - Audio settings
- `audio.commit` - Audio chunk ready
- `session.end` - End session

**Server → Client:**
- `stt.partial` - Partial transcription
- `stt.final` - Final transcription
- `ai.reply` - AI response text
- `tts.audio` - Audio response
- `session.summary_ready` - Fast analysis done
- `session.analysis_ready` - Deep analysis done

## Services

### Error Analysis (Hybrid)
1. **Rule-based**: Fast pattern matching (~50ms)
   - Grammar rules (articles, tenses, agreement)
   - L1-specific patterns (Uzbek speakers)
   - Fluency markers (fillers, repetition)

2. **LLM Analysis**: Deep context understanding
   - Complex errors
   - Explanations
   - Confidence scoring

### Pronunciation Assessment
1. **Intelligibility**: STT confidence analysis
2. **Prosody**: Speaking rate, pauses, rhythm

### IELTS Scoring
- Fluency & Coherence
- Lexical Resource
- Grammatical Range & Accuracy
- Pronunciation

Each criterion includes:
- Band score (0.5 steps)
- Evidence quotes
- Official descriptor match

### Training System
- Error-to-drill mapping
- SM-2 spaced repetition
- Progress tracking
- 7-day plans

## Monitoring

### Health Checks
- `/health` - Full health status
- `/ready` - Kubernetes readiness
- `/metrics` - Prometheus metrics

### Metrics Tracked
- Request count/duration
- Active sessions
- Analysis duration
- Token usage
- Error rates

## Security

- JWT authentication (Supabase)
- Rate limiting (IP + user)
- PII detection/masking
- Security headers
- Request validation
- Audit logging

## Environment Variables

See `.env.example` for all options.

**Required:**
- `SUPABASE_URL`, `SUPABASE_KEY`
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_API_KEY`

**Optional:**
- `REDIS_URL` - For background jobs
- `SENTRY_DSN` - Error tracking

## License

Proprietary - All rights reserved
