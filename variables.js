module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'token', name: 'login token', persistent: true},
		{ variableId: 'channelStatusKey', name: 'Last channel connection'}
	])
}
