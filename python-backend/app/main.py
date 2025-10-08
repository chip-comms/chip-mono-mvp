"""
FastAPI application for video processing.

This service handles CPU/GPU intensive video operations that are better
suited for Python than Node.js.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes import health, video, audio

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources."""
    # Startup: Create necessary directories
    storage_dir = Path(os.getenv("UPLOAD_DIR", "./storage/uploads"))
    temp_dir = Path(os.getenv("TEMP_DIR", "./storage/temp"))
    storage_dir.mkdir(parents=True, exist_ok=True)
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    print("🚀 Python backend started")
    print(f"📁 Storage: {storage_dir.absolute()}")
    print(f"📁 Temp: {temp_dir.absolute()}")
    
    yield
    
    # Shutdown: Cleanup if needed
    print("👋 Python backend shutting down")


app = FastAPI(
    title="Meeting Intelligence - Video Processing API",
    description="Python backend for video processing operations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
from app.config import settings
cors_origins_list = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(video.router, prefix="/api/video", tags=["video"])
app.include_router(audio.router, prefix="/api/audio", tags=["audio"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Meeting Intelligence - Video Processing",
        "status": "running",
        "docs": "/docs",
    }

