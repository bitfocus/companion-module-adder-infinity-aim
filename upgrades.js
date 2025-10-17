module.exports = [
    /*
     * Place your upgrade scripts here
     * Remember that once it has been added it cannot be removed!
     */
    function (context, props) {
        const actionsToFix = ["Connect_Channel", "connect_preset"];
        let updatedActions = [];

        for (const action of props.actions) {
            
            if (actionsToFix.includes(action.actionId)) {
                try {
                    // set userCheckbox to default to false and blank
                    action.options.userCheckbox = action.options.userCheckbox ?? false;
                    action.options.username = action.options.username ?? "";
                    action.options.password = action.options.password ?? "";
                } catch (e) {
                    console.log(e);
                }
            }

            updatedActions.push(action);
        }

        return {
            updatedConfig: null,
            updatedActions: updatedActions,
            updatedFeedbacks: [],
        }
    },
]