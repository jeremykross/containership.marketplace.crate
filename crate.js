var fs = require("fs");
var os = require("os");
var _ = require("lodash");
var async = require("async");
var dns = require("native-dns");
var child_process = require("child_process");

async.parallel({
    unicast_hosts: function(fn){
        if(_.has(process.env, "CRATE_UNICAST_HOSTS"))
            return fn(null, process.env.CRATE_UNICAST_HOSTS.split(","));

        var question = dns.Question({
          name: ["followers", process.env.CS_CLUSTER_ID, "containership"].join("."),
          type: "A"
        });

        var req = dns.Request({
            question: question,
            server: { address: "127.0.0.1", port: 53, type: "udp" },
            timeout: 2000
        });

        req.on("timeout", function(){
            return fn();
        });

        req.on("message", function (err, answer) {
            var addresses = [];
            answer.answer.forEach(function(a){
                addresses.push(a.address);
            });

            return fn(null, addresses);
        });

        req.send();
    },

    cluster_name: function(fn){
        return fn(null, process.env.CRATE_CLUSTER_NAME);
    },

    node_name: function(fn){
        return fn(null, process.env.CRATE_NODE_NAME);
    }
}, function(err, crate){
    _.defaults(crate, {
        transport_port: 4300,
        node_name: os.hostname(),
        unicast_hosts: [
            "127.0.0.1"
        ],
        cluster_name: "ContainerShip Crate"
    });

    fs.readFile([__dirname, "crate.template"].join("/"), function(err, config){
        config = config.toString();
        config = config.replace(/CRATE_CLUSTER_NAME/g, crate.cluster_name);
        config = config.replace(/CRATE_NODE_NAME/g, crate.node_name);
        config = config.replace(/CRATE_UNICAST_HOSTS/g, _.map(crate.unicast_hosts, function(host){
            return ["    - ", host, ":", crate.transport_port].join("");
        }).join("\n"));

        fs.writeFile(process.env.CRATE_CONFIG, config, function(err){
            if(err)
                process.exit(1);

            child_process.spawn("/crate/bin/crate", [], {
                stdio: "inherit"
            }).on("error", function(err){
                process.stderr.write(err);
            });
        });
    });
});
