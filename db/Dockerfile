# Postgres 16 + PostGIS 3.5 + pgvector. Multi-arch (linux/amd64 + arm64).
# Built from source so the pgvector version is pinned exactly, not whatever
# happens to be in the package repo at build time.
ARG POSTGIS_TAG=16-3.5-alpine3.22
FROM imresamu/postgis:${POSTGIS_TAG}

ARG PGVECTOR_VERSION=v0.8.2

# clang19/llvm19 match Alpine 3.22's default LLVM, which is what the
# Postgres binary in this image expects for JIT bitcode generation.
RUN apk add --no-cache --virtual .build-deps \
        git build-base clang19 llvm19-dev postgresql16-dev \
 && git clone --branch ${PGVECTOR_VERSION} --depth 1 \
        https://github.com/pgvector/pgvector.git /tmp/pgvector \
 && cd /tmp/pgvector \
 && make OPTFLAGS="" \
 && make install \
 && cd / && rm -rf /tmp/pgvector \
 && apk del .build-deps
