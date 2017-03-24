# crate.io

See https://crate.io/ for more information about crate.io

## What is the Containership Marketplace?

The Containership marketplace is a series of containerized applications configured to easily run and scale on a [containership.io](https://containership.io) cluster! Many conveniences such as High-Availability, automatic clustering among others are able to be configured out of the box allowing you to scale seamlessly as your infrastructure is required to grow.

> **Note:** If you attempt to run this image outside of a containership cluster, we cannot guarantee that it will run properly.

### Author
ContainerShip Developers - developers@containership.io

### Configuration
This image will run as-is, with no additional environment variables set. For clustering to work properly, start the application in host networking mode. There are various optionally configurable environment variables:

* `CRATE_CLUSTER_NAME` - the Crate cluster name. Defaults to `ContainerShip Crate`.
* `CRATE_NODE_NAME` - the Crate node name. Defaults to the hostname of the system.
* `CRATE_UNICAST_HOSTS` - comma delimited list of other Crate nodes to cluster with. Defaults to all nodes returned in the `followers.$CS_CLUSTER_ID.containership` DNS record.

### Recommendations
* On your ContainerShip cluster, run this application using the `constraints.per_node=1` tag. Each node in your cluster will run an instance of Crate, creating a cluster of `n` nodes, where `n` is the number of follower nodes in your ContainerShip cluster.
* Start the application with `container_volume=/mnt/crate` and `host_volume=/data` so data is persisted to the host system in case your container crashes. Additionally, by bind-mounting the volume, your data will be available for backup from ContainerShip Cloud.

## Contributing
Pull requests and issues are encouraged!
