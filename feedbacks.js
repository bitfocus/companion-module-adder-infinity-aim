const { combineRgb } = require('@companion-module/base')
const { getStatus } = require('./api')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
			channel_status_pre_configured: {
				name: 'Channel Connection Status Pre-Configured (Companion Only)',
				type: 'advanced',
				options: [
					{
						type: 'colorpicker',
						label: 'Connected Background Color',
						id: 'bg_connected',
						tooltip: 'Button Background Color for successful connection',
						default: 0x00ff00 // Green
					},
					{
						type: 'colorpicker',
						label: 'Connected Text Color',
						id: 'fg_connected',
						tooltip: 'Button Text color for successful connection',
						default: 0x000000 // Black
					},
					{
						type: 'colorpicker',
						label: 'Warning Background Color',
						id: 'bg_warning',
						tooltip: 'Button Background Color for a mix of successful and failed connections',
						default: 0xffa500 // orange
					},
					{
						type: 'colorpicker',
						label: 'Warning Text Color',
						id: 'fg_warning',
						tooltip: 'Button Background Color for a mix of successful and failed connections',
						default: 0x000000 // Black
					},
					{
						type: 'colorpicker',
						label: 'Error Background Color',
						id: 'bg_error',
						tooltip: 'Button Background Color for failed connection',
						default: 0xff0000 // Red
					},
					{
						type: 'colorpicker',
						label: 'Error Text Color',
						id: 'fg_error',
						tooltip: 'Button Background Color for failed connection',
						default: 0xffffff // White
					},
				],
				callback: async (feedback) => {
					
					if (!self.advancedFeedback[feedback.controlId]){
						self.advancedFeedback[feedback.controlId]={};
					}
					self.subscribeActions();
					let status = []
					 for (const [key, val] of Object.entries(self.advancedFeedback[feedback.controlId])){
						var stat = null;
						if(val.preset){
							stat = await getStatus(self, null, null, val.preset)
							status.push(stat);
						}else{
							stat = await getStatus(self, val.d_name, val.channel);
							status.push(stat);
						}
					 }

				//Get all connections that have the correct control ID
				
					let allError = status.every(conn => conn === self.CONN.ERROR);
					let allConnected = status.every(conn => conn === self.CONN.CONNECTED || conn == self.CONN.FULL);
					let allDisconnected = status.every(conn => conn === self.CONN.DISCONNECTED);
					let allPartial = status.every(conn => conn === self.CONN.PARTIAL);

					if (allConnected) {

						return {
							bgcolor: feedback.options.bg_connected, // User-selected color
							color: feedback.options.fg_connected // User-selected text color
							
						};
					} else if (allError) {

						return {
							bgcolor: feedback.options.bg_error, // User-selected color
							color: feedback.options.fg_error // User-selected text color
						};
					} else if (allPartial || (!allConnected && !allDisconnected && !allError)){

						return{
							bgcolor: feedback.options.bg_warning,
							color: feedback.options.fg_warning
						}
					}

					return {}; // Default button styling
				},
				subscribe: async (feedback) => {
					if (!self.advancedFeedback[feedback.controlId]){
						self.advancedFeedback[feedback.controlId]={};
					}
					self.subscribeActions();
				},
				
				unsubscribe: async (feedback) => {
					delete self.advancedFeedback[feedback.controlId];
				}
			},
		channel_status_boolean: {
			name: 'Channel Connection Status',
			type: 'boolean',
			options: [
				{
					id: 'receiver',
					type: 'dropdown',
					label: 'Receiver',
					choices: self.parsedConfig.receiverChoices,
					default: self.parsedConfig.receiverChoices.length > 0 ? self.parsedConfig.receiverChoices[0].id : 'None'
				},
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel',
					choices: self.parsedConfig.channelChoices,
					default: self.parsedConfig.channelChoices.length > 0 ? self.parsedConfig.channelChoices[0].id : 'None'
				},
				{
					id: 'connectionState',
					type: 'dropdown',
					label: 'Connection State',
					choices: [
						{id: self.CONN.CONNECTED, label: "Connected"}, 
						{id: self.CONN.DISCONNECTED, label: "Disconnected"},
						{id: self.CONN.ERROR, label: "Error"}
					],
					default: "connected"
				},
			],			
			learn: async (action) => {
				await refreshLists(self, 3);
			},
			callback: async (feedback) => {
				const selectedReceiver = self.parsedConfig.receiverChoices.find(r => r.id === feedback.options.receiver);
				const label = selectedReceiver ? selectedReceiver.label : "Unknown";
				let status = await getStatus(self, label, feedback.options.channel);
				if (status === feedback.options.connectionState) {
					return true
				} else{
					return false
				}
			},
		},
		preset_status_boolean: {
			name: 'Preset Connection Status',
			type: 'boolean',
			options: [
				{
					id: 'preset',
					type: 'dropdown',
					label: 'Preset',
					choices: self.parsedConfig.presets,
					default: self.parsedConfig.presets.length > 0 ? self.parsedConfig.presets[0].id : 'None'
				},
				{
					id: 'connectionState',
					type: 'dropdown',
					label: 'Connection State',
					choices: [
						{id: "full", label: "Connected"}, 
						{id: "disconnected", label: "Disconnected"},
						{id: "error", label: "Error"},
						{id: "partial", label: "Partial Connection"}
					],
					default: "full"
				},
			],
			learn: async (action) => {
				await refreshLists(self, 3);
			},
			callback: async (feedback) => {
				let status = await getStatus(self, null, null, feedback.options.preset);
				if (status === feedback.options.connectionState) {
					return true
				} else{
					return false
				}
			},
		},
	
	});
	
}
