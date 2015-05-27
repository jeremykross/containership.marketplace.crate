FROM java:8-jre

MAINTAINER ContainerShip Developers <developers@containership.io>

# set crate variables
ENV CRATE_VERSION 0.49.1
ENV CRATE_CONFIG /crate/config/crate.yml

# install packages
RUN apt-get update
RUN apt-get install -y npm

# install node
RUN npm install -g n
RUN n 0.10.38

# create /crate directory
RUN mkdir /crate

# install crate
RUN wget -nv -O - "https://cdn.crate.io/downloads/releases/crate-$CRATE_VERSION.tar.gz" | tar -xzC /crate --strip-components=1

# write logging configuration
ADD logging.yml /crate/config/logging.yml

# create /app and add files
WORKDIR /app
ADD . /app

# install dependencies
RUN npm install

# expose ports
EXPOSE 4200 4300

# run
CMD node crate.js
