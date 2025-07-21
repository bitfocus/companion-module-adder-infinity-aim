const { refreshAvailableChannels, refreshLists, connectChannel, getPresets, connectPreset, disconnect } = require('./api');
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
				
				},
				{
					id: 'userCheckbox',
					type: 'checkbox',
					label: "Use a different user?",
					default: false,
					tooltip: "Specify a different user to connect this channel."
				},
				{
					id: 'username',
					type: 'textinput',
					label: 'Connection User',
					isVisible: (options) => {
						return options.userCheckbox === true
					},
				},
				{
					id: 'password',
					type: 'textinput',
					label: 'Connection Password',
					isVisible: (options) => {
						return options.userCheckbox === true
					},
				},
			],
			learn: async (action) => {
				await refreshLists(self, 3);
			},
			callback: async (action) => {

				let success = null;
				//Try connecting the channel
				if(action.options.userCheckbox){
					let success = await connectChannel(self,action.options.receiver, action.options.channel, action.options.mode, action.options.username, action.options.password, action.options.force);
				}else{
					success = await connectChannel(self,action.options.receiver, action.options.channel, action.options.mode, self.config.username, self.config.password, action.options.force);
				}

				//let key = action.controlId;
				

				//Get the Receiver Name
				const selectedReceiver = self.parsedConfig.receiverChoices.find(r => r.id === action.options.receiver);
				const label = selectedReceiver ? selectedReceiver.label : "Unknown";
				let key = `${label}_${action.options.channel}`

				const cacheKey = label;
				if (self.cachedReceivers && self.cachedReceivers[cacheKey]) {
					delete self.cachedReceivers[cacheKey]; // Force next call to be fresh
				}


				if(self.advancedFeedback[action.controlId]){
					self.advancedFeedback[action.controlId][key]={d_name: label, channel: action.options.channel};
				}
				if (!success){
					self.errorTracker.add(key);
				}else{
					self.errorTracker.delete(key);
				}
				

				//Update feedbacks
				self.checkFeedbacks(...self.feedbackList);

				},
					subscribe: async (action) => {
					let key = `${action.options.receiver}_${action.options.channel}`

					//Get the Receiver Name
					const selectedReceiver = self.parsedConfig.receiverChoices.find(r => r.id === action.options.receiver);
					const label = selectedReceiver ? selectedReceiver.label : "Unknown";
					if(self.advancedFeedback[action.controlId] && !self.advancedFeedback[action.controlId][key]){
						self.advancedFeedback[action.controlId][key]={d_name: label, channel: action.options.channel};
					}
				},
				unsubscribe: async (action) => {
					//Remove Dict Element after unsubscribing
					let key = `${action.options.receiver}_${action.options.channel}`
					if(self.advancedFeedback[action.controlId]){
						delete self.advancedFeedback[action.controlId][key]
					}
				}
		},
		refresh_choices: {
            name: 'Refresh Devices and Presets',
            options: [],
            callback: async (action) => {
                await refreshLists(self, 3);
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
				},
				{
					id: 'force',
					type: 'checkbox',
					label: 'Force',
					default: false
				},
				{
					id: 'userCheckbox',
					type: 'checkbox',
					label: "Use a different user?",
					default: false,
					tooltip: "Specify a different user to connect this channel."
				},
				{
					id: 'username',
					type: 'textinput',
					label: 'Connection User',
					isVisible: (options) => {
						return options.userCheckbox === true
					},
				},
				{
					id: 'password',
					type: 'textinput',
					label: 'Connection Password',
					isVisible: (options) => {
						return options.userCheckbox === true
					},
				},
			],
			learn: async (action) => {
				await refreshLists(self, 3);
			},
			callback: async (action) => {
				let success = null;
				if (action.options.userCheckbox){
					success = await connectPreset(self, action.options.preset, action.options.username, action.options.password,  action.options.mode, action.options.force)
				}else{
					success = await connectPreset(self, action.options.preset, self.config.username, self.config.password, action.options.mode, action.options.force);
				}

				let key = action.options.preset
				if (self.cachedPresets) {
					delete self.cachedPresets.time;
					delete self.cachedPresets.presetInfo;
				}
				if(self.advancedFeedback[action.controlId]){
					self.advancedFeedback[action.controlId][key]={preset: self.options.preset};
				}
				if (!success){
					self.errorTracker.add(key);
				}else{
					self.errorTracker.delete(key);
				}
				self.checkFeedbacks(...self.feedbackList);
				
			},
			subscribe: async (action) => {

				//Create dict element when subscribing *Need to allow for multiple actions per button here.
					//const selectedReceiver = self.parsedConfig.receiverChoices.find(r => r.id === action.options.receiver);
					let key = action.options.preset
				if(self.advancedFeedback[action.controlId]){
					self.advancedFeedback[action.controlId][key]={"preset": action.options.preset};
				}
			},
			unsubscribe: async (action) => {

					if(self.advancedFeedback[action.controlId]){
						delete self.advancedFeedback[action.controlId][action.options.preset];
					}
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
				await refreshLists(self, 3);
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
				await refreshLists(self, 3);
			},
			callback: async (action) => {
				let force = action.options.force ? 1 : 0;
				let success = await disconnect(self, "channel", action.options.receiver, force)
			}
		},
	})
}
