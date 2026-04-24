// This script is executed by `init_cluster.sh` and connects to the router to set up the sharded collections.
// Schema definitions are loaded directly from /schemas/ files using load()

const dbName = 'time-capsule';
const db = db.getSiblingDB(dbName);

print(`🚀 Enabling sharding for database: ${dbName}`);
sh.enableSharding(dbName);

// Helper function to create collection with schema validation and optimized sharding
function createCollectionWithSchema(collectionName, schema, shardKey, description, options = {}) {
  print(`✨ Creating collection: ${collectionName}. ${description || ''}`);
  
  if (db.getCollectionNames().includes(collectionName)) {
    print(`Collection ${collectionName} already exists. Dropping it.`);
    db.getCollection(collectionName).drop();
  }

  db.createCollection(collectionName, {
    validator: {
      $jsonSchema: schema
    }
  });

  print(`🔑 Creating index and sharding for: ${collectionName}`);
  db.getCollection(collectionName).createIndex(shardKey);

  // Apply sharding with options for better distribution
  if (options.presplit && options.presplit.numInitialChunks) {
    sh.shardCollection(`${dbName}.${collectionName}`, shardKey, false, options.presplit);
  } else {
    sh.shardCollection(`${dbName}.${collectionName}`, shardKey);
  }

  // Add custom split points for better distribution if specified
  if (options.presplit && options.presplit.splitPoints) {
    options.presplit.splitPoints.forEach(point => {
      try {
        sh.splitAt(`${dbName}.${collectionName}`, point);
        print(`📍 Split created at: ${JSON.stringify(point)}`);
      } catch (e) {
        print(`⚠️ Split point ${JSON.stringify(point)} may already exist or be invalid`);
      }
    });
  }
}

// Collection configuration with sharding strategies and schema files
const collectionConfigs = {
  users: {
    schemaFile: './schemas/User.js',
    schemaVar: 'userSchema',
    // Shard by email so the unique email index satisfies shard key requirement
    shardKey: { email: 1 },
    description: "Stores user accounts",
    indexes: [
      // Optional online status index; removed nonexistent isActive field to avoid failures
      { isOnline: 1 },
      { deletedAt: 1 },
      { blockedUntil: 1 }
    ],
    uniqueIndexes: [
      { email: 1 }
    ]
  },

  capsules: {
    schemaFile: './schemas/Capsule.js',
    schemaVar: 'capsuleSchema',
    shardKey: { ownerId: "hashed" },
    description: "Stores time capsules",
    options: { presplit: { numInitialChunks: 6 } },
    indexes: [
      { ownerId: 1, createdAt: -1 },
      { ownerId: 1, status: 1, deletedAt: 1, unlockAt: 1 },
      { status: 1, deletedAt: 1, unlockAt: 1 },
      { visibility: 1, unlockAt: 1 },
      { unlockAt: 1 },
      { location: "2dsphere" }
    ]
  },

  reminders: {
    schemaFile: './schemas/Reminder.js',
    schemaVar: 'reminderSchema',
    shardKey: { userId: "hashed" },
    description: "Reminder schedules for capsules",
    options: { presplit: { numInitialChunks: 4 } },
    indexes: [
      { userId: 1, nextFireAt: 1 },
      { capsuleId: 1 }
    ]
  },

  notifications: {
    schemaFile: './schemas/Notification.js',
    schemaVar: 'notificationSchema',
    shardKey: { userId: "hashed" },
    description: "User notification inbox",
    options: { presplit: { numInitialChunks: 4 } },
    indexes: [
      { userId: 1 }
    ]
  },

  comments: {
    schemaFile: './schemas/Comment.js',
    schemaVar: 'commentSchema',
    shardKey: { capsuleId: "hashed" },
    description: "Comments on capsules",
    options: { presplit: { numInitialChunks: 6 } },
    indexes: [
      { capsuleId: 1, createdAt: -1 },
      { capsuleId: 1, userId: 1, createdAt: -1 }
    ]
  },

  reactions: {
    schemaFile: './schemas/Reaction.js',
    schemaVar: 'reactionSchema',
    shardKey: { capsuleId: "hashed" },
    description: "Reactions/likes on capsules",
    options: { presplit: { numInitialChunks: 6 } },
    indexes: [
      { capsuleId: 1, createdAt: -1 }
    ],
    uniqueIndexes: [
      { capsuleId: 1, userId: 1 }
    ]
  },

  shares: {
    schemaFile: './schemas/Share.js',
    schemaVar: 'shareSchema',
    shardKey: { capsuleId: "hashed" },
    description: "Access sharing for capsules",
    options: { presplit: { numInitialChunks: 4 } },
    indexes: [
      { shareToken: 1 }
    ],
    uniqueIndexes: [
      { capsuleId: 1, granteeId: 1 }
    ]
  },

  follows: {
    schemaFile: './schemas/Follow.js',
    schemaVar: 'followSchema',
    shardKey: { userId: "hashed" },
    description: "User follow relations",
    options: { presplit: { numInitialChunks: 4 } },
    indexes: [],
    uniqueIndexes: [
      { userId: 1, followerId: 1 }
    ]
  },

  geomarkers: {
    schemaFile: './schemas/GeoMarker.js',
    schemaVar: 'geoMarkerSchema',
    shardKey: { capsuleId: "hashed" },
    description: "Geo markers for capsules",
    options: { presplit: { numInitialChunks: 4 } },
    indexes: [
      { location: "2dsphere" },
      { capsuleId: 1 }
    ]
  },

  feed_events: {
    schemaFile: './schemas/FeedEvent.js',
    schemaVar: 'feedEventSchema',
    shardKey: { actorId: "hashed" },
    description: "Activity feed events (optional)",
    options: { presplit: { numInitialChunks: 4 } },
    indexes: [
      { actorId: 1, createdAt: -1 },
      { capsuleId: 1, createdAt: -1 }
    ]
  },

  chat_messages: {
    schemaFile: './schemas/ChatMessage.js',
    schemaVar: 'chatMessageSchema',
    shardKey: { toUserId: "hashed" },
    description: "Chat messages history",
    options: { presplit: { numInitialChunks: 4 } },
    indexes: [
      { fromUserId: 1, toUserId: 1, createdAt: -1 }
    ]
  },

  tags: {
    schemaFile: './schemas/Tag.js',
    schemaVar: 'tagSchema',
    shardKey: { name: 1 },
    description: "Tag definitions",
    uniqueIndexes: [
      { name: 1 }
    ],
    indexes: [
      { isSystem: 1 }
    ]
  },

  pending_users: {
    schemaFile: './schemas/PendingUser.js',
    schemaVar: 'pendingUserSchema',
    shardKey: { email: 1 },
    description: "Pending user registrations",
    uniqueIndexes: [
      { email: 1 }
    ]
  },

  admin_audit_logs: {
    schemaFile: './schemas/AdminAuditLog.js',
    schemaVar: 'adminAuditLogSchema',
    shardKey: { createdAt: 1 },
    description: "Admin audit events",
    indexes: [
      { createdAt: -1 },
      { action: 1, createdAt: -1 },
      { entityType: 1, createdAt: -1 },
      { actorEmail: 1, createdAt: -1 }
    ]
  },
};

// --- Create collections with loaded schemas ---

print(`📋 Processing ${Object.keys(collectionConfigs).length} collections...`);

Object.entries(collectionConfigs).forEach(([collectionName, config]) => {
  print(`\n🔄 Processing collection: ${collectionName}`);
  
  // Load schema from file using load()
  let schema = null;
  
  try {
    print(`🔍 Loading schema: ${config.schemaFile}`);
    load(config.schemaFile);

    // Get the schema variable from the loaded file
    if (config.schemaVar === 'userSchema' && typeof userSchema !== 'undefined') schema = userSchema;
    else if (config.schemaVar === 'capsuleSchema' && typeof capsuleSchema !== 'undefined') schema = capsuleSchema;
    else if (config.schemaVar === 'reminderSchema' && typeof reminderSchema !== 'undefined') schema = reminderSchema;
    else if (config.schemaVar === 'notificationSchema' && typeof notificationSchema !== 'undefined') schema = notificationSchema;
    else if (config.schemaVar === 'commentSchema' && typeof commentSchema !== 'undefined') schema = commentSchema;
    else if (config.schemaVar === 'reactionSchema' && typeof reactionSchema !== 'undefined') schema = reactionSchema;
    else if (config.schemaVar === 'shareSchema' && typeof shareSchema !== 'undefined') schema = shareSchema;
    else if (config.schemaVar === 'followSchema' && typeof followSchema !== 'undefined') schema = followSchema;
    else if (config.schemaVar === 'geoMarkerSchema' && typeof geoMarkerSchema !== 'undefined') schema = geoMarkerSchema;
    else if (config.schemaVar === 'feedEventSchema' && typeof feedEventSchema !== 'undefined') schema = feedEventSchema;
    else if (config.schemaVar === 'chatMessageSchema' && typeof chatMessageSchema !== 'undefined') schema = chatMessageSchema;
    else if (config.schemaVar === 'tagSchema' && typeof tagSchema !== 'undefined') schema = tagSchema;
    else if (config.schemaVar === 'pendingUserSchema' && typeof pendingUserSchema !== 'undefined') schema = pendingUserSchema;
    else if (config.schemaVar === 'adminAuditLogSchema' && typeof adminAuditLogSchema !== 'undefined') schema = adminAuditLogSchema;
    else {
      print(`❌ Schema variable ${config.schemaVar} not found after loading ${config.schemaFile}`);
    }
  } catch (error) {
    print(`⚠️ Error loading schema file ${config.schemaFile}: ${error}`);
  }
  
  if (!schema) {
    throw new Error(`Schema ${config.schemaVar} was not loaded for collection ${collectionName}`);
  }
  
  // Create collection with schema validation and sharding
  createCollectionWithSchema(
    collectionName,
    schema,
    config.shardKey,
    config.description,
    config.options
  );

  // Create additional indexes
  if (config.indexes && config.indexes.length > 0) {
    print(`📊 Creating ${config.indexes.length} indexes for ${collectionName}...`);
    config.indexes.forEach(indexSpec => {
      try {
        db.getCollection(collectionName).createIndex(indexSpec);
        print(`  ✅ Index ${JSON.stringify(indexSpec)} created`);
      } catch (e) {
        print(`  ⚠️ Index creation failed: ${e}`);
      }
    });
  }
  
  // Create unique indexes
  if (config.uniqueIndexes && config.uniqueIndexes.length > 0) {
    print(`🔐 Creating ${config.uniqueIndexes.length} unique indexes for ${collectionName}...`);
    config.uniqueIndexes.forEach((indexSpec, index) => {
      try {
        // Generate unique index name to avoid conflicts
        const indexName = `${collectionName}_unique_${index}`;
        db.getCollection(collectionName).createIndex(indexSpec, { unique: true, name: indexName });
        print(`  ✅ Unique index ${JSON.stringify(indexSpec)} created with name: ${indexName}`);
      } catch (e) {
        print(`  ⚠️ Unique index creation failed: ${e}`);
      }
    });
  }
});

print(`\n🎉 Schema initialization completed!`);
print(`📊 Created ${Object.keys(collectionConfigs).length} sharded collections with validation`);
print(`🔍 All schemas are loaded from /database/schemas/`);

// Auto-import seed datasets from CSV files
try {
  print(`\n📦 Running import_datasets.js...`);
  load('./scripts/import_datasets.js');
  print(`✅ Dataset import finished.`);
} catch (e) {
  print(`⚠️ import_datasets.js failed: ${e}`);
}
