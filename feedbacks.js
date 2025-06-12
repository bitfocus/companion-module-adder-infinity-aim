const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
			channel_status_pre_configured: {
				name: 'Channel Connection Status Pre-Configured',
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

					let connectionStatus = self.parsedConfig.channelStatus?.[feedback.controlId] || {};
					if (Object.keys(connectionStatus).length === 0){
					return {};
				}
					let connections = Object.values(connectionStatus).filter(
					conn => typeof conn === 'object' && conn !== null && 'connection' in conn
					);
					self.parsedConfig.channelStatus[feedback.controlId].feedback = true;

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

					if (!self.parsedConfig.channelStatus[feedback.controlId]) {
						self.parsedConfig.channelStatus[feedback.controlId] = {};
					}
					// Mark all active connections as feedback-tracked
					self.parsedConfig.channelStatus[feedback.controlId].feedback = true;
					self.stringifyAndSave();
				},
				
				unsubscribe: async (feedback) => {
					if (!self.parsedConfig.channelStatus[feedback.controlId]) return;
					self.parsedConfig.channelStatus[feedback.controlId].feedback = false;

					// Untrack feedback for all connections under this button

					self.stringifyAndSave()
				}
			},
		channel_status_connected: {
			name: 'Channel Connection Connected',
			type: 'boolean',
			callback: (feedback) => {

				let connectionStatus = self.parsedConfig.channelStatus?.[feedback.controlId] || {};
				if (Object.keys(connectionStatus).length === 0){
					return {};
				}
				let connections = Object.values(connectionStatus).filter(
				conn => typeof conn === 'object' && conn !== null && 'connection' in conn
				);
				self.parsedConfig.channelStatus[feedback.controlId].feedback = true;

				if (Object.keys(connections).length === 0) {
					return {};
				}

				let allConnected = connections.every(conn => conn.connection === "connected");
	
				// Check if we have a stored success/failure state
				if (allConnected === true) {
					return true
				} else{
					return false
				}
	

			},
			subscribe: async (feedback) => {

					if (!self.parsedConfig.channelStatus[feedback.controlId]) {
						self.parsedConfig.channelStatus[feedback.controlId] = {};
					}
					// Mark all active connections as feedback-tracked
					self.parsedConfig.channelStatus[feedback.controlId].feedback = true;
					self.stringifyAndSave();
				},
				
				unsubscribe: async (feedback) => {
					if (!self.parsedConfig.channelStatus[feedback.controlId]) return;
					self.parsedConfig.channelStatus[feedback.controlId].feedback = false;

					// Untrack feedback for all connections under this button

					self.stringifyAndSave()
				}
		},
		channel_status_errors: {
			name: 'Channel Connection Errors',
			type: 'boolean',
			callback: (feedback) => {

				let connectionStatus = self.parsedConfig.channelStatus?.[feedback.controlId] || {};
				if (Object.keys(connectionStatus).length === 0){
					return {};
				}
				let connections = Object.values(connectionStatus).filter(
				conn => typeof conn === 'object' && conn !== null && 'connection' in conn
				);
				self.parsedConfig.channelStatus[feedback.controlId].feedback = true;

				if (Object.keys(connections).length === 0) {
					return {};
				}

				let allError = connections.every(conn => conn.connection === "error");
	
				// Check if we have a stored success/failure state
				if (allError === true) {
					return true
				} else{
					return false
				}
			},
			subscribe: async (feedback) => {

					if (!self.parsedConfig.channelStatus[feedback.controlId]) {
						self.parsedConfig.channelStatus[feedback.controlId] = {};
					}
					// Mark all active connections as feedback-tracked
					self.parsedConfig.channelStatus[feedback.controlId].feedback = true;
					self.stringifyAndSave();
				},
				
				unsubscribe: async (feedback) => {
					if (!self.parsedConfig.channelStatus[feedback.controlId]) return;
					self.parsedConfig.channelStatus[feedback.controlId].feedback = false;

					// Untrack feedback for all connections under this button

					self.stringifyAndSave()
				}
		},
		channel_status_partial: {
			name: 'Channel Connection Status Partial',
			type: 'boolean',
			callback: (feedback) => {

				let connectionStatus = self.parsedConfig.channelStatus?.[feedback.controlId] || {};
				if (Object.keys(connectionStatus).length === 0){
					return {};
				}
				let connections = Object.values(connectionStatus).filter(
				conn => typeof conn === 'object' && conn !== null && 'connection' in conn
				);
				self.parsedConfig.channelStatus[feedback.controlId].feedback = true;

				if (Object.keys(connections).length === 0) {
					return {};
				}

				let allError = connections.every(conn => conn.connection === "error");
				let allConnected = connections.every(conn => conn.connection === "connected");
				let allDisconnected = connections.every(conn => conn.connection === "disconnected");
				let allPartial = connections.every(conn => conn.connection === "partial");
	
				// Check if we have a stored success/failure state
				if (allPartial === true || (!allConnected && !allDisconnected && !allError)) {
					return true
				} else{
					return false
				}
			},
			subscribe: async (feedback) => {

					if (!self.parsedConfig.channelStatus[feedback.controlId]) {
						self.parsedConfig.channelStatus[feedback.controlId] = {};
					}
					// Mark all active connections as feedback-tracked
					self.parsedConfig.channelStatus[feedback.controlId].feedback = true;
					self.stringifyAndSave();
				},
				
				unsubscribe: async (feedback) => {
					if (!self.parsedConfig.channelStatus[feedback.controlId]) return;
					self.parsedConfig.channelStatus[feedback.controlId].feedback = false;

					// Untrack feedback for all connections under this button

					self.stringifyAndSave()
				}
		},
		channel_status_disconnected: {
			name: 'Channel Connection Status Disconnected',
			type: 'boolean',
			callback: (feedback) => {

				let connectionStatus = self.parsedConfig.channelStatus?.[feedback.controlId] || {};
				if (Object.keys(connectionStatus).length === 0){
					return {};
				}
				let connections = Object.values(connectionStatus).filter(
				conn => typeof conn === 'object' && conn !== null && 'connection' in conn
				);
				self.parsedConfig.channelStatus[feedback.controlId].feedback = true;

				if (Object.keys(connections).length === 0) {
					return {};
				}

				let allDisconnected = connections.every(conn => conn.connection === "disconnected");
	
				// Check if we have a stored success/failure state
				if (allDisconnected === true) {
					return true
				} else{
					return false
				}
			},
			subscribe: async (feedback) => {

					if (!self.parsedConfig.channelStatus[feedback.controlId]) {
						self.parsedConfig.channelStatus[feedback.controlId] = {};
					}
					// Mark all active connections as feedback-tracked
					self.parsedConfig.channelStatus[feedback.controlId].feedback = true;
					self.stringifyAndSave();
				},
				
				unsubscribe: async (feedback) => {
					if (!self.parsedConfig.channelStatus[feedback.controlId]) return;
					self.parsedConfig.channelStatus[feedback.controlId].feedback = false;

					// Untrack feedback for all connections under this button

					self.stringifyAndSave()
				}
		}
	});
	
}
