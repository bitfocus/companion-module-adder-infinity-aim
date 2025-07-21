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
		this.config = config;
		this.feedbackList = ["channel_status_pre_configured", "channel_status_boolean", "preset_status_boolean"]
		this.subscribeActionsUsed = false;
		this.currentStatus = null;
		this.errorTracker = new Set();
		this.advancedFeedback = {};
		this.CONN = Object.freeze({
			CONNECTED: 'connected',
			DISCONNECTED: 'disconnected',
			ERROR: 'error',
			PARTIAL: 'partial',
			FULL: 'full',
		});

		//cleanup any leftover cache 
		this.startCleanupTimers();

		//Create Cache
		this.cachedReceivers = {};
		this.cachedPresets = {};
		this.receiverRequests = {};
		this.presetRequests = {};
		this.cachedTimeout = null;
		if (this.config.pollInterval <= 5000 ){
			this.cachedTimeout = this.config.pollInterval - 500;
		}else{
			this.cachedTimeout = 5000;
		}

		//Initialize dicts and remove depricated dicts
		if (!this.config.users){
			this.config.users = JSON.stringify({});;
		}

		if (this.config.channelStatus){
			delete this.config.channelStatus;
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

		//Load the Parsed version of config
		this.loadParsedConfig();
		this.log("debug", "Starting AIM module");
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

	startCleanupTimers(){
		this.receiverTimer = setInterval(() => this.cleanupStaleReceivers(),  60 * 60 * 1000);
		this.userTimer = setInterval(() => this.cleanupStaleUsers(),  24*60 * 60 * 1000);
	}

	//Run a cleanup for old users.
	cleanupStaleUsers() {
		const now = Date.now();
		const oneWeek = 7*24*60*60*1000;

		for (const userName in this.parsedConfig.users) {
			const session =  this.parsedConfig.users[userName];
			if (now - session.lastUsed > oneWeek) {
				this.log('debug', `Removing stale user session for ${userName}`);
				delete this.parsedConfig.users[userName];
				}
			}
	}

	cleanupStaleReceivers() {
		const now = Date.now();

		for (const key in this.cachedReceivers) {
			const entry = this.cachedReceivers[key];

			if (now - entry.time > 60*1000) {
				this.log('debug', `Removing stale cached receiver: ${key}`);
				delete this.cachedReceivers[key];
			}
		}
	}

	//Loads the config into a Parsed version for use within the module.
	loadParsedConfig() {
	this.parsedConfig = {
		receiverChoices: JSON.parse(this.config.receiverChoices),
		channelChoices: JSON.parse(this.config.channelChoices),
		presets: JSON.parse(this.config.presets),
		users: JSON.parse(this.config.users)
		};
	}

	// Stringifies the working parsed config and saves
	stringifyAndSave() {
		this.config.receiverChoices = JSON.stringify(this.parsedConfig.receiverChoices);
		this.config.channelChoices = JSON.stringify(this.parsedConfig.channelChoices);
		this.config.presets = JSON.stringify(this.parsedConfig.presets);
		this.config.users = JSON.stringify(this.parsedConfig.users)
		this.saveConfig(this.config);
	}

	/*
		Handles manual cleanup in Buttons as Subscribe/Unsubscribe actions are currently not available.
		Accepts a Key, schedules the cleanup for 10 seconds after, and clears any inactive objects.
	*/

	async configUpdated(config) {
		let auth = true;

		//reset token if username is changed
		if(config.username != this.config.username || config.ip != this.config.ip){
			this.stopPolling();
			this.config = config
			this.currentStatus = InstanceStatus.Connecting
			this.updateStatus(InstanceStatus.Connecting);
			this.config.token = null;
			auth = await this.authenticate(config.username, config.password)
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

	async authenticate(username, password) {

		//If the IP and Username are set, try authentication
		if (this.config.ip && username) {
			this.log("info", "Authenticating with the AIM server.");
	
			try {

				//Await Token
				var token = await getAuthToken(this, username, password);

				//Check if token was received.
				if (token) {
					if (this.currentStatus != InstanceStatus.Ok){
						this.currentStatus = InstanceStatus.Ok
						this.updateStatus(InstanceStatus.Ok);
						refreshLists(this);
					}
					if(username == this.config.username){
						this.config.token = token;
					}else{
						this.parsedConfig.users[username]["token"]=token;
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
				min: 1000,
				default: 5000
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
				this.checkFeedbacks(...this.feedbackList);
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
