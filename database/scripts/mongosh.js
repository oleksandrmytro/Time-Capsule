db.getMongo().setReadPref("secondaryPreferred");
print("🔄 readPreference is now:", db.getMongo().getReadPrefMode());
