const { refreshAvailableChannels, connectChannel, getPresets, connectPreset } = require('./api');
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
				{
					id: 'learnlabel',
					type: "static-text",
					label: "test"
				}
			],
			learn: async (action) => {
				await refreshAvailableChannels(self, 3);
			},
			callback: async (action) => {
				let success = await connectChannel(self,action.options.receiver, action.options.channel, action.options.mode)
				    // Ensure state storage exists
					self.log("info", JSON.stringify(action))
					//self.config.channelStatus = self.config.channelStatus || {};

					// Generate a unique key for each button using receiver & channel
					let key = action.controlId;
					const selectedReceiver = self.config.receiverChoices.find(r => r.id === action.options.receiver);
					const label = selectedReceiver ? selectedReceiver.label : "Unknown";
					self.config.channelStatus[key] = {connection: success ? "connected" : "error" , receiver: action.options.receiver, channel: action.options.channel, d_name: label};
					self.saveConfig(self.config)
					self.log("info", `channel status = ${JSON.stringify(self.config.channelStatus[key])}`)
					// self.setVariableValues({'channelStatusKey': key})
					// // Automatically refresh feedbacks for all buttons
					self.checkFeedbacks('channel_status', 'channel_status_custom');

				},
				unsubscribe: (action) => {
					self.log("info", `Unsubscribe ${action.controlId} from channelStatus ${JSON.stringify(self.config.channelStatus[action.controlId])}`)
					delete self.config.channelStatus[action.controlId]
					self.saveConfig(self.config)
					self.log("info", `config after delete ${JSON.stringify(self.config.channelStatus)}`)
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
				},
				{
					id: 'force',
					type: 'checkbox',
					label: 'Force',
					tooltip: "Whether to ignore errors with some of the preset's pairs or not.",
					default: false
				}
			],
			learn: async (action) => {
				await getPresets(self, 3);
			},
			callback: async (action) => {
				await connectPreset(self, action.options.preset, action.options.mode, action.options.force ? 1 : 0)
			}
		}
	})
}
