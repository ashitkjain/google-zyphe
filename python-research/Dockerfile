FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Move the hardcoded API key to an environment variable
ENV GEMINI_API_KEY=""

EXPOSE 8080

# Use gunicorn for production (threaded for parallel requests)
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "1800", "--workers", "2", "--threads", "4", "app:app"]
