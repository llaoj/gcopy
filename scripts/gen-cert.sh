#!/bin/bash
set -e

CERT_FILE="${1:-cert.pem}"
KEY_FILE="${2:-key.pem}"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "Certificates already exist: $CERT_FILE, $KEY_FILE"
    exit 0
fi

echo "Generating self-signed certificate..."

OPENSSL_CNF=$(mktemp)
cat > "$OPENSSL_CNF" <<EOF
[ req ]
default_bits       = 2048
distinguished_name = req_distinguished_name
x509_extensions    = v3_req
prompt             = no

[ req_distinguished_name ]
CN = gcopy

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = localhost
IP.1  = 127.0.0.1
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$KEY_FILE" -out "$CERT_FILE" \
    -days 365 -config "$OPENSSL_CNF"

rm "$OPENSSL_CNF"
echo "Done: $CERT_FILE, $KEY_FILE"
