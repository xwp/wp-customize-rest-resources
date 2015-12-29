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
