/* global CustomizeRestResources, wp, JSON */

/**
 * Rest Resource Pane Manager.
 *
 * @class
 */
CustomizeRestResources.RestResourcesPaneManager = CustomizeRestResources.RestResourcesManager.extend({

	/**
	 * Initialize.
	 *
	 * @param args
	 */
	initialize: function( args ) {
		var manager = this;
		CustomizeRestResources.RestResourcesManager.prototype.initialize.call( manager, args );
		manager.schema = args.schema || {};

		wp.customize.sectionConstructor.rest_resources = CustomizeRestResources.RestResourcesSection;
		wp.customize.controlConstructor.rest_resource = CustomizeRestResources.RestResourceControl;

		wp.customize.bind( 'ready', function() {
			var callback = _.bind( manager.notifyDirtySetting, manager );
			manager.notifyDirtySettings();
			wp.customize.bind( 'add', callback );
			wp.customize.bind( 'change', callback );
			wp.customize.bind( 'saved', callback );
			wp.customize.previewer.bind( 'rest-resource-previewed', function( resource ) {
				if ( _.isString( resource ) ) {
					resource = JSON.parse( resource );
				}
				manager.ensureSetting( resource );
			} );
			wp.customize.previewer.bind( 'rest-resource-setting-postmessage-transport-eligible', _.bind( manager.setPostMessageTransport, manager ) );
			wp.customize.bind( 'saved', _.bind( manager.handleSaveErrors, manager )) ;
		});
	},

	/**
	 * Send the setting to tha Customizer pane when it is created in the preview.
	 *
	 * Create and add the setting for a given REST Resource.
	 *
	 * @param {object} resource
	 * @returns {wp.customize.Setting|null}
	 */
	ensureSetting: function( resource ) {
		var manager = this, setting, customizeId;
		setting = CustomizeRestResources.RestResourcesManager.prototype.ensureSetting.call( manager, resource );
		customizeId = setting.id;

		if ( ! wp.customize.control.has( customizeId ) ) {
			wp.customize.control.add( customizeId, new CustomizeRestResources.RestResourceControl( customizeId, {
				params: {
					settings: {
						'default': setting.id
					},
					section: 'rest_resources',
					priority: wp.customize.section( 'rest_resources' ).controls().length + 1
				}
			} ) );
		}

		return setting;
	},

	/**
	 * Set postMessage transport for the supplied setting ID.
	 *
	 * By default settings get created with refresh transport. Only when JS model
	 * model is initialized that uses the resource will the setting opt-in to
	 * postMessage, since the Backbone model initialization signals that we are
	 * able to sync the model changes back into the initialized JS model. By
	 * default only WP-API Backbone models are supported, but other JS models
	 * can be supported by sending rest-resource-setting-postmessage-transport-eligible
	 * messages from the preview (via the preview manager's notifySettingPostMessageTransportEligible method).
	 *
	 * @param {string} settingId
	 */
	setPostMessageTransport: function( settingId ) {
		wp.customize( settingId, function( setting ) {
			setting.transport = 'postMessage';
		} );
	},

	/**
	 * Notify the preview of a dirty setting.
	 *
	 * @param {wp.customize.Setting} setting
	 */
	notifyDirtySetting: function( setting ) {
		if ( setting._dirty ) {
			wp.customize.previewer.send( 'rest-resource-dirty-setting', [ setting.id ] );
		}
	},

	/**
	 * Notify preview of all dirty settings.
	 */
	notifyDirtySettings: function() {
		var dirtySettingIds = [];
		wp.customize.each( function( value, key ) {
			if ( value._dirty ) {
				dirtySettingIds.push( key );
			}
		} );
		wp.customize.previewer.send( 'rest-resource-dirty-setting', dirtySettingIds );
	},

	/**
	 * Handle setting save errors that made it through the sanitization/validation checks.
	 *
	 * @param {object} response
	 * @param {object} [response.customize_rest_resources_save_errors]
	 */
	handleSaveErrors: function( response ) {
		if ( ! response.customize_rest_resources_save_errors ) {
			return;
		}
		_.each( response.customize_rest_resources_save_errors, function( errorMessage, settingId ) {
			var setting = wp.customize( settingId );
			if ( ! setting ) {
				return;
			}
			if ( setting.validationMessage ) {
				setting.validationMessage.set( errorMessage );
			}
		} );
	},

	/**
	 * Get query vars for Customize preview query.
	 *
	 * @returns {{
	 *     customized: string,
	 *     nonce: string,
	 *     wp_customize: string,
	 *     theme: string
	 * }}
	 */
	getCustomizeQueryVars: function() {
		return wp.customize.previewer.query();
	}
});
