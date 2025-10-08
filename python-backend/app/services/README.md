# Analysis Services

This directory contains all the analysis services for meeting intelligence processing.

## 📁 Structure

```
services/
├── llm/                    # ✅ LLM providers
│   ├── llm_adapter.py      # ✅ Auto provider selection
│   └── providers/
│       ├── base.py         # ✅ Base interface
│       ├── gemini.py       # ✅ Google Gemini
│       └── openai.py       # ✅ OpenAI GPT-4
├── audio/                  # Audio processing
│   ├── transcription.py    # 🚧 WhisperX transcription
│   ├── diarization.py      # 📋 Speaker identification
│   ├── prosody.py          # 📋 Pitch, pace, energy
│   └── voice_metrics.py    # 📋 Pauses, fillers
├── video/                  # Video processing
│   ├── face_detection.py   # 📋 Face detection
│   └── eye_tracking.py     # 📋 Gaze estimation
└── analysis/               # High-level metrics
    ├── primary_metrics.py  # 📋 Direct measurements
    └── secondary_metrics.py # 📋 Derived insights
```

## 🎯 Status Legend

- ✅ **Implemented** - Working in production
- 🚧 **In Progress** - Actively being developed
- 📋 **Backlog** - Planned for future

## 🔄 Service Dependencies

### Audio Services

**transcription.py** (🚧 In Progress)
- **Purpose**: Speech-to-text with timestamps
- **Technology**: WhisperX
- **Dependencies**: None (foundational)
- **Enables**: All text-based analysis

**diarization.py** (📋 Backlog)
- **Purpose**: Identify who spoke when
- **Technology**: pyannote.audio
- **Dependencies**: transcription (optional)
- **Enables**: Talk ratio, response latency, interruptions

**prosody.py** (📋 Backlog)
- **Purpose**: Vocal characteristics
- **Technology**: librosa, praat-parselmouth
- **Dependencies**: None
- **Enables**: Speech pace, vocal energy, confidence metrics

**voice_metrics.py** (📋 Backlog)
- **Purpose**: Speech patterns
- **Technology**: VAD, pattern matching
- **Dependencies**: transcription
- **Enables**: Filler detection, pause analysis, clarity score

### Video Services

**face_detection.py** (📋 Backlog)
- **Purpose**: Detect faces and landmarks
- **Technology**: OpenCV, MediaPipe
- **Dependencies**: None (foundational)
- **Enables**: Eye tracking, head pose

**eye_tracking.py** (📋 Backlog)
- **Purpose**: Gaze and attention
- **Technology**: MediaPipe Face Mesh
- **Dependencies**: face_detection
- **Enables**: Eye contact metrics, attention score

### Analysis Services

**primary_metrics.py** (📋 Backlog)
- **Purpose**: Calculate direct measurements
- **Dependencies**: Audio + Video services
- **Outputs**:
  - Talk Ratio
  - Response Latency
  - Speech Pace
  - Filler Words
  - Vocal Energy/Pitch
  - Eye Contact
  - Interruptions

**secondary_metrics.py** (📋 Backlog)
- **Purpose**: High-level insights
- **Dependencies**: primary_metrics + LLM
- **Outputs**:
  - Clarity Score ✅ (currently Node.js + GPT-4)
  - Empathy Index
  - Confidence Index
  - Collaboration Ratio
  - Engagement Index
  - Influence Score

## 🚀 Implementation Order

### Phase 1: Foundation (Current)
1. ✅ Basic infrastructure (FastAPI, routes)
2. 🚧 **Transcription** (WhisperX)

### Phase 2: Core Audio (Next)
3. 📋 Speaker Diarization
4. 📋 Voice Metrics (fillers, pauses)
5. 📋 Primary Metrics (talk ratio, fillers)

### Phase 3: Advanced Audio
6. 📋 Prosody Analysis
7. 📋 Primary Metrics (pace, energy, latency, interruptions)

### Phase 4: Video Processing
8. 📋 Face Detection
9. 📋 Eye Tracking
10. 📋 Primary Metrics (eye contact)

### Phase 5: Secondary Insights
11. 📋 All secondary metrics
12. 📋 LLM integration
13. 📋 Recommendations engine

## 💡 Usage Examples

### Current (Transcription - In Progress)

```python
from app.services.audio import TranscriptionService

service = TranscriptionService(model_size="small", device="cpu")
result = service.transcribe("meeting.wav", language="en")

print(result["text"])
for segment in result["segments"]:
    print(f"[{segment['start']:.2f}s]: {segment['text']}")
```

### Future (Full Pipeline)

```python
from app.services.audio import (
    TranscriptionService,
    DiarizationService,
    ProsodyService,
    VoiceMetricsService
)
from app.services.video import FaceDetectionService, EyeTrackingService
from app.services.analysis import PrimaryMetricsService, SecondaryMetricsService

# Step 1: Audio processing
transcription = TranscriptionService().transcribe("meeting.wav")
diarization = DiarizationService().diarize("meeting.wav")
prosody = ProsodyService().analyze_all("meeting.wav")
voice_metrics = VoiceMetricsService().detect_fillers(transcription["segments"])

# Step 2: Video processing (if available)
faces = FaceDetectionService().detect_faces_in_video("meeting.mp4")
eye_tracking = EyeTrackingService().detect_eye_contact("meeting.mp4")

# Step 3: Primary metrics
primary = PrimaryMetricsService()
metrics = {
    "talk_ratio": primary.calculate_talk_ratio(diarization, duration),
    "speech_pace": primary.calculate_speech_pace(prosody, transcription),
    "fillers": primary.calculate_filler_metrics(voice_metrics),
    "eye_contact": primary.calculate_eye_contact(eye_tracking),
    # ... more metrics
}

# Step 4: Secondary insights
secondary = SecondaryMetricsService()
insights = {
    "clarity": secondary.calculate_clarity_score(metrics["speech_pace"], metrics["fillers"]),
    "confidence": secondary.calculate_confidence_index(prosody, metrics["fillers"]),
    "engagement": secondary.calculate_engagement_index(metrics),
    # ... more insights
}
```

## 🔧 Adding a New Service

1. **Create the service file** in appropriate directory
2. **Define the service class** with clear docstrings
3. **Add to `__init__.py`** for easy imports
4. **Update dependencies** in `requirements.txt`
5. **Add tests** (when test infrastructure exists)
6. **Update this README** with status and usage

## 📝 Notes

- All services should be independent and testable
- Use dependency injection where possible
- Handle errors gracefully with logging
- Document TODO items for future implementation
- Each service should be able to run standalone
- Keep performance in mind (use generators for large data)

## 🤝 Contributing

When implementing a service:
1. Follow the existing structure and patterns
2. Add comprehensive docstrings
3. Include usage examples in docstring
4. Log important operations
5. Handle edge cases
6. Test with sample data before integration

