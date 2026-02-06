"""
SpeakMate AI - PDF Report Generator
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, ListFlowable, ListItem
)
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.graphics.charts.barcharts import VerticalBarChart
from datetime import datetime
from typing import List, Optional
import os
import io


class PDFGenerator:
    """Generate PDF reports for speaking sessions."""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
        # Ensure reports directory exists
        os.makedirs("reports", exist_ok=True)
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles."""
        # Use CustomTitle to avoid conflict with built-in Title
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#1a365d'),
            alignment=1  # Center
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor('#2c5282'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='SubSection',
            parent=self.styles['Heading3'],
            fontSize=12,
            spaceBefore=15,
            spaceAfter=8,
            textColor=colors.HexColor('#4a5568'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='ErrorOriginal',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#c53030'),
            leftIndent=20,
        ))
        
        self.styles.add(ParagraphStyle(
            name='ErrorCorrect',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#276749'),
            leftIndent=20,
        ))
        
        self.styles.add(ParagraphStyle(
            name='Explanation',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#718096'),
            leftIndent=20,
            spaceBefore=5,
        ))
    
    async def generate_session_report(self, report_data: dict) -> str:
        """
        Generate PDF report for a session.
        
        Args:
            report_data: dict containing session, user, errors, conversation
        
        Returns:
            Path to generated PDF
        """
        session = report_data.get("session", {})
        user = report_data.get("user", {})
        errors = report_data.get("errors", [])
        conversation = report_data.get("conversation", [])
        include_details = report_data.get("include_details", True)
        
        session_id = session.get("id", "unknown")
        pdf_path = f"reports/{session_id}.pdf"
        
        # Create document
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Build content
        story = []
        
        # Title
        story.append(Paragraph("SpeakMate AI", self.styles['CustomTitle']))
        story.append(Paragraph("Personal Speaking Report", self.styles['Heading2']))
        story.append(Spacer(1, 20))
        
        # User info and date
        user_name = user.get("full_name", "Student")
        date_str = datetime.now().strftime("%B %d, %Y")
        story.append(Paragraph(f"<b>Student:</b> {user_name}", self.styles['Normal']))
        story.append(Paragraph(f"<b>Date:</b> {date_str}", self.styles['Normal']))
        story.append(Paragraph(f"<b>Session Mode:</b> {session.get('mode', 'Free Speaking')}", self.styles['Normal']))
        story.append(Paragraph(f"<b>Topic:</b> {session.get('topic', 'General')}", self.styles['Normal']))
        story.append(Paragraph(f"<b>Duration:</b> {session.get('duration_seconds', 0) // 60} minutes", self.styles['Normal']))
        story.append(Spacer(1, 30))
        
        # Scores section
        scores = session.get("overall_scores", {})
        if scores:
            story.append(Paragraph("Overall Scores", self.styles['SectionHeader']))
            story.extend(self._create_scores_section(scores))
            story.append(Spacer(1, 20))
        
        # Error Summary
        story.append(Paragraph("Error Analysis", self.styles['SectionHeader']))
        story.extend(self._create_error_summary(errors))
        story.append(Spacer(1, 20))
        
        # Detailed Errors
        if include_details and errors:
            story.append(PageBreak())
            story.append(Paragraph("Detailed Error Report", self.styles['SectionHeader']))
            story.extend(self._create_detailed_errors(errors))
        
        # Recommendations
        story.append(Paragraph("Recommendations", self.styles['SectionHeader']))
        story.extend(self._create_recommendations(errors, scores))
        
        # Footer
        story.append(Spacer(1, 40))
        story.append(Paragraph(
            "Generated by SpeakMate AI - Your Personal IELTS Speaking Coach",
            self.styles['Italic']
        ))
        
        # Build PDF
        doc.build(story)
        
        return pdf_path
    
    def _create_scores_section(self, scores: dict) -> list:
        """Create scores display section."""
        elements = []
        
        # Overall band highlight
        overall = scores.get("overall_band", 0)
        elements.append(Paragraph(
            f"<b>Overall Band Score: {overall}</b>",
            self.styles['Heading3']
        ))
        elements.append(Spacer(1, 15))
        
        # Score breakdown table
        score_data = [
            ["Criterion", "Score", "Band"],
            ["Fluency & Coherence", str(scores.get("fluency_coherence", "-")), self._get_band_label(scores.get("fluency_coherence", 0))],
            ["Lexical Resource", str(scores.get("lexical_resource", "-")), self._get_band_label(scores.get("lexical_resource", 0))],
            ["Grammar", str(scores.get("grammatical_range", "-")), self._get_band_label(scores.get("grammatical_range", 0))],
            ["Pronunciation", str(scores.get("pronunciation", "-")), self._get_band_label(scores.get("pronunciation", 0))],
        ]
        
        table = Table(score_data, colWidths=[200, 80, 120])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f7fafc')),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#2d3748')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWHEIGHTS', (0, 0), (-1, -1), 30),
        ]))
        
        elements.append(table)
        return elements
    
    def _get_band_label(self, score: float) -> str:
        """Get descriptive label for band score."""
        if score >= 8:
            return "Excellent"
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
    
    def _create_error_summary(self, errors: list) -> list:
        """Create error summary section."""
        elements = []
        
        # Count errors by category
        categories = {}
        for error in errors:
            cat = error.get("category", "other")
            categories[cat] = categories.get(cat, 0) + 1
        
        total_errors = len(errors)
        elements.append(Paragraph(
            f"<b>Total Errors Detected:</b> {total_errors}",
            self.styles['Normal']
        ))
        elements.append(Spacer(1, 10))
        
        if categories:
            # Category breakdown
            elements.append(Paragraph("Errors by Category:", self.styles['SubSection']))
            
            for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_errors * 100) if total_errors > 0 else 0
                elements.append(Paragraph(
                    f"• {category.title()}: {count} ({percentage:.0f}%)",
                    self.styles['Normal']
                ))
        
        return elements
    
    def _create_detailed_errors(self, errors: list) -> list:
        """Create detailed error listing."""
        elements = []
        
        # Group by category
        by_category = {}
        for error in errors:
            cat = error.get("category", "other")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(error)
        
        for category, cat_errors in by_category.items():
            elements.append(Paragraph(
                f"{category.title()} Errors ({len(cat_errors)})",
                self.styles['SubSection']
            ))
            
            for i, error in enumerate(cat_errors[:10], 1):  # Limit to 10 per category
                # Error number
                elements.append(Paragraph(
                    f"<b>Error {i}:</b> {error.get('subcategory', 'general')}",
                    self.styles['Normal']
                ))
                
                # Original text
                original = error.get("original_text", "")
                if original:
                    elements.append(Paragraph(
                        f"❌ {original}",
                        self.styles['ErrorOriginal']
                    ))
                
                # Corrected text
                corrected = error.get("corrected_text", "")
                if corrected:
                    elements.append(Paragraph(
                        f"✓ {corrected}",
                        self.styles['ErrorCorrect']
                    ))
                
                # Explanation
                explanation = error.get("explanation", "")
                if explanation:
                    elements.append(Paragraph(
                        f"💡 {explanation}",
                        self.styles['Explanation']
                    ))
                
                elements.append(Spacer(1, 10))
            
            if len(cat_errors) > 10:
                elements.append(Paragraph(
                    f"... and {len(cat_errors) - 10} more {category} errors",
                    self.styles['Italic']
                ))
            
            elements.append(Spacer(1, 15))
        
        return elements
    
    def _create_recommendations(self, errors: list, scores: dict) -> list:
        """Create personalized recommendations."""
        elements = []
        
        recommendations = []
        
        # Score-based recommendations
        overall = scores.get("overall_band", 5)
        
        if overall < 5.5:
            recommendations.append(
                "Focus on building basic fluency. Practice speaking for longer periods without stopping."
            )
            recommendations.append(
                "Learn common phrases and expressions for everyday topics."
            )
        elif overall < 6.5:
            recommendations.append(
                "Work on extending your answers with examples and explanations."
            )
            recommendations.append(
                "Practice using a wider range of vocabulary and grammar structures."
            )
        elif overall < 7.5:
            recommendations.append(
                "Focus on accuracy while maintaining fluency."
            )
            recommendations.append(
                "Challenge yourself with more complex topics and abstract discussions."
            )
        else:
            recommendations.append(
                "Excellent progress! Focus on consistency and natural expression."
            )
            recommendations.append(
                "Practice with authentic IELTS materials under timed conditions."
            )
        
        # Error-based recommendations
        categories = {}
        for error in errors:
            cat = error.get("category", "other")
            categories[cat] = categories.get(cat, 0) + 1
        
        if categories:
            max_cat = max(categories.items(), key=lambda x: x[1])
            recommendations.append(
                f"Priority Area: {max_cat[0].title()} - This was your most frequent error type. "
                f"Dedicate extra practice time to improving this area."
            )
        
        # Build recommendation list
        for i, rec in enumerate(recommendations, 1):
            elements.append(Paragraph(
                f"<b>{i}.</b> {rec}",
                self.styles['Normal']
            ))
            elements.append(Spacer(1, 8))
        
        # Motivational message
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(
            "<i>Remember: Consistent practice is the key to improvement. "
            "Even 15-20 minutes of daily speaking practice can make a significant difference!</i>",
            self.styles['Italic']
        ))
        
        return elements
    
    async def generate_error_book(
        self,
        user_id: str,
        error_profile: list,
        recent_errors: list
    ) -> str:
        """
        Generate Personal Error Book PDF.
        
        Args:
            user_id: User's ID
            error_profile: Aggregated error profile
            recent_errors: Recent session errors
        
        Returns:
            Path to generated PDF
        """
        pdf_path = f"reports/error_book_{user_id}.pdf"
        
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        story = []
        
        # Title
        story.append(Paragraph("Personal Error Book", self.styles['CustomTitle']))
        story.append(Paragraph(
            "Your guide to common mistakes and how to fix them",
            self.styles['Heading3']
        ))
        story.append(Spacer(1, 30))
        
        # Group errors by category
        for category in ["grammar", "vocabulary", "pronunciation", "fluency"]:
            cat_errors = [e for e in error_profile if e.get("category") == category]
            
            if cat_errors:
                story.append(Paragraph(
                    f"{category.title()} Issues",
                    self.styles['SectionHeader']
                ))
                
                for error in sorted(cat_errors, key=lambda x: x.get("occurrence_count", 0), reverse=True)[:5]:
                    story.append(Paragraph(
                        f"<b>{error.get('subcategory', 'General')}</b> "
                        f"(occurred {error.get('occurrence_count', 0)} times)",
                        self.styles['Normal']
                    ))
                    story.append(Spacer(1, 5))
                
                story.append(Spacer(1, 15))
        
        # Build PDF
        doc.build(story)
        
        return pdf_path


# Global instance
pdf_generator = PDFGenerator()
