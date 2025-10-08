"""Configuration settings."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Application settings."""
    
    # Server
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    
    # Storage
    upload_dir: Path = Path(os.getenv("UPLOAD_DIR", "./storage/uploads"))
    temp_dir: Path = Path(os.getenv("TEMP_DIR", "./storage/temp"))
    
    # Limits
    max_file_size: int = int(os.getenv("MAX_FILE_SIZE", "500"))  # MB
    
    # CORS
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:3000"
    ).split(",")
    
    # AI Provider Configuration
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Preferred AI provider (auto, openai, gemini, anthropic)
    ai_provider: Literal["auto", "openai", "gemini", "anthropic"] = os.getenv(
        "AI_PROVIDER", 
        "auto"
    )
    
    class Config:
        env_file = ".env.local"  # Load from .env.local (falls back to .env)
    
    def validate_ai_config(self) -> dict:
        """Validate AI configuration."""
        errors = []
        
        if not self.openai_api_key and not self.gemini_api_key and not self.anthropic_api_key:
            errors.append(
                "At least one AI provider API key is required "
                "(OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY)"
            )
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "available_providers": [
                name for name, key in [
                    ("OpenAI", self.openai_api_key),
                    ("Gemini", self.gemini_api_key),
                    ("Anthropic", self.anthropic_api_key),
                ]
                if key
            ]
        }


settings = Settings()

