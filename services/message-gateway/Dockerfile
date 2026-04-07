FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/message-gateway/README.md ./README.md
COPY services/message-gateway/pyproject.toml ./pyproject.toml
COPY services/message-gateway/app ./app

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

EXPOSE 8010

CMD ["message-gateway"]
