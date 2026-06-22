#!/bin/bash
# run_summary.sh — Run the browser history summarizer on your Mac.
# This script is called by the macOS LaunchAgent (or manually).
#
# Z_API_KEY must be set in the environment (e.g. via launchd EnvironmentVariables or ~/.zshrc)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install openai Python package if needed (ZhiPu uses OpenAI-compatible API)
python3 -c "import openai" 2>/dev/null || pip3 install openai --break-system-packages --quiet

# Ensure the capture server is running (starts it silently if not)
if ! curl -sf http://localhost:7823/health > /dev/null 2>&1; then
    echo "Starting capture server..."
    nohup python3 "$SCRIPT_DIR/capture_server.py" > "$SCRIPT_DIR/capture_server.log" 2>&1 &
    sleep 1  # give it a moment to start
fi

# Run the summarizer and save output
python3 "$SCRIPT_DIR/summarize.py" --save --output-dir "$SCRIPT_DIR/summaries"
