FROM python:3.12-slim

RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu126 torch==2.7.1 \
    && pip install --no-cache-dir numpy==2.2.6 pymysql==1.1.1 "psycopg[binary]==3.2.9"

WORKDIR /app
CMD ["python", "-u", "ml/recommender/serve.py", "--host", "0.0.0.0", "--port", "8091"]
