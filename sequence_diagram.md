sequenceDiagram
    actor User
    participant Frontend
    participant Supabase
    participant Python as Python Service
    participant External as External APIs
    
    User->>Frontend: Upload meeting recording
    Frontend->>Frontend: Validate file (size, format)
    
    Frontend->>Supabase: Authenticate user
    Supabase-->>Frontend: Auth token
    
    Frontend->>Supabase: Upload video to Storage
    Supabase-->>Frontend: Return file URL
    
    Frontend->>Supabase: Create analysis job<br/>(user_id, video_url, status: "pending")
    Supabase-->>Frontend: Job ID
    
    Frontend->>User: Show "Processing..." status
    
    Note over Supabase,Python: Supabase triggers processing<br/>(Edge Function or Queue)
    
    Supabase->>Python: POST /analyze-meeting<br/>{videoUrl, jobId, userId}
    
    activate Python
    
    Python->>Supabase: Download video from Storage
    Supabase-->>Python: Video file
    
    Python->>Python: Split audio & video tracks
    
    par Video Analysis
        Python->>Python: Face Detection
        Python->>Python: Eye Tracking
        Python->>Python: Calculate Eye Contact
    and Audio Analysis
        Python->>External: Call Transcription API<br/>(if using external)
        External-->>Python: Transcript with timestamps
        
        Python->>Python: Speaker Diarization
        Python->>Python: Prosody Analysis
        Python->>Python: Voice Metrics
    end
    
    Python->>Python: Calculate Primary Metrics<br/>(Talk Ratio, Latency, etc.)
    
    Python->>External: Send transcript to LLM API
    External-->>Python: LLM analysis results<br/>(sentiment, questions, etc.)
    
    Python->>Python: Calculate Secondary Metrics<br/>(Clarity, Empathy, etc.)
    
    Python->>Supabase: Update job: "completed"<br/>Store metrics for user_id
    
    deactivate Python
    
    Supabase-->>Python: Confirmation
    
    Note over Frontend,Supabase: Frontend polls or realtime subscription
    
    Frontend->>Supabase: Check job status (for this user)
    Supabase-->>Frontend: Job completed
    
    Frontend->>Supabase: Fetch analysis results (user scoped)
    Supabase-->>Frontend: Return all metrics
    
    Frontend->>User: Display analysis dashboard
    
    User->>Frontend: View detailed metrics
    Frontend->>User: Show visualizations & insightss