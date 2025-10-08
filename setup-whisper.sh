#!/bin/bash

echo "🎤 Setting up local Whisper transcription..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew not found. Please install Homebrew first:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

# Check if whisper-cpp is already installed
if command -v whisper &> /dev/null; then
    echo "✅ whisper-cpp is already installed!"
    whisper --version
else
    echo "📦 Installing whisper-cpp via Homebrew..."
    brew install whisper-cpp
    
    if command -v whisper &> /dev/null; then
        echo "✅ whisper-cpp installed successfully!"
        whisper --version
    else
        echo "❌ Installation failed. Try manually:"
        echo "   brew install whisper-cpp"
        exit 1
    fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Your transcription options:"
echo "  • 🏠 FREE: Local Whisper (whisper-cpp) - installed ✅"
echo "  • 🤖 PAID: OpenAI Whisper API (~$0.006/minute) - needs API key"
echo ""
echo "The app will automatically use local Whisper if no OpenAI API key is provided."
echo "For OpenAI API, add your key to frontend/.env.local"
echo ""