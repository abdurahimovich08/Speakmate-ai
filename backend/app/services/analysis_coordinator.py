"""
SpeakMate AI - Analysis Coordinator (Production)

Orchestrates two-phase analysis:
1. Fast summary (10-20s) - immediate feedback
2. Deep analysis (background) - detailed report
"""
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass
import logging
import uuid

from app.services.hybrid_analyzer import HybridErrorAnalyzer
from app.services.pronunciation_engine import PronunciationAnalyzer
from app.services.ielts_scorer_production import ielts_scorer
from app.workers.queue_config import QueueManager

logger = logging.getLogger(__name__)


@dataclass
class AnalysisConfig:
    """Configuration for analysis run."""
    run_id: str
    session_id: str
    user_id: str
    analysis_type: str  # "fast" or "deep"
    prompt_version: str
    model_version: str
    started_at: datetime
    

class AnalysisCoordinator:
    """
    Coordinates two-phase analysis flow.
    
    Phase 1 (Fast): 10-20 seconds
    - Rule-based error detection
    - Quick band estimate
    - Basic feedback
    
    Phase 2 (Deep): 1-3 minutes (background)
    - Full LLM analysis
    - Detailed pronunciation
    - Complete IELTS scoring
    - Training task generation
    """
    
    def __init__(self):
        self.error_analyzer = HybridErrorAnalyzer()
        self.pronunciation = PronunciationAnalyzer()
        self.queue = QueueManager()
    
    async def run_fast_analysis(
        self,
        session_id: str,
        user_id: str,
        transcription: str,
        utterances: List[Dict] = None,
        mode: str = "free"
    ) -> Dict[str, Any]:
        """
        Run fast analysis for immediate feedback.
        
        Returns within 10-20 seconds with:
        - Error count and top issues
        - Estimated band score
        - Brief feedback
        """
        run_id = str(uuid.uuid4())
        started_at = datetime.utcnow()
        
        logger.info(f"Starting fast analysis: {run_id} for session {session_id}")
        
        try:
            # Quick rule-based error detection
            quick_errors = await self.error_analyzer.quick_analysis(transcription)
            
            # Basic pronunciation metrics
            pron_metrics = None
            if utterances:
                try:
                    pron_result = await self.pronunciation.analyze(utterances)
                    pron_metrics = {
                        "overall_score": pron_result.get("overall_score", 6.0),
                        "speaking_rate": pron_result.get("prosody", {}).get("speaking_rate"),
                        "issues_count": len(pron_result.get("problem_areas", []))
                    }
                except Exception as e:
                    logger.warning(f"Pronunciation analysis failed: {e}")
            
            # Estimate band score
            band_estimate = self._estimate_band(quick_errors, pron_metrics, transcription)
            
            # Generate quick feedback
            feedback = self._generate_quick_feedback(quick_errors, band_estimate)
            
            # Calculate duration
            duration_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
            
            result = {
                "run_id": run_id,
                "analysis_type": "fast",
                "status": "completed",
                "duration_ms": duration_ms,
                "error_count": len(quick_errors),
                "top_issues": self._get_top_issues(quick_errors),
                "band_estimate": band_estimate,
                "pronunciation_metrics": pron_metrics,
                "feedback": feedback,
                "deep_analysis_queued": False
            }
            
            # Queue deep analysis
            try:
                self.queue.enqueue_analysis(session_id, "deep")
                result["deep_analysis_queued"] = True
                logger.info(f"Deep analysis queued for session {session_id}")
            except Exception as e:
                logger.warning(f"Failed to queue deep analysis: {e}")
            
            # Save analysis run to database
            await self._save_analysis_run(
                run_id=run_id,
                session_id=session_id,
                user_id=user_id,
                analysis_type="fast",
                status="completed",
                result=result,
                duration_ms=duration_ms
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Fast analysis failed: {e}")
            
            return {
                "run_id": run_id,
                "analysis_type": "fast",
                "status": "failed",
                "error": str(e),
                "error_count": 0,
                "band_estimate": None,
                "feedback": "Analysis temporarily unavailable. Please try again."
            }
    
    async def run_deep_analysis(
        self,
        session_id: str,
        user_id: str,
        transcription: str,
        utterances: List[Dict] = None,
        mode: str = "free",
        native_language: str = "uz"
    ) -> Dict[str, Any]:
        """
        Run comprehensive deep analysis.
        
        Takes 1-3 minutes, runs in background.
        """
        run_id = str(uuid.uuid4())
        started_at = datetime.utcnow()
        
        logger.info(f"Starting deep analysis: {run_id} for session {session_id}")
        
        try:
            # Full error analysis with LLM
            errors = await self.error_analyzer.full_analysis(
                text=transcription,
                utterances=utterances,
                native_language=native_language
            )
            
            # Full pronunciation analysis
            pronunciation_result = {}
            if utterances:
                pronunciation_result = await self.pronunciation.analyze(
                    utterances=utterances,
                    native_language=native_language
                )
            
            # Full IELTS scoring
            scores = await ielts_scorer.score_with_evidence(
                transcription=transcription,
                errors=errors,
                pronunciation_scores=pronunciation_result,
                mode=mode
            )
            
            # Generate detailed recommendations
            recommendations = self._generate_recommendations(errors, scores)
            
            # Generate training plan
            training_plan = self._generate_training_plan(errors)
            
            # Calculate metrics
            duration_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
            tokens_used = ielts_scorer.last_tokens_used + 500  # Estimate
            
            result = {
                "run_id": run_id,
                "analysis_type": "deep",
                "status": "completed",
                "duration_ms": duration_ms,
                "tokens_used": tokens_used,
                "errors": errors,
                "error_count": len(errors),
                "scores": scores,
                "pronunciation": pronunciation_result,
                "recommendations": recommendations,
                "training_plan": training_plan
            }
            
            # Save analysis run
            await self._save_analysis_run(
                run_id=run_id,
                session_id=session_id,
                user_id=user_id,
                analysis_type="deep",
                status="completed",
                result=result,
                duration_ms=duration_ms,
                tokens_used=tokens_used
            )
            
            # Save individual errors
            await self._save_errors(session_id, run_id, errors)
            
            # Queue training task generation
            error_codes = list(set(e.get("error_code", "GRAM_OTHER") for e in errors))
            if error_codes:
                try:
                    self.queue.enqueue_training_generation(user_id, error_codes)
                except Exception as e:
                    logger.warning(f"Failed to queue training generation: {e}")
            
            # Queue PDF generation
            try:
                self.queue.enqueue_pdf_generation(session_id, user_id)
            except Exception as e:
                logger.warning(f"Failed to queue PDF generation: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Deep analysis failed: {e}")
            
            # Save failed run
            await self._save_analysis_run(
                run_id=run_id,
                session_id=session_id,
                user_id=user_id,
                analysis_type="deep",
                status="failed",
                result={"error": str(e)},
                duration_ms=int((datetime.utcnow() - started_at).total_seconds() * 1000)
            )
            
            raise
    
    def _estimate_band(
        self,
        errors: List[Dict],
        pron_metrics: Optional[Dict],
        transcription: str
    ) -> float:
        """Quick band estimation based on error rate."""
        word_count = len(transcription.split())
        if word_count == 0:
            return 5.0
        
        error_rate = len(errors) / (word_count / 50)
        
        # Base score from error rate
        if error_rate < 0.3:
            base_score = 7.5
        elif error_rate < 0.5:
            base_score = 7.0
        elif error_rate < 1.0:
            base_score = 6.5
        elif error_rate < 2.0:
            base_score = 6.0
        else:
            base_score = 5.5
        
        # Adjust for pronunciation
        if pron_metrics and pron_metrics.get("overall_score"):
            pron_score = pron_metrics["overall_score"]
            base_score = (base_score + pron_score) / 2
        
        return round(base_score * 2) / 2
    
    def _generate_quick_feedback(
        self,
        errors: List[Dict],
        band_estimate: float
    ) -> str:
        """Generate brief feedback for fast analysis."""
        
        if band_estimate >= 7.0:
            quality = "Great work!"
        elif band_estimate >= 6.0:
            quality = "Good effort!"
        else:
            quality = "Keep practicing!"
        
        if not errors:
            return f"{quality} Your speech was clear and fluent."
        
        # Find most common error type
        categories = {}
        for e in errors:
            cat = e.get("category", "grammar")
            categories[cat] = categories.get(cat, 0) + 1
        
        top_category = max(categories.keys(), key=lambda k: categories[k])
        
        focus_tips = {
            "grammar": "Focus on verb tenses and articles.",
            "vocabulary": "Try using more varied vocabulary.",
            "fluency": "Work on speaking more smoothly.",
            "pronunciation": "Pay attention to clear pronunciation."
        }
        
        tip = focus_tips.get(top_category, "Keep up the good work!")
        
        return f"{quality} {tip}"
    
    def _get_top_issues(self, errors: List[Dict]) -> List[Dict]:
        """Get top 3 most important issues."""
        # Sort by severity and impact
        sorted_errors = sorted(
            errors,
            key=lambda e: (
                {"major": 3, "moderate": 2, "minor": 1}.get(e.get("severity", "minor"), 1),
                e.get("impact_score", 0)
            ),
            reverse=True
        )
        
        return [
            {
                "category": e.get("category"),
                "original": e.get("original_text"),
                "corrected": e.get("corrected_text"),
                "explanation": e.get("explanation")
            }
            for e in sorted_errors[:3]
        ]
    
    def _generate_recommendations(
        self,
        errors: List[Dict],
        scores: Dict
    ) -> List[Dict]:
        """Generate actionable recommendations."""
        recommendations = []
        
        # Identify weakest area
        criteria = ["fluency_coherence", "lexical_resource", "grammatical_range", "pronunciation"]
        weakest = None
        lowest_score = 10
        
        for criterion in criteria:
            if criterion in scores and isinstance(scores[criterion], dict):
                score = scores[criterion].get("band", 9)
                if score < lowest_score:
                    lowest_score = score
                    weakest = criterion
        
        # Add recommendations based on weakest area
        if weakest == "grammatical_range":
            recommendations.append({
                "priority": "high",
                "area": "Grammar",
                "recommendation": "Practice complex sentence structures and tense consistency.",
                "resources": ["Grammar practice drills", "Error correction exercises"]
            })
        elif weakest == "lexical_resource":
            recommendations.append({
                "priority": "high",
                "area": "Vocabulary",
                "recommendation": "Expand your vocabulary with topic-specific words and collocations.",
                "resources": ["Vocabulary building exercises", "Collocation practice"]
            })
        elif weakest == "fluency_coherence":
            recommendations.append({
                "priority": "high",
                "area": "Fluency",
                "recommendation": "Practice speaking without long pauses. Use linking words.",
                "resources": ["Speaking practice", "Filler reduction exercises"]
            })
        elif weakest == "pronunciation":
            recommendations.append({
                "priority": "high",
                "area": "Pronunciation",
                "recommendation": "Focus on problem sounds and natural intonation patterns.",
                "resources": ["Pronunciation drills", "Shadowing exercises"]
            })
        
        # Add general recommendation
        if scores.get("overall_band", 6) < 7:
            recommendations.append({
                "priority": "medium",
                "area": "General",
                "recommendation": "Regular daily practice will help improve all areas.",
                "resources": ["Daily conversation practice", "IELTS mock tests"]
            })
        
        return recommendations
    
    def _generate_training_plan(self, errors: List[Dict]) -> Dict:
        """Generate 7-day training plan based on errors."""
        
        # Count errors by category
        categories = {}
        for e in errors:
            cat = e.get("category", "grammar")
            categories[cat] = categories.get(cat, 0) + 1
        
        # Sort by frequency
        sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)
        
        plan = {
            "duration_days": 7,
            "focus_areas": [cat for cat, _ in sorted_cats[:3]],
            "daily_tasks": []
        }
        
        task_templates = {
            "grammar": ["Grammar drills (15 min)", "Error correction practice (10 min)"],
            "vocabulary": ["Learn 5 new collocations", "Vocabulary review (10 min)"],
            "fluency": ["Speak for 2 minutes on a topic", "Record yourself speaking"],
            "pronunciation": ["Pronunciation drills (10 min)", "Shadowing exercise (10 min)"]
        }
        
        for day in range(1, 8):
            focus = sorted_cats[(day - 1) % len(sorted_cats)][0] if sorted_cats else "grammar"
            tasks = task_templates.get(focus, ["General practice"])
            
            plan["daily_tasks"].append({
                "day": day,
                "focus": focus.title(),
                "tasks": tasks,
                "estimated_minutes": 25
            })
        
        return plan
    
    async def _save_analysis_run(
        self,
        run_id: str,
        session_id: str,
        user_id: str,
        analysis_type: str,
        status: str,
        result: Dict,
        duration_ms: int,
        tokens_used: int = 0
    ):
        """Save analysis run to database."""
        try:
            from supabase import create_client
            from app.core.config import settings
            
            client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            client.table("analysis_runs").insert({
                "id": run_id,
                "session_id": session_id,
                "user_id": user_id,
                "analysis_type": analysis_type,
                "status": status,
                "result": result,
                "prompt_version": "v1",
                "model_version": "gemini-pro",
                "processing_time_ms": duration_ms,
                "tokens_used": tokens_used
            }).execute()
            
        except Exception as e:
            logger.error(f"Failed to save analysis run: {e}")
    
    async def _save_errors(
        self,
        session_id: str,
        run_id: str,
        errors: List[Dict]
    ):
        """Save individual errors to database."""
        try:
            from supabase import create_client
            from app.core.config import settings
            
            client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            for error in errors:
                client.table("error_instances").insert({
                    "session_id": session_id,
                    "analysis_run_id": run_id,
                    "category": error.get("category", "grammar"),
                    "subcategory": error.get("subcategory"),
                    "error_code": error.get("error_code"),
                    "severity": error.get("severity", "minor"),
                    "original_text": error.get("original_text"),
                    "corrected_text": error.get("corrected_text"),
                    "explanation": error.get("explanation"),
                    "confidence": error.get("confidence", 0.8),
                    "evidence": error.get("evidence", {})
                }).execute()
                
        except Exception as e:
            logger.error(f"Failed to save errors: {e}")


# Global instance
analysis_coordinator = AnalysisCoordinator()
