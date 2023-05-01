FROM ghcr.io/cloud-cli/node:latest
RUN mkdir /home/node/cli && \
  cd /home/node/cli && \
  wget https://github.com/cli/cli/releases/download/v2.28.0/gh_2.28.0_linux_armv6.tar.gz -O ghcli.tar.gz && \
  tar --strip-components=1 -xf ghcli.tar.gz && \
  rm ghcli.tar.gz
ENV PATH "$PATH:/home/node/cli/bin"
RUN mkdir /home/workdir && chown node:node /home/workdir
RUN git config --global user.email "me@darlanalv.es" && git config --global user.name "Darlan Alves"
COPY --chown=node:node . /home/app
RUN cd /home/app && npm i && npm run build && rm -r src
ENV WORKDIR /home/workdir