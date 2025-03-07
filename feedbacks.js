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
						default: 0x00ff00 // Green
					},
					{
						type: 'colorpicker',
						label: 'Connected Text Color',
						id: 'fg_connected',
						default: 0xffffff // Black
					},
					{
						type: 'colorpicker',
						label: 'Error Background Color',
						id: 'bg_error',
						default: 0xff0000 // Red
					},
					{
						type: 'colorpicker',
						label: 'Error Text Color',
						id: 'fg_error',
						default: 0x000000 // White
					},
				],
				callback: (feedback) => {
					self.log("info", `Feedback info ${JSON.stringify(feedback)}`);
		
					let connectionStatus = self.config.channelStatus?.[feedback.controlId] || {};
					if (!connectionStatus.connection) {
						return {};
					}
		
					if (connectionStatus.connection === "connected") {
						return {
							bgcolor: feedback.options.bg_connected, // User-selected color
							color: feedback.options.fg_connected // User-selected text color
						};
					} else if (connectionStatus.connection === "error") {
						return {
							bgcolor: feedback.options.bg_error, // User-selected color
							color: feedback.options.fg_error // User-selected text color
						};
					}
		
					return {}; // Default button styling
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
				self.log("info", `Feedback info ${JSON.stringify(feedback)}`)
				//let key = `${feedback.options.receiver}-${feedback.options.channel}`;
				let connectionStatus = {}
				if (self.config.channelStatus && self.config.channelStatus[feedback.controlId])
				{
					connectionStatus = self.config.channelStatus[feedback.controlId]
				}
				else{
					return false
				}
				self.log("info", `got to feedback ${self.config.channelStatus[connectionStatus.controlId]}`)
	
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
