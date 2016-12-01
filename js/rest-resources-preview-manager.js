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
		 * @todo Remove this once #35616 is available.
		 *
		 * @type {Object.<string, *>}
		 */
		manager.initialDirtySettingValues = args.initialDirtySettingValues || {};

		/**
		 * List of the IDs for settings that are dirty.
		 *
		 * @todo Reset this once saved happens.
		 * @todo Remove this once #35616 is available.
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

			// @todo Remove this once #35616 is available.
			// Keep track of which settings are dirty.
			wp.customize.preview.bind( 'rest-resource-dirty-setting', function( settingIds ) {
				_.each( settingIds, function( settingId ) {
					if ( -1 === manager.dirtySettings.indexOf( settingId ) ) {
						manager.dirtySettings.push( settingId );
					}
				} );
			} );

			wp.customize.preview.bind( 'active', function() {
				manager.previewActive.resolve();
			} );

			jQuery( document ).ajaxSuccess( _.bind( manager.handleAjaxSuccess, manager ) );
		});

		manager.bind( 'backbone-model-initialized', function( model, settingId ) {
			manager.notifySettingPostMessageTransportEligible( settingId, model.toJSON() );
		} );
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
			matches,
			models;

		matches = id.match( /^rest_resource\[(.+?)]/ );
		if ( ! matches ) {
			return;
		}

		models = manager.settingModels[ id ];
		if ( models ) {

			_.each( models, function( model ) {
				var resource;
				try {
					resource = JSON.parse( value );
				} catch ( e ) {
					if ( typeof console !== 'undefined' ) {
						console.error( e );
					}
					return;
				}

				// Make sure that any embedded resources get updated to reflect any dirty.
				if ( resource._embedded ) {
					_.each( resource._embedded, function( embeddeds ) {
						_.each( embeddeds, function( embed ) {
							var customizeId = manager.getCustomizeId( embed );
							if ( customizeId && -1 !== manager.dirtySettings.indexOf( customizeId ) && wp.customize.has( customizeId ) ) {
								_.extend( embed, JSON.parse( wp.customize( customizeId ).get() ) );
							}
						} );
					} );
				}

				resource = model.parse( resource );

				// Handle case where Customizer setting lacks _embedded
				// @todo A more elegant solution is needed here.
				_.each( model.attributes, function( value, key ) {
					if ( value instanceof Backbone.Model && value.id === resource[ key ].id ) {
						resource[ key ] = value;
					}
				} );

				model.set( resource );
			} );
		}
	},

	/**
	 * Notify Customizer pane that a REST resource setting can use the postMessage transport.
	 *
	 * This method should be called whenever a JS model (e.g. Backbone Model) is used to represent a REST resource.
	 *
	 * @param {string} settingId
	 */
	notifySettingPostMessageTransportEligible: function( settingId ) {
		var manager = this;
		manager.previewActive.done( function() {
			wp.customize.preview.send( 'rest-resource-setting-postmessage-transport-eligible', settingId );
		} );
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
			wp.customize.preview.send( 'rest-resource-previewed', setting() );
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
