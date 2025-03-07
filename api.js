const fetch = require('node-fetch-commonjs');
const { XMLParser } = require('fast-xml-parser');

async function refreshAvailableChannels(self, retry = 0){
    try{
        self.log("info", "Refresh Clicked")
        let url = `http://${self.config.ip}/api/?v=2&method=get_channels&token=${encodeURIComponent(self.config.token)}`;
                let response = await fetch(url, {
                    method: 'GET', // No need for POST since data is in the URL
                    headers: { 'Content-Type': 'application/xml' }, // Your API might return XML
                });
        
                let xmlText = await response.text();
                const parser = new XMLParser();
                let data = parser.parse(xmlText);
                if (data.api_response && !data.api_response.success)
                    {
                        if (retry>0){
                            await self.authenticate()
                            refreshAvailableChannels(self, retry-1)
                            return
                        }
                        else{
                            self.log("error", "Could not authenticate")
                            return
                        }
                    }


                
                if (data.api_response && data.api_response.channels) {
                    self.log("info",'Channels Fetched successful.');
                    let channels = Array.isArray(data.api_response.channels.channel)
                    ? data.api_response.channels.channel
                    : [data.api_response.channels.channel];
                    let channel_options = [{id: "None", label: "None"}]

                    channels.forEach(channel => {
                        channel_options.push({id: channel.c_id, label: channel.c_name})
                        
                    });
                    self.config.channelChoices = channel_options
                    self.saveConfig(self.config);
                    await refreshAvailableReceivers(self, retry)
                    self.updateActions();

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
                        await self.authenticate()
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
                    let devices = Array.isArray(data.api_response.devices.device)
                    ? data.api_response.devices.device
                    : [data.api_response.devices.device];
                    let device_options = [{id: "None", label: "None"}]
                    
                    devices.forEach(device => {
                        device_options.push({id: device.d_id, label: device.d_name})
                        
                    });
                    self.config.receiverChoices = device_options
                    self.saveConfig(self.config);

                } else {
                    self.log("Error", 'Unable to fetch receivers');
                    return null;
                }
    }
    catch (error){
        self.log("error", error.message)
    }
}


async function connectChannel(self, rec, channel, mode)
{
    let url = `http://${self.config.ip}/api/?v=5&method=connect_channel&token=${encodeURIComponent(self.config.token)}&c_id=${encodeURIComponent(channel)}&rx_id=${encodeURIComponent(rec)}&mode=${encodeURIComponent(mode)}`
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
            self.log('error', `Connection failed with code :${data.api_response.errors.error.code} - ${data.api_response.errors.error.msg}`)
            return false;
        }
        else{
            return true;
        }
    }
    catch (error)
    {
        self.log('error', `Failed to change channel: ${error.message}`);
    }
}

async function checkConnectionStatus(self, retry=0)
{
    for (const [key, value] of Object.entries(self.config.channelStatus)){
        let url = `http://${self.config.ip}/api/?v=2&method=get_devices&filter_d_name=${encodeURIComponent(value.d_name)}&token=${encodeURIComponent(self.config.token)}`
        let response = await fetch(url, {
            method: 'GET', // No need for POST since data is in the URL
            headers: { 'Content-Type': 'application/xml' }, // Your API might return XML
        });

        let xmlText = await response.text();
        const parser = new XMLParser();
        let data = parser.parse(xmlText);
        if (data.api_response && !data.api_response.success)
            {
                const error = Array.isArray(data.api_response.errors)
                ? data.api_response.errors[0]?.error
                : data.api_response.errors?.error;
        
            if (error?.code === 10) {
                await self.authenticate();
                continue;
                }
                else{
                    self.log("error", "Could not find device")
                    continue
                }
            }
        
            if (data.api_response.devices.device.con_c_id === value.channel)
            {
                if (data.api_response.devices.device.con_end_time)
                {
                    if(self.config.channelStatus[key]["connection"]==="error")
                    {
                        continue
                    }
                    else
                    {
                        self.config.channelStatus[key]["connection"]="disconnected"
                    }
                    
                }
                else{
                    self.config.channelStatus[key]["connection"]="connected"
                }
            }
    }
    self.checkFeedbacks('channel_status', 'channel_status_custom');
}

async function getPresets(self, retry=0)
{
    let url = `http://${self.config.ip}/api/?v=1&method=get_presets&token=${encodeURIComponent(self.config.token)}`
    let response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/xml' }, 
    });

    let xmlText = await response.text();
    const parser = new XMLParser();
    let data = parser.parse(xmlText);
    
    if ( data.api_response && !data.api_response.success )
    {
    const error = Array.isArray(data.api_response.errors)
        ? data.api_response.errors[0]?.error
        : data.api_response.errors?.error;
    if (error?.code === 10 && retry > 0) {
        await self.authenticate();
        await getPresets(self, retry - 1); // Ensure we await the function
        return;
        }
        else{
            self.log("error", "Could not fetch presets")
            return
        }
    }

    let presets = Array.isArray(data.api_response.connection_presets.connection_preset)
        ? data.api_response.connection_presets.connection_preset
        : [data.api_response.connection_presets.connection_preset];
    self.log("info", JSON.stringify(presets))
        let preset_options = [{id: "None", label: "None"}]
    presets.forEach( p => {
        preset_options.push({id: p.cp_id, label: p.cp_name});
    })

    self.config.presets = preset_options
    self.saveConfig(self.config);
    self.updateActions();

    }

async function connectPreset(self, cp_id, mode=s, force=0)
{
     let url = `http://${self.config.ip}/api/?v=5&method=connect_preset&token=${encodeURIComponent(self.config.token)}&id=${encodeURIComponent(cp_id)}&mode=${encodeURIComponent(mode)}&force=${encodeURIComponent(force)}`
     self.log("info", url)
}


module.exports = { refreshAvailableChannels, connectChannel, checkConnectionStatus, getPresets, connectPreset }