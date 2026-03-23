from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import time
import json
import os
import re

app = Flask(__name__)
# Enable CORS — in production, restrict to your Firebase hosting domain
CORS(app, origins=["https://zyphe-af0bf.web.app", "https://zyphe-af0bf.firebaseapp.com", "http://localhost:3000"])

# API key from environment variable (set in Cloud Run secrets)
API_KEY = os.environ.get("GEMINI_API_KEY", "")
client = genai.Client(api_key=API_KEY)



def extract_grounding_urls(outputs) -> dict[str, str]:
    """
    Walk all outputs looking for grounding metadata.
    Returns a dict mapping citation_index (1-based str) -> url.

    The deep-research agent usually exposes grounding sources via:
      output.grounding_metadata.grounding_chunks[].web.uri  (or .url)
    and the citation positions via:
      output.grounding_metadata.grounding_supports[].grounding_chunk_indices
    along with inline markers like [N] in the text.

    We collect all unique web URIs in encounter order and assign them
    1-based indices that match the typical [cite: N] numbering.
    """
    url_map: dict[str, str] = {}   # "1" -> "https://..."
    counter = 1

    # Track URIs we've already seen to avoid duplicates
    seen_uris: set[str] = set()

    for output in outputs:
        gm = getattr(output, 'grounding_metadata', None)
        if not gm:
            continue

        chunks = getattr(gm, 'grounding_chunks', None) or []
        for chunk in chunks:
            web = getattr(chunk, 'web', None)
            if not web:
                continue
            uri = getattr(web, 'uri', None) or getattr(web, 'url', None)
            if uri and uri not in seen_uris:
                seen_uris.add(uri)
                url_map[str(counter)] = uri
                counter += 1

    return url_map


def merge_urls_into_citations(parsed: dict, url_map: dict[str, str]) -> dict:
    """
    If the structured_report has a citations array, fill in any missing urls
    from the grounding url_map.  Also create citation entries for any grounding
    URLs that are NOT already in the citations list.
    """
    if not url_map:
        return parsed

    sr = parsed.get('structured_report')
    if not sr:
        parsed['structured_report'] = {}
        sr = parsed['structured_report']

    citations: list[dict] = sr.get('citations') or []

    # Build a lookup of existing citation ids
    existing_ids = {str(c.get('id', '')): c for c in citations}

    # Fill missing URLs from grounding
    for cid, url in url_map.items():
        if cid in existing_ids:
            if not existing_ids[cid].get('url'):
                existing_ids[cid]['url'] = url
        else:
            # Grounding returned a URL the AI didn't list — add it
            existing_ids[cid] = {'id': cid, 'name': f'Source {cid}', 'url': url}

    # Rebuild the citations list sorted by id
    merged = sorted(existing_ids.values(), key=lambda c: int(c.get('id', 0)) if str(c.get('id', '')).isdigit() else 0)
    sr['citations'] = merged
    return parsed


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
For every factual claim in the "content" field, add an inline citation marker like [cite: 1] or [cite: 2, 3].
In the "citations" field of "structured_report", list every source with its id, name, and url.
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
                # Collect grounding URLs from ALL outputs before parsing JSON
                url_map = extract_grounding_urls(status_check.outputs)
                print(f"[grounding] Found {len(url_map)} source URLs: {url_map}")

                # Deep Research might have multiple outputs; we want the final synthesis
                # Search backwards for the first valid JSON we can find
                parsed_result = None
                raw_text = None

                for output in reversed(status_check.outputs):
                    if not hasattr(output, 'text') or not output.text:
                        continue
                        
                    text = output.text
                    raw_text = text  # Keep track of last text for fallback
                    
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
                            # Ensure it's a dictionary and has the required field if schema_hint was provided
                            if isinstance(parsed, dict) and (not schema_hint or "content" in parsed):
                                parsed_result = parsed
                                break
                        except:
                            continue
                
                # If no JSON found, use the raw text as content
                if not parsed_result:
                    last_text = status_check.outputs[-1].text if status_check.outputs else "No output"
                    parsed_result = {"content": last_text}

                # Post-process: If structured_report is missing, use Flash to extract it
                if schema_hint and (not parsed_result.get('structured_report') or not parsed_result['structured_report'].get('market_dynamics')):
                    print("[post-process] structured_report missing or incomplete — extracting with Flash...")
                    try:
                        structured = structurize_with_flash(parsed_result.get('content', ''), schema_hint)
                        if structured:
                            # Keep original content, overlay structured data
                            parsed_result['structured_report'] = structured.get('structured_report', structured)
                            print(f"[post-process] Flash extraction successful. Keys: {list(parsed_result.get('structured_report', {}).keys())}")
                        else:
                            print("[post-process] Flash extraction returned None")
                    except Exception as e:
                        print(f"[post-process] Flash extraction failed: {e}")

                # Merge grounding URLs into citations
                parsed_result = merge_urls_into_citations(parsed_result, url_map)
                return jsonify({"data": parsed_result, "status": "success"})
                    
            elif status_check.status in ["failed", "cancelled"]:
                return jsonify({"error": f"Research {status_check.status}"}), 500
            
            time.sleep(10)
            attempts += 1
            
        return jsonify({"error": "Timed out waiting for research"}), 504
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def structurize_with_flash(content: str, schema_hint: str) -> dict | None:
    """
    Uses Gemini Flash to extract structured data from unstructured deep research content.
    This is cheap and fast (~0.5s, ~$0.001).
    """
    if not content or len(content) < 100:
        return None

    prompt = f"""Extract structured data from the following investment research report.

RESEARCH REPORT:
{content[:30000]}

OUTPUT SCHEMA (return ONLY a JSON object matching this schema):
{schema_hint}

RULES:
- Extract all data points from the report into the appropriate schema fields
- For "summary" fields, write a concise 1-2 sentence summary
- For "details" arrays, extract 3-5 key bullet points as strings
- For numerical fields (purchase_price, gross_rent, noi, cap_rate, etc.), extract the actual numbers
- For chart_data, extract any time-series or comparative data mentioned
- Return ONLY the JSON object, no markdown formatting
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.1,
                "max_output_tokens": 8192
            }
        )
        
        text = response.text
        if not text:
            return None

        parsed = json.loads(text)
        return parsed
    except Exception as e:
        print(f"[structurize_with_flash] Error: {e}")
        return None

if __name__ == '__main__':
    # Cloud Run sets PORT=8080; locally defaults to 5001
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port, threaded=True)
