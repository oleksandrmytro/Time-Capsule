var config = {
    "_id": "rs-shard-02",
    "version": 1,
    "members": [
        {
            "_id": 0,
            "host": "shard-02-node-a:27017",
			"priority": 1
        },
        {
            "_id": 1,
            "host": "shard-02-node-b:27017",
			"priority": 0.5
        },
        {
            "_id": 2,
            "host": "shard-02-node-c:27017",
			"priority": 0.5
        }
    ]
};
rs.initiate(config, { force: true });