const fetch = require('node-fetch-commonjs');
const { XMLParser } = require('fast-xml-parser');

async function getAuthToken(instance) {
    let url = `http://${instance.config.ip}/api/?v=1&method=login&username=${encodeURIComponent(instance.config.username)}&password=${encodeURIComponent(instance.config.password)}`;
    instance.log("info", "IN AUTHENTICATION NOW!")
    try {
        instance.log("info", `attempting: ${url}`)
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
            return null;
        }
    } catch (error) {
        instance.log("error", `Error in authentication: ${error.message}`);
        return null;
    }
}

module.exports = { getAuthToken };
