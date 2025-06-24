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
                            await self.authenticate()
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


async function connectChannel(self, rec, channel, mode, force = false, retry=2)
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
            self.log('error', `Connection failed with code: ${data.api_response.errors.error.code} - ${data.api_response.errors.error.msg}`)
        if (force){
            let result = await disconnect(self, "channel", rec, 1);
            if (!result){
                return false;
            }
            return await connectChannel(self, rec, channel, mode, force, retry-1)
        }
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

/*
    Polls the AIM server and gets current status of connections. Updates Feedback.
*/
async function checkConnectionStatus(self, retry=0)
{

    //Check if any presets are used as to get preset status, we need to pull the preset list.
    const hasPreset = Object.values(self.parsedConfig.channelStatus).some(value => value.preset !== undefined);
    let data = null;
    let presets = null;

    //If preset exists, refresh all lists and get preset list.
    if (hasPreset){
        presets = await refreshLists(self, 2, true);
    }
    
    //Manually cleanup any buttons that aren't being tracked
    self.cleanupInactiveFeedback();

    //Run through all connections
    for (const [key, status] of Object.entries(self.parsedConfig.channelStatus)){

        //Check for scheduled cleanup
        if (self.parsedConfig.channelStatus[key]["cleanup"]){
            self.cleanupInactiveForKey(key);
        }

        //Ensure button is tracked
        if (status.actionId.length === 0 || !status.feedback){
            continue;}

        //Run through preset status
        if (status.preset){
            const presetInfo = Object.values(presets).find(entry => String(entry.cp_id) === String(status.preset))
            if(presetInfo){
                if(presetInfo.cp_active==="none")
                {
                    if (status.connection === "error"){
                        continue;
                    }
                    
                    status.connection = "disconnected";
                }else if(presetInfo.cp_active==="full"){
                    status.connection = "full";
                    
                }else if(presetInfo.cp_active==="partial"){
                    status.connection = "partial";
                }
                
            }
            continue;
        }else{
            try{
                //Get Current status of Receiver
                let url = `http://${self.config.ip}/api/?v=2&method=get_devices&&device_type=rx&filter_d_name=${encodeURIComponent(status.d_name)}&token=${encodeURIComponent(self.config.token)}`
                let response = await fetch(url, {
                    method: 'GET', 
                    headers: { 'Content-Type': 'application/xml' },
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

                    //Check the receiver is connected to expected channel
                    if (data.api_response.devices.device.con_c_id === status.channel)
                    {
                       
                        if (this.currentStatus !== InstanceStatus.Ok){
                            this.currentStatus = InstanceStatus.Ok;
                            self.updateStatus(InstanceStatus.Ok);
                        }

                        //If endtime, means it is no longer connected.
                        if (data.api_response.devices.device.con_end_time)
                        {
                            //If the connection status is an error, don't replace
                            if(status.connection==="error")
                            {
                                continue;
                            }
                            else
                            {
                               status.connection="disconnected"
                            }
                            
                        }
                        else{
                            status.connection="connected"
                        }
                    }
                else{
                    if(status.connection==="error")
                        {
                            continue;
                        }
                    status.connection="disconnected"

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
    
        self.stringifyAndSave();
        self.checkFeedbacks(...self.feedbackList);
        }
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
        return false;
    }
}



module.exports = { refreshAvailableChannels, connectChannel, checkConnectionStatus, getPresets, connectPreset, disconnect, refreshLists }
