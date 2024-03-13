#!/bin/bash

# Setup routes

# Outnet
sudo ifconfig eth0 192.168.1.2/24 up

# Setup DNS

# Clear nameserver entries
sudo sed -i "/nameserver/d" /etc/resolv.conf

# Add 8.8.8.8 entry
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf

echo "[Setup server]: Installing NodeJS..."
sudo apt-get install -y nodejs
sudo apt install -y npm

echo "[Setup server]: Installing yarn..."
sudo npm install -g --unsafe-perm yarn

echo "[Setup server]: Installing dependencies (securelib)..."
(cd ~/t49-goncalo-miguel-renato/securelib; yarn install)

echo "[Setup server]: Building client..."
(cd ~/t49-goncalo-miguel-renato/securelib; yarn build)
