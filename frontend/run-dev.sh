#!/bin/bash

set -e

CERT_FILE="127.0.0.1.pem"
KEY_FILE="127.0.0.1-key.pem"
OPENSSL_CNF="./openssl.cnf"

echo "Generating self-signed certificate..."

cat > "$OPENSSL_CNF" <<EOF
[ req ]
default_bits       = 2048
distinguished_name = req_distinguished_name
x509_extensions    = v3_req
prompt             = no

[ req_distinguished_name ]
CN = 127.0.0.1

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = localhost
IP.1  = 127.0.0.1
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_FILE" -out "$CERT_FILE" \
  -days 365 -config "$OPENSSL_CNF"

echo "Certificate generation completed: $CERT_FILE and $KEY_FILE"

rm "$OPENSSL_CNF"

echo "Starting next.js development server..."
npx next dev -p 3375 \
  --experimental-https \
  --experimental-https-key "$KEY_FILE" \
  --experimental-https-cert "$CERT_FILE"
