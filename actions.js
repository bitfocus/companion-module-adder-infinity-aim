const { refreshAvailableChannels, connectChannel, getPresets, connectPreset, disconnect } = require('./api');
module.exports = function (self) {
	self.setActionDefinitions({
		Connect_Channel: {
			name: 'Connect Channel',
			options: [
				{
					id: 'receiver',
					type: 'dropdown',
					label: 'Receiver',
					choices: self.parsedConfig.receiverChoices,
					default: self.parsedConfig.receiverChoices[0].id
				},
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel',
					choices: self.parsedConfig.channelChoices,
					default: self.parsedConfig.channelChoices[0].id
				},
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Connection Mode',
					choices: [{id: "v", label: "View Only"}, {id: "s", label: "Shared"}, {id: "e", label: "Exclusive"}, {id: "p", label: "Private"}],
					default: "s"
				},
				{
					id: 'force',
					type: 'checkbox',
					label: 'Force',
					default: false,
					tooltip: "Forces the channel to connect even if another user is logged in.\n*API User must have permission to channel\n*API User must be admin or the \'Grant All Users Force Disconnect\' setting must be enabled on the server."
				
				}
			],
			learn: async (action) => {
				await refreshAvailableChannels(self, 3);
			},
			callback: async (action) => {

				//Try connecting the channel
				let success = await connectChannel(self,action.options.receiver, action.options.channel, action.options.mode, action.options.force);
				
				//Set key to button id
				let key = action.controlId;
				let subkey = `${action.options.receiver}_${action.options.channel}`

				//Get the Receiver Name
				const selectedReceiver = self.parsedConfig.receiverChoices.find(r => r.id === action.options.receiver);
				const label = selectedReceiver ? selectedReceiver.label : "Unknown";

				//Set channel status and save config
				if (!self.parsedConfig.channelStatus[key])
				{
					self.parsedConfig.channelStatus[key] = {subscribed: false, cleanup: false, feedback: false}
				}
				
				if (!self.parsedConfig.channelStatus[key][subkey])
				{
					self.parsedConfig.channelStatus[key][subkey]={connection: success ? "connected" : "error" , receiver: action.options.receiver, channel: action.options.channel, d_name: label, active: true};
				}else{
					self.parsedConfig.channelStatus[key]["cleanup"]=true;
					self.parsedConfig.channelStatus[key][subkey]["connection"] = success ? "connected" : "error";
					self.parsedConfig.channelStatus[key][subkey]["active"]=true;
				}

				self.checkFeedbacks(...self.feedbackList);
				if (!self.parsedConfig.channelStatus[key]["subscribed"]){
					self.scheduleCleanup(key);
				}
				
				self.stringifyAndSave()

				//Update feedbacks
				self.checkFeedbacks(...self.feedbackList);

				},
				subscribe: async (action) => {

					//Create dict element when subscribing *Need to allow for multiple actions per button here.
					const selectedReceiver = self.parsedConfig.receiverChoices.find(r => r.id === action.options.receiver);
					const label = selectedReceiver ? selectedReceiver.label : "Unknown";
					let key = action.controlId;
					if (!self.parsedConfig.channelStatus[key])
						{
							self.parsedConfig.channelStatus[key] = {subscribed: true, feedback: false}
						}
					let subkey = `${action.options.receiver}_${action.options.channel}`
					self.parsedConfig.channelStatus[action.controlId][subkey] = {connection: "disconnected", receiver: action.options.receiver, channel: action.options.channel, d_name: label};
					self.parsedConfig.channelStatus[key]["subscribed"]=true;
					self.subscribeActionsUsed = true;
					self.stringifyAndSave();
				},
				unsubscribe: async (action) => {
					//Remove Dict Element after unsubscribing
					let subkey = `${action.options.receiver}_${action.options.channel}`
					delete self.parsedConfig.channelStatus[action.controlId][subkey]
					if (self.parsedConfig.channelStatus[action.controlId].length === 0){
						delete self.parsedConfig.channelStatus[action.controlId]
					}
					self.stringifyAndSave();
				}
		},
		refresh_choices: {
            name: 'Refresh Channels',
            options: [],
            callback: async (action) => {
                await refreshAvailableChannels(self, 3);
            }
        },
		connect_preset: {
			name: "Connect Preset",
			options: [
				{
					id: 'preset',
					type:'dropdown',
					label: 'Preset',
					choices: self.parsedConfig.presets,
					default: self.parsedConfig.presets[0].id
				},
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Connection Mode',
					choices: [{id: "v", label: "View Only"}, {id: "s", label: "Shared"}, {id: "e", label: "Exclusive"}, {id: "p", label: "Private"}],
					default: "s"
				}
			],
			learn: async (action) => {
				await getPresets(self, 3);
			},
			callback: async (action) => {
				let success = await connectPreset(self, action.options.preset, action.options.mode)
				let key = action.controlId
				if(!self.parsedConfig.channelStatus[key])
				{
					self.parsedConfig.channelStatus[key] = {subscribed: false, cleanup: false, feedback: false}
				}
				if (!('subscribed' in self.parsedConfig.channelStatus[key])){
					self.parsedConfig.channelStatus[key]["subscribed"] = false;
				}

				if(!self.parsedConfig.channelStatus[key][action.options.preset])
				{
					self.parsedConfig.channelStatus[key][action.options.preset]= {connection: success ? "connected" : "error", preset: action.options.preset, active: true};
				}else{
					self.parsedConfig.channelStatus[key][action.options.preset]["connection"] = success ? "connected" : "error"
					self.parsedConfig.channelStatus[key]["cleanup"]=true;
					self.parsedConfig.channelStatus[key][action.options.preset]["active"]=true;
				}
				self.checkFeedbacks(...self.feedbackList);
				if (!self.parsedConfig.channelStatus[key]["subscribed"]){
					self.scheduleCleanup(key);
				}
				self.stringifyAndSave()
			},
			subscribe: async (action) => {

				//Create dict element when subscribing *Need to allow for multiple actions per button here.
				let key = action.controlId;
				if (!self.parsedConfig.channelStatus[key])
					{
						self.parsedConfig.channelStatus[key] = {subscribed: true, feedback: false}
					}
				let subkey = `${action.options.preset}`
				self.subscribeActionsUsed = true;
				self.parsedConfig.channelStatus[action.controlId][subkey] = {connection: "disconnected", preset: action.options.preset,};
				self.parsedConfig.channelStatus[key]["subscribed"]=true;
				self.stringifyAndSave();
			},
			unsubscribe: async (action) => {

				//Remove Dict Element after unsubscribing
				let subkey = `${action.options.preset}`
				delete self.parsedConfig.channelStatus[action.controlId][subkey]
				if (self.parsedConfig.channelStatus[action.controlId].length === 0){
					delete self.parsedConfig.channelStatus[action.controlId]
				}
				self.stringifyAndSave();
			}
		},
		disconnect_preset: {
			name: "Disconnect Preset",
			options: [
				{
					id: 'preset',
					type:'dropdown',
					label: 'Preset',
					choices: self.parsedConfig.presets,
					default: self.parsedConfig.presets[0].id
				},
				{
					id: 'force',
					type: 'checkbox',
					label: 'Force Disconnect',
					default: false
				}
			],
			learn: async (action) => {
				await getPresets(self, 3);
			},
			callback: async (action) => {
				let success = await disconnect(self, "preset", action.options.preset, action.options.force)
			}
		},
		disconnect_channel: {
			name: "Disconnect Receiver",
			options: [
				{
					id: 'receiver',
					type: 'dropdown',
					label: 'Receiver',
					choices: self.parsedConfig.receiverChoices,
					default: self.parsedConfig.receiverChoices[0].id
				},
				{
					id: 'force',
					type: 'checkbox',
					label: 'Force',
					default: false
				}

			],
			learn: async (action) => {
				await getPresets(self, 3);
			},
			callback: async (action) => {
				let force = action.options.force ? 1 : 0;
				let success = await disconnect(self, "channel", action.options.receiver, force)
			}
		},
	})
}
