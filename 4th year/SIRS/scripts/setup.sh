#!/bin/bash

PS3='Run setup for: '
options=("Client" "Database" "Server" "Border Router" "Inner Router" "Quit")
select opt in "${options[@]}"
do
    case $opt in
        "Client")
            chmod +x ./setup/configCli.sh
            (cd setup; ./configCli.sh)
            break
            ;;
        "Database")
            chmod +x ./setup/configDB.sh
            (cd setup; ./configDB.sh)
            break
            ;;
        "Server")
            chmod +x ./setup/configApi.sh
            (cd setup; ./configApi.sh)
            break
            ;;
        "Border Router")
            chmod +x ./setup/configRouter.sh
            (cd setup; ./configRouter.sh)
            break
            ;;
	"Inner Router")
            chmod +x ./setup/configInnerRouter.sh
            (cd setup; ./configInnerRouter.sh)
            break
            ;;
        "Quit")
            break
            ;;
        *) echo "invalid option $REPLY";;
    esac
done
