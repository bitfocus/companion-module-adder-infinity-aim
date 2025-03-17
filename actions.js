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
					choices: self.config.receiverChoices,
					default: self.config.receiverChoices[0].id
				},
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel',
					choices: self.config.channelChoices,
					default: self.config.channelChoices[0].id
				},
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Connection Mode',
					choices: [{id: "v", label: "View Only"}, {id: "s", label: "Shared"}, {id: "e", label: "Exclusive"}, {id: "p", label: "Private"}],
					default: "s"
				},
			],
			learn: async (action) => {
				await refreshAvailableChannels(self, 3);
			},
			callback: async (action) => {

				//Try connecting the channel
				let success = await connectChannel(self,action.options.receiver, action.options.channel, action.options.mode)
				
				//Set key to button id
				let key = action.controlId;
				let subkey = `${action.options.receiver}_${action.options.channel}`

				//Get the Receiver Name
				const selectedReceiver = self.config.receiverChoices.find(r => r.id === action.options.receiver);
				const label = selectedReceiver ? selectedReceiver.label : "Unknown";

				//Set channel status and save config
				if (!self.config.channelStatus[key])
				{
					self.config.channelStatus[key] = {}
				}
				
				if (!self.config.channelStatus[key][subkey])
				{
					self.config.channelStatus[key][subkey]={connection: success ? "connected" : "error" , receiver: action.options.receiver, channel: action.options.channel, d_name: label,feedback: false};
				}else{
					self.config.channelStatus[key][subkey]["connection"] = success ? "connected" : "error" 
				}
				self.saveConfig(self.config)

				//Update feedbacks
				self.checkFeedbacks('channel_status', 'channel_status_custom');

				},
				subscribe: async (action) => {

					//Create dict element when subscribing *Need to allow for multiple actions per button here.
					const selectedReceiver = self.config.receiverChoices.find(r => r.id === action.options.receiver);
					const label = selectedReceiver ? selectedReceiver.label : "Unknown";
					let key = action.controlId;
					if (!self.config.channelStatus[key])
						{
							self.config.channelStatus[key] = {}
						}
					let subkey = `${action.options.receiver}_${action.options.channel}`
					self.config.channelStatus[action.controlId][subkey] = {connection: "disconnected", receiver: action.options.receiver, channel: action.options.channel, d_name: label, feedback: false};
				},
				unsubscribe: async (action) => {

					//Remove Dict Element after unsubscribing
					let subkey = `${action.options.receiver}_${action.options.channel}`
					delete self.config.channelStatus[action.controlId][subkey]
					if (self.config.channelStatus[action.controlId].length === 0){
						delete self.config.channelStatus[action.controlId]
					}
					self.saveConfig(self.config)
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
					choices: self.config.presets,
					default: self.config.presets[0].id
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
				if(!self.config.channelStatus[key])
				{
					self.config.channelStatus[key]
				}

				if(!self.config.channelStatus[key][action.options.preset])
				{
					self.config.channelStatus[key][action.options.preset]= {connection: success ? "connected" : "error", preset: action.options.preset, feedback: false};
				}else{
					self.config.channelStatus[key][action.options.preset]["connection"] = success ? "connected" : "error" 
				}
				self.checkFeedbacks('channel_status', 'channel_status_custom');
			},
			subscribe: async (action) => {

				//Create dict element when subscribing *Need to allow for multiple actions per button here.
				let key = action.controlId;
				if (!self.config.channelStatus[key])
					{
						self.config.channelStatus[key] = {}
					}
				let subkey = `${action.options.preset}`
				self.config.channelStatus[action.controlId][subkey] = {connection: "disconnected", preset: action.options.preset, feedback: false};
			},
			unsubscribe: async (action) => {

				//Remove Dict Element after unsubscribing
				let subkey = `${action.options.preset}`
				delete self.config.channelStatus[action.controlId][subkey]
				if (self.config.channelStatus[action.controlId].length === 0){
					delete self.config.channelStatus[action.controlId]
				}
				self.saveConfig(self.config)
			}
		},
		disconnect_preset: {
			name: "Disconnect Preset",
			options: [
				{
					id: 'preset',
					type:'dropdown',
					label: 'Preset',
					choices: self.config.presets,
					default: self.config.presets[0].id
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
			name: "Disconnect Channel",
			options: [
				{
					id: 'receiver',
					type: 'dropdown',
					label: 'Receiver',
					choices: self.config.receiverChoices,
					default: self.config.receiverChoices[0].id
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
				let success = await disconnect(self, "channel", action.options.receiver, action.options.force)
			}
		},
	})
}
