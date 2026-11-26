#!/usr/bin/env sh
set -eu

mkdir -p secrets
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out secrets/jwt_private.pem
openssl rsa -pubout -in secrets/jwt_private.pem -out secrets/jwt_public.pem
chmod 600 secrets/jwt_private.pem 2>/dev/null || true
chmod 644 secrets/jwt_public.pem 2>/dev/null || true
echo "Generated RSA-2048 JWT keys in secrets/"
