#!/usr/bin/env bash
set -euo pipefail

FHEM_DIR=$1
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -z "${FHEM_DIR}" ]; then
  echo "usage: ./install.sh $FHEM_DIR"
  exit 1
fi

if [ ! -d "${FHEM_DIR}" ]; then
  echo "FHEM directory does not exist"
  exit 2
fi

ln -fs "${DIR}/98_BEWAE.pm" "${FHEM_DIR}/FHEM/98_BEWAE.pm"
ln -fs "${DIR}/web" "${FHEM_DIR}/www/BEWAE"

