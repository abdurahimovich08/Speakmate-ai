"""Tests for ConversationService — mode selection, prompt building, greeting."""

import pytest
from app.services.conversation import ConversationService


@pytest.fixture
def service():
    return ConversationService()


@pytest.mark.asyncio
async def test_generate_greeting_free_speaking(service):
    greeting = await service.generate_greeting(
        topic="travel",
        mode="free_speaking",
        user_name="Alex",
    )
    assert isinstance(greeting, str)
    assert len(greeting) > 5


@pytest.mark.asyncio
async def test_generate_greeting_ielts_test(service):
    greeting = await service.generate_greeting(
        topic="part 1 - hometown",
        mode="ielts_test",
        user_name="Student",
    )
    assert isinstance(greeting, str)


@pytest.mark.asyncio
async def test_generate_greeting_training(service):
    greeting = await service.generate_greeting(
        topic="pronunciation drill",
        mode="training",
        user_name="Test",
    )
    assert isinstance(greeting, str)


def test_band_to_cefr():
    assert ConversationService.band_to_cefr(3.0) == "A1"
    assert ConversationService.band_to_cefr(4.0) == "A2"
    assert ConversationService.band_to_cefr(5.0) == "B1"
    assert ConversationService.band_to_cefr(6.5) == "B2"
    assert ConversationService.band_to_cefr(7.5) == "C1"
    assert ConversationService.band_to_cefr(8.5) == "C2"


@pytest.mark.asyncio
async def test_generate_response_returns_string(service):
    response = await service.generate_response(
        user_message="Hello, how are you?",
        conversation_history=[],
        topic="general",
        mode="free_speaking",
        user_level="B1",
        target_band=6.5,
    )
    assert isinstance(response, str)
    assert len(response) > 0
