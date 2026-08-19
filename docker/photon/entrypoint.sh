#!/bin/sh
set -eu

PHOTON_DB_URL="${PHOTON_DB_URL:-https://download1.graphhopper.com/public/asia/japan/photon-db-japan-1.0-latest.tar.bz2}"
ARCHIVE=/data/photon-db-japan.tar.bz2

if [ ! -d /data/photon_data ]; then
  echo "Photon Japan index is missing; downloading ${PHOTON_DB_URL}"
  curl -fL --retry 5 --retry-delay 5 "${PHOTON_DB_URL}" -o "${ARCHIVE}.part"
  mv "${ARCHIVE}.part" "${ARCHIVE}"
  tar -xjf "${ARCHIVE}" -C /data
  rm -f "${ARCHIVE}"
fi

exec java ${JAVA_OPTS:--Xms512m -Xmx1280m} -jar /opt/photon/photon.jar serve -listen-ip 0.0.0.0
