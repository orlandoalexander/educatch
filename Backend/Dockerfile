# Use lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy app code
COPY . .

ENV PORT 8080

# Use gunicorn to run Flask app
CMD ["gunicorn", "-b", "0.0.0.0:8080", "main:app"]
