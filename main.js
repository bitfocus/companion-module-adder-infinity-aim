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
		if(!this.config.receiverChoices){
			this.config.receiverChoices = [{id: "None", label: "None"}]
		}
		if(!this.config.channelChoices){
			this.config.channelChoices = [{id: "None", label: "None"}]
		}
		if(!this.config.presets){
			this.config.presets = [{id: "None", label: "None"}]
		}
		this.log("info", JSON.stringify(this.config.channelStatus))
		if(!this.config.channelStatus){
			this.config.channelStatus = {}
		}

		this.saveConfig()
		this.log("info", "Starting module")
		this.log("info", `Config on startup: ${JSON.stringify(config)}`);
		this.log("info", `This is the token on startup ${this.config.token}`)
		this.updateStatus('connecting', 'Waiting for auth');
		
		this.handleHttpRequest
		this.updateStatus(InstanceStatus.Ok)
		this.log("info", `ip: ${this.config.ip} user: ${this.config.username}`)
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
		this.startPolling()

		//this.config.pollInterval = 5000;
		
	}
	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		this.config = config
		this.startPolling()

	}

	async authenticate(){
		if (this.config.ip && this.config.username) {
			this.log("info","Waiting for auth")
            this.config.token = await getAuthToken(this); // Get the token
			this.saveConfig(this.config)
			this.log("info", this.config.token)
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
			}
		]
	}

	async startPolling() {
		if (this.pollData) {
			// If already running, check if interval needs updating
			if (this.config.pollInterval !== this.currentPollInterval) {
				this.log("info", "clearing poll")
				clearInterval(this.pollData);
			} else {
				return; // Do nothing if interval is the same
			}
		}

		if (this.config.pollInterval) {
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
