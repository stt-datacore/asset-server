#!/bin/bash
TZ=UTC date
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pushd $DIR
npm run start
if [ "$1" === "--first"]; then
    /utils/utils_minor.sh
fi
TZ=UTC date | grep -v -e " 02:3" -v -e " 14:3" && /utils/utils_minor.sh
TZ=UTC date | grep -e " 02:3" -e " 14:3" && /utils/utils_major.sh
popd

