const fetch = require('node-fetch-commonjs');
const { XMLParser } = require('fast-xml-parser');

async function getAuthToken(instance, username, pass = "") {
    var user = null;
    var password = null;
    if (username == instance.config.username){
        user = instance.config.username;
        password = instance.config.password;
    }else{
        instance.parsedConfig.users[username] = {"password": pass, "token": "", lastUsed: Date.now()}
        instance.stringifyAndSave();
        user = username;
        password = pass;
    }
    let url = `http://${instance.config.ip}/api/?v=1&method=login&username=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}`;
    try {
        let response = await fetch(url, {
            method: 'GET', // No need for POST since data is in the URL
            headers: { 'Content-Type': 'application/xml' }, // Your API might return XML
        });

        let xmlText = await response.text();
        const parser = new XMLParser();
        let data = parser.parse(xmlText);

        // Extract token (adjust based on API response structure)
        if (data.api_response && data.api_response.token) {
            instance.log("info",'Authentication successful.');
            return data.api_response.token;
        } else {
            instance.log("warning", 'Authentication failed: No token received.');
            if (instance.parsedConfig.users[username]){
                delete instance.parsedConfig.users[username];
                instance.stringifyAndSave();
            }
            return null;
        }
    } catch (error) {
        instance.log("error", `Error in authentication: ${error.message}`);
        if (instance.parsedConfig.users[username]){
            delete instance.parsedConfig.users[username];
            instance.stringifyAndSave();
        }
        return null;
    }
}

module.exports = { getAuthToken };
