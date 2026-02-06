"""
SpeakMate AI - Services Package

Production-grade services for:
- Speech processing (STT/TTS)
- Conversation orchestration
- Error analysis (hybrid: rule + LLM)
- Pronunciation assessment
- IELTS scoring
- Training system
- Prompt management
"""

from app.services.hybrid_analyzer import HybridErrorAnalyzer
from app.services.pronunciation_engine import PronunciationAnalyzer
from app.services.ielts_scorer_production import IELTSScorerProduction, ielts_scorer
from app.services.training_engine import TrainingEngine, training_engine
from app.services.prompt_manager import PromptManager, prompt_manager
from app.services.analysis_coordinator import AnalysisCoordinator, analysis_coordinator
from app.services.quota_service import QuotaService

__all__ = [
    "HybridErrorAnalyzer",
    "PronunciationAnalyzer",
    "IELTSScorerProduction",
    "ielts_scorer",
    "TrainingEngine",
    "training_engine",
    "PromptManager",
    "prompt_manager",
    "AnalysisCoordinator",
    "analysis_coordinator",
    "QuotaService"
]
