for i in $(/bin/cat /etc/hosts.d/*.except);do 
	/usr/bin/printf s/^.*\\\($i\\\).*$/#\\\\1/g\\\n ;
done #> /tmp/update_hosts_except

