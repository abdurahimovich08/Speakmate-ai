"""
SpeakMate AI - Real-time Coaching Engine

Provides coaching tips during the conversation:
- Tracks errors per turn
- Decides WHEN to give feedback (every 3-4 turns, or on critical errors)
- Decides HOW to give feedback (recast, elicit, explicit)
- Formats coaching_tip WebSocket messages
"""
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# How many turns between coaching interventions
COACHING_INTERVAL = 3


class RealtimeCoach:
    """
    Manages real-time coaching decisions during a conversation session.

    Tracks accumulated errors and decides when/how to intervene.
    """

    def __init__(self):
        self.turn_count: int = 0
        self.last_coaching_turn: int = 0
        self.accumulated_errors: List[Dict] = []
        self.coached_errors: List[Dict] = []  # errors already shown

    def on_user_turn(self, errors: List[Dict]) -> Optional[Dict]:
        """
        Called after every user turn with newly detected errors.

        Returns a coaching_tip dict if it's time to coach, else None.
        """
        self.turn_count += 1
        self.accumulated_errors.extend(errors)

        # Check if we should coach this turn
        if not self._should_coach(errors):
            return None

        tip = self._pick_best_tip()
        if tip:
            self.last_coaching_turn = self.turn_count
            self.coached_errors.append(tip)
            return tip

        return None

    def _should_coach(self, new_errors: List[Dict]) -> bool:
        """Decide whether this turn warrants a coaching intervention."""
        turns_since_last = self.turn_count - self.last_coaching_turn

        # Always coach on critical/major errors
        for e in new_errors:
            if e.get("severity") == "major":
                return True

        # Otherwise, wait for the coaching interval
        if turns_since_last >= COACHING_INTERVAL and self._has_uncoached_errors():
            return True

        return False

    def _has_uncoached_errors(self) -> bool:
        """Check if there are errors not yet addressed."""
        coached_texts = {e.get("original_text", "") for e in self.coached_errors}
        for e in self.accumulated_errors:
            if e.get("original_text", "") not in coached_texts:
                return True
        return False

    def _pick_best_tip(self) -> Optional[Dict]:
        """Pick the most impactful uncoached error to address."""
        coached_texts = {e.get("original_text", "") for e in self.coached_errors}

        candidates = [
            e for e in self.accumulated_errors
            if e.get("original_text", "") not in coached_texts
        ]

        if not candidates:
            return None

        # Sort by impact: major > moderate > minor, then by impact_score
        severity_order = {"major": 3, "moderate": 2, "minor": 1}
        candidates.sort(
            key=lambda e: (
                severity_order.get(e.get("severity", "minor"), 1),
                e.get("impact_score", 0),
                e.get("confidence", 0),
            ),
            reverse=True,
        )

        error = candidates[0]
        return self._format_tip(error)

    def _format_tip(self, error: Dict) -> Dict:
        """Format an error into a coaching_tip WebSocket message payload."""
        category = error.get("category", "grammar")
        severity = error.get("severity", "moderate")
        original = error.get("original_text", "")
        corrected = error.get("corrected_text", "")
        explanation = error.get("explanation", "")

        # Choose correction strategy based on severity
        if severity == "major":
            strategy = "explicit"
        elif severity == "moderate":
            strategy = "recast"
        else:
            strategy = "recast"

        return {
            "category": category,
            "subcategory": error.get("subcategory", ""),
            "error_code": error.get("error_code", ""),
            "original": original,
            "corrected": corrected,
            "explanation": explanation,
            "tip": self._generate_tip_text(category, original, corrected, explanation),
            "severity": severity,
            "strategy": strategy,
        }

    @staticmethod
    def _generate_tip_text(
        category: str, original: str, corrected: str, explanation: str
    ) -> str:
        """Generate a short, friendly tip message."""
        if category == "grammar":
            return f"Quick tip: \"{corrected}\" instead of \"{original}\". {explanation}"
        if category == "vocabulary":
            return f"Try using \"{corrected}\" — it's more natural. {explanation}"
        if category == "fluency":
            return f"Tip: {explanation}"
        if category == "pronunciation":
            return f"Pronunciation: {explanation}"
        return f"Tip: {explanation}"

    def get_session_summary(self) -> Dict:
        """Get summary of coaching activity for this session."""
        return {
            "total_turns": self.turn_count,
            "total_errors_detected": len(self.accumulated_errors),
            "coaching_tips_given": len(self.coached_errors),
            "errors_by_category": self._count_by_category(),
        }

    def _count_by_category(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for e in self.accumulated_errors:
            cat = e.get("category", "other")
            counts[cat] = counts.get(cat, 0) + 1
        return counts
