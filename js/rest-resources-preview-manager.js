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

		manager.dirtySettings = [];
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
		var id = args[0],
			value = args[1],
			matches;

		matches = id.match( /^rest_resource\[(.+?)]/ );
		if ( matches ) {
			console.info( matches[1], value );
		}

		// @todo Now we need to figure out which collection contains this resource, and then update it in place.
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
		if ( _.isArray( data ) ) {
			resources = data.slice();
		} else {
			resources = [ data ];
		}

		manager.previewActive.done( function() {
			_.each( resources, function( resource ) {
				wp.customize.preview.send( 'previewedRestResource', resource );
			} );
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
