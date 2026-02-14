// MongoDB JSON Schema for mongosh - capsule shares/permissions (MVP)
var shareSchema = {
  bsonType: "object",
  required: ["capsuleId", "granteeId", "role", "status"],
  properties: {
    _id: { bsonType: "objectId" },
    capsuleId: { bsonType: "objectId" },
    granteeId: { bsonType: "objectId" },
    inviterId: { bsonType: "objectId" },
    role: { enum: ["viewer", "editor"] },
    status: { enum: ["pending", "accepted", "revoked"] },
    via: { enum: ["invite", "token"] },
    shareToken: { bsonType: "string" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
    deletedAt: { bsonType: "date" }
  }
};

