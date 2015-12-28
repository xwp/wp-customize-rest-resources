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

		wp.customize.sectionConstructor.rest_resources = CustomizeRestResources.RestResourcesSection;
		wp.customize.controlConstructor.rest_resource = CustomizeRestResources.RestResourceControl;

		wp.customize.bind( 'ready', function() {
			var callback = _.bind( manager.notifyDirtySetting, manager );
			wp.customize.bind( 'add', callback );
			wp.customize.bind( 'change', callback );
			wp.customize.bind( 'saved', callback );
			wp.customize.previewer.bind( 'previewedRestResource', function( resource ) {
				if ( _.isString( resource ) ) {
					resource = JSON.parse( resource );
				}
				manager.ensureSetting( resource );
			} );
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
	 * Create and add the setting for a given REST Resource.
	 *
	 * @param {object} resource
	 * @returns {{wp.customize.Setting|null}}
	 */
	//ensureSetting: function( resource ) {
	//	var manager = this, customizeId, setting;
	//
	//	customizeId = manager.getCustomizeId( resource );
	//	if ( ! customizeId ) {
	//		return null;
	//	}
	//	setting = wp.customize( customizeId );
	//	if ( ! setting ) {
	//		setting = wp.customize.create( customizeId, customizeId, JSON.stringify( resource ), {
	//			transport: 'postMessage',
	//			previewer: wp.customize.previewer
	//		} );
	//	}
	//	return setting;
	//},

	/**
	 * Notify the preview of a dirty setting.
	 *
	 * @param {wp.customize.Setting} setting
	 */
	notifyDirtySetting: function( setting ) {
		if ( setting._dirty ) {
			wp.customize.previewer.send( 'dirtySetting', setting.id );
		}
	},

	/**
	 * Notify preview of all dirty settings.
	 */
	notifyDirtySettings: function() {
		var manager = this, dirtySettingIds = [];
		wp.customize.each( function( value, key ) {
			if ( value._dirty ) {
				dirtySettingIds.push( key );
			}
		} );
		wp.customize.previewer.send( 'dirtySettings', dirtySettingIds );
	},

	/**
	 * Ensure there is a Customizer setting for the supplied REST resource.
	 */
	ensureResourceSettingAndControl: function( resource ) {

		console.info( 'ensureResourceSettingAndControl', resource );
		return;

		var manager = this, path, customizeId;
		path = resource._links.self[0].href.substr( manager.restApiRoot.length );
		customizeId = 'rest_resource[' + path + ']';
		if ( ! wp.customize.has( customizeId ) ) {
			// @todo Should we store the JSON string or the JS object in the setting?
			wp.customize.create( customizeId, customizeId, JSON.stringify( resource ), {
				transport: 'postMessage',
				previewer: wp.customize.previewer
			} );
		}

		if ( ! wp.customize.control.has( customizeId ) ) {
			wp.customize.control.add( customizeId, new CustomizeRestResources.RestResourceControl( customizeId, {
				params: {
					settings: {
						'default': customizeId
					},
					section: 'rest_resources',
					priority: wp.customize.section( 'rest_resources' ).controls().length + 1
				}
			} ) );
		}
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
