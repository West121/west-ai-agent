FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/worker-jobs/README.md ./README.md
COPY services/worker-jobs/pyproject.toml ./pyproject.toml
COPY services/worker-jobs/app ./app

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

CMD ["worker-jobs", "--job", "smoke"]
