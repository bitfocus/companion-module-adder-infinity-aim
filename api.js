const fetch = require('node-fetch-commonjs');
const { XMLParser } = require('fast-xml-parser');
const { InstanceStatus } = require('@companion-module/base')

async function refreshAvailableChannels(self, retry = 0){
    try{
        self.log("info", `Refresh Clicked ${self.config.token}`)
        let url = `http://${self.config.ip}/api/?v=2&method=get_channels&token=${encodeURIComponent(self.config.token)}`;
        self.log("info", `attempting: ${url}`)
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
                            self.log("info", "calling authentication")
                            await self.authenticate()
                            await refreshAvailableChannels(self, retry-1)
                            return
                        }
                        else{
                            self.log("error", "Could not authenticate")
                            return
                        }
                    }


                
                if (data.api_response && data.api_response.channels) {
                    self.log("info",'Channels Fetched successful.');
                    self.updateStatus(InstanceStatus.Ok);
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
                    self.updateStatus(InstanceStatus.Ok);
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


async function connectChannel(self, rec, channel, mode, retry=2)
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
            if(data.api_response.errors.error.code === 10 && retry > 0){
                await self.authenticate();
                await connectChannel(self, rec, channel, mode, retry-1)
                return;
            }
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
    const hasPreset = Object.values(self.config.channelStatus).some(connections => 
        Object.values(connections).some(value => value.preset !== undefined)
    );
    let presets = null;
    
    if (hasPreset){
        presets = await getPresets(self, 2, true);
        self.log("info", JSON.stringify.presets);
    }
    else {
        self.log("info", "no presets")
    }
    for (const [key, connections] of Object.entries(self.config.channelStatus)){


        if (Object.keys(connections).length === 0){continue;}
        for (const[subkey, value] of Object.entries(connections)){
            let data = null;
            if(!value["feedback"]){
                continue;
            }

            if(value["preset"]){
                Object.values(presets).forEach(entry => {
                    self.log("info", `${cp_id}:, entry.cp_id`);
                });
                const presetInfo = Object.values(presets).find(entry => sub => sub.cp_id === value.preset)
                if(presetInfo){
                    self.log("info", `Found Preset info`);
                    if(presetInfo.cp_active==="none")
                    {
                        if (self.config.channelStatus[key][subkey]["connection"] === "error"){
                            continue;
                        }
                        self.config.channelStatus[key][subkey]["connection"] = "disconnected";
                    }else if(presetInfo.cp_active==="full"){
                        self.config.channelStatus[key][subkey]["connection"] = "connected";
                    }else if(presetInfo.cp_active==="partial"){
                        self.config.channelStatus[key][subkey]["connection"] = "partial";
                    }

                    
                }
                continue;
            }
            
            try{
                let url = `http://${self.config.ip}/api/?v=2&method=get_devices&filter_d_name=${encodeURIComponent(value.d_name)}&token=${encodeURIComponent(self.config.token)}`
                let response = await fetch(url, {
                    method: 'GET', // No need for POST since data is in the URL
                    headers: { 'Content-Type': 'application/xml' }, // Your API might return XML
                });

                let xmlText = await response.text();
                const parser = new XMLParser();
                data = parser.parse(xmlText);
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
                    
                    if (data.api_response.count_devices===0){
                        self.log("warn", "No receivers found, please check your configuration.");
                        continue;
                    }
                    if (data.api_response.devices.device.con_c_id === value.channel)
                    {
                        self.updateStatus(InstanceStatus.Ok);
                        if (data.api_response.devices.device.con_end_time)
                        {
                            if(self.config.channelStatus[key][subkey]["connection"]==="error")
                            {
                                continue;
                            }
                            else
                            {
                                self.log("info", "disconnected")
                                self.config.channelStatus[key][subkey]["connection"]="disconnected"
                            }
                            
                        }
                        else{
                            self.config.channelStatus[key][subkey]["connection"]="connected"
                        }
                    }
                }catch (error){
                    if (data != null ){
                        self.log("error", `${error.message}   ${JSON.stringify(data)}`)
                        self.log('error', `Connection failed with code: ${data.api_response.errors.error.code} - ${data.api_response.errors.error.msg}`)
                        continue;
                    }else{
                        self.log('error', 'No response from AIM. Please check your configuration.');
                        self.updateStatus(InstanceStatus.ConnectionFailure)
                        return;
                        
                    }
                }
            }
    }
    self.checkFeedbacks('channel_status', 'channel_status_custom');
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
            await self.authenticate();
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

            self.config.presets = preset_options
            self.saveConfig(self.config);
            self.updateActions();
            if (rtnData){
                return data.api_response.connection_presets;
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

async function connectPreset(self, cp_id, mode='s', force=0)
{
     let url = `http://${self.config.ip}/api/?v=5&method=connect_preset&token=${encodeURIComponent(self.config.token)}&id=${encodeURIComponent(cp_id)}&mode=${encodeURIComponent(mode)}&force=${encodeURIComponent(force)}`
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
    }
}



module.exports = { refreshAvailableChannels, connectChannel, checkConnectionStatus, getPresets, connectPreset, disconnect }