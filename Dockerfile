FROM node:lts-alpine

WORKDIR /usr/src/asset-server

COPY . .

# Toolsets needed to build lz4 node module; after build, we can get rid of them
RUN apk add --no-cache --virtual .gyp \
        python \
        make \
        g++ \
    && npm install \
    && apk del .gyp

RUN npm run build

# Replace the crontab with our script running every 10 minutes
RUN echo $'*/10 * * * * cd /usr/src/asset-server && /usr/bin/flock -n /tmp/assets.lock /usr/local/bin/npm start >> /data/logs/assets.log' > /etc/crontabs/root

# Run cron in foreground mode
ENTRYPOINT [ "crond", "-f" ]
