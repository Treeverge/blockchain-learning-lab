FROM python:3.12-slim

WORKDIR /app

# Use the maintained learning dependencies; original pins remain archived.
COPY requirements-learning.txt /app/
RUN python -m pip install --no-cache-dir -r requirements-learning.txt

# Add actual source code.
COPY blockchain.py /app/

EXPOSE 5000

CMD ["python", "blockchain.py", "--host", "0.0.0.0", "--port", "5000"]
