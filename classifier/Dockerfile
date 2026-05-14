FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5055

COPY classifier/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY issue-taxonomy.json /app/issue-taxonomy.json
COPY classifier /app/classifier

WORKDIR /app/classifier

RUN python train.py || true

EXPOSE 5055

CMD ["python", "serve.py"]
