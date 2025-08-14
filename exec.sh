#!/bin/bash
date
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pushd $DIR
npm run start >> log.txt
npm run height
popd
