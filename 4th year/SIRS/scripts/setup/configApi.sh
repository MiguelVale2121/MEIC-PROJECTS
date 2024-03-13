#!/bin/bash

# Setup routes

# DMZ
sudo ifconfig eth0 192.168.0.2/24 up
# Default Gateway (Router)
sudo ip route add default via 192.168.0.1

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

echo "[Setup server]: Installing dependencies (server)..."
(cd ~/t49-goncalo-miguel-renato/server; yarn install)

echo "[Setup server]: Building server..."
(cd ~/t49-goncalo-miguel-renato/server; yarn build)


# Generate asymmetric keys

mkdir -p ~/.ssh
cd ~/.ssh
if [ ! -f "server_private.pem" ] || [ ! -f "server_public.pem" ]; then
echo "Generating Server Asymmetric Keys..."
openssl genpkey -algorithm RSA -out server_private.pem
openssl rsa -pubout -in server_private.pem -out server_public.pem
else
echo "Asymmetric Keys Already Exist"
fi

if [ ! -f ~/t49-goncalo-miguel-renato/server/.env ]; then
    # Content of the .env file
    echo "Generating .env file..."
    echo "KEYS_PATH=" > ~/t49-goncalo-miguel-renato/server/.env
    echo "DB_CONNECTION=\"mongodb://192.168.0.3:27017\"" >> ~/t49-goncalo-miguel-renato/server/.env
    echo "DB_USE_TLS=\"true\"" >> ~/t49-goncalo-miguel-renato/server/.env
    echo "TLS_CA_PATH=\"/etc/ssl/certs/BlingBank_Root_CA.pem\"" >> ~/t49-goncalo-miguel-renato/server/.env
    echo "TLS_CERT_KEY_PATH=\"/etc/ssl/certs/BlingBank_Server.pem\"" >> ~/t49-goncalo-miguel-renato/server/.env
else
   echo ".env file already exists"
fi


#Change keys path in .env
cd ~/t49-goncalo-miguel-renato/server
eval NEW_KEYS_PATH="~/.ssh"
sed -i "s|^KEYS_PATH=.*|KEYS_PATH=\"$NEW_KEYS_PATH\"|" ".env"
#Copy server public key to shared folder
echo "Making a copy of server public key..."
cp ~/.ssh/server_public.pem /media/sf_Keys/


#Set keys for tls
sudo cp ~/t49-goncalo-miguel-renato/scripts/setup/certs/BlingBank_Root_CA.pem /etc/ssl/certs
sudo cp ~/t49-goncalo-miguel-renato/scripts/setup/certs/BlingBank_Server.pem /etc/ssl/certs
