// MongoDB JSON Schema for admin audit logs
var adminAuditLogSchema = {
  bsonType: "object",
  required: ["action", "entityType", "createdAt"],
  properties: {
    _id: { bsonType: "objectId" },
    actorId: { bsonType: ["string", "null"] },
    actorEmail: { bsonType: ["string", "null"] },
    actorRole: { bsonType: ["string", "null"] },
    action: { bsonType: "string" },
    entityType: { bsonType: "string" },
    entityId: { bsonType: ["string", "null"] },
    details: { bsonType: ["object", "null"] },
    createdAt: { bsonType: "date" }
  }
};

