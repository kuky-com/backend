FROM certbot/certbot:latest

# Set the default command to run Certbot and renew certificates every 12 hours
ENTRYPOINT ["/bin/sh", "-c", "trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;"]
