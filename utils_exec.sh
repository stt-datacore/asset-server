#!/bin/bash
date
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pushd $DIR
npm run start
date | grep -v -e " 19:4" -v -e " 07:4" && /utils/utils_minor.sh
date | grep -e " 19:4" -e " 07:4"  && /utils/utils_major.sh
popd

