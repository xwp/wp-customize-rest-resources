/* global JSON, wp, jQuery, console, _customizeRestResourcesExports */

/**
 * Rest Resource Manager.
 *
 * @class
 * @param {object} args
 * @param {wp.customize.Values} args.customizeApi
 * @param {object} args.restApi
 * @param {object} args.restApiSettings
 * @param {string} args.previewNonce
 * @param {string} args.previewedTheme
 * @param {string} args.restApiRoot
 * @param {string} args.restApiNonce
 * @todo @param {object} args.customizeApiSettings ???
 * @todo @param {string} args.customizeApiSettings.nonce ???
 * @todo @param {string} args.customizeApiSettings.theme ???
 */
wp.customize.RestResourcesManager = wp.customize.Class.extend({

	initialize: function ( args ) {
		var manager = this;

		/**
		 * The wp.customize object.
		 *
		 * @type {wp.customize.Values} customizeApi - wp.customize.
		 */
		manager.customizeApi = args.customizeApi;

		/**
		 * The settings for the Customizer.
		 *
		 * @see wp.customize.settings
		 *
		 * @type {object} customizeApiSettings
		 * @type {string} customizeApiSettings.nonce - Preview nonce.
		 * @type {string} customizeApiSettings.theme - Previewed theme.
		 */
		//@todo manager.customizeApiSettings = args.customizeApiSettings; ???

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
		 * The wp.api object.
		 *
		 * @type {object} restApi - wp.api object.
		 * @type {object.<string, Backbone.Collection>} restApi.collections - Collections.
		 * @type {object.<string, Backbone.Model>} restApi.models - Models.
		 */
		manager.restApi = args.restApi;

		/**
		 * WP_API_Settings
		 *
		 * @see rest_register_scripts() in PHP.
		 *
		 * @type {object} restApiSettings - WP_API_Settings.
		 * @type {string} restApiSettings.nonce - Nonce.
		 * @type {string} restApiSettings.root - API root URL.
		 */
		//@todo manager.restApiSettings = args.restApiSettings;  ???

		/**
		 * REST API Root URL.
		 *
		 * @type {string}
		 */
		manager.restApiRoot = args.restApiRoot;

		/**
		 * REST API Nonce.
		 *
		 * @todo Do we even need this?
		 *
		 * @type {string}
		 */
		manager.restApiNonce = args.restApiNonce;

		if ( ! manager.restApi || 0 === _.values( manager.restApi.collections ).length || 0 === _.values( manager.restApi.models ).length ) {
			throw new Error( 'wp.api has not been initialized yet' );
		}

		manager.init();
	},

	init: function() {
		var manager = this;
		jQuery.ajaxPrefilter( 'json', _.bind( manager.prefilterAjax, manager ) );

		// @todo
		//wp.customize.bind( 'add', self.notifyDirtySetting );
		//wp.customize.bind( 'change', self.notifyDirtySetting );
		//wp.customize.bind( 'saved', self.notifyDirtySettings );
		//wp.customize.previewer.bind( 'previewedRestResource', self.ensureResourceSettingAndControl  );
	},

	injectCollectionSync: function() {
		var manager = this;
		_.each( this.restApi.collections, function( collection ) {
			manager.customizeCollection( collection );
		} );
	},

	/**
	 * Extend a WP API Backbone collection to integrate with the Customizer.
	 *
	 * @param {Backbone.Collection} collection
	 */
	customizeCollection: function ( collection ) {
		var oldInitialize = collection.prototype.initialize;
		collection.prototype.initialize = function () {
			var collection = this;
			oldInitialize.apply( collection, arguments );
			collection.on( 'add', function( model, collection, options ) {
				console.info( 'added', model );
				// @todo Make sure that
			} );

		};
	},

	/**
	 * Get the customized data to send in the request.
	 *
	 * Note that this should be overridden by a subclass to only include dirty settings.
	 *
	 * @returns {object}
	 */
	getCustomizedData: function() {
		var manager = this, customized = {};
		manager.customizeApi.each( function( setting, settingId ) {
			customized[ settingId ] = wp.customize( settingId ).get();
		} );
		return customized;
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
		var manager = this;
		return {
			wp_customize: 'on',
			theme: manager.customizeApiSettings.theme,
			customized: JSON.stringify( manager.getCustomizedData() ),
			nonce: manager.customizeApiSettings.nonce
		};
	},

	/**
	 * Rewrite WP API Ajax requests to inject Customizer state.
	 *
	 * @todo This can be in base??
	 *
	 * @param {object} options
	 * @param {string} options.type
	 * @param {string} options.url
	 * @param {object} originalOptions
	 * @param {object} xhr
	 */
	prefilterAjax: function( options, originalOptions, xhr ) {
		var manager = this;

		// Abort if not API request or Customizer preview not initialized yet.
		if ( 0 !== options.url.indexOf( manager.restApiRoot ) ) {
			return;
		}

		if ( 'GET' !== options.type && 'HEAD' !== options.type && 'undefined' !== typeof console.warn ) {
			console.warn( 'Performing write request to WP API in Customizer.' );
		}

		// Customizer currently requires POST requests, so use override (force Backbone.emulateHTTP).
		if ( 'POST' !== options.type ) {
			xhr.setRequestHeader( 'X-HTTP-Method-Override', options.type );
			options.type = 'POST';
		}

		// Include Customizer preview data.
		if ( options.data ) {
			options.data += '&';
		}

		options.data += jQuery.param( manager.getCustomizeQueryVars() );
		//
		//if ( self.preview ) {
		//	options.data += $.param( self.preview.getCustomizedQueryVars() );
		//} else if ( self.controls ) {
		//	options.data += $.param( wp.customize.previewer.query() );
		//}

	}
} );
