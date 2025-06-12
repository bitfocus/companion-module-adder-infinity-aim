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
		this.feedbackList = ["channel_status_pre_configured", "channel_status_connected", "channel_status_errors", "channel_status_partial", "channel_status_disconnected"]
		this.subscribeActionsUsed = false;
		this.currentStatus = null;


		//Setup config dicts if they don't exist
		if (!this.config.firstRun){
			this.config.receiverChoices = JSON.stringify([{id: "None", label: "None"}]);
			this.config.channelChoices = JSON.stringify([{id: "None", label: "None"}]);
			this.config.presets = JSON.stringify([{id: "None", label: "None"}]);
			this.config.channelStatus = JSON.stringify({});
			this.config.firstRun=1;
		}
		if(!this.config.receiverChoices){
			this.config.receiverChoices = JSON.stringify([{id: "None", label: "None"}]);
		}
		if(!this.config.channelChoices){
			this.config.channelChoices = JSON.stringify([{id: "None", label: "None"}]);
		}
		if(!this.config.presets){
			this.config.presets = JSON.stringify([{id: "None", label: "None"}]);
		}
		if(!this.config.channelStatus || !this.config.firstRun){
			this.config.channelStatus = JSON.stringify({});
		}
		this.loadParsedConfig();
		this.log("debug", "Starting AIM module")
		this.updateStatus('connecting', 'Waiting for auth');
		
		//this.handleHttpRequest
		this.currentStatus = InstanceStatus.Ok;
		this.updateStatus(InstanceStatus.Ok)
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
		if(this.config.poll){this.startPolling()}		
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
	}

	loadParsedConfig() {
	this.parsedConfig = {
		receiverChoices: JSON.parse(this.config.receiverChoices),
		channelChoices: JSON.parse(this.config.channelChoices),
		presets: JSON.parse(this.config.presets),
		channelStatus: JSON.parse(this.config.channelStatus)
		};
		for (let key in this.parsedConfig.channelStatus){
			this.parsedConfig.channelStatus[key].feedback = false;
		}
	}

	// Before saving
	stringifyAndSave() {
		this.config.receiverChoices = JSON.stringify(this.parsedConfig.receiverChoices);
		this.config.channelChoices = JSON.stringify(this.parsedConfig.channelChoices);
		this.config.presets = JSON.stringify(this.parsedConfig.presets);
		this.config.channelStatus = JSON.stringify(this.parsedConfig.channelStatus);
		this.saveConfig(this.config);
	}

	scheduleCleanup(key){
		this.parsedConfig.channelStatus[key]["cleanup"]=true;
		if (this.config.poll) {
			return;
		}

		if (this._cleanupTimers === undefined) {
			this._cleanupTimers = {};
		}

		// Avoid multiple timers for the same key
		if (this._cleanupTimers[key]) return;

		this._cleanupTimers[key] = setTimeout(() => {
			this.cleanupInactiveFeedback();
			if (this.parsedConfig.channelStatus[key]){
				console.log("DELETING: ", key)
				this.cleanupInactiveForKey(key);
			}
			delete this._cleanupTimers[key];
		}, 10000);
	}

	cleanupInactiveForKey(key){

		for (let subKey in this.parsedConfig.channelStatus[key]) {
			if (typeof this.parsedConfig.channelStatus[key][subKey] === "boolean"){
				continue;
			}
			if (!this.parsedConfig.channelStatus[key][subKey].active){
				delete this.parsedConfig.channelStatus[key][subKey];
			}else{
				this.parsedConfig.channelStatus[key][subKey].active = false;
			}
		}
		this.parsedConfig.channelStatus[key]["cleanup"] = false;
		this.stringifyAndSave();
		this.checkFeedbacks(...this.feedbackList);
	}
	cleanupInactiveFeedback(){
		const keysToDelete = Object.entries(this.parsedConfig.channelStatus)
		.filter(([_, value]) => !value.feedback && !value.subscribed)
		.map(([key, _]) => key);
		for (let keys of keysToDelete){
			delete this.parsedConfig.channelStatus[keys];
		}
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
			this.log("info", "Authenticating with the AIM server.");
	
			try {

				//Await Token
				this.config.token = await getAuthToken(this);
				
				//Check if token was received.
				if (this.config.token) {
					if (this.currentStatus !== InstanceStatus.Ok){
						this.currentStatus = InstanceStatus.Ok
						this.updateStatus(InstanceStatus.Ok);
					}
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
				label: 'Poll',
				tooltip: "Enable channel polling. Allows for keeping channel feedback updated.",
				width: 2,
				default: false
			}
		]
	}

	async startPolling() {
		
		//Don't start polling if already polling
		if (this.pollData) {
			// If already running, check if interval needs updating
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
