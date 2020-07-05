# Introduction 
DataCore Asset Parser

Run exec.sh with a cronjob (every 10minutes should suffice), for example with flock `*/10 * * * * /usr/bin/flock -n /tmp/tool.lockfile /home/stt/tool/exec.sh`

## Nginx
Example configuration
```
# Redirect all HTTP traffic to HTTPS
server {
        listen 80;
        server_name assets.datacore.app;
        return 301 https://$host$request_uri;
}

server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;

        server_name assets.datacore.app;

        ssl_certificate      /home/stt/certs/cert.pem;
        ssl_certificate_key  /home/stt/certs/privkey.pem;

        add_header X-XSS-Protection "1; mode=block";
        add_header X-Content-Type-Options "nosniff";
        add_header Strict-Transport-Security "max-age=63072000";
        add_header Content-Security-Policy "object-src 'none'; frame-ancestors 'none'";

        location / {
                alias /home/stt/tool/out/assets/;
                access_log off;
                expires max;
        }

        location /data/ {
                alias /home/stt/tool/out/data/;
                expires -1;
        }
}
```