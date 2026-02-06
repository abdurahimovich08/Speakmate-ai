"""
SpeakMate AI - PDF Report Worker (Production)

Generates professional PDF reports for sessions.
"""
import asyncio
from datetime import datetime
from typing import Dict, Any, List
import logging
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, ListFlowable, ListItem, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, Line
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie

from app.db.supabase import db_service
from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_pdf_report(session_id: str, user_id: str) -> Dict[str, Any]:
    """
    Generate comprehensive PDF report for a session.
    
    Args:
        session_id: Session to report on
        user_id: User who owns the session
    
    Returns:
        dict with report URL and metadata
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(_generate_report(session_id, user_id))
        return result
    finally:
        loop.close()


async def _generate_report(session_id: str, user_id: str) -> Dict[str, Any]:
    """Async report generation."""
    logger.info(f"Generating PDF report for session {session_id}")
    start_time = datetime.utcnow()
    
    # Ensure reports directory exists
    reports_dir = "reports"
    os.makedirs(reports_dir, exist_ok=True)
    
    # Gather data
    session = await db_service.get_session(session_id)
    user = await db_service.get_user_profile(user_id)
    errors = await db_service.get_session_errors(session_id)
    turns = await db_service.get_conversation_turns(session_id)
    
    # Create PDF generator
    generator = ProfessionalReportGenerator()
    
    # Generate report
    pdf_path = await generator.generate(
        session=session,
        user=user,
        errors=errors,
        turns=turns
    )
    
    # TODO: Upload to Supabase Storage and get signed URL
    # For now, return local path
    
    processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    
    logger.info(f"PDF report generated in {processing_time}ms: {pdf_path}")
    
    return {
        "session_id": session_id,
        "pdf_path": pdf_path,
        "processing_time_ms": processing_time,
        "generated_at": datetime.utcnow().isoformat()
    }


class ProfessionalReportGenerator:
    """
    Generates professional IELTS-style PDF reports.
    
    Report structure:
    1. Cover page
    2. Overall snapshot
    3. Score breakdown with charts
    4. Error analysis by category
    5. Detailed corrections
    6. Recommendations
    7. 7-day training plan
    8. Appendix: Transcript
    """
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
        # Brand colors
        self.primary_color = colors.HexColor("#1a365d")
        self.secondary_color = colors.HexColor("#2563eb")
        self.success_color = colors.HexColor("#38a169")
        self.warning_color = colors.HexColor("#d69e2e")
        self.error_color = colors.HexColor("#e53e3e")
    
    def _setup_custom_styles(self):
        """Setup professional styles."""
        
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Title'],
            fontSize=28,
            spaceAfter=20,
            textColor=colors.HexColor('#1a365d'),
            alignment=1
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceBefore=25,
            spaceAfter=12,
            textColor=colors.HexColor('#1a365d'),
            borderWidth=0,
            borderPadding=0,
            borderColor=colors.HexColor('#2563eb'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='SubSection',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=15,
            spaceAfter=8,
            textColor=colors.HexColor('#2c5282'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='BodyText',
            parent=self.styles['Normal'],
            fontSize=11,
            leading=16,
            textColor=colors.HexColor('#2d3748'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='ErrorOriginal',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#c53030'),
            leftIndent=15,
            bulletIndent=5,
        ))
        
        self.styles.add(ParagraphStyle(
            name='ErrorCorrected',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#276749'),
            leftIndent=15,
            bulletIndent=5,
        ))
        
        self.styles.add(ParagraphStyle(
            name='Explanation',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#718096'),
            leftIndent=15,
            fontName='Helvetica-Oblique',
        ))
        
        self.styles.add(ParagraphStyle(
            name='Highlight',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#2563eb'),
            fontName='Helvetica-Bold',
        ))
    
    async def generate(
        self,
        session: Dict,
        user: Dict,
        errors: List[Dict],
        turns: List[Dict]
    ) -> str:
        """Generate the full report."""
        
        session_id = session["id"]
        pdf_path = f"reports/report_{session_id}.pdf"
        
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=50,
            leftMargin=50,
            topMargin=50,
            bottomMargin=50
        )
        
        story = []
        
        # 1. Cover Page
        story.extend(self._create_cover_page(session, user))
        story.append(PageBreak())
        
        # 2. Overall Snapshot
        story.extend(self._create_snapshot_section(session, errors))
        
        # 3. Score Breakdown
        scores = session.get("overall_scores", {})
        if scores:
            story.extend(self._create_scores_section(scores))
        
        # 4. Error Analysis
        story.append(PageBreak())
        story.extend(self._create_error_analysis_section(errors))
        
        # 5. Detailed Corrections (top 10)
        story.extend(self._create_corrections_section(errors[:10]))
        
        # 6. Recommendations
        story.append(PageBreak())
        story.extend(self._create_recommendations_section(errors, scores, user))
        
        # 7. Training Plan
        story.extend(self._create_training_plan_section(errors))
        
        # 8. Appendix: Transcript
        if turns:
            story.append(PageBreak())
            story.extend(self._create_transcript_section(turns))
        
        # Build PDF
        doc.build(story)
        
        return pdf_path
    
    def _create_cover_page(self, session: Dict, user: Dict) -> List:
        """Create professional cover page."""
        elements = []
        
        # Logo placeholder
        elements.append(Spacer(1, 60))
        
        # Title
        elements.append(Paragraph("SpeakMate AI", self.styles['ReportTitle']))
        elements.append(Paragraph("Speaking Practice Report", self.styles['SubSection']))
        
        elements.append(Spacer(1, 40))
        
        # User info box
        user_name = user.get("full_name", "Student")
        date_str = datetime.now().strftime("%B %d, %Y")
        mode = session.get("mode", "free_speaking").replace("_", " ").title()
        topic = session.get("topic", "General Practice")
        duration = session.get("duration_seconds", 0) // 60
        
        info_data = [
            ["Student", user_name],
            ["Date", date_str],
            ["Mode", mode],
            ["Topic", topic],
            ["Duration", f"{duration} minutes"],
        ]
        
        info_table = Table(info_data, colWidths=[120, 280])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('TEXTCOLOR', (0, 0), (0, -1), self.primary_color),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#4a5568')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
        ]))
        
        elements.append(info_table)
        
        # Overall score highlight
        scores = session.get("overall_scores", {})
        if scores.get("overall_band"):
            elements.append(Spacer(1, 50))
            overall = scores["overall_band"]
            
            elements.append(Paragraph(
                f"Overall Band Score: <b>{overall}</b>",
                ParagraphStyle(
                    'BandHighlight',
                    parent=self.styles['Heading1'],
                    fontSize=24,
                    textColor=self._get_band_color(overall),
                    alignment=1
                )
            ))
        
        return elements
    
    def _create_snapshot_section(self, session: Dict, errors: List) -> List:
        """Create quick snapshot section."""
        elements = []
        
        elements.append(Paragraph("Session Overview", self.styles['SectionHeader']))
        
        # Stats grid
        duration = session.get("duration_seconds", 0)
        scores = session.get("overall_scores", {})
        
        stats_data = [
            ["Total Errors", str(len(errors))],
            ["Speaking Time", f"{duration // 60}m {duration % 60}s"],
            ["Turn Count", str(session.get("turn_count", 0))],
        ]
        
        stats_table = Table(stats_data, colWidths=[150, 100])
        stats_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#718096')),
            ('TEXTCOLOR', (1, 0), (1, -1), self.primary_color),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(stats_table)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def _create_scores_section(self, scores: Dict) -> List:
        """Create score breakdown section with table."""
        elements = []
        
        elements.append(Paragraph("IELTS Score Breakdown", self.styles['SectionHeader']))
        
        # Score table
        score_data = [
            ["Criterion", "Score", "Level"],
            ["Fluency & Coherence", str(scores.get("fluency_coherence", "-")), 
             self._get_level_label(scores.get("fluency_coherence", 0))],
            ["Lexical Resource", str(scores.get("lexical_resource", "-")),
             self._get_level_label(scores.get("lexical_resource", 0))],
            ["Grammatical Range", str(scores.get("grammatical_range", "-")),
             self._get_level_label(scores.get("grammatical_range", 0))],
            ["Pronunciation", str(scores.get("pronunciation", "-")),
             self._get_level_label(scores.get("pronunciation", 0))],
        ]
        
        score_table = Table(score_data, colWidths=[200, 80, 120])
        score_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.primary_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWHEIGHTS', (0, 0), (-1, -1), 30),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        elements.append(score_table)
        elements.append(Spacer(1, 20))
        
        return elements
    
    def _create_error_analysis_section(self, errors: List) -> List:
        """Create error analysis by category."""
        elements = []
        
        elements.append(Paragraph("Error Analysis", self.styles['SectionHeader']))
        
        # Group errors by category
        categories = {}
        for error in errors:
            cat = error.get("category", "other")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(error)
        
        elements.append(Paragraph(
            f"Total Errors Detected: {len(errors)}",
            self.styles['BodyText']
        ))
        elements.append(Spacer(1, 10))
        
        # Category breakdown
        for category, cat_errors in sorted(categories.items(), key=lambda x: len(x[1]), reverse=True):
            percentage = (len(cat_errors) / len(errors) * 100) if errors else 0
            
            elements.append(Paragraph(
                f"<b>{category.title()}</b>: {len(cat_errors)} errors ({percentage:.0f}%)",
                self.styles['SubSection']
            ))
            
            # Top issues in category
            subcats = {}
            for e in cat_errors:
                subcat = e.get("subcategory", "general")
                subcats[subcat] = subcats.get(subcat, 0) + 1
            
            for subcat, count in sorted(subcats.items(), key=lambda x: x[1], reverse=True)[:3]:
                elements.append(Paragraph(
                    f"• {subcat}: {count} occurrences",
                    self.styles['BodyText']
                ))
            
            elements.append(Spacer(1, 10))
        
        return elements
    
    def _create_corrections_section(self, errors: List) -> List:
        """Create detailed corrections section."""
        elements = []
        
        elements.append(Paragraph("Key Corrections", self.styles['SectionHeader']))
        
        for i, error in enumerate(errors, 1):
            # Keep error block together
            error_block = []
            
            error_block.append(Paragraph(
                f"<b>Error {i}:</b> {error.get('subcategory', 'general')} ({error.get('category', '')})",
                self.styles['BodyText']
            ))
            
            error_block.append(Paragraph(
                f"✗ {error.get('original_text', '')}",
                self.styles['ErrorOriginal']
            ))
            
            error_block.append(Paragraph(
                f"✓ {error.get('corrected_text', '')}",
                self.styles['ErrorCorrected']
            ))
            
            if error.get('explanation'):
                error_block.append(Paragraph(
                    f"💡 {error.get('explanation')}",
                    self.styles['Explanation']
                ))
            
            error_block.append(Spacer(1, 10))
            
            elements.append(KeepTogether(error_block))
        
        return elements
    
    def _create_recommendations_section(self, errors: List, scores: Dict, user: Dict) -> List:
        """Create personalized recommendations."""
        elements = []
        
        elements.append(Paragraph("Recommendations", self.styles['SectionHeader']))
        
        recommendations = self._generate_recommendations(errors, scores, user)
        
        for i, rec in enumerate(recommendations, 1):
            elements.append(Paragraph(
                f"<b>{i}.</b> {rec}",
                self.styles['BodyText']
            ))
            elements.append(Spacer(1, 8))
        
        return elements
    
    def _create_training_plan_section(self, errors: List) -> List:
        """Create 7-day training plan."""
        elements = []
        
        elements.append(Paragraph("7-Day Training Plan", self.styles['SectionHeader']))
        
        elements.append(Paragraph(
            "Based on your errors, here's a focused practice plan:",
            self.styles['BodyText']
        ))
        elements.append(Spacer(1, 10))
        
        # Group by category and create daily focus
        categories = {}
        for e in errors:
            cat = e.get("category", "other")
            categories[cat] = categories.get(cat, 0) + 1
        
        sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)
        
        days = [
            ("Day 1-2", "Focus on " + (sorted_cats[0][0] if sorted_cats else "grammar")),
            ("Day 3-4", "Focus on " + (sorted_cats[1][0] if len(sorted_cats) > 1 else "vocabulary")),
            ("Day 5-6", "Mixed practice session"),
            ("Day 7", "Full practice conversation"),
        ]
        
        for day, activity in days:
            elements.append(Paragraph(
                f"<b>{day}:</b> {activity}",
                self.styles['BodyText']
            ))
        
        elements.append(Spacer(1, 15))
        elements.append(Paragraph(
            "Tip: Practice for at least 15-20 minutes each day for best results.",
            self.styles['Explanation']
        ))
        
        return elements
    
    def _create_transcript_section(self, turns: List) -> List:
        """Create transcript appendix."""
        elements = []
        
        elements.append(Paragraph("Appendix: Session Transcript", self.styles['SectionHeader']))
        
        for turn in turns:
            role = turn.get("role", "user").title()
            content = turn.get("content", "")
            
            if role == "User":
                style = ParagraphStyle(
                    'UserTurn',
                    parent=self.styles['BodyText'],
                    textColor=self.secondary_color
                )
            else:
                style = ParagraphStyle(
                    'AITurn',
                    parent=self.styles['BodyText'],
                    textColor=colors.HexColor('#718096'),
                    fontName='Helvetica-Oblique'
                )
            
            elements.append(Paragraph(f"<b>{role}:</b> {content}", style))
            elements.append(Spacer(1, 5))
        
        return elements
    
    def _get_band_color(self, band: float) -> colors.Color:
        """Get color for band score."""
        if band >= 8:
            return self.success_color
        elif band >= 7:
            return colors.HexColor("#3182ce")
        elif band >= 6:
            return self.warning_color
        else:
            return self.error_color
    
    def _get_level_label(self, score: float) -> str:
        """Get level label for score."""
        if score >= 8:
            return "Expert"
        elif score >= 7:
            return "Good"
        elif score >= 6:
            return "Competent"
        elif score >= 5:
            return "Modest"
        elif score >= 4:
            return "Limited"
        else:
            return "Needs Work"
    
    def _generate_recommendations(self, errors: List, scores: Dict, user: Dict) -> List[str]:
        """Generate personalized recommendations."""
        recommendations = []
        
        target = user.get("target_band", 7.0)
        current = scores.get("overall_band", 5.5)
        
        if current < target:
            recommendations.append(
                f"To reach Band {target}, focus on consistency and reducing errors."
            )
        
        # Category-based
        categories = {}
        for e in errors:
            cat = e.get("category")
            categories[cat] = categories.get(cat, 0) + 1
        
        if categories.get("grammar", 0) > 3:
            recommendations.append(
                "Grammar: Review article usage (a/an/the) and verb tenses."
            )
        
        if categories.get("fluency", 0) > 2:
            recommendations.append(
                "Fluency: Practice speaking without filler words. Pause briefly instead."
            )
        
        if categories.get("vocabulary", 0) > 2:
            recommendations.append(
                "Vocabulary: Learn topic-specific words and use synonyms."
            )
        
        if categories.get("pronunciation", 0) > 2:
            recommendations.append(
                "Pronunciation: Practice word stress and connected speech."
            )
        
        recommendations.append(
            "Daily Practice: Speak English for at least 15 minutes every day."
        )
        
        return recommendations[:5]
