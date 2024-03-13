#!/bin/bash

rm -rf setup/certs
mkdir setup/certs

echo "Generating Certificate Authority..."

# Generate root CA private key
openssl genrsa -out setup/certs/rootCA.key 2048

# Generate CA private key
openssl req -x509 -new -nodes -key setup/certs/rootCA.key -sha256 -days 1024 -out setup/certs/BlingBank_Root_CA.pem -subj "/C=PT/ST=Lisbon/CN=root/emailAddress=dsi_rootCA@blingbank.com"
echo "00" > setup/certs/file.srl

# Generate database server certificate

echo "Generating database server certificate..."
openssl genrsa -out setup/certs/dbserver.key 2048
openssl req -key setup/certs/dbserver.key -new -out setup/certs/dbserver.req -subj "/C=PT/ST=Lisbon/CN=dbserver1/CN=192.168.2.2/emailAddress=dsi@blingbank.com"
openssl x509 -req -in setup/certs/dbserver.req -CA setup/certs/BlingBank_Root_CA.pem -CAkey setup/certs/rootCA.key -CAserial setup/certs/file.srl -out setup/certs/BlingBank_Database.crt -days 1024
cat setup/certs/dbserver.key setup/certs/BlingBank_Database.crt > setup/certs/BlingBank_Database.pem

echo "Validating database server certificate..."
openssl verify -CAfile setup/certs/BlingBank_Root_CA.pem setup/certs/BlingBank_Database.pem

# Generate API server certificate

echo "Generating API server certificate..."
openssl genrsa -out setup/certs/apiserver.key 2048
openssl req -key setup/certs/apiserver.key -new -out setup/certs/apiserver.req -subj "/C=PT/ST=Lisbon/CN=apiserver1/emailAddress=dsi@blingbank.com"
openssl x509 -req -in setup/certs/apiserver.req -CA setup/certs/BlingBank_Root_CA.pem -CAkey setup/certs/rootCA.key -CAserial setup/certs/file.srl -out setup/certs/BlingBank_Server.crt -days 1024
cat setup/certs/apiserver.key setup/certs/BlingBank_Server.crt > setup/certs/BlingBank_Server.pem

echo "Validating API server certificate..."
openssl verify -CAfile setup/certs/BlingBank_Root_CA.pem setup/certs/BlingBank_Server.pem
