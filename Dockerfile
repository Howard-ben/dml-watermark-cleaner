FROM python:3.10-slim

# Install system dependencies and ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg libsm6 libxext6 libgl1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency file and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

ENV PORT=5000
EXPOSE 5000

# Start using gunicorn (production server)
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
