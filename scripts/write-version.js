const fs = require("fs");
const path = require("path");

const packageJson = require("../package.json");

const versionFile = path.join(__dirname, "..", "public", "version.json");
const buildTime = new Date().toISOString();

const versionInfo = {
  version: process.env.REACT_APP_APP_VERSION || packageJson.version,
  buildTime
};

fs.writeFileSync(versionFile, `${JSON.stringify(versionInfo, null, 2)}\n`);
console.log(`Wrote public/version.json (${versionInfo.version}, ${versionInfo.buildTime})`);
