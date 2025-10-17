const fetch = require('node-fetch-commonjs');
const { XMLParser } = require('fast-xml-parser');
const { InstanceStatus } = require('@companion-module/base')


/*
    Refreshes all lists from AIM
*/
async function refreshLists(self, retry = 2, rtnData = false){
    await refreshAvailableChannels(self, retry);
    await refreshAvailableReceivers(self, retry);
    let presets = await getPresets(self, retry, rtnData);
    self.stringifyAndSave();
    self.updateActions();
    self.updateFeedbacks();
    if (rtnData) return presets;
}

/*
    Refresh Channel List from AIM server.
*/
async function refreshAvailableChannels(self, retry = 0){
    try{
        let url = `http://${self.config.ip}/api/?v=2&method=get_channels&token=${encodeURIComponent(self.config.token)}`;
                let response = await fetch(url, {
                    method: 'GET', // No need for POST since data is in the URL
                    headers: { 'Content-Type': 'application/xml' }, // Your API might return XML
                });
                
                //Parse Response
                let xmlText = await response.text();
                const parser = new XMLParser();
                let data = parser.parse(xmlText);

                //Retry if error
                if (data.api_response && !data.api_response.success)
                    {
                        if (retry>0){
                            self.log("info", "calling authentication")
                            await self.authenticate(self.config.username, self.config.password)
                            await refreshAvailableChannels(self, retry-1)
                            return
                        }
                        else{
                            self.log("error", "Could not authenticate")
                            return
                        }
                    }


                //If success, replace channel list
                if (data.api_response && data.api_response.channels) {
                    self.log("debug",'Channels Fetched successful.');
                    if (this.currentStatus !== InstanceStatus.Ok){
                        this.currentStatus = InstanceStatus.Ok;
                        self.updateStatus(InstanceStatus.Ok);
                    }
                    let channels = Array.isArray(data.api_response.channels.channel)
                    ? data.api_response.channels.channel
                    : [data.api_response.channels.channel];
                    let channel_options = [{id: "None", label: "None"}]

                    channels.forEach(channel => {
                        channel_options.push({id: channel.c_id, label: channel.c_name})
                        
                    });
                    self.parsedConfig.channelChoices = channel_options

                } else {
                    self.log("warning", 'Authentication failed: No token received.');
                    return null;
                }
    }
    catch (error){
        self.log("error", error.message)
    }
}

async function refreshAvailableReceivers(self, retry=0){
    try{
        self.log("info", "Refresh Receivers")
        let url = `http://${self.config.ip}/api/?v=2&method=get_devices&device_type=rx&token=${encodeURIComponent(self.config.token)}`;
                let response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/xml' }, 
                });
        
                let xmlText = await response.text();
                const parser = new XMLParser();
                let data = parser.parse(xmlText);
                
                if (data.api_response && !data.api_response.success)
                {
                    if (retry>0){
                        await self.authenticate(self.config.username, self.config.password)
                        refreshAvailableReceivers(self, retry-1)
                        return
                    }
                    else{
                        self.log("error", "Could not authenticate")
                        return
                    }
                }
                if (data.api_response.devices) {
                    self.log("info",'Receivers Fetched successful.');
                    if (this.currentStatus !== InstanceStatus.Ok){
                        this.currentStatus = InstanceStatus.Ok;
                        self.updateStatus(InstanceStatus.Ok);
                    }
                    let devices = Array.isArray(data.api_response.devices.device)
                    ? data.api_response.devices.device
                    : [data.api_response.devices.device];
                    let device_options = [{id: "None", label: "None"}]
                    
                    devices.forEach(device => {
                        device_options.push({id: device.d_id, label: device.d_name})
                        
                    });
                    self.parsedConfig.receiverChoices = device_options
                    self.stringifyAndSave();

                } else {
                    self.log("Error", 'Unable to fetch receivers');
                    return null;
                }
    }
    catch (error){
        self.log("error", error.message)
    }
}

async function getToken(self, user, password){
    var token = null;


    if (user == self.config.username){
        token = self.config.token;
        password = self.config.password;
    }
    else{
        if (!self.parsedConfig.users[user] || !self.parsedConfig.users[user]["token"]){
             var success = await self.authenticate(user, password);
             if (success){
                token = self.parsedConfig.users[user]["token"];
             }else{
                retry=retry-1;
             }
        }else{
            token = self.parsedConfig.users[user]["token"];
        }
    }
    return token;
}

async function connectChannel(self, rec, channel, mode, user, password = "", force = false, retry = 2) {
    const token = await getToken(self, user, password);
    const url = `http://${self.config.ip}/api/?v=5&method=connect_channel&token=${encodeURIComponent(token)}&c_id=${encodeURIComponent(channel)}&rx_id=${encodeURIComponent(rec)}&mode=${encodeURIComponent(mode)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/xml' },
        });

        const xmlText = await response.text();
        const parser = new XMLParser();
        const data = parser.parse(xmlText);

        if (data.api_response) {
            if (data.api_response.success) {
                return true;
            }

            const error = data.api_response.errors?.error;
            const code = parseInt(error?.code);
            const msg = error?.msg;

            if (code === 10 && retry > 0) {
                self.log('warn', `Token expired or permission denied. Retrying auth for ${user}...`);
                await self.authenticate(user, password);
                return await connectChannel(self, rec, channel, mode, user, password, force, retry - 1);
            }

            self.log('error', `Connection failed with code: ${code} - ${msg}`);

            if (force && retry > 0) {
                const result = await disconnect(self, "channel", rec, 1);
                if (!result) return false;
                return await connectChannel(self, rec, channel, mode, user, password, force, retry - 1);
            }
            return false;
        } else {
            self.log('error', 'No API Response');
            return false;
        }
    } catch (error) {
        self.log('error', `Failed to change channel: ${error.message}`);
        return false;
    }
}


/*
    Polls the AIM server and gets current status of connections. Updates Feedback.
*/
async function getStatus(self, rxName = null, chID = null, presetID = null, retry = 2) {
	let now = Date.now();
    let presetInfo = null;

    //Check if preset feedback
    if (presetID) {
        const presetKey = 'all_presets'; 
        self.presetRequests = self.presetRequests || {};
        self.cachedPresets = self.cachedPresets || {};

        if (
            self.cachedPresets.time &&
            now - self.cachedPresets.time < self.cachedTimeout &&
            self.cachedPresets.presetInfo &&
            String(self.cachedPresets.presetInfo.cp_id) === String(presetID)
        ) {
            presetInfo = self.cachedPresets.presetInfo;
        } else if (self.presetRequests[presetKey]) {
            const presets = await self.presetRequests[presetKey];
            presetInfo = Object.values(presets).find(entry => String(entry.cp_id) === String(presetID));
        } else {
            const presetPromise = (async () => {
                const presets = await getPresets(self, 2, true);
                return presets;
            })();

            self.presetRequests[presetKey] = presetPromise;

            try {
                const presets = await presetPromise;
                presetInfo = Object.values(presets).find(entry => String(entry.cp_id) === String(presetID));
                self.cachedPresets = {
                    presetInfo,
                    time: Date.now(),
                };
            } finally {
                delete self.presetRequests[presetKey]; // Cleanup
            }
        }

        // Process preset status if found
        if (presetInfo) {
            if (presetInfo.cp_active === "none") {
                if (self.errorTracker.has(presetID)) {
                    return self.CONN.ERROR;
                } else {
                    return self.CONN.DISCONNECTED;
                }
            } else if (presetInfo.cp_active === self.CONN.FULL) {
                self.errorTracker.delete(presetID);
                return self.CONN.FULL;
            } else if (presetInfo.cp_active === self.CONN.PARTIAL) {
                self.errorTracker.delete(presetID);
                return self.CONN.PARTIAL;
            }
        }
    }

	// ----- Receiver Status Cache Logic -----
	const key = rxName;
	if (!self.receiverRequests) self.receiverRequests = {};

	let data = null;

	try {
		// Use cache if fresh
		if (key in self.cachedReceivers && now - self.cachedReceivers[key].time < self.cachedTimeout) {
			data = self.cachedReceivers[key].data;
		}
		// Await in-progress request if present
		else if (key in self.receiverRequests) {
			data = await self.receiverRequests[key];
		}
		// No valid cache or in-progress — fetch
		else {
			self.receiverRequests[key] = (async () => {
				const url = `http://${self.config.ip}/api/?v=2&method=get_devices&&device_type=rx&filter_d_name=${encodeURIComponent(rxName)}&token=${encodeURIComponent(self.config.token)}`;
				const response = await fetch(url, {
					method: 'GET',
					headers: { 'Content-Type': 'application/xml' },
				});
                
                //Get response
				const xmlText = await response.text();
                
                //Handle 429
                if(response.status == 429){
                    throw new Error(429);
                }

				const parser = new XMLParser();
				var parsed = parser.parse(xmlText);

                //If a response was received and API was not successful, check error code
				if (parsed.api_response && !parsed.api_response.success) {
					const error = Array.isArray(parsed.api_response.errors)
						? parsed.api_response.errors[0]?.error
						: parsed.api_response.errors?.error;

                    //If 10, Log in failed, attempt login and retry
					if (error?.code === 10) {
						await self.authenticate(self.config.username, self.config.password);
						if (retry > 0) {
							delete self.receiverRequests[key]; // clear before retry
							return await getStatus(self, rxName, chID, presetID, retry - 1);
						}
						throw new Error("Auth failure after retries");
					}else {
						self.log("error", "Could not find device");
						throw new Error("Device fetch failed");
					}
				}
                
                //Add data to cache
				self.cachedReceivers[key] = {
					data: parsed,
					time: Date.now(),
				};
				return parsed;
			})();

			data = await self.receiverRequests[key];
		}

		// Clean up in progress tracking
		delete self.receiverRequests[key];

		if (data.api_response.count_devices === 0) {
			self.log("warn", "No receivers found, please check your configuration.");
			return self.CONN.DISCONNECTED;
		}

		const device = data.api_response.devices.device;

		// Connected to expected channel?
		if (String(device.con_c_id) === String(chID)) {
			if (self.currentStatus !== InstanceStatus.Ok) {
				self.currentStatus = InstanceStatus.Ok;
				self.updateStatus(InstanceStatus.Ok);
			}

			if (device.con_end_time) {
				return self.errorTracker.has(`${rxName}_${chID}`) ? self.CONN.ERROR : self.CONN.DISCONNECTED;
			} else {
				return self.CONN.CONNECTED;
			}
		} else {
			return self.errorTracker.has(`${rxName}_${chID}`) ? self.CONN.ERROR : self.CONN.DISCONNECTED;
		}
	} catch (error) {
		delete self.receiverRequests[key];

		if (data != null) {
			self.log("error", `${error.message} ${JSON.stringify(data)}`);
			self.log("error", `Connection failed with code: ${data.api_response?.errors?.error?.code} - ${data.api_response?.errors?.error?.msg}`);
		} else {
            if(error.message==429){
                self.log("error", "Too many requests to AIM, waiting for next poll");
                return self.CONN.CONNECTED
            }
			self.log("error", `${error.message} No response from AIM. Please check your configuration.`);
			self.updateStatus(InstanceStatus.ConnectionFailure);
		}

		return self.CONN.ERROR;
	}
}


async function getPresets(self, retry=0, rtnData = false)
{
    let url = `http://${self.config.ip}/api/?v=1&method=get_presets&token=${encodeURIComponent(self.config.token)}`
    let data = null;
    try{
        let response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/xml' }, 
        });

        let xmlText = await response.text();
        const parser = new XMLParser();
        data = parser.parse(xmlText);
        
        if ( data.api_response && !data.api_response.success )
        {
        const error = Array.isArray(data.api_response.errors)
            ? data.api_response.errors[0]?.error
            : data.api_response.errors?.error;
        if (error?.code === 10 && retry > 0) {
            await self.authenticate(self.config.username, self.config.password)
            await getPresets(self, retry - 1); // Ensure we await the function
            return;
            }
            else{
                self.log("error", "Could not fetch presets")
                return
            }
        }

        if(data.api_response.count_presets>0){
            let presets = Array.isArray(data.api_response.connection_presets.connection_preset)
                ? data.api_response.connection_presets.connection_preset
                : [data.api_response.connection_presets.connection_preset];
                let preset_options = [{id: "None", label: "None"}]
            presets.forEach( p => {
                preset_options.push({id: p.cp_id, label: p.cp_name});
            })

            self.parsedConfig.presets = preset_options
            if (rtnData){
                return presets;
            }
        }else{
            self.log("info", "There were no presets defined on the AIM server.")
        }

    }catch (error){
        if(data){
            self.log('error', `Connection failed with code: ${JSON.stringify(data)} with js ${error.message}`)
            return false;
        }else {
            self.log("error", error.message)
            return false;
        }
    }
}

async function connectPreset(self, cp_id, username, password, mode='s', force=0)
{
    const token = await getToken(self, username, password)
     let url = `http://${self.config.ip}/api/?v=5&method=connect_preset&token=${encodeURIComponent(token)}&id=${encodeURIComponent(cp_id)}&mode=${encodeURIComponent(mode)}&force=${encodeURIComponent(force)}`
     try
     {
         let response = await fetch(url, {
             method: 'GET',
             headers: {'Content-Type': 'applictaion/xml' },
         });
 
         let xmlText = await response.text();
                 const parser = new XMLParser();
                 let data = parser.parse(xmlText);
 
         if (data.api_response)
             if(!data.api_response.success)
         {
             self.log('error', `Connection failed with code: ${data.api_response.errors.error.code} - ${data.api_response.errors.error.msg}`)
             return false;
         }
         else{
             return true;
         }
     }
     catch (error)
     {
         self.log('error', `Failed to connect preset: ${error.message}`);
     }
}


//Disconnect channel or preset
async function disconnect(self, type, id, force = 0){
    let url = ''
    if (type==="preset"){
        url = `http://${self.config.ip}/api/?v=5&method=disconnect_preset&token=${encodeURIComponent(self.config.token)}&id=${encodeURIComponent(id)}&force=${encodeURIComponent(force)}`
    }else{
        url = `http://${self.config.ip}/api/?v=5&method=disconnect_channel&token=${encodeURIComponent(self.config.token)}&rx_id=${encodeURIComponent(id)}&force=${encodeURIComponent(force)}`
    }
    try
    {
        let response = await fetch(url, {
            method: 'GET',
            headers: {'Content-Type': 'applictaion/xml' },
        });

        let xmlText = await response.text();
                const parser = new XMLParser();
                let data = parser.parse(xmlText);

        if (data.api_response)
            if(!data.api_response.success)
        {
            self.log('error', `Could not disconnect: ${data.api_response.errors.error.code} - ${data.api_response.errors.error.msg}`)
            return false;
        }
        else{
            return true;
        }
    }
    catch (error)
    {
        self.log('error', `Error disconnecting: ${error.message}`);
        return false;
    }
}



module.exports = { refreshAvailableChannels, connectChannel, getPresets, connectPreset, disconnect, refreshLists, getStatus }
