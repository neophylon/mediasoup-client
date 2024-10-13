var fs = require("fs");

module.exports = {
	cert: fs.readFileSync(__dirname + "/certs/fullchain.pem"),
	key: fs.readFileSync(__dirname + "/certs/privkey.pem"),
	// passphrase: "12345"
};