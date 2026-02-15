from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import time
import json
import os

app = Flask(__name__)
# Enable CORS for the frontend development server
CORS(app)

# Use the API key from environment variable or hardcoded for now (matching APP_CONFIG)
API_KEY = "AIzaSyCNXiqET26-cMRpoM9vttl13SfiA4ifQu4"
client = genai.Client(api_key=API_KEY)

@app.route('/research', methods=['POST'])
def perform_research():
    data = request.json
    query = data.get('query')
    schema_hint = data.get('schema_hint', "")
    
    if not query:
        return jsonify({"error": "No query provided"}), 400

    # Combine query with schema instruction if provided
    # Using a more forceful template for deep research agents
    prompt_template = f"""
Query: {query}

CRITICAL INSTRUCTION:
You are a research agent. You MUST perform deep research and then summarize your findings into a single JSON object.
The JSON object MUST follow this schema strictly:
{schema_hint}

Place all your research, analysis, and grounding data inside the "content" field as a Markdown-formatted string.
DO NOT return any text outside of the JSON block.
"""
    full_input = prompt_template if schema_hint else query

    try:
        # 1. Start the Deep Research Session
        interaction = client.interactions.create(
            agent="deep-research-pro-preview-12-2025",
            input=full_input,
            background=True,
            agent_config={'type': 'deep-research'}
        )
        
        interaction_name = interaction.id
        print(f"Started research session: {interaction_name}")
        
        # 2. Poll for the result
        max_attempts = 120 # 120 * 10s = 20 minutes for Deep Research
        attempts = 0
        
        while attempts < max_attempts:
            status_check = client.interactions.get(id=interaction_name)
            print(f"Polling {interaction_name}: {status_check.status}")
            
            if status_check.status == "completed":
                # Deep Research might have multiple outputs; we want the final synthesis
                # Search backwards for the first valid JSON we can find
                for output in reversed(status_check.outputs):
                    if not hasattr(output, 'text') or not output.text:
                        continue
                        
                    text = output.text
                    
                    # Extraction logic
                    json_str = None
                    if "```json" in text:
                        json_str = text.split("```json")[1].split("```")[0].strip()
                    elif "{" in text and "}" in text:
                        # Find the first { and last }
                        start = text.find("{")
                        end = text.rfind("}")
                        if start != -1 and end != -1:
                            json_str = text[start:end+1]
                    
                    if json_str:
                        try:
                            parsed = json.loads(json_str)
                            # Ensure it has the required field if schema_hint was provided
                            if not schema_hint or "content" in parsed:
                                return jsonify({"data": parsed, "status": "success"})
                        except:
                            continue
                
                # If no JSON found in any output, return the last text as-is
                last_text = status_check.outputs[-1].text if status_check.outputs else "No output"
                return jsonify({"data": {"content": last_text}, "status": "fallback_text"})
                    
            elif status_check.status in ["failed", "cancelled"]:
                return jsonify({"error": f"Research {status_check.status}"}), 500
            
            time.sleep(10)
            attempts += 1
            
        return jsonify({"error": "Timed out waiting for research"}), 504
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Running on a different port than Vite
    # threaded=True allows parallel requests to not block each other
    app.run(port=5001, threaded=True)
