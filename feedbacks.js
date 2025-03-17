const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
			channel_status: {
				name: 'Channel Connection Status Auto',
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

		
					let connectionStatus = self.config.channelStatus?.[feedback.controlId] || {};

					let allError = Object.values(connectionStatus).every(conn => conn.connection === "error");
					let allConnected = Object.values(connectionStatus).every(conn => conn.connection === "connected");
					let allDisconnected = Object.values(connectionStatus).every(conn => conn.connection === "disconnected");
					let allPartial = Object.values(connectionStatus).every(conn => conn.connection === "partial");
					if (Object.keys(connectionStatus).length === 0) {
						return {};
					}

		
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
					} else if (allPartial || (!allConnected && !allDisconnected && !allConnected)){

						return{
							bgcolor: feedback.options.bg_warning,
							color: feedback.options.fg_warning
						}
					}

					return {}; // Default button styling
				},
				subscribe: async (feedback) => {

					if (!self.config.channelStatus[feedback.controlId]) {
						self.config.channelStatus[feedback.controlId] = {};
					}
				
					// Mark all active connections as feedback-tracked
					for (let subKey in self.config.channelStatus[feedback.controlId]) {

						self.config.channelStatus[feedback.controlId][subKey].feedback = true;

					}
					self.saveConfig(self.config)
				},
				
				unsubscribe: async (feedback) => {
					if (!self.config.channelStatus[feedback.controlId]) return;

					// Untrack feedback for all connections under this button
					for (let subKey in self.config.channelStatus[feedback.controlId]) {
						self.config.channelStatus[feedback.controlId][subKey].feedback = false;
					}
					self.saveConfig(self.config)
				}
			},
		channel_status_custom: {
			name: 'Channel Connection Status Customizable',
			type: 'boolean',
			options: [
				{
					id: 'test',
					type: 'textinput',
					label: "test"
				}
			],
			callback: (feedback) => {

				//let key = `${feedback.options.receiver}-${feedback.options.channel}`;
				let connectionStatus = {}
				if (self.config.channelStatus && self.config.channelStatus[feedback.controlId])
				{
					connectionStatus = self.config.channelStatus[feedback.controlId]
				}
				else{
					return false
				}

	
				// Check if we have a stored success/failure state
				if (connectionStatus.connection === true) {
					return true
				} else if (connectionStatus.connection === false) {
					return false
				}
	
				return {}; // Default button color
			}
		}
	});
	
}
