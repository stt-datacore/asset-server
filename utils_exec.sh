#!/bin/bash
TZ=America/New_York date
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pushd $DIR
npm run start
TZ=America/New_York date | grep -v -e " 19:3" -v -e " 07:3" && /utils/utils_minor.sh
TZ=America/New_York date | grep -e " 19:3" -e " 07:3" && /utils/utils_major.sh
popd

