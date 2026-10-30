#!/bin/sh
set -e

CERT_DIR=/etc/nginx/certs
CERT="$CERT_DIR/selfsigned.crt"
KEY="$CERT_DIR/selfsigned.key"

mkdir -p "$CERT_DIR"

# Chrome needs the host in subjectAltName, not only in the CN. A certificate from an older
# start (kept in the nginx_certs volume) has no SAN, so it is replaced too.
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ] \
    || ! openssl x509 -in "$CERT" -noout -ext subjectAltName 2>/dev/null | grep -q "DNS:localhost"; then
    echo "Generating self-signed TLS certificate for dev..."
    openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout "$KEY" -out "$CERT" \
        -days 365 \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

exec nginx -g "daemon off;"
