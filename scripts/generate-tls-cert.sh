#!/usr/bin/env sh
set -eu

mkdir -p nginx/certs
MSYS_NO_PATHCONV=1 openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
chmod 600 nginx/certs/server.key 2>/dev/null || true
chmod 644 nginx/certs/server.crt 2>/dev/null || true
echo "Generated self-signed TLS certificate in nginx/certs/"
