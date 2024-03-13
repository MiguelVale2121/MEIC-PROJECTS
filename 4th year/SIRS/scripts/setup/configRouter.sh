#!/bin/bash

echo "Installling iptables persistence..."
sudo apt install -y iptables-persistent

echo "Configuring interfaces..."
sudo ifconfig eth0 192.168.0.1/24 up
sudo ifconfig eth1 192.168.1.1/24 up
sudo sysctl net.ipv4.ip_forward=1

# Configure DNS

echo "Configuring DNS..."
sudo sed -i "/nameserver/d" /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf

# Apply iptables config

echo "Configuring firewall rules..."
sudo cp rules/router.v4 /etc/iptables/rules.v4
sudo cp rules/router.v6 /etc/iptables/rules.v6

echo "Reloading netfilter service..."
sudo service netfilter-persistent reload
