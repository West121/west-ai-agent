FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/platform-api/README.md ./README.md
COPY services/platform-api/pyproject.toml ./pyproject.toml
COPY services/platform-api/app ./app

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

EXPOSE 8000

CMD ["platform-api"]
