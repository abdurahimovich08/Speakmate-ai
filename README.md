# SpeakMate AI

Your personal IELTS speaking coach powered by AI.

## Overview

SpeakMate AI is a mobile application that helps users improve their IELTS speaking skills through:

- **Real-time conversation practice** with AI
- **Automatic error detection** (grammar, pronunciation, vocabulary, fluency)
- **IELTS-style scoring** with detailed feedback
- **Personal error tracking** to focus on weak areas
- **PDF reports** for progress review

## Tech Stack

### Mobile App (React Native + Expo)
- Expo SDK 50
- Expo Router for navigation
- Zustand for state management
- Expo AV for audio recording

### Backend (Python FastAPI)
- FastAPI with WebSocket support
- Google Cloud Speech-to-Text
- Google Gemini Pro for AI conversations
- Supabase for database and auth
- ReportLab for PDF generation

## Project Structure

```
speakmate-ai/
├── mobile/                 # React Native Expo app
│   ├── app/               # Expo Router pages
│   ├── components/        # Reusable components
│   ├── services/          # API, WebSocket, Audio services
│   ├── stores/            # Zustand state stores
│   └── types/             # TypeScript types
│
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── api/          # REST and WebSocket routes
│   │   ├── core/         # Config and security
│   │   ├── db/           # Supabase client
│   │   ├── models/       # Pydantic schemas
│   │   └── services/     # Business logic
│   └── prompts/          # AI prompt templates
│
└── docs/                  # Documentation
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Expo CLI (`npm install -g expo-cli`)
- Supabase account
- Google Cloud account

### 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the schema from `backend/supabase/schema.sql`
3. Copy your project URL and anon key from Project Settings > API

### 2. Google Cloud Setup

1. Create a new Google Cloud project
2. Enable these APIs:
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API
   - Vertex AI API (for Gemini)
3. Create a service account and download the JSON key
4. Set up billing (required for API usage)

### 3. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
copy .env.example .env
# Edit .env with your credentials

# Run the server
uvicorn main:app --reload
```

### 4. Mobile App Setup

```bash
# Navigate to mobile folder
cd mobile

# Install dependencies
npm install

# Copy environment file
copy .env.example .env
# Edit .env with your backend URL and Supabase credentials

# Start Expo development server
npx expo start
```

### 5. Running the App

- For iOS: Press `i` in the terminal or scan QR code with Expo Go
- For Android: Press `a` in the terminal or scan QR code with Expo Go
- For development build: Run `npx expo run:ios` or `npx expo run:android`

## Environment Variables

### Backend (.env)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GOOGLE_API_KEY=your-gemini-api-key
```

### Mobile (.env)

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_WS_URL=ws://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Features

### Free Speaking Mode
- Natural conversation with AI on any topic
- Real-time transcription of speech
- Hidden error tracking (errors shown after session)
- Session summary with detected errors

### IELTS Test Mode (Coming Soon)
- Full IELTS speaking test simulation
- Part 1, 2, 3 structure
- Timed responses
- Official band score estimation

### Training Mode (Coming Soon)
- Personalized exercises based on error profile
- Pronunciation drills
- Grammar exercises
- Vocabulary expansion

## API Endpoints

### REST API

- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update profile
- `POST /api/v1/sessions/` - Create new session
- `GET /api/v1/sessions/` - Get user sessions
- `GET /api/v1/feedback/{session_id}` - Get session feedback
- `POST /api/v1/feedback/{session_id}/pdf` - Generate PDF report

### WebSocket

- `WS /ws/conversation/{session_id}` - Real-time conversation

## Error Categories

1. **Pronunciation**
   - Stress patterns
   - Sound substitutions (th → s)
   - Connected speech issues

2. **Grammar**
   - Tense errors
   - Article usage (a/an/the)
   - Preposition errors
   - Subject-verb agreement

3. **Vocabulary**
   - Word repetition
   - Basic vocabulary overuse
   - Incorrect collocations

4. **Fluency**
   - Excessive pauses
   - Filler words (um, uh, like)
   - Incomplete sentences

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please open a GitHub issue.

---

Built with love for IELTS learners worldwide.
