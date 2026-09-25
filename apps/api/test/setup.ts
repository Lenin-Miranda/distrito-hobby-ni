import "reflect-metadata";

// Integration tests use a known local configuration, independent of shell/.env.
process.env.PORT = "4000";
process.env.WEB_ORIGINS = "http://localhost:3000";

process.env.DATABASE_ENABLED = "false";
