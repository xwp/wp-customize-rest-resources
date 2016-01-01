/* global CustomizeRestResources, JSON, wp, jQuery, console */

/**
 * Rest Resource Manager.
 *
 * @class
 * @param {object} args
 * @param {string} args.previewNonce
 * @param {string} args.previewedTheme
 * @param {string} args.restApiRoot
 */
CustomizeRestResources.RestResourcesManager = wp.customize.Class.extend({

	initialize: function ( args ) {
		var manager = this;

		/**
		 * Customizer preview nonce.
		 *
		 * @type {string}
		 */
		manager.previewNonce = args.previewNonce;

		/**
		 * Customizer previewed theme.
		 *
		 * @type {string}
		 */
		manager.previewedTheme = args.previewedTheme;

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
		if ( 0 === _.values( wp.api.collections ).length || 0 === _.values( wp.api.models ).length ) {
			throw new Error( 'wp.api has not been initialized yet' );
		}
		_.each( [ 'restApiRoot', 'previewNonce', 'previewedTheme' ], function( key ) {
			if ( ! manager[ key ] ) {
				throw new Error( 'Missing ' + key + ' arg' );
			}
		} );

		jQuery.ajaxPrefilter( 'json', _.bind( manager.prefilterAjax, manager ) );

		manager.injectModelSync();
	},

	/**
	 * Inject logic to each model to register it among the instances of a given resource.
	 */
	injectModelSync: function() {
		var manager = this, WPApiBaseModel, originalModelInitialize;

		WPApiBaseModel = _.first( _.values( wp.api.models ) ).__super__.constructor;

		originalModelInitialize = WPApiBaseModel.prototype.initialize;
		WPApiBaseModel.prototype.initialize = function( attributes, options ) {
			var model = this;
			manager.initializeBackboneModel.call( manager, model, attributes, options, originalModelInitialize );
		};
	},

	/**
	 * Get query vars for Customize preview query.
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
		wp.customize.each( function( setting, settingId ) {
			customized[ settingId ] = wp.customize( settingId ).get();
		} );
		return {
			wp_customize: 'on',
			theme: manager.previewedTheme,
			nonce: manager.previewNonce,
			customized: JSON.stringify( customized )
		};
	},

	/**
	 * Get the ID for the Customzier setting (or control).
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
				// This will run in the Customizer pane.
				setting = new wp.customize.Setting( customizeId, JSON.stringify( resource ), {
					transport: 'postMessage',
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
				setting = manager.ensureSetting( model.toJSON() );
				if ( ! manager.settingModels[ setting.id ] ) {
					manager.settingModels[ setting.id ] = [];
				}
				if ( -1 === manager.settingModels[ setting.id ].indexOf( model ) ) {
					manager.settingModels[ setting.id ].push( model );
				}
			}
		};

		// Defer registering the model until it is saved.
		if ( ! registerSelf.call( model ) ) {
			model.on( 'change:_links', function() {
				registerSelf.call( this );
			} );
		}
	},

	/**
	 * Rewrite WP API Ajax requests to inject Customizer state.
	 *
	 * @param {object} options
	 * @param {string} options.type
	 * @param {string} options.url
	 * @param {object} originalOptions
	 * @param {object} xhr
	 */
	prefilterAjax: function( options, originalOptions, xhr ) {
		var manager = this, restMethod;

		// Abort if not API request or Customizer preview not initialized yet.
		if ( 0 !== options.url.indexOf( manager.restApiRoot ) ) {
			return;
		}

		restMethod = options.type.toUpperCase();

		if ( 'GET' !== restMethod && 'HEAD' !== restMethod && 'undefined' !== typeof console.warn ) {
			throw new Error( 'Attempted ' + restMethod + ' request for ' + options.url + ' when in Customizer. Write interception is not yet implemented.' );
		}

		// Customizer currently requires POST requests, so use override (force Backbone.emulateHTTP).
		if ( 'POST' !== restMethod ) {
			xhr.setRequestHeader( 'X-HTTP-Method-Override', restMethod );
			options.type = 'POST';
		}

		// Eliminate context param because we will be adding edit context.
		if ( ! options.data ) {
			options.data = '';
		}

		if ( options.data && 'GET' === restMethod ) {
			/*
			 * Make sure the query vars for the REST API persist in GET (since
			 * REST API explicitly look at $_GET['filter']).
			 * We have to make sure the REST query vars are added as GET params
			 * when the method is GET as otherwise they won't be parsed properly.
			 * The issue lies in \WP_REST_Request::get_parameter_order() which
			 * only is looking at \WP_REST_Request::$method instead of $_SERVER['REQUEST_METHOD'].
			 * @todo Improve \WP_REST_Request::get_parameter_order() to be more aware of X-HTTP-Method-Override
			 */
			if ( options.url.indexOf( '?' ) === -1 ) {
				options.url += '?';
			} else {
				options.url += '&';
			}
			options.url += options.data;
		}

		// Add Customizer post data.
		if ( options.data ) {
			options.data += '&';
		}
		options.data += jQuery.param( manager.getCustomizeQueryVars() );
	}
} );
