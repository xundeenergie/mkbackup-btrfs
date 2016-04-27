#!/bin/sh

SETNAME=$1
SETS=$(ipset list -n)

if [ -e /etc/cn.zone ] ;then
	# Create the ipset list
	for i in $SETS; do
	echo -n "Existing Set: $i ... "
		if [ "x$i" = "x$SETNAME" ]; then
			echo "destroy"
			ipset destroy $SETNAME
		else
			echo
		fi
	done

	echo "Create new $SETNAME-set"
	ipset -N $SETNAME hash:net
	
	
	# Add each IP address from the downloaded list into the ipset 'china'
	echo -n "add ips to Set [$SETNAME]: waiting ... "
	for i in $(cat /etc/cn.zone ); do ipset -A $SETNAME $i; done
	echo "done"
else
	exit 1
fi
