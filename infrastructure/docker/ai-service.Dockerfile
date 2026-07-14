FROM python:3.12.4-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

RUN groupadd --system growthos && useradd --system --gid growthos --create-home growthos
WORKDIR /app
COPY services/ai-service/pyproject.toml ./
COPY services/ai-service/src ./src
RUN pip install --no-cache-dir .

USER growthos
EXPOSE 8000
CMD ["sh", "-c", "python -m uvicorn growthos_ai.main:app --host 0.0.0.0 --port ${PORT}"]
