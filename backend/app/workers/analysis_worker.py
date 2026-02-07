"""
SpeakMate AI - Analysis Worker (Production)

Background worker for session analysis.
Two-phase analysis: Fast (10-20s) + Deep (1-3 min)
"""
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging
import json

from app.db.supabase import db_service
from app.services.hybrid_analyzer import HybridErrorAnalyzer
from app.services.pronunciation_engine import PronunciationAnalyzer
from app.services.ielts_scorer_production import IELTSScorerProduction
from app.services.prompt_manager import prompt_manager

logger = logging.getLogger(__name__)


def analyze_session(session_id: str, analysis_type: str = "deep") -> Dict[str, Any]:
    """
    Main entry point for session analysis.
    
    Args:
        session_id: Session to analyze
        analysis_type: "fast" or "deep"
    
    Returns:
        Analysis results
    """
    # Run async function in sync context (for RQ compatibility)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        if analysis_type == "fast":
            result = loop.run_until_complete(run_fast_analysis(session_id))
        else:
            result = loop.run_until_complete(run_deep_analysis(session_id))
        return result
    finally:
        loop.close()


async def run_fast_analysis(session_id: str) -> Dict[str, Any]:
    """
    Fast analysis (10-20 seconds).
    
    Provides:
    - Quick error count
    - Estimated band score
    - Top 3 issues
    - Key highlights
    """
    logger.info(f"Starting fast analysis for session {session_id}")
    start_time = datetime.utcnow()
    
    try:
        # Create analysis run record
        run_id = await create_analysis_run(
            session_id=session_id,
            run_type="fast",
            analyzer_version="1.0.0",
            prompt_version="v1"
        )
        
        # Get session data
        session = await db_service.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        turns = await db_service.get_conversation_turns(session_id)
        
        # Extract user transcriptions
        user_texts = [
            turn["transcription"] or turn["content"]
            for turn in turns
            if turn["role"] == "user"
        ]
        
        full_text = " ".join(user_texts)
        
        # Quick rule-based analysis
        analyzer = HybridErrorAnalyzer()
        quick_errors = await analyzer.quick_analysis(full_text)
        
        # Quick score estimation
        word_count = len(full_text.split())
        error_density = len(quick_errors) / max(word_count / 50, 1)
        
        # Estimate band (rough)
        if error_density < 0.5:
            estimated_band = 7.0
        elif error_density < 1.0:
            estimated_band = 6.5
        elif error_density < 2.0:
            estimated_band = 6.0
        elif error_density < 3.0:
            estimated_band = 5.5
        else:
            estimated_band = 5.0
        
        # Group errors by category
        error_counts = {}
        for error in quick_errors:
            cat = error.get("category", "other")
            error_counts[cat] = error_counts.get(cat, 0) + 1
        
        # Top issues
        sorted_cats = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)
        top_issues = [cat for cat, _ in sorted_cats[:3]]
        
        # Build result
        result = {
            "session_id": session_id,
            "analysis_type": "fast",
            "overall_band": estimated_band,
            "error_count": len(quick_errors),
            "error_counts_by_category": error_counts,
            "top_issues": top_issues,
            "word_count": word_count,
            "highlights": generate_quick_highlights(quick_errors, estimated_band),
            "processing_time_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000)
        }
        
        # Update analysis run
        await update_analysis_run(
            run_id=run_id,
            status="completed",
            results=result,
            scores={"overall_band": estimated_band},
            error_count=len(quick_errors)
        )
        
        # Update session with quick scores
        await db_service.update_session(session_id, {
            "overall_scores": {
                "overall_band": estimated_band,
                "analysis_status": "fast_complete"
            }
        })
        
        logger.info(f"Fast analysis completed for {session_id} in {result['processing_time_ms']}ms")
        
        return result
        
    except Exception as e:
        logger.error(f"Fast analysis failed for {session_id}: {e}")
        await update_analysis_run(run_id, status="failed", last_error=str(e))
        raise


async def run_deep_analysis(session_id: str) -> Dict[str, Any]:
    """
    Deep analysis (1-3 minutes).
    
    Provides:
    - Detailed error instances with evidence
    - Full IELTS scoring with rubric mapping
    - Pronunciation analysis
    - Personalized recommendations
    - Training task generation
    """
    logger.info(f"Starting deep analysis for session {session_id}")
    start_time = datetime.utcnow()
    tokens_used = 0
    
    try:
        # Create analysis run
        run_id = await create_analysis_run(
            session_id=session_id,
            run_type="deep",
            analyzer_version="1.0.0",
            prompt_version="v1"
        )
        
        # Get session and user data
        session = await db_service.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        user_id = session["user_id"]
        user = await db_service.get_user_profile(user_id)
        
        turns = await db_service.get_conversation_turns(session_id)
        
        # Extract transcriptions with timestamps
        user_utterances = []
        for turn in turns:
            if turn["role"] == "user":
                user_utterances.append({
                    "text": turn["transcription"] or turn["content"],
                    "word_timestamps": turn.get("word_timestamps", []),
                    "duration_ms": turn.get("audio_duration_ms", 0),
                    "sequence": turn["sequence_order"]
                })
        
        full_text = " ".join([u["text"] for u in user_utterances])
        
        # 1. Hybrid Error Analysis
        analyzer = HybridErrorAnalyzer()
        error_instances = await analyzer.full_analysis(
            text=full_text,
            utterances=user_utterances,
            native_language=user.get("native_language", "uz")
        )
        tokens_used += analyzer.last_tokens_used
        
        # Save error instances to database
        for error in error_instances:
            await save_error_instance(session_id, run_id, error)
        
        # 2. Pronunciation Analysis (two-layer)
        pron_analyzer = PronunciationAnalyzer()
        pron_scores = await pron_analyzer.analyze(
            utterances=user_utterances,
            native_language=user.get("native_language", "uz")
        )
        
        # 3. IELTS Scoring (if applicable)
        scores = {}
        if session["mode"] in ["ielts_test", "ielts_part1", "ielts_part2", "ielts_part3"]:
            scorer = IELTSScorerProduction()
            scores = await scorer.score_with_evidence(
                transcription=full_text,
                errors=error_instances,
                pronunciation_scores=pron_scores,
                mode=session["mode"]
            )
            tokens_used += scorer.last_tokens_used
        else:
            # Estimate scores for free speaking
            scores = estimate_free_speaking_scores(error_instances, pron_scores, len(full_text.split()))
        
        # 4. Generate recommendations
        recommendations = await generate_recommendations(
            error_instances=error_instances,
            scores=scores,
            user_profile=user
        )
        
        # 5. Update error profiles
        await update_user_error_profiles(user_id, error_instances)
        
        # 6. Queue training task generation
        error_codes = list(set([e["error_code"] for e in error_instances[:10]]))
        if error_codes:
            from app.workers.queue_config import queue_manager
            queue_manager.enqueue_training_generation(user_id, error_codes)
        
        # Build final result
        processing_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        result = {
            "session_id": session_id,
            "analysis_type": "deep",
            "scores": scores,
            "error_count": len(error_instances),
            "errors_by_category": group_errors_by_category(error_instances),
            "pronunciation_analysis": pron_scores,
            "recommendations": recommendations,
            "tokens_used": tokens_used,
            "processing_time_ms": processing_time_ms,
            "analyzer_version": "1.0.0"
        }
        
        # Estimate cost
        cost_estimate = (tokens_used / 1000) * 0.0005  # Rough estimate
        
        # Update analysis run
        await update_analysis_run(
            run_id=run_id,
            status="completed",
            results=result,
            scores=scores,
            error_count=len(error_instances),
            tokens_used=tokens_used,
            cost_estimate=cost_estimate
        )
        
        # Update session with full scores
        await db_service.update_session(session_id, {
            "overall_scores": {
                **scores,
                "analysis_status": "deep_complete",
                "analysis_run_id": run_id
            }
        })
        
        # Queue PDF generation
        from app.workers.queue_config import queue_manager
        queue_manager.enqueue_pdf_generation(session_id, user_id)
        
        logger.info(f"Deep analysis completed for {session_id} in {processing_time_ms}ms")
        
        return result
        
    except Exception as e:
        logger.error(f"Deep analysis failed for {session_id}: {e}")
        await update_analysis_run(run_id, status="failed", last_error=str(e))
        raise


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def create_analysis_run(
    session_id: str,
    run_type: str,
    analyzer_version: str,
    prompt_version: str
) -> str:
    """Create analysis run record."""
    client = db_service.client
    
    # Get user_id from session
    session = await db_service.get_session(session_id)
    
    response = client.table("analysis_runs").insert({
        "session_id": session_id,
        "user_id": session["user_id"],
        "run_type": run_type,
        "status": "running",
        "analyzer_version": analyzer_version,
        "prompt_version": prompt_version,
        "started_at": datetime.utcnow().isoformat()
    }).execute()
    
    return response.data[0]["id"]


async def update_analysis_run(
    run_id: str,
    status: str,
    results: Dict = None,
    scores: Dict = None,
    error_count: int = None,
    tokens_used: int = None,
    cost_estimate: float = None,
    last_error: str = None
):
    """Update analysis run record."""
    client = db_service.client
    
    update_data = {
        "status": status,
        "completed_at": datetime.utcnow().isoformat() if status in ["completed", "failed"] else None
    }
    
    if results:
        update_data["results"] = results
    if scores:
        update_data["scores"] = scores
    if error_count is not None:
        update_data["error_count"] = error_count
    if tokens_used is not None:
        update_data["tokens_used"] = tokens_used
    if cost_estimate is not None:
        update_data["cost_estimate"] = cost_estimate
    if last_error:
        update_data["last_error"] = last_error
    
    client.table("analysis_runs").update(update_data).eq("id", run_id).execute()


async def save_error_instance(session_id: str, run_id: str, error: Dict):
    """Save error instance to database."""
    client = db_service.client
    
    client.table("error_instances").insert({
        "session_id": session_id,
        "analysis_run_id": run_id,
        "category": error["category"],
        "subcategory": error.get("subcategory", "general"),
        "error_code": error["error_code"],
        "severity": error.get("severity", "moderate"),
        "original_text": error["original_text"],
        "corrected_text": error["corrected_text"],
        "explanation": error["explanation"],
        "evidence": error.get("evidence", {}),
        "confidence": error.get("confidence", 0.8),
        "impact_score": error.get("impact_score", 0.5),
        "timestamp_ms": error.get("timestamp_ms", 0)
    }).execute()


async def update_user_error_profiles(user_id: str, errors: List[Dict]):
    """Update user's error profiles based on new errors."""
    # This is handled by database trigger, but we can do additional processing here
    pass


def generate_quick_highlights(errors: List[Dict], band: float) -> List[str]:
    """Generate quick highlight messages."""
    highlights = []
    
    if band >= 7.0:
        highlights.append("Good performance! Focus on consistency.")
    elif band >= 6.0:
        highlights.append("Solid foundation. Work on accuracy.")
    else:
        highlights.append("Keep practicing! You're improving.")
    
    # Category-specific highlights
    categories = {}
    for e in errors:
        cat = e.get("category", "other")
        categories[cat] = categories.get(cat, 0) + 1
    
    if categories.get("grammar", 0) > 3:
        highlights.append("Grammar needs attention - review tenses and articles.")
    if categories.get("fluency", 0) > 2:
        highlights.append("Work on fluency - reduce pauses and filler words.")
    
    return highlights[:4]


def group_errors_by_category(errors: List[Dict]) -> Dict:
    """Group errors by category with counts."""
    grouped = {}
    for error in errors:
        cat = error.get("category", "other")
        if cat not in grouped:
            grouped[cat] = {"count": 0, "examples": []}
        grouped[cat]["count"] += 1
        if len(grouped[cat]["examples"]) < 3:
            grouped[cat]["examples"].append({
                "original": error["original_text"],
                "corrected": error["corrected_text"],
                "code": error["error_code"]
            })
    return grouped


def estimate_free_speaking_scores(
    errors: List[Dict],
    pron_scores: Dict,
    word_count: int
) -> Dict:
    """Estimate IELTS-style scores for free speaking mode."""
    
    # Count errors by category
    error_counts = {"grammar": 0, "vocabulary": 0, "fluency": 0, "pronunciation": 0}
    for e in errors:
        cat = e.get("category", "grammar")
        if cat in error_counts:
            error_counts[cat] += 1
    
    def calc_band(error_count: int) -> float:
        rate = error_count / max(word_count / 50, 1)
        if rate < 0.5: return 7.0
        elif rate < 1.0: return 6.5
        elif rate < 2.0: return 6.0
        elif rate < 3.0: return 5.5
        else: return 5.0
    
    fluency_band = calc_band(error_counts["fluency"])
    lexical_band = calc_band(error_counts["vocabulary"])
    grammar_band = calc_band(error_counts["grammar"])
    pron_band = pron_scores.get("overall_score", 6.0)
    
    overall = round((fluency_band + lexical_band + grammar_band + pron_band) / 4 * 2) / 2
    
    return {
        "fluency_coherence": fluency_band,
        "lexical_resource": lexical_band,
        "grammatical_range": grammar_band,
        "pronunciation": pron_band,
        "overall_band": overall
    }


async def generate_recommendations(
    error_instances: List[Dict],
    scores: Dict,
    user_profile: Dict
) -> List[str]:
    """Generate personalized recommendations."""
    recommendations = []
    
    target_band = user_profile.get("target_band", 7.0)
    current_band = scores.get("overall_band", 5.5)
    gap = target_band - current_band
    
    # Score-based recommendations
    if scores.get("fluency_coherence", 9) < 6:
        recommendations.append("Practice speaking for longer periods without pausing.")
    if scores.get("grammatical_range", 9) < 6:
        recommendations.append("Focus on using a mix of simple and complex sentences.")
    if scores.get("lexical_resource", 9) < 6:
        recommendations.append("Expand vocabulary by learning topic-specific words.")
    if scores.get("pronunciation", 9) < 6:
        recommendations.append("Work on clear pronunciation and natural intonation.")
    
    # Error-based recommendations
    error_codes = [e["error_code"] for e in error_instances[:10]]
    if any("ARTICLE" in code for code in error_codes):
        recommendations.append("Review article usage (a, an, the) rules.")
    if any("TENSE" in code for code in error_codes):
        recommendations.append("Practice verb tense consistency.")
    if any("FILLER" in code for code in error_codes):
        recommendations.append("Reduce filler words by pausing briefly instead.")
    
    # Gap-based
    if gap > 1.5:
        recommendations.append(f"To reach Band {target_band}, focus on your weakest areas first.")
    elif gap > 0:
        recommendations.append(f"You're close to Band {target_band}! Keep consistent practice.")
    
    return recommendations[:5]
