FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pillow==11.3.0 paddleocr==3.1.0 paddlepaddle==3.1.0
RUN pip install --no-cache-dir setuptools==80.9.0
RUN pip install --no-cache-dir paddlex==3.1.0

WORKDIR /app
CMD ["python", "-u", "ml/recommender/admin_ingest_server.py"]
