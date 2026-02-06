"""
SpeakMate AI - Security and Authentication
"""
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional
import base64
import json
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()


def decode_jwt_unverified(token: str) -> dict:
    """
    Decode JWT without verification (development only).
    Manually parses the JWT payload without cryptographic verification.
    """
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid JWT format")
        
        # Decode payload (second part)
        payload_b64 = parts[1]
        # Add padding if needed
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload_json = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_json)
    except Exception as e:
        raise JWTError(f"Failed to decode token: {e}")


async def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Verify Supabase JWT token and return user data.
    
    In development mode (no JWT secret), it decodes without signature verification.
    In production, it verifies with the Supabase JWT secret.
    """
    token = credentials.credentials
    
    try:
        # Determine if we should verify signature
        jwt_secret = settings.SUPABASE_JWT_SECRET
        
        if jwt_secret:
            # Production: Verify signature with JWT secret
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience="authenticated"
            )
        else:
            # Development: Decode without signature verification
            # WARNING: Only for development! Set SUPABASE_JWT_SECRET in production
            logger.warning("JWT verification disabled - set SUPABASE_JWT_SECRET for production")
            payload = decode_jwt_unverified(token)
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no user ID"
            )
        
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "phone": payload.get("phone"),
            "role": payload.get("role", "authenticated")
        }
        
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


async def get_current_user(
    user_data: dict = Depends(verify_supabase_token)
) -> dict:
    """
    Get current authenticated user.
    """
    return user_data


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[dict]:
    """
    Get current user if authenticated, None otherwise.
    """
    if not credentials:
        return None
    
    try:
        return await verify_supabase_token(credentials)
    except HTTPException:
        return None
