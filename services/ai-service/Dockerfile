FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/ai-service/README.md ./README.md
COPY services/ai-service/pyproject.toml ./pyproject.toml
COPY services/ai-service/app ./app

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

EXPOSE 8020

CMD ["ai-service"]
