#!/bin/bash

echo "Installling iptables persistence..."
sudo apt install -y iptables-persistent

echo "Configuring interfaces..."
sudo ifconfig eth0 192.168.0.3/24 up
sudo ifconfig eth1 192.168.2.1/24 up
sudo sysctl net.ipv4.ip_forward=1
sudo ip route add default via 192.168.0.1

# Clear nameserver entries
sudo sed -i "/nameserver/d" /etc/resolv.conf

# Add 8.8.8.8 entry
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf

# Apply iptables config

echo "Configuring firewall rules..."
sudo cp rules/innerRouter.v4 /etc/iptables/rules.v4
sudo cp rules/router.v6 /etc/iptables/rules.v6

echo "Reloading netfilter service..."
sudo service netfilter-persistent reload
