#!/bin/bash
TZ=UTC date
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pushd $DIR
npm run start
TZ=UTC date | grep -v -e " 00:3" -v -e " 12:3" && /utils/utils_minor.sh
TZ=UTC date | grep -e " 00:3" -e " 12:3" && /utils/utils_major.sh
popd

