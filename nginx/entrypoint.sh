#!/bin/sh
set -e

CERT_DIR=/etc/nginx/certs
CERT="$CERT_DIR/selfsigned.crt"
KEY="$CERT_DIR/selfsigned.key"

mkdir -p "$CERT_DIR"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    echo "Generating self-signed TLS certificate for dev..."
    openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout "$KEY" -out "$CERT" \
        -days 365 \
        -subj "/CN=localhost"
fi

exec nginx -g "daemon off;"
