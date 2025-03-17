const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const { getAuthToken } = require('./auth');
const { refreshAvailableChannels, checkConnectionStatus } = require('./api');
class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config

		//Setup config dicts if they don't exist
		if(!this.config.receiverChoices){
			this.config.receiverChoices = [{id: "None", label: "None"}]
		}
		if(!this.config.channelChoices){
			this.config.channelChoices = [{id: "None", label: "None"}]
		}
		if(!this.config.presets){
			this.config.presets = [{id: "None", label: "None"}]
		}
		if(!this.config.channelStatus){
			this.config.channelStatus = {}
		}
		this.log("info", "Starting AIM module")
		this.log("info", `This is the token on startup ${this.config.token}`)
		this.updateStatus('connecting', 'Waiting for auth');
		
		this.handleHttpRequest
		this.updateStatus(InstanceStatus.Ok)
		this.log("info", `ip: ${this.config.ip} user: ${this.config.username}`)
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
		if(this.config.poll){this.startPolling()}

		
	}
	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {

		//reset token if username is changed
		if(config.username != this.config.username){
			this.config = config
			this.config.token = null;
			this.saveConfig(this.config);
		}
		this.config = config
		//start/stop polling
		if(!this.config.poll){
			this.stopPolling();
		}else{
			this.startPolling();
		}
	}

	async authenticate() {

		//If the IP and Username are set, try authentication
		if (this.config.ip && this.config.username) {
			this.log("info", "Attempting authentication");
	
			try {

				//Await Token
				this.config.token = await getAuthToken(this);
				
				//Check if token was received.
				if (this.config.token) {
					this.updateStatus(InstanceStatus.Ok);
					this.saveConfig(this.config);
				} else {
					this.updateStatus(InstanceStatus.AuthenticationFailure);
					this.log("error", "Could not log in. Please check your configuration.");
				}
			} catch (error) {
				this.log("error", `Authentication process failed: ${error.message}`);
			}
		}
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'ip',
				label: 'AIM IP',
				tooltip: "IP Address for AIM Server",
				width: 8,
				regex: Regex.IP,
				default: "169.254.1.2"
			},
			{
				type: 'textinput',
				id: 'username',
				label: 'username',
				width: 6,
				default: "admin"
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'password',
				width: 6,
				default: ""
			},
			{
				type: 'number',
				id: 'pollInterval',
				tooltip: "Refresh feedbacks for each buttons selected channel",
				label: "Channel Poll Interval",
				width: 4,
				default: 0
			},
			{
				type: 'checkbox',
				id: 'poll',
				tooltip: "Enable channel polling. Allows for keeping channel feedback updated.",
				width: 1,
				default: false
			}
		]
	}

	async startPolling() {
		
		//Don't start polling if already polling
		if (this.pollData) {
			// If already running, check if interval needs updating
			this.log("info", "already polling")
			if (this.config.pollInterval !== this.currentPollInterval) {
				clearInterval(this.pollData);
			} else {
				return;
			}
		}

		//Only poll if inteval is above 0 and checkbox
		if (this.config.pollInterval && this.config.poll) {
			this.currentPollInterval = this.config.pollInterval; // Store the current interval
			this.pollData = setInterval(() => {
				checkConnectionStatus(this);
			}, this.config.pollInterval);
		}
	}

	stopPolling() {
		if (this.pollData) {
			clearInterval(this.pollData);
			this.pollData = null;
		}
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
