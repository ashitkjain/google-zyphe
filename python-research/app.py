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
    full_input = f"{query}\n\nIMPORTANT: Return the final output strictly as a JSON object matching this schema: {schema_hint}" if schema_hint else query

    try:
        # 1. Start the Deep Research Session
        interaction = client.interactions.create(
            agent="deep-research-pro-preview-12-2025",
            input=full_input,
            background=True,
            agent_config={'type': 'deep-research'}
        )
        
        interaction_name = interaction.id
        
        # 2. Poll for the result
        max_attempts = 60 # 60 * 10s = 10 minutes
        attempts = 0
        
        while attempts < max_attempts:
            status_check = client.interactions.get(id=interaction_name)
            
            if status_check.status == "completed":
                final_text = status_check.outputs[-1].text
                # Try to extract JSON if it's wrapped in markdown
                if "```json" in final_text:
                    final_text = final_text.split("```json")[1].split("```")[0].strip()
                elif "```" in final_text:
                    final_text = final_text.split("```")[1].strip()
                
                try:
                    return jsonify({"data": json.loads(final_text), "status": "success"})
                except:
                    return jsonify({"data": final_text, "status": "raw_completion"})
                    
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
