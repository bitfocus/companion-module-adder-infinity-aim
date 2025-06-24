const { combineRgb } = require('@companion-module/base')

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
				callback: (feedback) => {

				//Get all connections that have the correct control ID
				let connections = Object.values(self.parsedConfig.channelStatus).filter(conn => conn.actionId.includes(feedback.controlId));

				//Set feedback status
				connections.forEach(conn => {
					conn.feedback = true;
				});
			

					if (Object.keys(connections).length === 0) {
						return {};
					}

					let allError = connections.every(conn => conn.connection === "error");
					let allConnected = connections.every(conn => conn.connection === "connected");
					let allDisconnected = connections.every(conn => conn.connection === "disconnected");
					let allPartial = connections.every(conn => conn.connection === "partial");

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

					//Get all connections for the button and set true
					let connections = Object.values(self.parsedConfig.channelStatus).filter(conn => conn.actionId.includes(feedback.controlId));
					connections.forEach(conn => {
						conn.feedback = true;
					});

					self.stringifyAndSave();
				},
				
				unsubscribe: async (feedback) => {

					//Set feedback flag on connections
					let connections = Object.values(self.parsedConfig.channelStatus).filter(conn => conn.actionId.includes(feedback.controlId));
					connections.forEach(conn => {
						conn.feedback = false;
					});

					self.stringifyAndSave()
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
					id: 'connectionState',
					type: 'dropdown',
					label: 'Connection State',
					choices: [
						{id: "connected", label: "Connected"}, 
						{id: "disconnected", label: "Disconnected"},
						{id: "error", label: "Error"}
					],
					default: "connected"
				},
			],			
			learn: async (action) => {
				await refreshLists(self, 3);
			},
			callback: (feedback) => {

				//Ensure key exists in status
				let key = `${feedback.options.receiver}_${feedback.options.channel}`
				let connectionStatus = self.parsedConfig.channelStatus?.[key] || {};
				if (!connectionStatus) {
					return {};
				}

				//Set feedback and check against connection state
				connectionStatus.feedback=true;
				if (connectionStatus.connection === feedback.options.connectionState) {
					return true
				} else{
					return false
				}
				},
				subscribe: async (feedback) => {
					let key = `${feedback.options.receiver}_${feedback.options.channel}`
					if (!self.parsedConfig.channelStatus[key]) return;
					self.parsedConfig.channelStatus[key].feedback = true;
					self.stringifyAndSave()
				},
				
				unsubscribe: async (feedback) => {
					let key = `${feedback.options.receiver}_${feedback.options.channel}`
					if (!self.parsedConfig.channelStatus[key]) return;
					self.parsedConfig.channelStatus[key].feedback = false;
					self.stringifyAndSave()
				}
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
					default: self.parsedConfig.presets[0].id
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
			callback: (feedback) => {
				let key = `${feedback.options.preset}`
				let connectionStatus = self.parsedConfig.channelStatus?.[key] || {};
				if (!connectionStatus) {
					return {};
				}
				connectionStatus.feedback=true;
				if (connectionStatus.connection === feedback.options.connectionState) {
					return true
				} else{
					return false
				}
				},
				subscribe: async (feedback) => {
					let key = `${feedback.options.receiver}_${feedback.options.channel}`
					if (!self.parsedConfig.channelStatus[key]) return;
					self.parsedConfig.channelStatus[key].feedback = true;
					self.stringifyAndSave()
				},
				
				unsubscribe: async (feedback) => {
					let key = `${feedback.options.receiver}_${feedback.options.channel}`
					if (!self.parsedConfig.channelStatus[key]) return;
					self.parsedConfig.channelStatus[key].feedback = false;
					self.stringifyAndSave()
				}
		},
	
	});
	
}
