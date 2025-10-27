const fetch = require('node-fetch-commonjs');
const { XMLParser } = require('fast-xml-parser');
const { InstanceStatus } = require('@companion-module/base')


/*
    Refreshes all lists from AIM
*/
async function refreshLists(self, retry = 2, rtnData = false){
    let presets = [];
    try{
        await refreshAvailableChannels(self, retry);
    }catch (error){
        self.log("error", error.message);
    }
    try{
        await refreshAvailableReceivers(self, retry);
    }catch (error){
        self.log("error", error.message);
    }
    try{
        presets = await refreshAvailablePresets(self, retry, rtnData);
    }catch (error){
        self.log("error", error.message);
    }
        self.stringifyAndSave();
        self.updateActions();
        self.updateFeedbacks();
        if (rtnData) return presets;
}

async function getChannels(self, retry =0, page=1){
        try{
        let url = `http://${self.config.ip}/api/?v=14&method=get_channels&token=${encodeURIComponent(self.config.token)}&page=${page}`;
                let response = await fetch(url, {
                    method: 'GET', // No need for POST since data is in the URL
                    headers: { 'Content-Type': 'application/xml' }, // Your API might return XML
                });
                
                if(response.status===429){
                    throw new Error('Server Rejected with Status 429 - Too many requests');
                }
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
                            return await getChannels(self, retry-1, page)
                            
                        }
                        else{
                            self.log("error", "Could not authenticate")
                            throw new Error("Authentication failed after retries")
                        }
                    }


                //If success, get channels and return list
                if (data.api_response && data.api_response.channels) {
                    if (self.currentStatus !== InstanceStatus.Ok){
                        self.currentStatus = InstanceStatus.Ok;
                        self.updateStatus(InstanceStatus.Ok);
                    }
                    let channels = [];
                    if (data.api_response.channels.channel){
                        channels = Array.isArray(data.api_response.channels.channel)
                            ? data.api_response.channels.channel
                            : [data.api_response.channels.channel];

                    }
                    let return_data = {
                        total_channels: parseInt(data.api_response.total_channels, 10), 
                        count_channels: parseInt(data.api_response.count_channels, 10), 
                        current_page: parseInt(data.api_response.page, 10),
                        results_per_page: parseInt(data.api_response.results_per_page, 10),
                        channels: channels
                    }
                    return return_data;
                }
            }catch (error){
                self.log("error", `getChannels failed: ${error.message}`);
                throw error;
            }

}

/*
    Refresh Channel List from AIM server.
*/
async function refreshAvailableChannels(self, retry = 0){
    try{
        let data = await getChannels(self, retry);
        let channels = data.channels;

        if(data.count_channels < data.total_channels){
            let current_page = data.current_page;
            let total_pages = Math.ceil(data.total_channels/data.results_per_page);
            for (let i = current_page + 1; i <= total_pages; i++){
                let tempData = await getChannels(self, retry, i);
                channels.push(...tempData.channels);
            }
        }
        let channel_options=[{id: "None", label: "None"}];
        channels.forEach(channel => {
            channel_options.push({id: channel.c_id, label: channel.c_name})
        });
        self.parsedConfig.channelChoices = channel_options
    }
    catch (error){
        self.log("error", error.message)
    }
}

async function getReceivers(self, retry=0, page=1){
    try{
            //self.log("info", "Refresh Receivers")
            let url = `http://${self.config.ip}/api/?v=14&method=get_devices&device_type=rx&token=${encodeURIComponent(self.config.token)}&page=${page}`;
                    let response = await fetch(url, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/xml' }, 
                    });

                    if(response.status===429){
                        throw new Error('429');
                    }
            
                    let xmlText = await response.text();
                    const parser = new XMLParser();
                    let data = parser.parse(xmlText);
                    
                    if (data.api_response && !data.api_response.success)
                    {
                        if (retry>0){
                            await self.authenticate(self.config.username, self.config.password)
                            return await getReceivers(self, retry-1, page)
                        }
                        else{
                            self.log("error", "Could not authenticate")
                            throw new Error("Authentication failed after retries")
                        }
                    }
                    let devices = [];
                    if (data.api_response.devices) {
                        if (data.api_response.devices.device) { 
                            devices = Array.isArray(data.api_response.devices.device)
                                ? data.api_response.devices.device
                                : [data.api_response.devices.device];
                        }

                        let return_data = {
                           total_devices: parseInt(data.api_response.total_devices, 10), 
                            count_devices: parseInt(data.api_response.count_devices, 10), 
                            current_page: parseInt(data.api_response.page, 10),
                            results_per_page: parseInt(data.api_response.results_per_page, 10),
                            devices: devices}
                        return return_data;
                    }else {
                    self.log("Error", 'Unable to fetch receivers');
                    throw new Error("Unable to fetch receivers: No 'devices' field in API response");
                }
            }catch (error){
                throw error;
            }
}

async function refreshAvailableReceivers(self, retry=0){
    self.refreshingCacheInProgress=true;
    try{

        let data = await getReceivers(self, retry);
        let devices = data.devices;
        //self.log("info",'Receivers Fetched successful.');
        if (self.currentStatus !== InstanceStatus.Ok){
            self.currentStatus = InstanceStatus.Ok;
            self.updateStatus(InstanceStatus.Ok);
        }
        if (data.count_devices < data.total_devices){
            let current_page = data.current_page;
            let total_pages = Math.ceil(data.total_devices/data.results_per_page);
            for (let i = current_page + 1; i <= total_pages; i++){
                let tempData = await getReceivers(self, retry, i);
                devices.push(...tempData.devices);
            }
        }
        let device_options = [{id: "None", label: "None"}]

        
        devices.forEach(device => {
            device_options.push({id: device.d_id, label: device.d_name})
            self.cachedReceivers[device.d_name]={id: device.d_id, con_c_id: device.con_c_id, con_end_time: device.con_end_time, status: device.d_status}
            
        });
        self.receiverCacheLastRefreshed = Date.now();
        self.parsedConfig.receiverChoices = device_options
        self.stringifyAndSave();

    }catch (error){
        self.log("error", `Refresh Receivers failed ${error.message}`);
        throw error;
    }finally{
        self.refreshingCacheInProgress=false;
        
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
        self.cachedPresets = self.cachedPresets || {};

        const isPresetCacheValid = self.presetCacheLastRefreshed && (now -self.presetCacheLastRefreshed < self.cachedTimeout);

        try {
            if (!isPresetCacheValid){
                if (!self.presetRefreshPromise){
                    self.presetRefreshPromise = (async () => {
                        try{
                            const presets = await refreshAvailablePresets(self, 2);
                            } finally {
                                self.presetRefreshPromise=null;
                            }
                    })();
                }
                await self.presetRefreshPromise;
            }
        } catch (error) {
            if (String(error.message).includes('429')) {
                self.log("warn", "429 Too Many Requests on Presets. Using stale data.");
            } else {
                self.log("error", `Preset check failed during refresh: ${error.message}`);
                return self.CONN.ERROR; // Real error
            }
        }
        presetInfo = self.cachedPresets[presetID]

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
    if (key === "None") {return self.CONN.DISCONNECTED}
	if (!self.cachedReceivers) self.cachedReceivers = {};

	try {

        const isCacheValid = self.receiverCacheLastRefreshed && (now - self.receiverCacheLastRefreshed < self.cachedTimeout);
        //Get Fresh Cache
        try{
            if (!isCacheValid){
                if(!self.refreshPromise){
                    self.refreshPromise = (async () => {
                        try {
                            await refreshAvailableReceivers(self);
                        } finally {
                            self.refreshPromise = null;
                        }
                    })();
                }
                await self.refreshPromise;
            }
        } catch (error){
            if (String(error.message) === '429') {
                        self.log("warn", "429 Too Many Requests. Using stale data until next poll.");
                    } else {
                        self.log("error", `Status check failed during refresh: ${error.message}`);
                        return self.CONN.ERROR;
                    }
        }
		const device = self.cachedReceivers[key];

        if (!device){
            self.log("warn", `Receiver "${key}" not found in cache. Please check configuration.`);
            return self.CONN.ERROR;
        }

		// Connected to expected channel?
		if (String(device.con_c_id) === String(chID)) {

			if (device.con_end_time || device.status==0) {
				return self.errorTracker.has(`${rxName}_${chID}`) ? self.CONN.ERROR : self.CONN.DISCONNECTED;
			} else {
				return self.CONN.CONNECTED;
			}
		} else {
			return self.errorTracker.has(`${rxName}_${chID}`) ? self.CONN.ERROR : self.CONN.DISCONNECTED;
		}
	} catch (error) {
	    self.log("error", `Error Parsing Receiver Feedback for RX - \"${key}\": ${error.message}`);
		return self.CONN.ERROR;
	}
}

async function getPresets(self, retry=0, page=1){
    let url = `http://${self.config.ip}/api/?v=14&method=get_presets&token=${encodeURIComponent(self.config.token)}&page=${page}`
    let data = null;
    try{
        let response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/xml' }, 
        });

        if (response.status===429){
            throw new Error('Server Rejected with Status 429 - Too many requests');
        }

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
            return await getPresets(self, retry - 1, page); // Ensure we await the function
            }
            else{
                self.log("error", "Could not fetch presets")
                throw new Error("Authentication failed after retries.")
            }
        }

        let presets = [];
        if(data.api_response.connection_presets && data.api_response.connection_presets.connection_preset){
            presets = Array.isArray(data.api_response.connection_presets.connection_preset)
                ? data.api_response.connection_presets.connection_preset
                : [data.api_response.connection_presets.connection_preset];
        }
        let return_data = {
            total_presets: parseInt(data.api_response.total_presets, 10), 
            count_presets: parseInt(data.api_response.count_presets, 10), 
            current_page: parseInt(data.api_response.page, 10),
            results_per_page: parseInt(data.api_response.results_per_page, 10),
            presets: presets}
            return return_data;
    }catch (error){
        if(data){
            self.log('error', `Connection failed with code: ${JSON.stringify(data)} with js ${error.message}`)

        }else {
            self.log("error", error.message)
        }
        throw error;
    }

}

async function refreshAvailablePresets(self, retry=0, rtnData = false)
{
    try{
        let data = await getPresets(self, retry)
        let presets = data.presets;
        if (data.count_presets < data.total_presets){
            let total_pages = Math.ceil(data.total_presets/data.results_per_page);
            for (let i = data.current_page + 1; i <= total_pages; i++){
                let tempData = await getPresets(self, retry, i);
                presets.push(...tempData.presets);
            }
        }
        let preset_options = [{id: "None", label: "None"}]
        self.cachedPresets={}
        presets.forEach( p => {
            preset_options.push({id: p.cp_id, label: p.cp_name});
            self.cachedPresets[p.cp_id] = p;
        });
        self.presetCacheLastRefreshed = Date.now();
        self.parsedConfig.presets = preset_options
        if (rtnData){
            return presets;
        }

    }catch (error){
        throw error;
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



module.exports = { refreshAvailableChannels, connectChannel, refreshAvailablePresets, connectPreset, disconnect, refreshLists, getStatus }
