#!/bin/bash
GIT_PATH=/home/stt/prod/asset-server
DATA_PATH=/home/stt/prod/data

pushd $GIT_PATH

git pull 2>&1
if [ $? -ne 0 ]
then
    echo "Failed during git pull"
    exit 1
fi

# TODO: versioning?
docker build --tag stt-datacore/asset-server:latest .
if [ $? -ne 0 ]
then
    echo "Failed during Docker build"
    exit 3
fi

popd

# TODO: remove old image and restart; is there a best practices for this?
docker stop DCAssetServer
docker rm DCAssetServer

docker run -d --name=DCAssetServer \
    --restart unless-stopped \
    --mount type=bind,source="$DATA_PATH",target=/data \
    --env OUT_PATH=/data/assets/ \
    --env-file "$DATA_PATH/env.list" \
    stt-datacore/asset-server:latest

