/* global wp, CustomizeRestResources, JSON */

/**
 * Rest Resource Preview Manager.
 *
 * @class
 */
CustomizeRestResources.RestResourcesPreviewManager = CustomizeRestResources.RestResourcesManager.extend({

	/**
	 * Initialize.
	 *
	 * @param args
	 */
	initialize: function( args ) {
		var manager = this;
		CustomizeRestResources.RestResourcesManager.prototype.initialize.call( manager, args );

		/**
		 * Mapping of setting IDs to initial dirty setting value.
		 *
		 * This is used when a script in the preview attempts to make a request
		 * to the REST API before the Customizer settings are initialized.
		 *
		 * @type {Object.<string, *>}
		 */
		manager.initialDirtySettingValues = args.initialDirtySettingValues || {};

		/**
		 * List of the IDs for settings that are dirty.
		 *
		 * @type {Array}
		 */
		manager.dirtySettings = _.keys( manager.initialDirtySettingValues );

		/**
		 * Deferred object for when pane sends active message.
		 *
		 * @type {jQuery.Deferred}
		 */
		manager.previewActive = jQuery.Deferred();

		wp.customize.bind( 'preview-ready', function() {

			// @todo Redirect all API writes into messages sent to the wp.customize.preview

			wp.customize.preview.bind( 'setting', _.bind( manager.receiveSetting, manager ) );

			// Keep track of which settings are dirty.
			wp.customize.preview.bind( 'dirtySetting', function( settingId ) {
				if ( -1 === manager.dirtySettings.indexOf( settingId ) ) {
					manager.dirtySettings.push( settingId );
				}
			} );
			wp.customize.preview.bind( 'dirtySettings', function( settingIds ) {
				manager.dirtySettings = settingIds;
			} );

			wp.customize.preview.bind( 'active', function() {
				manager.previewActive.resolve();
			} );

			jQuery( document ).ajaxSuccess( _.bind( manager.handleAjaxSuccess, manager ) );
		});
	},

	/**
	 * Handle updates to a given setting.
	 *
	 * @param {array} args
	 */
	receiveSetting: function( args ) {
		var manager = this,
			id = args[0],
			value = args[1],
			resource,
			matches,
			models;

		matches = id.match( /^rest_resource\[(.+?)]/ );
		if ( ! matches ) {
			return;
		}

		models = manager.settingModels[ id ];
		if ( models ) {
			resource = JSON.parse( value );
			_.each( models, function( model ) {
				model.set( resource );
			} );
		}
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
		var manager = this, setting;
		setting = CustomizeRestResources.RestResourcesManager.prototype.ensureSetting.call( manager, resource );

		/*
		 * Send the resource to the parent to create the corresponding setting
		 * in the pane along with any controls.
		 */
		manager.previewActive.done( function() {
			wp.customize.preview.send( 'previewedRestResource', setting() );
		} );

		return setting;
	},

	/**
	 * Send each loaded resource to the Customizer for creation as a rest setting.
	 *
	 * @param event
	 * @param xhr
	 * @param options
	 * @param data
	 */
	handleAjaxSuccess: function( event, xhr, options, data ) {
		var manager = this, resources;
		if ( 0 !== options.url.indexOf( manager.restApiRoot ) ) {
			return;
		}

		// Abort syncing ensuring resources if the REST resource is not editable.
		if ( 'edit' !== xhr.getResponseHeader( 'X-Customize-REST-Resources-Context' ) ) {
			return;
		}

		if ( _.isArray( data ) ) {
			resources = data.slice();
		} else {
			resources = [ data ];
		}

		_.each( resources, function( resource ) {

			// Ensure the setting is created. This will be done automatically if there is a Backbone model.
			manager.ensureSetting( resource );
		} );
	},

	/**
	 *
	 * @see wp.customize.previewer.query
	 *
	 * @returns {{
	 *     customized: string,
	 *     nonce: string,
	 *     wp_customize: string,
	 *     theme: string
	 * }}
	 */
	getCustomizeQueryVars: function() {
		var manager = this, customized = {};
		_.each( manager.dirtySettings, function( settingId ) {
			if ( wp.customize.has( settingId ) ) {
				customized[ settingId ] = wp.customize( settingId ).get();
			} else if ( 'pending' === manager.previewActive.state() && manager.initialDirtySettingValues[ settingId ] ) {
				customized[ settingId ] = manager.initialDirtySettingValues[ settingId ];
			}
		} );
		return {
			wp_customize: 'on',
			theme: manager.previewedTheme,
			nonce: manager.previewNonce,
			customized: JSON.stringify( customized )
		};
	}
});
