FROM ghcr.io/cloud-cli/node:latest
RUN mkdir /home/workdir && chown node:node /home/workdir
RUN git config --global user.email "me@darlanalv.es" && git config --global user.name "Darlan Alves"
COPY . /home/app
RUN cd /home/app && npm i && npm run build && rm -r src
ENV WORKDIR /home/workdir