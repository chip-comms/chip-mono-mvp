"""
Supabase client for Python backend to interact with the database and storage.
"""

import httpx
import os
from typing import Dict, Any, Optional


class SupabaseClient:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.service_key = os.getenv("SUPABASE_SECRET_KEY")

        if not self.url or not self.service_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment")
        
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json"
        }
    
    async def download_file(self, file_path: str) -> bytes:
        """Download file from Supabase Storage"""
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.get(
                f"{self.url}/storage/v1/object/meeting-recordings/{file_path}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.content
    
    async def update_job_status(self, job_id: str, status: str, error: Optional[str] = None):
        """Update processing job status"""
        data = {"status": status, "updated_at": "now()"}
        if error:
            data["processing_error"] = error
            
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.url}/rest/v1/processing_jobs?id=eq.{job_id}",
                json=data,
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
    
    async def save_analysis_results(self, job_id: str, results: Dict[str, Any]):
        """Save analysis results to Supabase"""
        data = {
            "job_id": job_id,
            **results
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.url}/rest/v1/meeting_analysis",
                json=data,
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
    
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get job status and details"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.url}/rest/v1/processing_jobs?id=eq.{job_id}",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
            return data[0] if data else None