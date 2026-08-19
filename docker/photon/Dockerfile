FROM eclipse-temurin:21-jre-jammy

ARG PHOTON_VERSION=1.2.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends bzip2 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/photon /data \
    && curl -fsSL \
      "https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-${PHOTON_VERSION}.jar" \
      -o /opt/photon/photon.jar

COPY docker/photon/entrypoint.sh /usr/local/bin/photon-entrypoint
RUN chmod +x /usr/local/bin/photon-entrypoint

WORKDIR /data
EXPOSE 2322

ENTRYPOINT ["photon-entrypoint"]
