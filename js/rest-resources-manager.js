/* global CustomizeRestResources, JSON, wp */

/**
 * Rest Resource Manager.
 *
 * @class
 * @param {object} args
 * @param {string} args.restApiRoot
 */
CustomizeRestResources.RestResourcesManager = wp.customize.Class.extend({

	initialize: function( args ) {
		var manager = this;

		/**
		 * REST API Root URL.
		 *
		 * @type {string}
		 */
		manager.restApiRoot = args.restApiRoot;

		/**
		 * Mapping of setting ID to array of backbone Models.
		 * @type {Object.<string, Array>}
		 */
		manager.settingModels = {};

		if ( 'undefined' === typeof wp ) {
			throw new Error( 'wp object is not defined' );
		}
		if ( 'undefined' === typeof wp.customize ) {
			throw new Error( 'wp.customize is not defined' );
		}
		if ( 'undefined' === typeof wp.api ) {
			throw new Error( 'wp.api is not defined' );
		}
		_.each( [ 'restApiRoot' ], function( key ) {
			if ( ! manager[ key ] ) {
				throw new Error( 'Missing ' + key + ' arg' );
			}
		} );

		manager.injectModelSync();
	},

	/**
	 * Inject logic to each Backbone model to register it among the instances of a given resource.
	 */
	injectModelSync: function() {
		var manager = this, originalModelInitialize;

		originalModelInitialize = wp.api.WPApiBaseModel.prototype.initialize;
		wp.api.WPApiBaseModel.prototype.initialize = function( attributes, options ) {
			var model = this;
			manager.initializeBackboneModel.call( manager, model, attributes, options, originalModelInitialize );
		};
	},

	/**
	 * Get the ID for the Customizer setting (or control).
	 *
	 * @param {object} resource
	 * @param {object} resource._links
	 * @param {array} resource._links.self
	 * @returns {string|null}
	 */
	getCustomizeId: function( resource ) {
		var manager = this, path, customizeId;
		if ( ! resource._links || ! resource._links.self ) {
			return null;
		}

		path = resource._links.self[0].href.substr( manager.restApiRoot.length );
		customizeId = 'rest_resource[' + path + ']';
		return customizeId;
	},

	/**
	 * Create and add the setting for a given REST Resource.
	 *
	 * @param {object} resource
	 * @returns {wp.customize.Setting|null}
	 */
	ensureSetting: function( resource ) {
		var manager = this, customizeId, setting;

		customizeId = manager.getCustomizeId( resource );
		if ( ! customizeId ) {
			return null;
		}
		setting = wp.customize( customizeId );
		if ( ! setting ) {

			// Prevent embedded resources from being included in Customizer settings.
			resource = _.clone( resource );
			delete resource._embedded;

			if ( wp.customize.Setting ) {
				/*
				 * This will run in the Customizer pane.
				 * Note that the transport will get upgraded to postMessage upon the pane
				 * receiving an rest-resource-backbone-model-initialized message with
				 * the appropriate setting ID.
				 */
				setting = new wp.customize.Setting( customizeId, JSON.stringify( resource ), {
					previewer: wp.customize.previewer || null
				} );
			} else {

				// This will run in the Customizer preview.
				setting = new wp.customize.Value( JSON.stringify( resource ) );
				setting.id = customizeId;
			}
			wp.customize.add( customizeId, setting );
		}
		return setting;
	},

	/**
	 * Create the Customizer setting for any REST API model created.
	 *
	 * @param {Backbone.Model} model
	 * @param {function} model.toJSON
	 * @param {object} attributes
	 * @param {object} options
	 * @param {function} originalModelInitialize
	 */
	initializeBackboneModel: function( model, attributes, options, originalModelInitialize ) {
		var manager = this, registerSelf;

		originalModelInitialize.call( model, attributes, options );

		/**
		 * Create the Customizer setting for a given model and keep track of the
		 * model instances created for a given resource (and setting).
		 *
		 * Note that we have to cal ensureSetting() in this instance for the
		 * sake of Backbone collections/models that are pre-filled on init.
		 *
		 * @this Backbone.Model
		 */
		registerSelf = function() {
			var model = this, setting, customizeId = manager.getCustomizeId( model.attributes );
			if ( customizeId ) {
				model.customizeId = customizeId;
				setting = manager.ensureSetting( model.toJSON() );
				if ( ! manager.settingModels[ setting.id ] ) {
					manager.settingModels[ setting.id ] = [];
				}
				if ( -1 === manager.settingModels[ setting.id ].indexOf( model ) ) {
					manager.settingModels[ setting.id ].push( model );
				}
				manager.trigger( 'backbone-model-initialized', model, customizeId );
			}
		};

		// Defer registering the model until it is saved.
		if ( ! registerSelf.call( model ) ) {
			model.on( 'change:_links', function() {
				registerSelf.call( this );
			} );
		}
	}
} );

_.extend( CustomizeRestResources.RestResourcesManager.prototype, wp.customize.Events );
