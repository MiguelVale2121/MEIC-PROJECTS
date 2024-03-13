#!/bin/bash

# Setup routes

echo "[Network setup]: Configuring interfaces..."

# Database
sudo ifconfig eth0 192.168.2.2/24 up
# Default Gateway (Router)
sudo ip route add default via 192.168.2.1

# Setup DNS

echo "[Network setup]: Configuring DNS..."

sudo sed -i "/nameserver/d" /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf

if ! command -v mongo &> /dev/null
then
	echo "[Database setup]: Setting up MongoDB..."
	sudo apt-get install -y mongodb
	echo "[Database setup]: Creating data folder..."
	mkdir -p ~/data/db
fi

#Set keys for tls
sudo cp certs/BlingBank_Root_CA.pem /etc/ssl/certs
sudo cp certs/BlingBank_Database.pem /etc/ssl/certs
