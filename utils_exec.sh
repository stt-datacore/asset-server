#!/bin/bash
TZ=UTC date
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pushd $DIR
if [ "$1" != "--first" ]; then
    TZ=UTC date | grep -e ":\w5:" -e ":\w0:" && date | grep -v -e ":30:" -v -e ":00:" && /utils/utils_cap.sh && popd && exit 0
fi

npm run start
npm run height

if [ "$1" == "--first" ]; then
    /utils/utils_major.sh
fi
TZ=UTC date | grep -e ":00:" -e ":30:" && /utils/utils_major.sh

popd


