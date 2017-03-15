var fs = require("fs");
var os = require("os");
var _ = require("lodash");
var async = require("async");
var dns = require("native-dns");
var request = require("request");
var child_process = require("child_process");

async.parallel({
    leader_ip: function(fn){
        var question = dns.Question({
          name: ["leaders", process.env.CS_CLUSTER_ID, "containership"].join("."),
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
            var address = null;
            answer.answer.forEach(function(a){
                address = a.address;
            });

            return fn(null, address);
        });

        req.send();
    },

    publish_host: function(fn){
        if(_.has(process.env, "CRATE_PUBLISH_HOST"))
            return fn(null, process.env.CRATE_PUBLISH_HOST.split(","));

        var question = dns.Question({
          name: [os.hostname(), process.env.CS_CLUSTER_ID, "containership"].join("."),
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
            var address = null;
            answer.answer.forEach(function(a){
                address = a.address;
            });

            return fn(null, address);
        });

        req.send();
    },

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
        publish_host: "_eth1_",
        transport_port: 4300,
        node_name: os.hostname(),
        unicast_hosts: [
            "127.0.0.1"
        ],
        cluster_name: "ContainerShip Crate"
    });

    var port = 80;
    try {
        var proc_opts = JSON.parse(process.env.CS_PROC_OPTS || '{}');
        port = proc_opts && proc_opts['api-port'] || 80;
    } catch(err) { /* do nothing */ }

    var req_opts = {
        url: ["http:/", [crate.leader_ip, port].join(":"), "v1", "applications", process.env.CS_APPLICATION].join("/"),
        method: "GET",
        json: true
    }

    request(req_opts, function(err, response){
        if(err){
            process.stderr.write(err.message);
            process.exit(1);
        }
        else if(response.statusCode != 200){
            process.stderr.write(["Received", response.statusCode, "status code when fetching", process.env.CS_APPLICATION, "application"].join(" "));
            process.exit(1);
        }
        else{
            var containers = response.body.containers.length;

            crate.expected_nodes = containers;
            crate.recover_after_nodes = containers;

            if(containers % 2 == 0)
                crate.min_master_nodes = (containers / 2) + 1;
            else
                crate.min_master_nodes = Math.ceil(containers / 2);

            fs.readFile([__dirname, "crate.template"].join("/"), function(err, config){
                config = config.toString();
                config = config.replace(/CRATE_MIN_MASTER_NODES/g, crate.min_master_nodes);
                config = config.replace(/CRATE_EXPECTED_NODES/g, crate.expected_nodes);
                config = config.replace(/CRATE_RECOVER_AFTER_NODES/g, crate.recover_after_nodes);
                config = config.replace(/CRATE_PUBLISH_HOST/g, crate.publish_host);
                config = config.replace(/CRATE_CLUSTER_NAME/g, crate.cluster_name);
                config = config.replace(/CRATE_NODE_NAME/g, crate.node_name);
                config = config.replace(/CRATE_UNICAST_HOSTS/g, _.map(crate.unicast_hosts, function(host){
                    return ["    - ", host, ":", crate.transport_port].join("");
                }).join("\n"));

                fs.writeFile(process.env.CRATE_CONFIG, config, function(err){
                    if(err){
                        process.stderr.write(err.message);
                        process.exit(1);
                    }

                    child_process.spawn("/crate/bin/crate", [], {
                        stdio: "inherit"
                    }).on("error", function(err){
                        process.stderr.write(err);
                    });
                });
            });
        }
    });
});
