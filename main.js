const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const { getAuthToken } = require('./auth');
const { refreshLists, checkConnectionStatus } = require('./api');
class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config
		this.feedbackList = ["channel_status_pre_configured", "channel_status_boolean", "preset_status_boolean"]
		this.subscribeActionsUsed = false;
		this.currentStatus = null;


		//Setup config dicts if they don't exist or running for the first time since v1.0 clear.
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

		//Load the Parsed version of config
		this.loadParsedConfig();
		this.log("debug", "Starting AIM module")
		this.currentStatus=InstanceStatus.Connecting;
		this.updateStatus(InstanceStatus.Connecting, 'Waiting for auth');

		//Get a Token if none exists
		let auth = false;
		if (this.config.token){
			auth = true;
		}else{
			auth = await this.authenticate()
		}

		//Update status
		if (auth) {
			this.currentStatus = InstanceStatus.Ok;
			this.updateStatus(InstanceStatus.Ok)
		}
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
		if(this.config.poll && this.currentStatus===InstanceStatus.Ok){this.startPolling()}		
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
	}

	//Loads the config into a Parsed version for use within the module.
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

	// Stringifies the working parsed config and saves
	stringifyAndSave() {
		this.config.receiverChoices = JSON.stringify(this.parsedConfig.receiverChoices);
		this.config.channelChoices = JSON.stringify(this.parsedConfig.channelChoices);
		this.config.presets = JSON.stringify(this.parsedConfig.presets);
		this.config.channelStatus = JSON.stringify(this.parsedConfig.channelStatus);
		this.saveConfig(this.config);
	}

	/*
		Handles manual cleanup in Buttons as Subscribe/Unsubscribe actions are currently not available.
		Accepts a Key, schedules the cleanup for 10 seconds after, and clears any inactive objects.
	*/

	scheduleCleanup(key){

		//Sets the cleanup flag
		this.parsedConfig.channelStatus[key]["cleanup"]=true;

		//If polling is used, uses the poll timer to activate cleanup
		if (this.config.poll) {
			return;
		}

		//Creates cleanup map to track key timers
		if (this._cleanupTimers === undefined) {
			this._cleanupTimers = {};
		}

		// Avoid multiple timers for the same key
		if (this._cleanupTimers[key]) return;

		//Timeout function
		this._cleanupTimers[key] = setTimeout(() => {

			//Cleanup keys if no feedback is used.
			this.cleanupInactiveFeedback();

			//If the Key exists, check if active and clean
			if (this.parsedConfig.channelStatus[key]){
				this.cleanupInactiveForKey(key);
			}
			
			//Delete timer
			delete this._cleanupTimers[key];
		}, 10000);
	}

	/*
		Accepts a Key. Checks if the key is active. If the key isn't active, it's deleted.
		If active, marks as inactive (This will revert if the button is pressed) and sets cleanup flag.
	*/
	cleanupInactiveForKey(key){
			if (!this.parsedConfig.channelStatus[key].active){
				delete this.parsedConfig.channelStatus[key];
			}else{
				this.parsedConfig.channelStatus[key].active = false;
				this.parsedConfig.channelStatus[key].cleanup = false;
			}
		this.stringifyAndSave();
		this.checkFeedbacks(...this.feedbackList);
	}

	//Cleans up any keys that aren't being used for feedback.
	cleanupInactiveFeedback(){
		const keysToDelete = Object.entries(this.parsedConfig.channelStatus)
		.filter(([_, value]) => !value.feedback && !value.subscribed)
		.map(([key, _]) => key);
		for (let keys of keysToDelete){
			delete this.parsedConfig.channelStatus[keys];
		}
	}

	async configUpdated(config) {
		let auth = true;

		//reset token if username is changed
		if(config.username != this.config.username || config.ip != this.config.ip){
			this.stopPolling();
			this.config = config
			this.currentStatus = InstanceStatus.Connecting
			this.updateStatus(InstanceStatus.Connecting);
			this.config.token = null;
			auth = await this.authenticate()
			this.stringifyAndSave();
		}
		this.config = config
		//start/stop polling
		if(!this.config.poll || !auth || this.currentStatus!=InstanceStatus.Ok){
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
					if (this.currentStatus != InstanceStatus.Ok){
						this.currentStatus = InstanceStatus.Ok
						this.updateStatus(InstanceStatus.Ok);
						refreshLists(this);
					}
					this.stringifyAndSave();
					return true;
				} else {
					this.currentStatus = InstanceStatus.AuthenticationFailure;
					this.updateStatus(InstanceStatus.AuthenticationFailure);
					this.log("error", "Could not log in. Please check your configuration.");
					return false;
				}
			} catch (error) {
				this.log("error", `Authentication process failed: ${error.message}`);
				return false;
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
