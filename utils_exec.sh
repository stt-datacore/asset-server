#!/bin/bash
TZ=UTC date
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pushd $DIR
if [ "$1" != "--first" ]; then
    TZ=UTC date | grep -e ":\w5:" -e ":\w0:" && date | grep -v -e ":30:" -v -e ":00:" && /utils/utils_cap.sh && popd && exit 0
fi
npm run start
if [ "$1" == "--first" ]; then
    /utils/utils_minor.sh
fi
TZ=UTC date | grep -v -e " 02:30" -v -e " 14:30" && date | grep -e ":00:" -e ":30:" && /utils/utils_minor.sh
TZ=UTC date | grep -e " 02:30" -e " 14:30" && /utils/utils_major.sh


popd


